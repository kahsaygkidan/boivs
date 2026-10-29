//export const today = () => new Date().toISOString().slice(0, 10);





/* ==========================================================================
   uboForm.js — shared constants, helpers, and validation primitives
   used by NewLegalRegistration, RecordDetail, and the report views.
   ========================================================================== */

/* ==========================================================================
   Today's date (YYYY-MM-DD) — stable helper used across forms
   ========================================================================== */
export const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/* ==========================================================================
   Identification document types — used in the BO verification form
   ========================================================================== */
export const ID_DOCUMENT_TYPES = [
  { value: 'FAYDA_ID', label: 'Fayda ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVER_LICENSE', label: "Driver's License" },
  { value: 'TIN', label: 'TIN' },
  { value: 'KEBELE_ID', label: 'Kebele ID' },
  { value: 'GOVERNMENT_ID', label: 'Other Government-issued ID' },
  { value: 'OTHER', label: 'Other' },
];

/* Per-type configuration — controls numeric/uppercase input, length, placeholder */
export const ID_TYPE_CONFIG = {
  FAYDA_ID: {
    numeric: true,
    upper: false,
    maxLength: 16,
    numberLabel: '16-digit Fayda number',
    detailLabel: null,
  },
  PASSPORT: {
    numeric: false,
    upper: true,
    maxLength: 20,
    numberLabel: 'Passport number',
    detailLabel: null,
  },
  DRIVER_LICENSE: {
    numeric: false,
    upper: true,
    maxLength: 25,
    numberLabel: "Driver's license number",
    detailLabel: null,
  },
  TIN: {
    numeric: true,
    upper: false,
    maxLength: 10,
    numberLabel: '10-digit TIN',
    detailLabel: null,
  },
  KEBELE_ID: {
    numeric: false,
    upper: true,
    maxLength: 20,
    numberLabel: 'Kebele ID',
    detailLabel: 'Kebele / Woreda',
  },
  GOVERNMENT_ID: {
    numeric: false,
    upper: true,
    maxLength: 30,
    numberLabel: 'Government ID number',
    detailLabel: 'Issuing authority',
  },
  OTHER: {
    numeric: false,
    upper: true,
    maxLength: 40,
    numberLabel: 'ID number',
    detailLabel: 'Document description',
  },
};

/* ==========================================================================
   ID verification statuses
   ========================================================================== */
export const ID_VERIFICATION_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'PARTIAL', label: 'Partially verified' },
  { value: 'FAILED', label: 'Failed verification' },
  { value: 'EXPIRED', label: 'Expired' },
];

/* ==========================================================================
   Sources of information
   ========================================================================== */
export const SOURCES_OF_INFORMATION = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'OFFICIAL_REGISTRY', label: 'Official registry' },
  { value: 'PUBLIC_REGISTER', label: 'Public register' },
  { value: 'THIRD_PARTY', label: 'Third-party data provider' },
  { value: 'FIELD_VISIT', label: 'Field visit' },
  { value: 'DOCUMENT', label: 'Document provided by customer' },
  { value: 'OTHER', label: 'Other' },
];

/* ==========================================================================
   Legal-person document types
   --------------------------------------------------------------------------
   Used by NewLegalRegistration to upload, list, download, and delete
   supporting documents via the unified DocumentController:
     POST   /api/documents/LEGAL_PERSON/{lpId}
     GET    /api/documents/LEGAL_PERSON/{lpId}
     GET    /api/documents/LEGAL_PERSON/{lpId}/{docId}/download
     DELETE /api/documents/LEGAL_PERSON/{lpId}/{docId}
   The `docType` field sent to the backend MUST match the LegalDocType enum
   on the server: MOA, AOA, COMMERCIAL_REGISTRATION, BUSINESS_LICENSE,
   TIN_CERTIFICATE, SHAREHOLDER_REGISTER, BOARD_RESOLUTION, MINUTES,
   FOREIGN_HOME_DOCUMENT, OTHER.
   ========================================================================== */
export const LEGAL_DOC_TYPES = [
  {
    key: 'moa',
    docType: 'MOA',
    label: 'Memorandum of Association (MOA)',
    required: false,
  },
  {
    key: 'aoa',
    docType: 'AOA',
    label: 'Articles of Association (AOA)',
    required: false,
  },
  {
    key: 'commercialRegistration',
    docType: 'COMMERCIAL_REGISTRATION',
    label: 'Commercial Registration Certificate',
    required: false,
  },
  {
    key: 'businessLicense',
    docType: 'BUSINESS_LICENSE',
    label: 'Business License',
    required: false,
  },
  {
    key: 'tinCertificate',
    docType: 'TIN_CERTIFICATE',
    label: 'TIN Certificate',
    required: false,
  },
  {
    key: 'shareholderRegister',
    docType: 'SHAREHOLDER_REGISTER',
    label: 'Shareholder / Member Register',
    required: false,
  },
  {
    key: 'boardResolution',
    docType: 'BOARD_RESOLUTION',
    label: 'Board Resolution',
    required: false,
  },
  {
    key: 'minutes',
    docType: 'MINUTES',
    label: 'Minutes of Meeting',
    required: false,
  },
  {
    key: 'foreignHomeDoc',
    docType: 'FOREIGN_HOME_DOCUMENT',
    label: 'Home-Jurisdiction Official Document (foreign entities)',
    required: false,
    foreignOnly: false,
  },
];

/* Fast lookup: client-side key → backend LegalDocType */
export const DOC_KEY_TO_TYPE = LEGAL_DOC_TYPES.reduce((acc, d) => {
  acc[d.key] = d.docType;
  return acc;
}, {});

/* Reverse lookup: backend LegalDocType → client key */
export const DOC_TYPE_TO_KEY = LEGAL_DOC_TYPES.reduce((acc, d) => {
  acc[d.docType] = d.key;
  return acc;
}, {});

/* ==========================================================================
   Entity classification — used by the entity wizard + reports
   ========================================================================== */
export const ENTITY_TYPES = [
  { value: '', label: 'Select…' },
  { value: 'SHARE_COMPANY', label: 'Share Company' },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company' },
  { value: 'ONE_MEMBER_PLC', label: 'One Member PLC' },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company' },
  { value: 'GENERAL_PARTNERSHIP', label: 'General Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership' },
  { value: 'FINANCIAL_INSTITUTION', label: 'Financial Institution' },
  { value: 'FOREIGN_LEGAL_PERSON', label: 'Foreign Legal Person' },
  { value: 'PPP', label: 'Public Private Partnership' },
  { value: 'CIVIL_SOCIETY_ORGANIZATION', label: 'Civil Society Organisation' },
  { value: 'GOVERNMENT_OWNED_ENTERPRISE', label: 'Government-Owned Enterprise (Federal/Regional)' },
  { value: 'COOPERATIVE_ASSOCIATION', label: 'Cooperative Association' },
  { value: 'PUBLIC_ADMINISTRATION', label: 'Public Administration Organisation' },
  { value: 'RELIGIOUS_INSTITUTION', label: 'Religious Institution' },
  { value: 'INTERNATIONAL_ORGANIZATION', label: 'International Organisation (Ethiopia member)' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'OTHER', label: 'Other' },
];

/* ==========================================================================
   Sectors — drive beneficial ownership thresholds
   ========================================================================== */
export const SECTORS = [
  { value: '', label: 'Select sector…' },
  { value: 'OTHER', label: 'Other' },
  { value: 'MINING', label: 'Mining' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'MOTOR_DEALERSHIP', label: 'Motor Dealership' },
  { value: 'IMPORT_EXPORT', label: 'Import / Export' },
  { value: 'FINANCIAL', label: 'Financial' },
];

/* Sectors that trigger the 5% threshold for Share Companies */
export const HIGH_RISK_SECTORS = new Set([
  'MINING',
  'REAL_ESTATE',
  'MOTOR_DEALERSHIP',
  'IMPORT_EXPORT',
]);

/* ==========================================================================
   Beneficial ownership threshold rule — NBE directive
   Returns { pct, title, body, note, tone } or null for special entity types
   ========================================================================== */
export function getThresholdInfo(entityType, sector) {
  switch (entityType) {
    case 'SHARE_COMPANY': {
      const highRisk = HIGH_RISK_SECTORS.has(sector);
      const pct = highRisk ? 5 : 10;
      return {
        pct,
        title: `Share Company threshold: ≥${pct}%`,
        body: highRisk
          ? `${pct}% direct or indirect ownership (individual or joint). Applies because the sector is ${SECTORS.find((s) => s.value === sector)?.label || 'Directive-specified'}, which triggers the reduced threshold. Covers preferential shares, ≥${pct}% convertible equity debt, and control through other means.`
          : `${pct}% direct or indirect ownership (individual or joint). Covers preferential shares, ≥${pct}% convertible equity debt, and control through other means.`,
        note: highRisk
          ? 'Reduced from 10% to 5% for mining, real estate development, motor vehicle dealership, import/export, and other Directive-specified sectors.'
          : '5% threshold applies if the entity operates in mining, real estate development, motor vehicle dealership, import/export, or another Directive-specified sector.',
        tone: highRisk ? 'warn' : 'info',
      };
    }
    case 'PRIVATE_LIMITED_COMPANY':
      return {
        pct: 5,
        title: 'Private Limited Company threshold: ≥5%',
        body: '5% direct or indirect ownership (individual or joint), plus control through other means.',
        note: 'Includes individuals or joint holders meeting the 5% ownership test.',
        tone: 'info',
      };
    case 'ONE_MEMBER_PLC':
      return {
        pct: null,
        title: 'One Member PLC: single owner + general manager',
        body: 'The sole owner and the applicable general manager or other controlling person must both be registered.',
        note: 'Single-BO-plus-manager pattern.',
        tone: 'info',
      };
    case 'GENERAL_PARTNERSHIP':
      return {
        pct: 25,
        title: 'General Partnership threshold: ≥25%',
        body: '25% profit entitlement, assets on dissolution, voting rights, qualifying third-party beneficial interests, plus control provisions.',
        note: 'Any partner meeting the 25% test or exercising control is captured.',
        tone: 'info',
      };
    case 'LIMITED_PARTNERSHIP':
      return {
        pct: 25,
        title: 'Limited Partnership threshold: ≥25%',
        body: '25% profit distribution, assets on dissolution, voting rights, plus control rights.',
        note: 'Applies to both general and limited partners.',
        tone: 'info',
      };
    case 'LIMITED_LIABILITY_PARTNERSHIP':
      return {
        pct: 25,
        title: 'Limited Liability Partnership threshold: ≥25%',
        body: '25% profit or asset interest, plus control through other means.',
        note: 'Any partner meeting the 25% test or exercising control is captured.',
        tone: 'info',
      };
    case 'PPP':
      return {
        pct: 25,
        title: 'Public Private Partnership threshold: ≥25%',
        body: '25% share or asset criterion.',
        note: 'Applies to both public and private parties meeting the 25% test.',
        tone: 'info',
      };
    case 'FINANCIAL_INSTITUTION':
      return {
        pct: 2,
        title: 'Financial Institution threshold: ≥2%',
        body: '2% direct or indirect ownership (individual or joint) or ≥2% convertible equity debt, plus control provisions.',
        note: 'Lower threshold due to the systemic nature of financial institutions.',
        tone: 'warn',
      };
    case 'FOREIGN_LEGAL_PERSON':
      return {
        pct: null,
        title: 'Foreign Legal Person: home-jurisdiction evidence',
        body: 'Country of registration is captured. Beneficial ownership information should be supported by home-jurisdiction documentation, attestation, or authentication where available.',
        note: 'Upload the home-jurisdiction official document in the Supporting documents section if you have it.',
        tone: 'warn',
      };
    default:
      return null;
  }
}

/* ==========================================================================
   Missing-field checks — used by the verify step to compute
   how many fields remain incomplete for each person.
   ========================================================================== */
const REQUIRED_PERSON_FIELDS = [
  'fullName',
  'gender',
  'dateOfBirth',
  'placeOfBirth',
  'nationality',
  'idDocumentType',
  'idNumber',
  'countryOfIssue',
  'dateOfIssue',
  'dateOfExpiry',
  'residentialStatus',
  'residentialAddress',
  'emailAddress',
  'phoneNumber',
  'dateBecameBo',
  'idVerificationStatus',
  'sourceOfInformation',
  'verificationMethod',
  'verificationDate',
];

/**
 * Return the list of required person-form fields that are still empty.
 * @param {object} form
 * @returns {string[]}
 */
export function personMissing(form) {
  if (!form) return REQUIRED_PERSON_FIELDS.slice();
  const missing = [];
  REQUIRED_PERSON_FIELDS.forEach((k) => {
    const v = form[k];
    const empty =
      v === '' ||
      v === null ||
      v === undefined ||
      (typeof v === 'string' && v.trim() === '');
    if (empty) missing.push(k);
  });

  // PEP requires source of wealth
  if (form.pep && (!form.sourceOfWealth || !String(form.sourceOfWealth).trim())) {
    missing.push('sourceOfWealth');
  }

  // Ceased BOs need a ceased date
  if (form.boStatus === 'CEASED' && !form.dateCeasedBo) {
    missing.push('dateCeasedBo');
  }

  return missing;
}

/* ==========================================================================
   Formatting helpers
   ========================================================================== */
export const fmtDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};

export const fmtDateTime = (v) => {
  if (!v) return '—';
  return String(v).replace('T', ' ').slice(0, 19);
};

/* ==========================================================================
   Validation primitives — share between NewLegalRegistration and RecordDetail
   ========================================================================== */
export const RE_PHONE = /^[+\d\s\-()]{0,20}$/;
export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RE_PASSPORT = /^[A-Z0-9]{5,20}$/;
export const RE_DRIVER_LICENSE = /^[A-Z0-9\-]{5,25}$/;
export const RE_KEBELE = /^[A-Z0-9\-/]{3,20}$/;

export const validateTin = (v) => {
  if (!v) return 'TIN is required';
  if (!/^\d+$/.test(v)) return 'TIN must contain digits only';
  if (v.length !== 10) return 'TIN must be exactly 10 digits';
  return null;
};

export const validateFayda = (v) => {
  if (!v) return 'Fayda number is required';
  if (!/^\d+$/.test(v)) return 'Fayda number must contain digits only';
  if (v.length !== 16) return 'Fayda number must be exactly 16 digits';
  return null;
};

export const validatePassport = (v) => {
  if (!v) return 'Passport number is required';
  if (!RE_PASSPORT.test(v)) return 'Passport must be 5–20 letters or digits';
  return null;
};

export const validateDriverLicense = (v) => {
  if (!v) return "Driver's license number is required";
  if (!RE_DRIVER_LICENSE.test(v)) return "Driver's license must be 5–25 letters/digits/-";
  return null;
};

export const validateKebele = (v) => {
  if (!v) return 'Kebele ID is required';
  if (!RE_KEBELE.test(v)) return 'Kebele ID must be 3–20 letters/digits/-/';
  return null;
};

export const validatePhone = (v) => {
  if (!v) return 'Phone number is required';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 9) return 'Phone number is too short';
  if (digits.length > 15) return 'Phone number is too long';
  if (!RE_PHONE.test(v)) return 'Phone number contains invalid characters';
  return null;
};

export const validateEmail = (v) => {
  if (!v) return 'Email is required';
  if (!RE_EMAIL.test(v)) return 'Enter a valid email address';
  return null;
};

/**
 * Validate an ID number based on the selected document type.
 * Returns an error string, or null when valid.
 */
export const validateIdFor = (type, value) => {
  switch (type) {
    case 'FAYDA_ID': return validateFayda(value);
    case 'PASSPORT': return validatePassport(value);
    case 'DRIVER_LICENSE': return validateDriverLicense(value);
    case 'KEBELE_ID': return validateKebele(value);
    case 'TIN': return validateTin(value);
    default: return value && String(value).trim() ? null : 'ID number is required';
  }
};

/* ==========================================================================
   Ownership helpers — used across the wizard + reports
   ========================================================================== */
export const splitChain = (chain) =>
  String(chain || '')
    .split(/\s*→\s*/)
    .map((x) => x.trim())
    .filter(Boolean);

export const isDirectHolder = (holder) => {
  const paths = holder?.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};

export const ownershipKind = (holder) =>
  isDirectHolder(holder) ? 'Direct' : 'Indirect';

/* ==========================================================================
   Default exports (convenience bag for callers that import *)
   ========================================================================== */
export default {
  today,
  ID_DOCUMENT_TYPES,
  ID_TYPE_CONFIG,
  ID_VERIFICATION_STATUSES,
  SOURCES_OF_INFORMATION,
  LEGAL_DOC_TYPES,
  DOC_KEY_TO_TYPE,
  DOC_TYPE_TO_KEY,
  ENTITY_TYPES,
  SECTORS,
  HIGH_RISK_SECTORS,
  getThresholdInfo,
  personMissing,
  fmtDate,
  fmtDateTime,
  validateTin,
  validateFayda,
  validatePassport,
  validateDriverLicense,
  validateKebele,
  validatePhone,
  validateEmail,
  validateIdFor,
  splitChain,
  isDirectHolder,
  ownershipKind,
};

/* Document types the wizard must collect for a legal person */
export const LEGAL_DOC_TYPES = [
  { key: 'moa', label: 'Memorandum of Association (MOA)', required: false },
  { key: 'aoa', label: 'Articles of Association (AOA)', required: false },
  { key: 'commercialRegistration', label: 'Commercial Registration Certificate', required: false },
  { key: 'businessLicense', label: 'Business License', required: false },
  { key: 'tinCertificate', label: 'TIN Certificate', required: false },
  { key: 'shareholderRegister', label: 'Shareholder / Member Register', required: false },
  { key: 'boardResolution', label: 'Board Resolution', required: false },
  { key: 'minutes', label: 'Minutes of Meeting', required: false },
  { key: 'foreignHomeDoc', label: 'Home-Jurisdiction Official Document (foreign entities)', required: false, foreignOnly: false },
];
export const HIGH_RISK_SECTORS = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);

export const ENTITY_TYPES = [
  { value: '', label: 'Select…' },
  { value: 'SHARE_COMPANY', label: 'Share Company' },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company' },
  { value: 'ONE_MEMBER_PLC', label: 'One Member PLC' },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company' },
  { value: 'GENERAL_PARTNERSHIP', label: 'General Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership' },
  { value: 'FINANCIAL_INSTITUTION', label: 'Financial Institution' },
  { value: 'FOREIGN_LEGAL_PERSON', label: 'Foreign Legal Person' },
  { value: 'PPP', label: 'Public Private Partnership' },
  { value: 'CIVIL_SOCIETY_ORGANIZATION', label: 'Civil Society Organisation' },
  { value: 'GOVERNMENT_OWNED_ENTERPRISE', label: 'Government-Owned Enterprise (Federal/Regional)' },
  { value: 'COOPERATIVE_ASSOCIATION', label: 'Cooperative Association' },
  { value: 'PUBLIC_ADMINISTRATION', label: 'Public Administration Organisation' },
  { value: 'RELIGIOUS_INSTITUTION', label: 'Religious Institution' },
  { value: 'INTERNATIONAL_ORGANIZATION', label: 'International Organisation (Ethiopia member)' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'OTHER', label: 'Other' },
];
export const SECTORS = [
  { value: '', label: 'Select sector…' },
  { value: 'OTHER', label: 'Other' },
  { value: 'MINING', label: 'Mining' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'MOTOR_DEALERSHIP', label: 'Motor Dealership' },
  { value: 'IMPORT_EXPORT', label: 'Import / Export' },
  { value: 'FINANCIAL', label: 'Financial' },
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
//  if (requireFile && !f.file) m.push('Verified ID document');
  if (f.pep && !f.pepDetails.trim()) m.push('PEP details');
  if (f.pep && !f.sourceOfWealth.trim()) m.push('Source of wealth (required for PEP)');
//  if (!f.sanctionsScreened) m.push('Sanctions screening confirmation');
  return m;
}
