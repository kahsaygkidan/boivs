package dashen.bank.boivs.dto;

import dashen.bank.boivs.domain.enums.EntityType;
import dashen.bank.boivs.domain.enums.Sector;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LegalPersonRequest(
        @NotBlank
        String name,
        @NotBlank
        String registrationNumber,
        @NotNull
        EntityType entityType,
        String tin,
        String countryOfIncorporation,
         Sector sector,
        String directorsAndManagement
) {

}