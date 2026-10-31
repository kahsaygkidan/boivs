package dashen.bank.boivs.dto;

import java.time.LocalDate;

import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.ResidentialStatus;
import dashen.bank.boivs.domain.enums.SourceOfInformation;
import dashen.bank.boivs.domain.enums.VerificationStatus;

/**
 * Maker edit of a record that is not yet verified. Deliberately free of validation constraints:
 * every field is optional and only the fields that are sent are changed (blank values on
 * mandatory columns are ignored). Ownership %, type, chain and control basis are NOT editable
 * here: they are calculated from the customer's ownership structure.
 */
public record BeneficialOwnerUpdateRequest(
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
        LocalDate dateBecameBo,
        Boolean pep,
        String pepDetails,
        SourceOfInformation sourceOfInformation,
        String additionalInformation,
        String sourceOfWealth,
        String sourceOfFunds,
        Boolean sanctionsScreened
) {

}