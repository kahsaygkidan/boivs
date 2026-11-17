package dashen.bank.boivs.dto;

import java.time.LocalDate;

import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;

public record SeniorManagingOfficialRequest(

        @NotBlank
        String fullName,

        @NotNull
        @Past
        LocalDate dateOfBirth,

        @NotBlank
        String nationality,

        @NotNull
        Gender gender,

        @NotBlank
        String phoneNumber,

        @NotNull
        IdDocumentType idDocumentType,

        @NotBlank
        String idNumber,

        @NotBlank
        String countryOfIssue,

        @NotNull
        @PastOrPresent
        LocalDate dateOfIssue,

        @NotNull
        LocalDate dateOfExpiry,

        @NotBlank
        String position,

        @NotBlank
        String justification,

        String verificationNotes

) {}
