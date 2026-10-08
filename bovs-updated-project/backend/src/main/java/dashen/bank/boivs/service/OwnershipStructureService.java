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
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import dashen.bank.boivs.domain.BeneficialOwner;
import dashen.bank.boivs.domain.LegalPerson;
import dashen.bank.boivs.domain.OwnershipNode;
import dashen.bank.boivs.domain.enums.AuditAction;
import dashen.bank.boivs.domain.enums.BoStatus;
import dashen.bank.boivs.domain.enums.ControlBasis;
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
import dashen.bank.boivs.repository.LegalPersonRepository;
import dashen.bank.boivs.repository.OwnershipNodeRepository;
import dashen.bank.boivs.security.CurrentUser;

/**
 * Multi-layer UBO tracing. A customer's shareholders are stored as a tree; companies are traced
 * through every intermediate layer until natural persons are reached. Effective (indirect) ownership
 * is the product of the percentages along each path, summed per natural person across all branches.
 * A person is a UBO if the aggregated stake reaches the threshold OR a control basis is recorded.
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
    private final BigDecimal threshold;

    public OwnershipStructureService(OwnershipNodeRepository nodeRepository,
            LegalPersonRepository legalPersonRepository,
            LegalPersonService legalPersonService,
            BeneficialOwnerRepository boRepository,
            CurrentUser currentUser,
            AuditService auditService,
            @Value("${bovs.ubo.ownership-threshold:25}") BigDecimal threshold) {
        this.nodeRepository = nodeRepository;
        this.legalPersonRepository = legalPersonRepository;
        this.legalPersonService = legalPersonService;
        this.boRepository = boRepository;
        this.currentUser = currentUser;
        this.auditService = auditService;
        this.threshold = threshold;
    }

    /** What the BO record must be populated with when created from a node of the tree. */
    public record Derivation(
            String chain,
            BigDecimal effectivePercentage,
            OwnershipType ownershipType,
            List<ControlBasis> controlBasis,
            boolean qualifiesByOwnership,
            boolean qualifiesByControl) {

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
                .map(h -> toHolder(h, boRefs))
                .sorted(Comparator.comparing(Holder::effectivePercentage).reversed())
                .toList();
        Set<String> uboKeys = holders.stream().filter(Holder::ubo).map(Holder::key).collect(Collectors.toSet());

        List<NodeView> roots = c.children.getOrDefault(ROOT, List.of()).stream()
                .map(n -> view(n, c, uboKeys)).toList();

        boolean fallbackAllowed = uboKeys.isEmpty();
        SeniorManagingOfficial smo = lp.getSmoName() == null ? null
                : new SeniorManagingOfficial(lp.getSmoName(), lp.getSmoPosition(), lp.getSmoJustification());

        return new OwnershipTreeResponse(lp.getId(), lp.getName(), lp.getRegistrationNumber(), threshold,
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
        if (pct.signum() == 0 && controls.isEmpty()) {
            throw new InvalidWorkflowStateException(
                    "Ownership percentage must be greater than 0 unless a control basis is recorded for a natural person");
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

        OwnershipNode n = new OwnershipNode();
        n.setLegalPersonId(legalPersonId);
        n.setParentId(parentId);
        n.setNodeType(req.nodeType());
        n.setName(req.name().trim());
        n.setOwnershipPercentage(pct);
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
        boolean anyUbo = c.holders.values().stream().anyMatch(h -> isUbo(h));
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
        boolean ownership = acc.total.compareTo(threshold) >= 0;
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
        return new Derivation(chain, total, type, List.copyOf(acc.controls), ownership, control);
    }

    @Transactional
    public void markLinked(String nodeId, String beneficialOwnerId) {
        nodeRepository.findById(nodeId).ifPresent(n -> {
            n.setBeneficialOwnerId(beneficialOwnerId);
            nodeRepository.save(n);
        });
    }

    public BigDecimal threshold() {
        return threshold;
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
    }

    private Computation compute(LegalPerson lp, List<OwnershipNode> nodes) {
        Computation c = new Computation();
        for (OwnershipNode n : nodes) {
            c.children.computeIfAbsent(n.getParentId() == null ? ROOT : n.getParentId(), k -> new ArrayList<>()).add(n);
        }
        if (nodes.isEmpty()) {
            c.warnings.add("No shareholders recorded yet. Add the customer's shareholders and trace each company "
                    + "down to the natural person(s).");
            return c;
        }
        walk(ROOT, lp.getName(), HUNDRED, lp.getName(), 0, c, new HashSet<>());
        return c;
    }

    private void walk(String parentKey, String parentName, BigDecimal parentEffective, String parentChain,
            int depth, Computation c, Set<String> visited) {
        BigDecimal childSum = BigDecimal.ZERO;
        for (OwnershipNode n : c.children.getOrDefault(parentKey, List.of())) {
            if (!visited.add(n.getId())) {
                continue; // defensive: never loop on corrupt data
            }
            childSum = childSum.add(n.getOwnershipPercentage());
            BigDecimal eff = parentEffective.multiply(n.getOwnershipPercentage())
                    .divide(HUNDRED, CALC_SCALE, RoundingMode.HALF_UP);
            String chain = parentChain + " → " + n.getName() + " (" + fmt(n.getOwnershipPercentage()) + "%)";
            c.effective.put(n.getId(), eff);

            if (n.getNodeType() == NodeType.COMPANY) {
                walk(n.getId(), n.getName(), eff, chain, depth + 1, c, visited);
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

    private boolean isUbo(HolderAcc h) {
        return h.total.compareTo(threshold) >= 0 || !h.controls.isEmpty();
    }

    private Holder toHolder(HolderAcc h, Map<String, String> boRefs) {
        BigDecimal total = h.total.min(HUNDRED).setScale(2, RoundingMode.HALF_UP);
        OwnershipNode linked = h.nodes.stream().filter(n -> n.getBeneficialOwnerId() != null).findFirst().orElse(null);
        String boId = linked == null ? null : linked.getBeneficialOwnerId();
        String ref = boId == null ? null : boRefs.get(boId);
        return new Holder(h.key, h.name, h.idNumber, h.nationality, total,
                h.total.compareTo(threshold) >= 0, !h.controls.isEmpty(), isUbo(h),
                List.copyOf(h.controls), List.copyOf(h.paths),
                (linked != null ? linked : h.nodes.get(0)).getId(), ref != null, boId, ref);
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
