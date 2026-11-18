// In ID_TYPE_CONFIG:
PASSPORT: {
  numeric: false,
  upper: true,
  maxLength: 12,
  numberLabel: 'Passport number',
  detailLabel: null,
},

// In validators:
export const RE_PASSPORT = /^[A-Z0-9]{6,12}$/;

export const validatePassport = (v) => {
  if (!v) return 'Passport number is required';
  if (!RE_PASSPORT.test(v)) return 'Passport must be 6–12 letters or digits';
  return null;
};