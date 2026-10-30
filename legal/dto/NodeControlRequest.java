package dashen.bank.boivs.dto;

import java.util.List;

import dashen.bank.boivs.domain.enums.ControlBasis;

/** Control basis recorded for a natural person (applied to every branch the person appears in). */
public record NodeControlRequest(
        List<ControlBasis> controlBasis,
        String controlNotes
) {

}