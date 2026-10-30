package dashen.bank.boivs.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import dashen.bank.boivs.domain.BeneficialOwner;
import dashen.bank.boivs.domain.enums.BoCapacity;
import dashen.bank.boivs.domain.enums.BoStatus;
import dashen.bank.boivs.domain.enums.ControlBasis;
import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.OwnershipType;
import dashen.bank.boivs.domain.enums.ResidentialStatus;
import dashen.bank.boivs.domain.enums.SourceOfInformation;
import dashen.bank.boivs.domain.enums.VerificationStatus;

public record BeneficialOwnerResponse(
        String id,
        String boReference,
        String legalPersonId,
        String legalPersonName,
        String legalPersonRegistrationNumber,
        String legalPersonTin,
        String legalPersonCountry,
        String legalPersonNatureOfBusiness,
        String legalPersonDirectors,
        String fullName,
        Gender gender,
        LocalDate dateOfBirth,
        String placeOfBirth,
        String nationality,
        ResidentialStatus residentialStatus,
        String residentialAddress,
        String emailAddress,
        String phoneNumber,
        String occupation,
        IdDocumentType idDocumentType,
        VerificationStatus idVerificationStatus,
        String idTypeDetail,
        String idNumber,
        String countryOfIssue,
        LocalDate dateOfIssue,
        LocalDate dateOfExpiry,
        boolean idExpired,
        String ownershipNature,
        OwnershipType ownershipType,
        BigDecimal ownershipPercentage,
        LocalDate dateBecameBo,
        LocalDate dateCeased,
        /** ACTIVE or CEASED. */
        String boStatus,
        boolean pep,
        String pepDetails,
        SourceOfInformation sourceOfInformation,
        /** VERIFIED, PENDING or NOT_VERIFIED. */
        String verificationStatus,
        LocalDateTime verificationDate,
        String additionalInformation,
        BoCapacity capacity,
        String ownershipChain,
        List<ControlBasis> controlBasis,
        String sourceOfWealth,
        String sourceOfFunds,
        boolean sanctionsScreened,
        String ownershipNodeId,
        BoStatus status,
        String rejectionReason,
        String createdBy,
        LocalDateTime createdAt,
        String updatedBy,
        LocalDateTime updatedAt,
        String decidedBy,
        LocalDateTime decidedAt
) {

    public static BeneficialOwnerResponse from(BeneficialOwner b) {
        boolean idExpired = b.getDateOfExpiry() != null && b.getDateOfExpiry().isBefore(LocalDate.now());
        List<ControlBasis> controls = b.getControlBasis() == null || b.getControlBasis().isBlank()
                ? List.of()
                : Arrays.stream(b.getControlBasis().split(",")).map(String::trim).map(ControlBasis::valueOf).toList();

        String boStatus = b.getStatus() == BoStatus.CEASED ? "CEASED" : "ACTIVE";
        String verificationStatus = switch (b.getStatus()) {
            case VERIFIED, CEASED -> "VERIFIED";
            case PENDING -> "PENDING";
            default -> "NOT_VERIFIED";
        };
        LocalDateTime verificationDate = b.getVerificationDate() != null ? b.getVerificationDate()
                : (b.getStatus() == BoStatus.VERIFIED ? b.getDecidedAt() : null);

        return new BeneficialOwnerResponse(
                b.getId(), b.getBoReference(), b.getLegalPerson().getId(), b.getLegalPerson().getName(),
                b.getLegalPerson().getRegistrationNumber(), b.getLegalPerson().getTin(),
                b.getLegalPerson().getCountryOfIncorporation(), b.getLegalPerson().getNatureOfBusiness(),
                b.getLegalPerson().getDirectorsAndManagement(),
                b.getFullName(), b.getGender(), b.getDateOfBirth(), b.getPlaceOfBirth(), b.getNationality(),
                b.getResidentialStatus(), b.getResidentialAddress(), b.getEmailAddress(), b.getPhoneNumber(),
                b.getOccupation(), b.getIdDocumentType(), b.getIdVerificationStatus(), b.getIdTypeDetail(), b.getIdNumber(), b.getCountryOfIssue(),
                b.getDateOfIssue(), b.getDateOfExpiry(), idExpired,
                b.getOwnershipNature(), b.getOwnershipType(), b.getOwnershipPercentage(),
                b.getDateBecameBo(), b.getDateCeased(), boStatus,
                b.isPep(), b.getPepDetails(), b.getSourceOfInformation(),
                verificationStatus, verificationDate, b.getAdditionalInformation(),
                b.getCapacity(), b.getOwnershipChain(), controls,
                b.getSourceOfWealth(), b.getSourceOfFunds(), b.isSanctionsScreened(), b.getOwnershipNodeId(),
                b.getStatus(), b.getRejectionReason(),
                b.getCreatedBy(), b.getCreatedAt(), b.getUpdatedBy(), b.getUpdatedAt(),
                b.getDecidedBy(), b.getDecidedAt());
    }
}