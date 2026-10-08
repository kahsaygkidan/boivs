package dashen.bank.boivs.domain.enums;

public enum OwnershipType {
    DIRECT,
    INDIRECT,
    JOINT,
    /** Control through voting rights with no (or negligible) shareholding. */
    VOTING_RIGHTS,
    /** Other control (displayed as "Other Control"). */
    CONTROL_BY_OTHER_MEANS
}
