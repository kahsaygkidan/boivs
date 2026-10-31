package dashen.bank.boivs.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dashen.bank.boivs.domain.BeneficialOwner;
import dashen.bank.boivs.domain.LegalPerson;
import dashen.bank.boivs.domain.OwnershipNode;
import dashen.bank.boivs.domain.enums.AuditAction;
import dashen.bank.boivs.domain.enums.BoStatus;
import dashen.bank.boivs.domain.enums.ControlBasis;
import dashen.bank.boivs.domain.enums.EntityType;
import dashen.bank.boivs.domain.enums.LegalDocType;
import dashen.bank.boivs.domain.enums.NodeType;
import dashen.bank.boivs.domain.enums.OwnershipType;
import dashen.bank.boivs.dto.NodeControlRequest;
import dashen.bank.boivs.dto.OwnershipNodeRequest;
import dashen.bank.boivs.dto.OwnershipTreeResponse;
import dashen.bank.boivs.dto.OwnershipTreeResponse.Holder;
import dashen.bank.boivs.dto.OwnershipTreeResponse.NodeView;
import dashen.bank.boivs.dto.OwnershipTreeResponse.OwnershipPath;
import dashen.bank.boivs.dto.OwnershipTreeResponse.SeniorManagingOfficial;
import dashen.bank.boivs.dto.SeniorManagingOfficialRequest;
import dashen.bank.boivs.exception.ConflictException;
import dashen.bank.boivs.exception.InvalidWorkflowStateException;
import dashen.bank.boivs.exception.NotFoundException;
import dashen.bank.boivs.repository.BeneficialOwnerRepository;
import dashen.bank.boivs.repository.LegalPersonDocumentRepository;
import dashen.bank.boivs.repository.LegalPersonRepository;
import dashen.bank.boivs.repository.OwnershipNodeRepository;
import dashen.bank.boivs.security.CurrentUser;
import dashen.bank.boivs.service.BoThresholdPolicy.Criterion;
import dashen.bank.boivs.service.BoThresholdPolicy.Stake;

/**
 * Multi-layer UBO tracing. A customer's shareholders are stored as a tree; companies are traced
 * through every intermediate layer until natural persons are reached. Effective (indirect) ownership
 * is the product of the percentages along each path, summed per natural person across all branches.
 * A person is a UBO if the aggregated stake reaches the threshold for the customer's entity type and
 * sector (Regulation 592/2026, see BoThresholdPolicy) OR a control basis is recorded.
 */
@Service
public class OwnershipStructureService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int CALC_SCALE = 8;
    private static final String ROOT = "__ROOT__";

    private final OwnershipNodeRepository nodeRepository;
    private final LegalPersonRepository legalPersonRepository;
    private final LegalPersonService legalPersonService;
    private final BeneficialOwnerRepository boRepository;
    private final CurrentUser currentUser;
    private final AuditService auditService;
    private final BoThresholdPolicy thresholdPolicy;
    private final LegalPersonDocumentRepository documentRepository;

    public OwnershipStructureService(OwnershipNodeRepository nodeRepository,
                                     LegalPersonRepository legalPersonRepository,
                                     LegalPersonService legalPersonService,
                                     BeneficialOwnerRepository boRepository,
                                     CurrentUser currentUser,
                                     AuditService auditService,
                                     BoThresholdPolicy thresholdPolicy,
                                     LegalPersonDocumentRepository documentRepository) {
        this.nodeRepository = nodeRepository;
        this.legalPersonRepository = legalPersonRepository;
        this.legalPersonService = legalPersonService;
        this.boRepository = boRepository;
        this.currentUser = currentUser;
        this.auditService = auditService;
        this.thresholdPolicy = thresholdPolicy;
        this.documentRepository = documentRepository;
    }

    /** What the BO record must be populated with when created from a node of the tree. */
    public record Derivation(
            String chain,
            BigDecimal effectivePercentage,
            OwnershipType ownershipType,
            List<ControlBasis> controlBasis,
            boolean qualifiesByOwnership,
            boolean qualifiesByControl,
            /** Threshold applied to this customer; null for a One Member PLC (no percentage test). */
            BigDecimal threshold) {

    }

    /* ======================================================================
       Public API
       ====================================================================== */
    @Transactional(readOnly = true)
    public OwnershipTreeResponse getTree(String legalPersonId) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        List<OwnershipNode> nodes = nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId);
        Computation c = compute(lp, nodes);

        Map<String, String> boRefs = boReferences(c);
        List<Holder> holders = c.holders.values().stream()
                .map(h -> toHolder(h, boRefs, c))
                .sorted(Comparator.comparing(Holder::effectivePercentage).reversed())
                .toList();
        Set<String> uboKeys = holders.stream().filter(Holder::ubo).map(Holder::key).collect(Collectors.toSet());

        List<NodeView> roots = c.children.getOrDefault(ROOT, List.of()).stream()
                .map(n -> view(n, c, uboKeys)).toList();

        boolean fallbackAllowed = uboKeys.isEmpty();
        SeniorManagingOfficial smo = lp.getSmoName() == null ? null
                : new SeniorManagingOfficial(lp.getSmoName(), lp.getSmoPosition(), lp.getSmoJustification());

        return new OwnershipTreeResponse(lp.getId(), lp.getName(), lp.getRegistrationNumber(), c.rule.threshold(),
                roots, holders, c.warnings, fallbackAllowed, smo);
    }

    @Transactional
    public OwnershipTreeResponse addNode(String legalPersonId, OwnershipNodeRequest req) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        List<OwnershipNode> existing = nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId);

        OwnershipNode parent = null;
        if (req.parentId() != null && !req.parentId().isBlank()) {
            parent = existing.stream().filter(n -> n.getId().equals(req.parentId())).findFirst()
                    .orElseThrow(() -> new NotFoundException("Parent shareholder not found in this structure"));
            if (parent.getNodeType() != NodeType.COMPANY) {
                throw new InvalidWorkflowStateException("Only a company can have shareholders; '"
                        + parent.getName() + "' is a natural person");
            }
        }
        String parentId = parent == null ? null : parent.getId();

        boolean individual = req.nodeType() == NodeType.INDIVIDUAL;
        List<ControlBasis> controls = individual && req.controlBasis() != null
                ? req.controlBasis().stream().distinct().toList() : List.of();
        BigDecimal pct = req.ownershipPercentage();
        if (pct.signum() == 0 && controls.isEmpty() && !hasSeparateStake(req)) {
            throw new InvalidWorkflowStateException(
                    "Ownership percentage must be greater than 0 unless a control basis or a separate profit, "
                            + "dissolution, voting or convertible-debt stake is recorded");
        }

        BigDecimal siblings = existing.stream()
                .filter(n -> Objects.equals(n.getParentId(), parentId))
                .map(OwnershipNode::getOwnershipPercentage)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (siblings.add(pct).compareTo(HUNDRED) > 0) {
            String owner = parent == null ? lp.getName() : parent.getName();
            throw new InvalidWorkflowStateException("Shareholdings in '" + owner + "' would total "
                    + siblings.add(pct).stripTrailingZeros().toPlainString() + "%, which exceeds 100%");
        }

        BoThresholdPolicy.Rule rule = thresholdPolicy.resolve(lp.getEntityType(), lp.getSector());
        validateCriteriaFor(rule, req, individual);
        String where = parent == null ? lp.getName() : parent.getName();
        checkCriterionTotal("Profit entitlement", existing, parentId, req.profitPercentage(), pct,
                OwnershipNode::getProfitPercentage, where);
        checkCriterionTotal("Share of assets on dissolution", existing, parentId, req.dissolutionPercentage(), pct,
                OwnershipNode::getDissolutionPercentage, where);
        checkCriterionTotal("Voting rights", existing, parentId, req.votingPercentage(), pct,
                OwnershipNode::getVotingPercentage, where);

        OwnershipNode n = new OwnershipNode();
        n.setLegalPersonId(legalPersonId);
        n.setParentId(parentId);
        n.setNodeType(req.nodeType());
        n.setName(req.name().trim());
        n.setOwnershipPercentage(pct);
        n.setProfitPercentage(req.profitPercentage());
        n.setDissolutionPercentage(req.dissolutionPercentage());
        n.setVotingPercentage(req.votingPercentage());
        n.setConvertibleDebtPercentage(req.convertibleDebtPercentage());
        n.setPreferentialShares(Boolean.TRUE.equals(req.preferentialShares()) ? Boolean.TRUE : null);
        n.setJointGroup(individual ? blankToNull(req.jointGroup()) : null);
        n.setCreatedBy(currentUser.username());
        if (individual) {
            n.setIdNumber(blankToNull(req.idNumber()));
            n.setNationality(blankToNull(req.nationality()));
            n.setControlBasis(controls.isEmpty() ? null
                    : controls.stream().map(Enum::name).collect(Collectors.joining(",")));
            n.setControlNotes(blankToNull(req.controlNotes()));
        } else {
            n.setRegistrationNumber(blankToNull(req.registrationNumber()));
        }
        nodeRepository.save(n);

        auditService.record("LEGAL_PERSON", lp.getRegistrationNumber(), AuditAction.OWNERSHIP_NODE_ADDED,
                "Added " + req.nodeType() + " '" + n.getName() + "' (" + pct.stripTrailingZeros().toPlainString()
                        + "%) under '" + (parent == null ? lp.getName() : parent.getName()) + "'");
        return getTree(legalPersonId);
    }

    @Transactional
    public OwnershipTreeResponse deleteNode(String legalPersonId, String nodeId) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        List<OwnershipNode> all = nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId);
        OwnershipNode target = all.stream().filter(n -> n.getId().equals(nodeId)).findFirst()
                .orElseThrow(() -> new NotFoundException("Ownership node not found: " + nodeId));

        // Collect the branch breadth-first, then delete deepest-first.
        List<OwnershipNode> branch = new ArrayList<>();
        branch.add(target);
        for (int i = 0; i < branch.size(); i++) {
            String id = branch.get(i).getId();
            all.stream().filter(n -> id.equals(n.getParentId())).forEach(branch::add);
        }
        if (branch.stream().anyMatch(n -> n.getBeneficialOwnerId() != null)) {
            throw new ConflictException(
                    "A beneficial owner record has been registered from this branch; it cannot be removed");
        }
        List<OwnershipNode> deepestFirst = new ArrayList<>(branch);
        java.util.Collections.reverse(deepestFirst);
        nodeRepository.deleteAll(deepestFirst);

        auditService.record("LEGAL_PERSON", lp.getRegistrationNumber(), AuditAction.OWNERSHIP_NODE_REMOVED,
                "Removed '" + target.getName() + "'" + (branch.size() > 1 ? " and " + (branch.size() - 1)
                        + " shareholder(s) beneath it" : ""));
        return getTree(legalPersonId);
    }

    /** Step "examine control": sets the control basis of a natural person on all branches they appear in. */
    @Transactional
    public OwnershipTreeResponse updateControl(String legalPersonId, String nodeId, NodeControlRequest req) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        List<OwnershipNode> nodes = nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId);
        OwnershipNode target = nodes.stream().filter(n -> n.getId().equals(nodeId)).findFirst()
                .orElseThrow(() -> new NotFoundException("Ownership node not found: " + nodeId));
        if (target.getNodeType() != NodeType.INDIVIDUAL) {
            throw new InvalidWorkflowStateException("Control basis can only be recorded for a natural person");
        }
        String key = holderKey(target);
        List<OwnershipNode> samePerson = nodes.stream()
                .filter(n -> n.getNodeType() == NodeType.INDIVIDUAL && holderKey(n).equals(key)).toList();
        if (samePerson.stream().anyMatch(n -> n.getBeneficialOwnerId() != null)) {
            throw new ConflictException(
                    "A beneficial owner record has already been registered for this person; control can no longer be changed");
        }
        List<ControlBasis> controls = req.controlBasis() == null ? List.of() : req.controlBasis().stream().distinct().toList();
        if (controls.isEmpty() && samePerson.stream().allMatch(n -> n.getOwnershipPercentage().signum() == 0)) {
            throw new InvalidWorkflowStateException(
                    "This person holds no shares, so a control basis is required (or remove them from the structure)");
        }
        String csv = controls.isEmpty() ? null : controls.stream().map(Enum::name).collect(Collectors.joining(","));
        for (OwnershipNode n : samePerson) {
            n.setControlBasis(csv);
            if (req.controlNotes() != null) {
                n.setControlNotes(blankToNull(req.controlNotes()));
            }
            nodeRepository.save(n);
        }
        auditService.record("LEGAL_PERSON", lp.getRegistrationNumber(), AuditAction.OWNERSHIP_CONTROL_UPDATED,
                "Control basis of '" + target.getName() + "' set to " + (csv == null ? "none" : csv));
        return getTree(legalPersonId);
    }

    /** CDD fallback; only allowed when no natural person qualifies as UBO. */
    @Transactional
    public OwnershipTreeResponse saveSeniorManagingOfficial(String legalPersonId, SeniorManagingOfficialRequest req) {
        requireFallbackAllowed(legalPersonId);
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        lp.setSmoName(req.name().trim());
        lp.setSmoPosition(req.position().trim());
        lp.setSmoJustification(req.justification().trim());
        legalPersonRepository.save(lp);
        auditService.record("LEGAL_PERSON", lp.getRegistrationNumber(),
                AuditAction.SENIOR_MANAGING_OFFICIAL_RECORDED,
                "Recorded senior managing official '" + lp.getSmoName() + "' (" + lp.getSmoPosition()
                        + ") as CDD fallback");
        return getTree(legalPersonId);
    }

    @Transactional(readOnly = true)
    public void requireFallbackAllowed(String legalPersonId) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        Computation c = compute(lp, nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId));
        boolean anyUbo = c.holders.values().stream().anyMatch(h -> isUbo(h, c));
        if (anyUbo) {
            throw new InvalidWorkflowStateException("A natural-person UBO has been identified for this customer; "
                    + "the senior managing official fallback does not apply");
        }
    }

    /** Calculates the BO record values for a natural person in the tree. Also guards against duplicates. */
    @Transactional(readOnly = true)
    public Derivation derive(String legalPersonId, String nodeId) {
        LegalPerson lp = legalPersonService.getById(legalPersonId);
        List<OwnershipNode> nodes = nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(legalPersonId);
        OwnershipNode node = nodes.stream().filter(n -> n.getId().equals(nodeId)).findFirst().orElse(null);
        if (node == null || node.getNodeType() != NodeType.INDIVIDUAL) {
            throw new InvalidWorkflowStateException(
                    "The selected shareholder must be a natural person in this customer's ownership structure");
        }
        Computation c = compute(lp, nodes);
        HolderAcc acc = c.holders.get(c.nodeToHolder.get(nodeId));
        if (acc == null) {
            throw new InvalidWorkflowStateException("The selected person is not connected to the customer");
        }

        for (OwnershipNode n : acc.nodes) {
            if (n.getBeneficialOwnerId() == null) {
                continue;
            }
            BeneficialOwner bo = boRepository.findById(n.getBeneficialOwnerId()).orElse(null);
            if (bo != null && (bo.getStatus() == BoStatus.DRAFT || bo.getStatus() == BoStatus.PENDING
                    || bo.getStatus() == BoStatus.VERIFIED)) {
                throw new ConflictException("A beneficial owner record (" + bo.getBoReference()
                        + ") already exists for this person under this customer");
            }
        }

        BigDecimal total = acc.total.min(HUNDRED).setScale(2, RoundingMode.HALF_UP);
        boolean ownership = thresholdPolicy.qualifiesByOwnership(c.rule, effectiveStake(acc, c));
        boolean control = !acc.controls.isEmpty();
        OwnershipType type = total.signum() == 0
                ? (acc.controls.contains(ControlBasis.VOTING_RIGHTS) ? OwnershipType.VOTING_RIGHTS : OwnershipType.CONTROL_BY_OTHER_MEANS)
                : (acc.paths.size() == 1 && acc.maxDepth == 1 ? OwnershipType.DIRECT : OwnershipType.INDIRECT);

        String chain = acc.paths.stream()
                .map(p -> p.chain() + " = " + p.percentage().stripTrailingZeros().toPlainString() + "%")
                .collect(Collectors.joining("\n"));
        if (chain.length() > 2000) {
            chain = chain.substring(0, 1997) + "...";
        }
        return new Derivation(chain, total, type, List.copyOf(acc.controls), ownership, control, c.rule.threshold());
    }

    @Transactional
    public void markLinked(String nodeId, String beneficialOwnerId) {
        nodeRepository.findById(nodeId).ifPresent(n -> {
            n.setBeneficialOwnerId(beneficialOwnerId);
            nodeRepository.save(n);
        });
    }

    /* ======================================================================
       Calculation
       ====================================================================== */
    private static final class HolderAcc {

        String key;
        String name;
        String idNumber;
        String nationality;
        BigDecimal total = BigDecimal.ZERO;
        Stake stake = Stake.zero();
        String jointGroup;
        int maxDepth = 0;
        final List<OwnershipNode> nodes = new ArrayList<>();
        final Set<ControlBasis> controls = EnumSet.noneOf(ControlBasis.class);
        final List<OwnershipPath> paths = new ArrayList<>();
    }

    private static final class Computation {

        final Map<String, List<OwnershipNode>> children = new HashMap<>();
        final Map<String, BigDecimal> effective = new HashMap<>();
        final Map<String, BigDecimal> untraced = new HashMap<>();
        final Map<String, HolderAcc> holders = new LinkedHashMap<>();
        final Map<String, String> nodeToHolder = new HashMap<>();
        final List<String> warnings = new ArrayList<>();
        BoThresholdPolicy.Rule rule;
    }

    private Computation compute(LegalPerson lp, List<OwnershipNode> nodes) {
        Computation c = new Computation();
        c.rule = thresholdPolicy.resolve(lp.getEntityType(), lp.getSector());
        for (OwnershipNode n : nodes) {
            c.children.computeIfAbsent(n.getParentId() == null ? ROOT : n.getParentId(), k -> new ArrayList<>()).add(n);
        }
        if (nodes.isEmpty()) {
            c.warnings.add("No shareholders recorded yet. Add the customer's shareholders and trace each company "
                    + "down to the natural person(s).");
            return c;
        }
        walk(ROOT, lp.getName(), Stake.root(), lp.getName(), 0, c, new HashSet<>());
        return c;
    }

    private void walk(String parentKey, String parentName, Stake parentStake, String parentChain,
                      int depth, Computation c, Set<String> visited) {
        BigDecimal parentEffective = parentStake.ownership();
        BigDecimal childSum = BigDecimal.ZERO;
        for (OwnershipNode n : c.children.getOrDefault(parentKey, List.of())) {
            if (!visited.add(n.getId())) {
                continue; // defensive: never loop on corrupt data
            }
            childSum = childSum.add(n.getOwnershipPercentage());
            BigDecimal eff = parentEffective.multiply(n.getOwnershipPercentage())
                    .divide(HUNDRED, CALC_SCALE, RoundingMode.HALF_UP);
            String chain = parentChain + " → " + n.getName() + " (" + fmt(n.getOwnershipPercentage()) + "%)";
            Stake stake = parentStake.through(n.getOwnershipPercentage(), n.getProfitPercentage(),
                    n.getDissolutionPercentage(), n.getVotingPercentage(), n.getConvertibleDebtPercentage(),
                    Boolean.TRUE.equals(n.getPreferentialShares()));
            c.effective.put(n.getId(), eff);

            if (n.getNodeType() == NodeType.COMPANY) {
                walk(n.getId(), n.getName(), stake, chain, depth + 1, c, visited);
            } else {
                String key = holderKey(n);
                HolderAcc acc = c.holders.computeIfAbsent(key, k -> {
                    HolderAcc a = new HolderAcc();
                    a.key = k;
                    a.name = n.getName();
                    a.idNumber = n.getIdNumber();
                    a.nationality = n.getNationality();
                    return a;
                });
                acc.total = acc.total.add(eff);
                acc.stake = acc.stake.plus(stake);
                if (acc.jointGroup == null && n.getJointGroup() != null && !n.getJointGroup().isBlank()) {
                    acc.jointGroup = n.getJointGroup().trim();
                }
                acc.maxDepth = Math.max(acc.maxDepth, depth + 1);
                acc.nodes.add(n);
                acc.controls.addAll(parseControls(n.getControlBasis()));
                acc.paths.add(new OwnershipPath(chain, eff.setScale(2, RoundingMode.HALF_UP)));
                c.nodeToHolder.put(n.getId(), key);
            }
        }

        BigDecimal untraced = HUNDRED.subtract(childSum);
        if (ROOT.equals(parentKey)) {
            if (untraced.signum() > 0) {
                c.warnings.add(fmt(untraced) + "% of '" + parentName
                        + "' is not yet attributed to any shareholder.");
            }
        } else {
            c.untraced.put(parentKey, untraced);
            if (untraced.signum() > 0) {
                BigDecimal ofCustomer = parentEffective.multiply(untraced).divide(HUNDRED, 2, RoundingMode.HALF_UP);
                c.warnings.add(childSum.signum() == 0
                        ? "'" + parentName + "' has no shareholders recorded: keep tracing to the natural person(s) (up to "
                        + ofCustomer.stripTrailingZeros().toPlainString() + "% of the customer)."
                        : "'" + parentName + "': " + fmt(untraced) + "% of its shares are not yet traced (about "
                        + ofCustomer.stripTrailingZeros().toPlainString() + "% of the customer).");
            }
        }
    }

    /**
     * The stake tested against the rule: the person's own stake, or - where joint ownership applies and the
     * person holds jointly - the combined stake of every member of their joint group. Preferential shares
     * always stay personal to the holder.
     */
    private Stake effectiveStake(HolderAcc h, Computation c) {
        if (!c.rule.jointAllowed() || h.jointGroup == null) {
            return h.stake;
        }
        Stake sum = Stake.zero();
        for (HolderAcc o : c.holders.values()) {
            if (o.jointGroup != null && o.jointGroup.equalsIgnoreCase(h.jointGroup)) {
                sum = sum.plus(o.stake);
            }
        }
        return new Stake(sum.ownership(), sum.profit(), sum.dissolution(), sum.voting(), sum.convertibleDebt(),
                h.stake.preferentialShares());
    }

    private boolean isUbo(HolderAcc h, Computation c) {
        return thresholdPolicy.qualifiesByOwnership(c.rule, effectiveStake(h, c)) || !h.controls.isEmpty();
    }

    private Holder toHolder(HolderAcc h, Map<String, String> boRefs, Computation c) {
        BigDecimal total = h.total.min(HUNDRED).setScale(2, RoundingMode.HALF_UP);
        OwnershipNode linked = h.nodes.stream().filter(n -> n.getBeneficialOwnerId() != null).findFirst().orElse(null);
        String boId = linked == null ? null : linked.getBeneficialOwnerId();
        String ref = boId == null ? null : boRefs.get(boId);
        Stake eff = effectiveStake(h, c);
        Set<Criterion> met = thresholdPolicy.qualifyingCriteria(c.rule, eff);
        boolean byControl = !h.controls.isEmpty();
        boolean joint = c.rule.jointAllowed() && h.jointGroup != null;
        return new Holder(h.key, h.name, h.idNumber, h.nationality, total,
                !met.isEmpty(), byControl, !met.isEmpty() || byControl,
                List.copyOf(h.controls), List.copyOf(h.paths),
                (linked != null ? linked : h.nodes.get(0)).getId(), ref != null, boId, ref,
                joint ? h.jointGroup : null,
                joint ? eff.ownership().min(HUNDRED).setScale(2, RoundingMode.HALF_UP) : null,
                met.stream().map(Enum::name).toList());
    }

    private Map<String, String> boReferences(Computation c) {
        Set<String> ids = c.holders.values().stream().flatMap(h -> h.nodes.stream())
                .map(OwnershipNode::getBeneficialOwnerId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, String> refs = new HashMap<>();
        for (BeneficialOwner bo : boRepository.findAllById(ids)) {
            if (bo.getStatus() != BoStatus.REJECTED && bo.getStatus() != BoStatus.CEASED) {
                refs.put(bo.getId(), bo.getBoReference());
            }
        }
        return refs;
    }

    private NodeView view(OwnershipNode n, Computation c, Set<String> uboKeys) {
        List<NodeView> kids = n.getNodeType() == NodeType.COMPANY
                ? c.children.getOrDefault(n.getId(), List.of()).stream().map(k -> view(k, c, uboKeys)).toList()
                : List.of();
        BigDecimal eff = c.effective.getOrDefault(n.getId(), BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        boolean ubo = n.getNodeType() == NodeType.INDIVIDUAL && uboKeys.contains(holderKey(n));
        return new NodeView(n.getId(), n.getParentId(), n.getNodeType(), n.getName(), n.getRegistrationNumber(),
                n.getIdNumber(), n.getNationality(), n.getOwnershipPercentage(), eff,
                n.getNodeType() == NodeType.COMPANY ? c.untraced.get(n.getId()) : null,
                parseControls(n.getControlBasis()).stream().toList(), n.getControlNotes(), ubo,
                n.getBeneficialOwnerId(), kids);
    }

    /* ======================================================================
       Entity-specific rules
       ====================================================================== */
    private static boolean hasSeparateStake(OwnershipNodeRequest req) {
        return positive(req.profitPercentage()) || positive(req.dissolutionPercentage())
                || positive(req.votingPercentage()) || positive(req.convertibleDebtPercentage())
                || Boolean.TRUE.equals(req.preferentialShares());
    }

    private static boolean positive(BigDecimal v) {
        return v != null && v.signum() > 0;
    }

    /** Rejects holding criteria that do not apply to the customer's entity type, and misused joint groups. */
    private static void validateCriteriaFor(BoThresholdPolicy.Rule rule, OwnershipNodeRequest req, boolean individual) {
        Set<Criterion> crit = rule.criteria();
        if (req.profitPercentage() != null && !crit.contains(Criterion.PROFIT)) {
            throw new InvalidWorkflowStateException(
                    "Profit entitlement is only recorded for partnerships and limited liability partnerships");
        }
        if (req.dissolutionPercentage() != null && !crit.contains(Criterion.DISSOLUTION)) {
            throw new InvalidWorkflowStateException(
                    "Share of assets on dissolution is only recorded for partnerships, LLPs and PPPs");
        }
        if (req.votingPercentage() != null && !crit.contains(Criterion.VOTING)) {
            throw new InvalidWorkflowStateException(
                    "Voting rights are only recorded separately for general and limited partnerships");
        }
        if (req.convertibleDebtPercentage() != null && req.convertibleDebtPercentage().signum() > 0
                && !crit.contains(Criterion.CONVERTIBLE_DEBT)) {
            throw new InvalidWorkflowStateException(
                    "Convertible equity debt is only recorded for share companies and financial institutions");
        }
        if (Boolean.TRUE.equals(req.preferentialShares()) && !crit.contains(Criterion.PREFERENTIAL_SHARES)) {
            throw new InvalidWorkflowStateException("Preferential shares apply only to share companies");
        }
        if (req.jointGroup() != null && !req.jointGroup().isBlank()) {
            if (!rule.jointAllowed()) {
                throw new InvalidWorkflowStateException(
                        "Joint ownership applies only to share companies, private limited companies and financial institutions");
            }
            if (!individual) {
                throw new InvalidWorkflowStateException("Only natural persons can be placed in a joint holding group");
            }
        }
    }

    /** Direct stakes of one criterion under the same parent must not exceed 100% (unspecified = ownership %). */
    private static void checkCriterionTotal(String label, List<OwnershipNode> existing, String parentId,
                                            BigDecimal newValue, BigDecimal newOwnership,
                                            Function<OwnershipNode, BigDecimal> getter, String owner) {
        BigDecimal incoming = newValue == null ? newOwnership : newValue;
        BigDecimal total = existing.stream()
                .filter(n -> Objects.equals(n.getParentId(), parentId))
                .map(n -> getter.apply(n) == null ? n.getOwnershipPercentage() : getter.apply(n))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(incoming);
        if (total.compareTo(HUNDRED) > 0) {
            throw new InvalidWorkflowStateException(label + " in '" + owner + "' would total "
                    + total.stripTrailingZeros().toPlainString() + "%, which exceeds 100%");
        }
    }

    /**
     * Preconditions for submitting a beneficial-owner record for verification:
     * foreign legal person -> country of registration + home-jurisdiction document;
     * One Member PLC -> both the owner and the general manager / controlling person identified as BOs.
     */
    @Transactional(readOnly = true)
    public void requireSubmissionPrerequisites(LegalPerson lp, boolean checkOwnerAndManager) {
        if (lp.getEntityType() == EntityType.FOREIGN_LEGAL_PERSON) {
            if (lp.getCountryOfIncorporation() == null || lp.getCountryOfIncorporation().isBlank()) {
                throw new InvalidWorkflowStateException(
                        "A foreign legal person requires its country of registration before a record can be submitted");
            }
            if (!documentRepository.existsByLegalPersonIdAndDocType(lp.getId(), LegalDocType.FOREIGN_HOME_DOCUMENT)) {
                throw new InvalidWorkflowStateException("A foreign legal person's beneficial ownership information must be "
                        + "supported by a home-jurisdiction document, attestation or authentication - upload it first");
            }
        }
        if (checkOwnerAndManager) {
            Computation c = compute(lp, nodeRepository.findByLegalPersonIdOrderByCreatedAtAsc(lp.getId()));
            if (c.rule.mode() == BoThresholdPolicy.Mode.OWNER_PLUS_MANAGER
                    && c.holders.values().stream().filter(h -> isUbo(h, c)).count() < 2) {
                throw new InvalidWorkflowStateException("A one member PLC needs both the owner and the general manager "
                        + "(or other controlling person) identified as beneficial owners in the ownership structure "
                        + "before a record can be submitted");
            }
        }
    }

    /* ======================================================================
       Helpers
       ====================================================================== */
    /** The same person in several branches is aggregated by ID number, falling back to name. */
    private static String holderKey(OwnershipNode n) {
        return n.getIdNumber() != null && !n.getIdNumber().isBlank()
                ? "id:" + n.getIdNumber().trim().toLowerCase()
                : "name:" + n.getName().trim().toLowerCase();
    }

    private static Set<ControlBasis> parseControls(String csv) {
        Set<ControlBasis> set = EnumSet.noneOf(ControlBasis.class);
        if (csv != null && !csv.isBlank()) {
            for (String s : csv.split(",")) {
                set.add(ControlBasis.valueOf(s.trim()));
            }
        }
        return set;
    }

    private static String fmt(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}