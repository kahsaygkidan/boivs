/* ==========================================================================
   REQUIRED_PERSON_FIELDS — 'docType' REMOVED (not a BO field; docs are
   uploaded separately via the document controller). Presence is checked by
   personMissing(); format/business rules live in the frontend validator.
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
 * Human-readable labels for the exact-missing error.
 */
export const PERSON_FIELD_LABELS = {
  fullName: 'Full name',
  gender: 'Gender',
  dateOfBirth: 'Date of birth',
  placeOfBirth: 'Place of birth',
  nationality: 'Nationality',
  idDocumentType: 'ID document type',
  idNumber: 'ID / passport number',
  countryOfIssue: 'Country of issue',
  dateOfIssue: 'ID date of issue',
  dateOfExpiry: 'ID expiry date',
  residentialStatus: 'Residential status',
  residentialAddress: 'Address',
  emailAddress: 'Email address',
  phoneNumber: 'Telephone number',
  dateBecameBo: 'Date became BO',
  idVerificationStatus: 'ID verification status',
  sourceOfInformation: 'Source of information',
  verificationMethod: 'Verification method',
  verificationDate: 'Verification date',
  sourceOfWealth: 'Source of wealth',
  dateCeasedBo: 'Date ceased to be BO',
};

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