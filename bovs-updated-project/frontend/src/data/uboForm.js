export const today = () => new Date().toISOString().slice(0, 10);

export const ID_DOCUMENT_TYPES = [
  { value: 'FAYDA_ID', label: 'Fayda ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENCE', label: "Driver's License" },
  { value: 'TIN', label: 'TIN' },
  { value: 'KEBELE_ID', label: 'Kebele ID' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * What the form asks for once an ID type is chosen. The matching input receives focus automatically.
 * numeric: digits only. detailLabel: a second input is shown as well (both number and text).
 */
export const ID_TYPE_CONFIG = {
  FAYDA_ID: {
    numberLabel: 'Fayda number (FAN / FIN)', placeholder: '12 to 16 digits', numeric: true,
    test: (v) => /^\d{12,16}$/.test(v), error: 'Fayda number (12 to 16 digits)',
  },
  PASSPORT: {
    numberLabel: 'Passport number', placeholder: 'e.g. EP1234567', upper: true,
    test: (v) => /^[A-Za-z0-9]{6,12}$/.test(v), error: 'Passport number (6 to 12 letters or digits)',
  },
  DRIVING_LICENCE: {
    numberLabel: "Driver's license number", placeholder: 'License number',
    test: (v) => /^[A-Za-z0-9/-]{4,30}$/.test(v), error: "Driver's license number",
  },
  TIN: {
    numberLabel: 'TIN', placeholder: '10 digits', numeric: true,
    test: (v) => /^\d{10}$/.test(v), error: 'TIN (10 digits)',
  },
  KEBELE_ID: {
    numberLabel: 'Kebele ID number', placeholder: 'Kebele ID number',
    detailLabel: 'Kebele / Woreda', detailPlaceholder: 'e.g. Kebele 05, Bole',
    test: (v) => /^[A-Za-z0-9/-]{3,30}$/.test(v), error: 'Kebele ID number',
  },
  OTHER: {
    numberLabel: 'Document number', placeholder: 'Document number',
    detailLabel: 'Document name / type', detailPlaceholder: 'e.g. Residence permit',
    test: (v) => v.length >= 3, error: 'Document number',
  },
};

export const ID_VERIFICATION_STATUSES = [
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NOT_VERIFIED', label: 'Not Verified' },
];

export const SOURCES_OF_INFORMATION = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'GOVERNMENT_REGISTRY', label: 'Government Registry' },
  { value: 'OFFICIAL_DOCUMENT', label: 'Official Document' },
  { value: 'OTHER', label: 'Other' },
];

/** Returns the labels of everything still missing for a person (10.6). */
export function personMissing(f, { requireFile = true } = {}) {
  const m = [];
  if (!f.fullName.trim()) m.push('Full name');
  if (!f.gender) m.push('Gender');
  if (!f.dateOfBirth) m.push('Date of birth');
  if (!f.placeOfBirth.trim()) m.push('Place of birth');
  if (!/^\S+@\S+\.\S+$/.test(f.emailAddress.trim())) m.push('A valid email address');
  if (!f.phoneNumber.trim()) m.push('Telephone number');
  if (!f.occupation.trim()) m.push('Occupation / profession');
  if (!f.dateOfIssue) m.push('ID date of issue');
  else if (f.dateOfIssue > today()) m.push('ID date of issue (cannot be in the future)');
  else if (f.dateOfExpiry && f.dateOfIssue >= f.dateOfExpiry) m.push('ID issue date before expiry date');
  const idCfg = ID_TYPE_CONFIG[f.idDocumentType];
  if (!idCfg?.test(f.idNumber.trim())) m.push(idCfg?.error || 'ID number');
  if (idCfg?.detailLabel && !f.idTypeDetail.trim()) m.push(idCfg.detailLabel);
  if (!f.nationality.trim()) m.push('Nationality');
  if (!f.residentialAddress.trim()) m.push('Residential address');
  if (!f.countryOfIssue.trim()) m.push('Country of issue');
  if (!f.dateOfExpiry) m.push('ID expiry date');
  else if (f.dateOfExpiry < today()) m.push('A valid (non-expired) ID document');
  if (!f.dateBecameBo) m.push('Date became BO');
  if (requireFile && !f.file) m.push('Verified ID document');
  if (f.pep && !f.pepDetails.trim()) m.push('PEP details');
  if (f.pep && !f.sourceOfWealth.trim()) m.push('Source of wealth (required for PEP)');
  if (!f.sanctionsScreened) m.push('Sanctions screening confirmation');
  return m;
}

