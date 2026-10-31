package dashen.bank.boivs.dto;

import dashen.bank.boivs.domain.enums.Sector;

public record LegalPersonProfileRequest(
        String tin,
        String countryOfIncorporation,
        Sector sector,
        String directorsAndManagement
) {

}