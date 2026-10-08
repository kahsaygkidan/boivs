package dashen.bank.boivs.domain.enums;

/** Why the natural person is recorded on the register. */
public enum BoCapacity {
    /** Meets the ownership threshold (direct, indirect or aggregated). */
    OWNERSHIP,
    /** Ultimate effective control through means other than the ownership threshold. */
    CONTROL,
    /** CDD fallback: no natural person found after reasonable measures. NOT automatically the UBO. */
    SENIOR_MANAGING_OFFICIAL
}
