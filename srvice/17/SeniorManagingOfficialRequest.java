
package dashen.bank.boivs.dto;

import java.time.LocalDate;

import dashen.bank.boivs.domain.enums.Gender;
import dashen.bank.boivs.domain.enums.IdDocumentType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

public record SeniorManagingOfficialRequest(

    @NotBlank
    @Size(max = 200)
    String fullName,

    @NotNull
    @Past
    LocalDate dateOfBirth,

    @NotBlank
    @Size(max = 100)
    String nationality,

    @NotNull
    Gender gender,

    @NotBlank
    @Size(max = 50)
    String phoneNumber,

    @NotNull
    IdDocumentType idDocumentType,

    @NotBlank
    @Size(max = 100)
    String idNumber,

    @NotBlank
    @Size(max = 100)
    String countryOfIssue,

    @NotNull
    @PastOrPresent
    LocalDate dateOfIssue,

    @NotNull
    LocalDate dateOfExpiry,

    @NotBlank
    @Size(max = 150)
    String position,

    @NotBlank
    @Size(max = 2000)
    String justification,

    @Size(max = 2000)
    String verificationNotes

) {}
