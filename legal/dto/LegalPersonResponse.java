package dashen.bank.boivs.dto;

import java.time.LocalDateTime;

import dashen.bank.boivs.domain.LegalPerson;
import dashen.bank.boivs.domain.enums.EntityType;

public record LegalPersonResponse(
        String id,
        String name,
        String registrationNumber,
        EntityType entityType,
        String tin,
        String countryOfIncorporation,
        String natureOfBusiness,
        String directorsAndManagement,
        String smoName,
        String smoPosition,
        String smoJustification,
        String createdBy,
        LocalDateTime createdAt
) {
    public static LegalPersonResponse from(LegalPerson lp) {
        return new LegalPersonResponse(lp.getId(), lp.getName(), lp.getRegistrationNumber(),
                lp.getEntityType(), lp.getTin(), lp.getCountryOfIncorporation(), lp.getNatureOfBusiness(),
                lp.getDirectorsAndManagement(), lp.getSmoName(), lp.getSmoPosition(), lp.getSmoJustification(),
                lp.getCreatedBy(), lp.getCreatedAt());
    }
}