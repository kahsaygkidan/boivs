package dashen.bank.boivs.dto;

import java.math.BigDecimal;
import java.util.List;

import dashen.bank.boivs.domain.enums.ControlBasis;
import dashen.bank.boivs.domain.enums.NodeType;

public record OwnershipTreeResponse(
        String legalPersonId,
        String legalPersonName,
        String registrationNumber,
        BigDecimal thresholdPercentage,
        List<NodeView> shareholders,
        List<Holder> holders,
        List<String> warnings,
        boolean seniorManagingOfficialAllowed,
        SeniorManagingOfficial seniorManagingOfficial
) {

    /** A node in the tree, with calculated effective ownership of the customer. */
    public record NodeView(
            String id,
            String parentId,
            NodeType nodeType,
            String name,
            String registrationNumber,
            String idNumber,
            String nationality,
            BigDecimal ownershipPercentage,
            BigDecimal effectivePercentage,
            /** COMPANY only: share of this company not yet traced to a shareholder (direct %, 0-100). */
            BigDecimal untracedPercentage,
            List<ControlBasis> controlBasis,
            String controlNotes,
            boolean ubo,
            String beneficialOwnerId,
            List<NodeView> children
    ) {

    }

    public record OwnershipPath(String chain, BigDecimal percentage) {

    }

    /** A natural person, aggregated across every branch of the tree they appear in. */
    public record Holder(
            String key,
            String fullName,
            String idNumber,
            String nationality,
            BigDecimal effectivePercentage,
            boolean qualifiesByOwnership,
            boolean qualifiesByControl,
            boolean ubo,
            List<ControlBasis> controlBasis,
            List<OwnershipPath> paths,
            String ownershipNodeId,
            boolean registered,
            String beneficialOwnerId,
            String beneficialOwnerReference,
            /** Joint-holding label, when the person holds jointly with others (null otherwise). */
            String jointGroup,
            /** Combined ownership % of the whole joint group (null when not joint). */
            BigDecimal jointPercentage,
            /** Which holding tests made the person qualify: OWNERSHIP, CONVERTIBLE_DEBT, PREFERENTIAL_SHARES, PROFIT, DISSOLUTION, VOTING. */
            List<String> qualifyingCriteria
    ) {

    }

    public record SeniorManagingOfficial(String name, String position, String justification) {

    }
}