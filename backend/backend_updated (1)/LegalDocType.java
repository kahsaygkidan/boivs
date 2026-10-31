package dashen.bank.boivs.domain.enums;

/**
 * Document types the wizard can attach to a legal person.
 * Matches the LEGAL_DOC_TYPES array in NewLegalRegistration.jsx.
 */
public enum LegalDocType {
    MOA,
    AOA,
    COMMERCIAL_REGISTRATION,
    BUSINESS_LICENSE,
    TIN_CERTIFICATE,
    SHAREHOLDER_REGISTER,
    BOARD_RESOLUTION,
    MINUTES,
    FOREIGN_HOME_DOCUMENT,
    OTHER
}