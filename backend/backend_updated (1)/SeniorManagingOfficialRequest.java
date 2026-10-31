package dashen.bank.boivs.dto;

import jakarta.validation.constraints.NotBlank;

public record SeniorManagingOfficialRequest(
        @NotBlank
        String name,
        @NotBlank
        String position,
        /** Describes the reasonable measures taken before falling back to the senior managing official. */
        @NotBlank
        String justification
) {

}