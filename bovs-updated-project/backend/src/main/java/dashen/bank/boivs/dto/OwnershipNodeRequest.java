package dashen.bank.boivs.dto;

import java.math.BigDecimal;
import java.util.List;

import dashen.bank.boivs.domain.enums.ControlBasis;
import dashen.bank.boivs.domain.enums.NodeType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Adds a shareholder to the ownership tree. parentId = null means a direct shareholder of the customer.
 * ownershipPercentage is the DIRECT stake in the parent (0 is allowed for a pure controller).
 */
public record OwnershipNodeRequest(
        String parentId,
        @NotNull
        NodeType nodeType,
        @NotBlank
        String name,
        String registrationNumber,
        String idNumber,
        String nationality,
        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal ownershipPercentage,
        List<ControlBasis> controlBasis,
        String controlNotes
        ) {

}
