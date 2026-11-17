
package dashen.bank.boivs.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;
import dashen.bank.boivs.domain.enums.VerificationStatus;

public record SeniorManagingOfficialResponse(

    String id,

    String legalPersonId,

    String legalPersonName,

    String legalPersonRegistrationNumber,

    String fullName,

    LocalDate dateOfBirth,

    String nationality,

    Gender gender,

    String phoneNumber,

    IdDocumentType idDocumentType,

    String idNumber,

    String countryOfIssue,

    LocalDate dateOfIssue,

    LocalDate dateOfExpiry,

    VerificationStatus idVerificationStatus,

    boolean documentExpired,

    String position,

    String justification,

    String verificationNotes,

    String createdBy,

    LocalDateTime createdAt,

    String updatedBy,

    LocalDateTime updatedAt

) {}
