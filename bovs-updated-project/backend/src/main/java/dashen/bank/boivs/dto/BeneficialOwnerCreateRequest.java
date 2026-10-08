package dashen.bank.boivs.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import dashen.bank.boivs.domain.enums.BoCapacity;
import dashen.bank.boivs.domain.enums.ControlBasis;
import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.ResidentialStatus;
import dashen.bank.boivs.domain.enums.SourceOfInformation;
import dashen.bank.boivs.domain.enums.VerificationStatus;
import dashen.bank.boivs.domain.enums.OwnershipType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;

/**
 * When ownershipNodeId is supplied the server derives ownershipType, ownershipPercentage, ownershipChain
 * and controlBasis from the customer's ownership tree (the values sent for those fields are ignored).
 */
public record BeneficialOwnerCreateRequest(
        @NotBlank
        String legalPersonId,
        @NotBlank
        String fullName,
        @NotNull
        @Past
        LocalDate dateOfBirth,
        @NotNull
        Gender gender,
        @NotBlank
        String placeOfBirth,
        @NotNull
        ResidentialStatus residentialStatus,
        @NotBlank
        @Email
        String emailAddress,
        @NotBlank
        String phoneNumber,
        @NotBlank
        String occupation,
        @NotNull
        IdDocumentType idDocumentType,
        @NotNull
        VerificationStatus idVerificationStatus,
        String idTypeDetail,
        @NotBlank
        String idNumber,
        @NotBlank
        String nationality,
        @NotBlank
        String residentialAddress,
        @NotBlank
        String countryOfIssue,
        @NotNull
        @PastOrPresent
        LocalDate dateOfIssue,
        @NotNull
        LocalDate dateOfExpiry,
        @NotNull
        OwnershipType ownershipType,
        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal ownershipPercentage,
        @NotNull
        LocalDate dateBecameBo,
        boolean pep,
        String pepDetails,
        String ownershipNodeId,
        BoCapacity capacity,
        String ownershipChain,
        List<ControlBasis> controlBasis,
        String sourceOfWealth,
        String sourceOfFunds,
        boolean sanctionsScreened,
        @NotNull
        SourceOfInformation sourceOfInformation,
        String additionalInformation
        ) {

}
