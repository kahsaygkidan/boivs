package dashen.bank.boivs.domain.enums;

public enum IdDocumentType {
    FAYDA_ID,
    PASSPORT,
    DRIVING_LICENCE,
    TIN,
    KEBELE_ID,
    OTHER,
    /** Legacy value kept so existing records still load. */
    NATIONAL_ID
}