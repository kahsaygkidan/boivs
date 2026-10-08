package dashen.bank.boivs.dto;

public record LegalPersonProfileRequest(
        String tin,
        String countryOfIncorporation,
        String natureOfBusiness,
        String directorsAndManagement
        ) {

}
