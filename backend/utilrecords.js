// Status labels/styling map — backend returns uppercase enum values
// (DRAFT, PENDING, VERIFIED, REJECTED, CEASED).
export const statusLabel = {
  DRAFT: "Draft",
  PENDING: "Pending Verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  CEASED: "Ceased",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  WITHDRAWN:"Removed"
};

export const entityTypeLabel = {
  SHARE_COMPANY: "Share Company",
  PRIVATE_LIMITED_COMPANY: "Private Limited Company",
  PARTNERSHIP: "Partnership",
  OTHER_LEGAL_ARRANGEMENT: "Other legal arrangement",
};

export const idDocumentTypeLabel = {
  FAYDA_ID: "Fayda ID",
  PASSPORT: "Passport",
  DRIVING_LICENCE: "Driver's License",
  TIN: "TIN",
  KEBELE_ID: "Kebele ID",
  OTHER: "Other",
  NATIONAL_ID: "National ID",
};

export const ownershipTypeLabel = {
  DIRECT: "Direct",
  INDIRECT: "Indirect",
  JOINT: "Joint",
  VOTING_RIGHTS: "Voting Rights",
  CONTROL_BY_OTHER_MEANS: "Other Control",
};


export const genderLabel = { MALE: "Male", FEMALE: "Female" };
export const residentialStatusLabel = { RESIDENT: "Resident", NON_RESIDENT: "Non-resident" };
export const sourceOfInformationLabel = {
  CUSTOMER: "Customer",
  GOVERNMENT_REGISTRY: "Government Registry",
  OFFICIAL_DOCUMENT: "Official Document",
  OTHER: "Other",
};
export const verificationStatusLabel = { VERIFIED: "Verified", PENDING: "Pending", NOT_VERIFIED: "Not Verified" };
export const boStatusLabel = { ACTIVE: "Active", CEASED: "Ceased" };

export const capacityLabel = {
  OWNERSHIP: "Ownership threshold",
  CONTROL: "Ultimate effective control",
  SENIOR_MANAGING_OFFICIAL: "Senior managing official (fallback)",
};

export const controlBasisLabel = {
  VOTING_RIGHTS: "Voting rights",
  SHAREHOLDER_AGREEMENT: "Shareholder agreement",
  VOTING_AGREEMENT: "Voting agreement",
  POWER_TO_APPOINT_REMOVE_DIRECTORS: "Power to appoint/remove directors",
  BOARD_CONTROL: "Board control",
  MANAGEMENT_CONTROL_RIGHTS: "Management/control rights",
  CONVERTIBLE_INSTRUMENTS: "Convertible instruments",
  NOMINEE_ARRANGEMENT: "Nominee arrangement",
  OTHER_CONTRACTUAL_ARRANGEMENT: "Other contractual arrangement",
  PERSONS_ACTING_TOGETHER: "Persons acting together",
  OTHER_MEANS: "Other means of ultimate effective control",
};
