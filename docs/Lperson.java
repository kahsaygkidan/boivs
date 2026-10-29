Uncaught TypeError: LEGAL_DOC_TYPES.map is not a function
    at NewLegalRegistration (NewLegalRegistration.jsx:1290:31)
    at renderWithHooks (react-dom.development.js:15486:18)
    at mountIndeterminateComponent (react-dom.development.js:20103:13)
    at beginWork (react-dom.development.js:21626:16)
    at HTMLUnknownElement.callCallback2 (react-dom.development.js:4164:14)
    at Object.invokeGuardedCallbackDev (react-dom.development.js:4213:16)
    at invokeGuardedCallback (react-dom.development.js:4277:31)
    at beginWork$1 (react-dom.development.js:27490:7)
    at performUnitOfWork (react-dom.development.js:26596:12)
    at workLoopSync (react-dom.development.js:26505:5)'import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createBoRecord, createLegalPerson, getOwnershipTree, listLegalPersons,
  saveSeniorManagingOfficial, searchBoRecords, updateLegalPersonProfile,
  updateNodeControl, uploadDocument,
  uploadLegalPersonDocument,
  listLegalPersonDocuments,
  downloadLegalPersonDocument,
  deleteLegalPersonDocument,
  triggerDownload,
} from '../api/bovsApi.js';
import OwnershipTree from '../components/OwnershipTree.jsx';
import { controlBasisLabel } from '../utils/records.js';
import {
  ID_DOCUMENT_TYPES, ID_TYPE_CONFIG, ID_VERIFICATION_STATUSES,
  SOURCES_OF_INFORMATION, personMissing, today,LEGAL_DOC_TYPES,
} from '../utils/uboForm.js';
import Field from '../components/Field.jsx';
import '../styles/NewLegalRegistration.css';

/* ==========================================================================
   Constants
   ========================================================================== */
const STEPS = [
  { key: 'customer', title: 'Customer', sub: 'Legal entity + docs' },
  { key: 'structure', title: 'Structure', sub: 'Ownership tree' },
  { key: 'control', title: 'Control', sub: 'Assess UBO' },
  { key: 'fallback', title: 'Fallback', sub: 'Senior official' },
  { key: 'verify', title: 'Verify', sub: 'Each UBO' },
  { key: 'submit', title: 'Submit', sub: 'Confirm & send' },
];

const ENTITY_TYPES = [
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

/* Document types the wizard must collect for a legal person */




/* Sector dropdown — replaces free-text nature of business */
const SECTORS = [
  { value: '', label: 'Select sector…' },
  { value: 'OTHER', label: 'Other' },
  { value: 'MINING', label: 'Mining' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'MOTOR_DEALERSHIP', label: 'Motor Dealership' },
  { value: 'IMPORT_EXPORT', label: 'Import / Export' },
  { value: 'FINANCIAL', label: 'Financial' },
];

/* Sectors that trigger the 5% threshold (instead of 10%) for Share Companies */
const HIGH_RISK_SECTORS = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);

/* ==========================================================================
   Threshold rules — per NBE directive
   ========================================================================== */
function getThresholdInfo(entityType, sector) {
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
        title: 'Foreign Legal Person: home-jurisdiction evidence required',
        body: 'Country of registration captured. Beneficial ownership information must be supported by home-jurisdiction documentation, attestation, or authentication.',
        note: 'Upload the home-jurisdiction official document in the Supporting documents section.',
        tone: 'warn',
      };
    default:
      return null;
  }
}

const EMPTY_CUSTOMER = {
  name: '', registrationNumber: '', entityType: '', tin: '',
  countryOfIncorporation: '', sector: '', directorsAndManagement: '',
  cifNumber: '',
};

const EMPTY_SMO = { name: '', position: '', justification: '', directorsAndManagement: '' };

const pct = (v) => String(Number(v ?? 0));
const personKey = (name, id) => `${(name || '').trim().toLowerCase()}|${(id || '').trim()}`;

/* ==========================================================================
   Validation
   ========================================================================== */
const RE_PHONE = /^[+\d\s\-()]{0,20}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PASSPORT = /^[A-Z0-9]{5,20}$/;
const RE_DRIVER_LICENSE = /^[A-Z0-9\-]{5,25}$/;
const RE_KEBELE = /^[A-Z0-9\-/]{3,20}$/;

const validateTin = (v) => {
  if (!v) return 'TIN is required';
  if (!/^\d+$/.test(v)) return 'TIN must contain digits only';
  if (v.length !== 10) return 'TIN must be exactly 10 digits';
  return null;
};
const validateFayda = (v) => {
  if (!v) return 'Fayda number is required';
  if (!/^\d+$/.test(v)) return 'Fayda number must contain digits only';
  if (v.length !== 16) return 'Fayda number must be exactly 16 digits';
  return null;
};
const validatePassport = (v) => {
  if (!v) return 'Passport number is required';
  if (!RE_PASSPORT.test(v)) return 'Passport must be 5–20 letters or digits';
  return null;
};
const validateDriverLicense = (v) => {
  if (!v) return "Driver's license number is required";
  if (!RE_DRIVER_LICENSE.test(v)) return "Driver's license must be 5–25 letters/digits/-";
  return null;
};
const validateKebele = (v) => {
  if (!v) return 'Kebele ID is required';
  if (!RE_KEBELE.test(v)) return 'Kebele ID must be 3–20 letters/digits/-/';
  return null;
};
const validatePhone = (v) => {
  if (!v) return 'Phone number is required';
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 9) return 'Phone number is too short';
  if (digits.length > 15) return 'Phone number is too long';
  if (!RE_PHONE.test(v)) return 'Phone number contains invalid characters';
  return null;
};
const validateEmail = (v) => {
  if (!v) return 'Email is required';
  if (!RE_EMAIL.test(v)) return 'Enter a valid email address';
  return null;
};
const validateIdFor = (type, value) => {
  switch (type) {
    case 'FAYDA_ID': return validateFayda(value);
    case 'PASSPORT': return validatePassport(value);
    case 'DRIVER_LICENSE': return validateDriverLicense(value);
    case 'KEBELE_ID': return validateKebele(value);
    case 'TIN': return validateTin(value);
    default: return value ? null : 'ID number is required';
  }
};

/* ==========================================================================
   Uniqueness
   ========================================================================== */
async function isTinUnique(tin, excludeId, legalPersons) {
  if (!tin) return true;
  const local = legalPersons.some((lp) => lp.tin && lp.tin === tin && lp.id !== excludeId);
  if (local) return false;
  try {
    const res = await listLegalPersons({ q: tin, size: 5 });
    return !(res.content || []).some((lp) => lp.tin === tin && lp.id !== excludeId);
  } catch { return true; }
}
async function isIdUnique(idNumber, idType, excludeBoId) {
  if (!idNumber) return true;
  try {
    const res = await searchBoRecords({ idNumber, size: 5 });
    return !(res.content || []).some(
      (b) => b.idNumber === idNumber && b.idDocumentType === idType && b.id !== excludeBoId
    );
  } catch { return true; }
}

/* ==========================================================================
   Helpers
   ========================================================================== */
const findDraft = (drafts, holder) => {
  if (!holder) return null;
  const exact = drafts[personKey(holder.fullName, holder.idNumber)];
  if (exact) return exact;
  const all = Object.values(drafts);
  const id = (holder.idNumber || '').trim();
  const byId = id && all.find((d) => (d.idNumber || '').trim() === id);
  if (byId) return byId;
  const name = (holder.fullName || '').trim().toLowerCase();
  return all.find((d) => (d.fullName || '').trim().toLowerCase() === name) || null;
};
const isFilled = (v) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
const fillFromDraft = (form, draft) => {
  if (!draft) return form;
  const next = { ...form };
  Object.entries(draft).forEach(([k, v]) => { if (!isFilled(next[k]) && isFilled(v)) next[k] = v; });
  return next;
};

const emptySubjectForm = (subject, drafts = {}) => {
  const base = {
    fullName: subject.holder?.fullName || subject.smo?.name || '',
    gender: '', dateOfBirth: '', placeOfBirth: '', residentialStatus: 'RESIDENT',
    emailAddress: '', phoneNumber: '', occupation: '', dateOfIssue: '',
    sourceOfInformation: 'CUSTOMER', additionalInformation: '',
    idDocumentType: 'FAYDA_ID', idVerificationStatus: 'PENDING', idTypeDetail: '',
    idNumber: subject.holder?.idNumber || '',
    nationality: subject.holder?.nationality || '',
    residentialAddress: '', countryOfIssue: '', dateOfExpiry: '',
    dateBecameBo: today(), boStatus: 'ACTIVE', dateCeasedBo: '',
    votingRights: '', jointOwnership: false, jointOwnerNames: '',
    ownershipBasis: subject.holder ? (subject.holder.qualifiesByOwnership ? 'OWNERSHIP' : 'CONTROL') : 'CONTROL',
    pep: false, pepPosition: '', pepCountry: '', pepOrganization: '',
    sanctionsScreened: false, sanctionsResult: '', sanctionsResolution: '',
    nbeFreezeScreened: false, nbeFreezeResult: '', nbeFreezeResolution: '',
    adverseMediaScreened: false, adverseMediaResult: '', adverseMediaResolution: '',
    verificationDate: today(), verificationMethod: 'DOCUMENT_VERIFICATION', verificationOutcome: '',
    sourceOfWealth: '', sourceOfFunds: '',
    file: null, evidence: [],
  };
  const draft = findDraft(drafts, subject.holder);
  if (!draft) return base;
  const filled = Object.fromEntries(Object.entries(draft).filter(([, v]) => isFilled(v)));
  return { ...base, ...filled };
};

const fmtDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};
const ownershipKind = (h) =>
  h.paths.length === 1 && (h.paths[0].chain.match(/ → /g) || []).length === 1 ? 'Direct' : 'Indirect';

const isForeignEntity = (entityType, country) =>
  entityType === 'FOREIGN_LEGAL_PERSON' ||
  (country && country.trim().toLowerCase() !== 'ethiopia');

/* ==========================================================================
   Icons
   ========================================================================== */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const I = {
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
};

/* ==========================================================================
   Small components
   ========================================================================== */
function Banner({ tone = 'error', children }) {
  return (
    <div className={`nlr-banner nlr-banner--${tone}`}>
      <span className="nlr-banner__icon">{tone === 'error' ? '⚠' : tone === 'success' ? '✓' : '⚑'}</span>
      <div>{children}</div>
    </div>
  );
}
const FieldError = ({ msg }) => (msg ? <div className="nlr-field-error">{msg}</div> : null);
const FieldHint = ({ msg }) => (msg ? <div className="nlr-field-hint">{msg}</div> : null);

/* ==========================================================================
   Threshold banner — shown under entity/sector on step 1
   ========================================================================== */
function ThresholdBanner({ entityType, sector }) {
  const info = getThresholdInfo(entityType, sector);
  if (!info) return null;

  const toneClass = info.tone === 'warn' ? 'nlr-threshold--warn' : 'nlr-threshold--info';

  return (
    <div className={`nlr-threshold ${toneClass}`}>
      <div className="nlr-threshold__head">
        <span className="nlr-threshold__badge">{info.pct != null ? `≥ ${info.pct}%` : 'SPECIAL'}</span>
        <span className="nlr-threshold__title">{info.title}</span>
      </div>
      <div className="nlr-threshold__body">{info.body}</div>
      {info.note && <div className="nlr-threshold__note"><strong>Note:</strong> {info.note}</div>}
    </div>
  );
}

/* ==========================================================================
   RecordView
   ========================================================================== */
function RecordView({ f, s }) {
  const h = s.holder;
  const idType = ID_DOCUMENT_TYPES.find((t) => t.value === f.idDocumentType)?.label || f.idDocumentType;
  const idLine = [idType, f.idNumber].filter(Boolean).join(' · ');
  const docLine = f.file ? `Verified document: ${f.file.name}` : 'No verified document attached';
  const control = h
    ? ([h.qualifiesByOwnership && 'Ownership', ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c)].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';
  const pepLine = f.pep
    ? ['PEP', f.pepPosition, f.pepCountry, f.pepOrganization].filter(Boolean).join(' · ')
    : 'Not a PEP';
  const screeningLine = [
    f.sanctionsScreened && `Sanctions: ${f.sanctionsResult || 'Screened'}`,
    f.nbeFreezeScreened && `NBE Freeze: ${f.nbeFreezeResult || 'Screened'}`,
    f.adverseMediaScreened && `Adverse Media: ${f.adverseMediaResult || 'Screened'}`,
  ].filter(Boolean).join(' · ') || 'Not screened';

  const rows = [
    ['Full name', f.fullName || '—'],
    ['Nationality', f.nationality || '—'],
    ['Date of birth', fmtDate(f.dateOfBirth)],
    ['ID / passport', `${idLine || '—'} — ${docLine}`],
    ['Country of issue', f.countryOfIssue || '—'],
    ['Date of issue', fmtDate(f.dateOfIssue)],
    ['Date of expiry', fmtDate(f.dateOfExpiry)],
    ['Address', f.residentialAddress || '—'],
    ['Ownership %', h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'],
    ['Direct / indirect', h ? ownershipKind(h) : '—'],
    ['Ownership basis', f.ownershipBasis],
    ['Voting rights', f.votingRights ? `${f.votingRights}%` : '—'],
    ['Joint ownership', f.jointOwnership ? `Yes — ${f.jointOwnerNames || 'joint holders'}` : 'No'],
    ['Ownership chain', h ? h.paths.map((p) => p.chain).join('; ') : '—'],
    ['Control basis', control],
    ['PEP status', pepLine],
    ['Screening', screeningLine],
    ['Source of information', f.sourceOfInformation],
    ['Verification method', f.verificationMethod],
    ['Verification date', fmtDate(f.verificationDate)],
    ['Verification outcome', f.verificationOutcome || '—'],
    ['BO status', f.boStatus + (f.dateCeasedBo ? ` · ceased ${fmtDate(f.dateCeasedBo)}` : '')],
    ['Date became BO', fmtDate(f.dateBecameBo)],
    ['Source of wealth', f.sourceOfWealth || '—'],
    ['Source of funds', f.sourceOfFunds || '—'],
  ];

  return (
    <dl className="nlr-record">
      {rows.map(([label, value], i) => (
        <div key={label} className={`nlr-record__row${i % 2 ? ' nlr-record__row--alt' : ''}`}>
          <dt className="nlr-record__key">{label}</dt>
          <dd className="nlr-record__value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ==========================================================================
   RecordEditor
   ========================================================================== */
function EditRow({ label, req, children }) {
  return (
    <div className="nlr-record__row">
      <dt className="nlr-record__key">{label}{req && <span className="nlr-required"> *</span>}</dt>
      <dd className="nlr-record__value">{children}</dd>
    </div>
  );
}

function RecordEditor({ f, s, set, idKey, errors = {} }) {
  const h = s.holder;
  const cfg = ID_TYPE_CONFIG[f.idDocumentType] || ID_TYPE_CONFIG.OTHER;
  const inputCls = (err) => `nlr-input${err ? ' nlr-input--error' : ''}`;
  const idErr = errors.idNumber;
  const typeCfg = {
    FAYDA_ID: { max: 16, numeric: true, hint: 'Fayda must be exactly 16 digits' },
    PASSPORT: { max: 20, numeric: false, hint: '5–20 letters or digits' },
    DRIVER_LICENSE: { max: 25, numeric: false, hint: "5–25 letters, digits or '-'" },
    KEBELE_ID: { max: 20, numeric: false, hint: '3–20 letters, digits, - or /' },
    TIN: { max: 10, numeric: true, hint: 'TIN must be exactly 10 digits' },
  }[f.idDocumentType] || { max: undefined, numeric: cfg.numeric, hint: null };

  const control = h
    ? ([h.qualifiesByOwnership && 'Ownership', ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c)].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';

  return (
    <dl className="nlr-record">
      <EditRow label="Full name" req>
        <input className={inputCls(errors.fullName)} value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        <FieldError msg={errors.fullName} />
      </EditRow>
      <EditRow label="Nationality" req>
        <input className={inputCls(errors.nationality)} value={f.nationality} onChange={(e) => set({ nationality: e.target.value })} />
        <FieldError msg={errors.nationality} />
      </EditRow>
      <EditRow label="Date of birth" req>
        <input className={inputCls(errors.dateOfBirth)} type="date" max={today()} value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
        <FieldError msg={errors.dateOfBirth} />
      </EditRow>

      <EditRow label="ID / passport" req>
        <div className="nlr-record__value--stack">
          <select className="nlr-input" value={f.idDocumentType}
            onChange={(e) => set({ idDocumentType: e.target.value, idNumber: '', idTypeDetail: '' })}>
            {ID_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            id={`idnum-${idKey}`}
            className={`nlr-input nlr-input--mono${idErr ? ' nlr-input--error' : ''}`}
            inputMode={typeCfg.numeric ? 'numeric' : 'text'}
            placeholder={cfg.numberLabel}
            maxLength={typeCfg.max}
            value={f.idNumber}
            onChange={(e) => {
              let v = e.target.value;
              if (typeCfg.numeric) v = v.replace(/\D/g, '').slice(0, typeCfg.max || undefined);
              else v = v.toUpperCase().slice(0, typeCfg.max || undefined);
              set({ idNumber: v });
            }}
          />
          <FieldError msg={idErr} />
          {!idErr && typeCfg.hint && <FieldHint msg={typeCfg.hint} />}
          {cfg.detailLabel && (
            <input className="nlr-input" placeholder={cfg.detailLabel} value={f.idTypeDetail}
              onChange={(e) => set({ idTypeDetail: e.target.value })} />
          )}
          <input className="nlr-input" type="file" onChange={(e) => set({ file: e.target.files?.[0] || null })} />
        </div>
      </EditRow>

      <EditRow label="Country of issue" req>
        <input className={inputCls(errors.countryOfIssue)} value={f.countryOfIssue} onChange={(e) => set({ countryOfIssue: e.target.value })} />
        <FieldError msg={errors.countryOfIssue} />
      </EditRow>
      <EditRow label="ID date of issue" req>
        <input className={inputCls(errors.dateOfIssue)} type="date" max={today()} value={f.dateOfIssue} onChange={(e) => set({ dateOfIssue: e.target.value })} />
        <FieldError msg={errors.dateOfIssue} />
      </EditRow>
      <EditRow label="ID expiry date" req>
        <input className={inputCls(errors.dateOfExpiry)} type="date" value={f.dateOfExpiry} onChange={(e) => set({ dateOfExpiry: e.target.value })} />
        <FieldError msg={errors.dateOfExpiry} />
      </EditRow>

      <EditRow label="Address" req>
        <input className={inputCls(errors.residentialAddress)} value={f.residentialAddress} onChange={(e) => set({ residentialAddress: e.target.value })} />
        <FieldError msg={errors.residentialAddress} />
      </EditRow>

      <EditRow label="Ownership %">{h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'}</EditRow>
      <EditRow label="Direct / indirect">{h ? ownershipKind(h) : '—'}</EditRow>
      <EditRow label="Ownership basis" req>
        <select className="nlr-input" value={f.ownershipBasis} onChange={(e) => set({ ownershipBasis: e.target.value })}>
          <option value="OWNERSHIP">Ownership</option>
          <option value="CONTROL">Control (other means)</option>
          <option value="BOTH">Both ownership and control</option>
        </select>
      </EditRow>
      <EditRow label="Voting rights %">
        <input className="nlr-input" type="number" min="0" max="100" value={f.votingRights} onChange={(e) => set({ votingRights: e.target.value })} />
        <FieldHint msg="If different from ownership %" />
      </EditRow>
      <EditRow label="Joint ownership">
        <div className="nlr-record__value--stack">
          <button type="button" className={`nlr-toggle${f.jointOwnership ? ' nlr-toggle--on' : ''}`} aria-pressed={f.jointOwnership}
            onClick={() => set({ jointOwnership: !f.jointOwnership })}>
            <span className="nlr-toggle__knob" />
          </button>
          {f.jointOwnership && (
            <input className="nlr-input" placeholder="Other joint owners' names (comma-separated)"
              value={f.jointOwnerNames} onChange={(e) => set({ jointOwnerNames: e.target.value })} />
          )}
        </div>
      </EditRow>
      <EditRow label="Ownership chain">{h ? h.paths.map((p) => p.chain).join('; ') : '—'}</EditRow>
      <EditRow label="Control basis">{control}</EditRow>

      <EditRow label="PEP status">
        <div className="nlr-record__value--stack">
          <button type="button" className={`nlr-toggle${f.pep ? ' nlr-toggle--on' : ''}`} aria-pressed={f.pep}
            onClick={() => set({ pep: !f.pep })}>
            <span className="nlr-toggle__knob" />
          </button>
          {f.pep && (
            <>
              <input className="nlr-input" placeholder="PEP position" value={f.pepPosition} onChange={(e) => set({ pepPosition: e.target.value })} />
              <input className="nlr-input" placeholder="PEP country" value={f.pepCountry} onChange={(e) => set({ pepCountry: e.target.value })} />
              <input className="nlr-input" placeholder="PEP organisation" value={f.pepOrganization} onChange={(e) => set({ pepOrganization: e.target.value })} />
            </>
          )}
        </div>
      </EditRow>

      <div className="nlr-record__section">Screening</div>
      <EditRow label="Sanctions list">
        <div className="nlr-record__value--stack">
          <button type="button" className={`nlr-toggle${f.sanctionsScreened ? ' nlr-toggle--on' : ''}`} aria-pressed={f.sanctionsScreened}
            onClick={() => set({ sanctionsScreened: !f.sanctionsScreened })}>
            <span className="nlr-toggle__knob" />
          </button>
          {f.sanctionsScreened && (
            <>
              <select className="nlr-input" value={f.sanctionsResult} onChange={(e) => set({ sanctionsResult: e.target.value })}>
                <option value="">Select result…</option>
                <option value="CLEAR">Clear</option>
                <option value="POTENTIAL_MATCH">Potential match</option>
                <option value="CONFIRMED_MATCH">Confirmed match</option>
              </select>
              {f.sanctionsResult && f.sanctionsResult !== 'CLEAR' && (
                <input className="nlr-input" placeholder="Resolution / follow-up notes" value={f.sanctionsResolution}
                  onChange={(e) => set({ sanctionsResolution: e.target.value })} />
              )}
            </>
          )}
        </div>
      </EditRow>

      <EditRow label="NBE freeze list">
        <div className="nlr-record__value--stack">
          <button type="button" className={`nlr-toggle${f.nbeFreezeScreened ? ' nlr-toggle--on' : ''}`} aria-pressed={f.nbeFreezeScreened}
            onClick={() => set({ nbeFreezeScreened: !f.nbeFreezeScreened })}>
            <span className="nlr-toggle__knob" />
          </button>
          {f.nbeFreezeScreened && (
            <>
              <select className="nlr-input" value={f.nbeFreezeResult} onChange={(e) => set({ nbeFreezeResult: e.target.value })}>
                <option value="">Select result…</option>
                <option value="CLEAR">Clear</option>
                <option value="POTENTIAL_MATCH">Potential match</option>
                <option value="CONFIRMED_MATCH">Confirmed match</option>
              </select>
              {f.nbeFreezeResult && f.nbeFreezeResult !== 'CLEAR' && (
                <input className="nlr-input" placeholder="Resolution / follow-up notes" value={f.nbeFreezeResolution}
                  onChange={(e) => set({ nbeFreezeResolution: e.target.value })} />
              )}
            </>
          )}
        </div>
      </EditRow>

      <EditRow label="Adverse media">
        <div className="nlr-record__value--stack">
          <button type="button" className={`nlr-toggle${f.adverseMediaScreened ? ' nlr-toggle--on' : ''}`} aria-pressed={f.adverseMediaScreened}
            onClick={() => set({ adverseMediaScreened: !f.adverseMediaScreened })}>
            <span className="nlr-toggle__knob" />
          </button>
          {f.adverseMediaScreened && (
            <>
              <select className="nlr-input" value={f.adverseMediaResult} onChange={(e) => set({ adverseMediaResult: e.target.value })}>
                <option value="">Select result…</option>
                <option value="CLEAR">Clear</option>
                <option value="POTENTIAL_MATCH">Potential match</option>
                <option value="CONFIRMED_MATCH">Confirmed match</option>
              </select>
              {f.adverseMediaResult && f.adverseMediaResult !== 'CLEAR' && (
                <input className="nlr-input" placeholder="Resolution / follow-up notes" value={f.adverseMediaResolution}
                  onChange={(e) => set({ adverseMediaResolution: e.target.value })} />
              )}
            </>
          )}
        </div>
      </EditRow>

      <div className="nlr-record__section">Lifecycle & verification</div>
      <EditRow label="BO status" req>
        <select className="nlr-input" value={f.boStatus} onChange={(e) => set({ boStatus: e.target.value })}>
          <option value="ACTIVE">Active</option>
          <option value="CEASED">Ceased</option>
        </select>
      </EditRow>
      <EditRow label="Date became BO" req>
        <input className="nlr-input" type="date" max={today()} value={f.dateBecameBo} onChange={(e) => set({ dateBecameBo: e.target.value })} />
      </EditRow>
      {f.boStatus === 'CEASED' && (
        <EditRow label="Date ceased to be BO" req>
          <input className="nlr-input" type="date" max={today()} value={f.dateCeasedBo} onChange={(e) => set({ dateCeasedBo: e.target.value })} />
        </EditRow>
      )}
      <EditRow label="Verification method" req>
        <select className="nlr-input" value={f.verificationMethod} onChange={(e) => set({ verificationMethod: e.target.value })}>
          <option value="DOCUMENT_VERIFICATION">Document verification</option>
          <option value="IN_PERSON">In-person</option>
          <option value="DIGITAL">Digital / electronic</option>
          <option value="THIRD_PARTY">Third-party data provider</option>
          <option value="FIELD_VISIT">Field visit</option>
        </select>
      </EditRow>
      <EditRow label="Verification date" req>
        <input className="nlr-input" type="date" max={today()} value={f.verificationDate} onChange={(e) => set({ verificationDate: e.target.value })} />
      </EditRow>
      <EditRow label="Verification outcome">
        <select className="nlr-input" value={f.verificationOutcome} onChange={(e) => set({ verificationOutcome: e.target.value })}>
          <option value="">Pending outcome</option>
          <option value="VERIFIED">Verified</option>
          <option value="PARTIAL">Partially verified</option>
          <option value="FAILED">Failed verification</option>
        </select>
      </EditRow>
      <EditRow label="ID verification status" req>
        <select className="nlr-input" value={f.idVerificationStatus} onChange={(e) => set({ idVerificationStatus: e.target.value })}>
          {ID_VERIFICATION_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </EditRow>
      <EditRow label="Source of information" req>
        <select className="nlr-input" value={f.sourceOfInformation} onChange={(e) => set({ sourceOfInformation: e.target.value })}>
          {SOURCES_OF_INFORMATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </EditRow>
      <EditRow label="Source of wealth" req={f.pep}>
        <input className="nlr-input" placeholder="Obtained where required" value={f.sourceOfWealth}
          onChange={(e) => set({ sourceOfWealth: e.target.value })} />
      </EditRow>
      <EditRow label="Source of funds">
        <input className="nlr-input" placeholder="Obtained where required" value={f.sourceOfFunds}
          onChange={(e) => set({ sourceOfFunds: e.target.value })} />
      </EditRow>

      <div className="nlr-record__section">Other details</div>
      <EditRow label="Gender" req>
        <select className="nlr-input" value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
          <option value="">Select…</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </EditRow>
      <EditRow label="Place of birth" req>
        <input className="nlr-input" value={f.placeOfBirth} onChange={(e) => set({ placeOfBirth: e.target.value })} />
      </EditRow>
      <EditRow label="Residential status" req>
        <select className="nlr-input" value={f.residentialStatus} onChange={(e) => set({ residentialStatus: e.target.value })}>
          <option value="RESIDENT">Resident</option>
          <option value="NON_RESIDENT">Non-resident</option>
        </select>
      </EditRow>
      <EditRow label="Email address" req>
        <input className={inputCls(errors.emailAddress)} type="email" value={f.emailAddress}
          onChange={(e) => set({ emailAddress: e.target.value })} />
        <FieldError msg={errors.emailAddress} />
      </EditRow>
      <EditRow label="Telephone number" req>
        <input className={`nlr-input nlr-input--mono${errors.phoneNumber ? ' nlr-input--error' : ''}`} value={f.phoneNumber}
          onChange={(e) => set({ phoneNumber: e.target.value })} />
        <FieldError msg={errors.phoneNumber} />
        {!errors.phoneNumber && <FieldHint msg="9–15 digits, +/spaces/-/() allowed" />}
      </EditRow>
      <EditRow label="Occupation / profession">
        <input className="nlr-input" value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} />
      </EditRow>
      <EditRow label="Remark">
        <input className="nlr-input" value={f.additionalInformation} onChange={(e) => set({ additionalInformation: e.target.value })} />
      </EditRow>
      <EditRow label="Supporting evidence">
        <input className="nlr-input" type="file" multiple onChange={(e) => set({ evidence: Array.from(e.target.files || []) })} />
      </EditRow>
    </dl>
  );
}

/* ==========================================================================
   Combobox & Stepper
   ========================================================================== */
function Combobox({ options, value, onChange, placeholder = 'Search…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);
  const [existingDocs, setExistingDocs] = useState({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => { setHi(0); }, [query]);
  const pick = (o) => { onChange(o.value); setOpen(false); setQuery(''); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  useEffect(() => {
    if (!legalPersonId || mode !== 'existing') return;
    listLegalPersonDocuments(legalPersonId)
      .then((docs) => {
        // Build a lookup of uploaded docs by docType
        const byType = {};
        docs.forEach((d) => { byType[d.docType] = d; });
        setExistingDocs(byType);
      })
      .catch(() => setExistingDocs({}));
  }, [legalPersonId, mode]);

  return (
    <div className="nlr-combo" ref={ref}>
      <input type="text" className="nlr-input" role="combobox" aria-expanded={open}
        value={open ? query : (selected ? `${selected.label}${selected.sub ? ` (${selected.sub})` : ''}` : '')}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="nlr-combo__list" role="listbox">
          {filtered.length === 0 && <li className="nlr-combo__empty">No customer found</li>}
          {filtered.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`nlr-combo__item${i === hi ? ' nlr-combo__item--hi' : ''}${o.value === value ? ' nlr-combo__item--selected' : ''}`}>
              <span>{o.label}</span>
              {o.sub && <span className="nlr-combo__sub">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stepper({ step, onGo }) {
  return (
    <ol className="nlr-stepper">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <li key={s.key} onClick={() => done && onGo(i)}
            className={`nlr-step${active ? ' nlr-step--active' : ''}${done ? ' nlr-step--done' : ''}${done ? ' nlr-step--clickable' : ''}`}>
            <span className="nlr-step__num">{done ? '✓' : i + 1}</span>
            <span className="nlr-step__text">
              <span className="nlr-step__title">{s.title}</span>
              <span className="nlr-step__sub">{s.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ==========================================================================
   Main wizard
   ========================================================================== */
export default function NewLegalRegistration() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [legalPersons, setLegalPersons] = useState([]);
  const [mode, setMode] = useState('existing');
  const [legalPersonId, setLegalPersonId] = useState('');
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [customerErrors, setCustomerErrors] = useState({});
  const [legalDocs, setLegalDocs] = useState({});

  const [tree, setTree] = useState(null);
  const [controlDraft, setControlDraft] = useState({});
  const [smo, setSmo] = useState(EMPTY_SMO);
  const [personDrafts, setPersonDrafts] = useState({});
  const [startWithPerson, setStartWithPerson] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [forms, setForms] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [viewMode, setViewMode] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState({});

  const failMsg = (err, fallback) => {
    const base = err?.friendlyMessage || err?.message || fallback;
    const details = Array.isArray(err?.details) ? err.details : [];
    return details.length ? `${base} — ${details.join('; ')}` : base;
  };

  useEffect(() => {
    listLegalPersons({ size: 200, sort: 'name' })
      .then((res) => {
        const list = res.content || [];
        setLegalPersons(list);
        if (list.length > 0) selectCustomer(list[0]); else setMode('new');
      })
      .catch((err) => setError(failMsg(err, 'Failed to load customers')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCustomer = (lp) => {
    setLegalPersonId(lp.id);
    setCustomer({
      name: lp.name || '', registrationNumber: lp.registrationNumber || '',
      entityType: lp.entityType || 'SHARE_COMPANY', tin: lp.tin || '',
      countryOfIncorporation: lp.countryOfIncorporation || '',
      sector: lp.sector || '',
      directorsAndManagement: lp.directorsAndManagement || '',
      cifNumber: lp.cifNumber || '',
    });
    setCustomerErrors({});
  };

  const refreshTree = async () => {
    const t = await getOwnershipTree(legalPersonId);
    setTree(t);
    setControlDraft((d) => {
      const next = { ...d };
      t.holders.forEach((h) => {
        if (!next[h.key] || !next[h.key].dirty) {
          next[h.key] = { controlBasis: h.controlBasis, controlNotes: '', dirty: false };
        }
      });
      return next;
    });
    return t;
  };

  useEffect(() => {
    if (step >= 2 && legalPersonId) refreshTree().catch((err) => setError(failMsg(err, 'Failed to load ownership structure')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, legalPersonId]);
  useEffect(() => { if (step !== 1) setStartWithPerson(false); }, [step]);

  const go = (i) => { setError(null); setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (err) { setError(failMsg(err, 'Action failed')); }
    finally { setBusy(false); }
  };

  const isForeign = isForeignEntity(customer.entityType, customer.countryOfIncorporation);

  const validateCustomer = () => {
    const errs = {};
    if (!customer.name.trim()) errs.name = 'Legal entity name is required';
    if (!customer.registrationNumber.trim()) errs.registrationNumber = 'Registration number is required';
    const tinErr = validateTin(customer.tin); if (tinErr) errs.tin = tinErr;
    if (!customer.countryOfIncorporation.trim()) errs.countryOfIncorporation = 'Country is required';
    if (!customer.sector) errs.sector = 'Sector is required';
//     if (!customer.cifNumber.trim()) errs.cifNumber = 'CIF number is required';
    LEGAL_DOC_TYPES.filter((d) => d.required || (d.foreignOnly && isForeign)).forEach((d) => {
      if (!legalDocs[d.key]) errs[`doc_${d.key}`] = `${d.label} is required`;
    });
    return errs;
  };

  const nextFromCustomer = () => run(async () => {
    const errs = validateCustomer();
    setCustomerErrors(errs);
    if (Object.keys(errs).length > 0) throw new Error('Please fix the errors in the form.');

    if (customer.tin) {
      const unique = await isTinUnique(customer.tin, mode === 'existing' ? legalPersonId : null, legalPersons);
      if (!unique) {
        setCustomerErrors({ tin: `TIN ${customer.tin} is already registered .` });
        throw new Error('TIN is already in use.');
      }
    }

    if (mode === 'new') {
      const created = await createLegalPerson(customer);
      setLegalPersons((l) => [...l, created]);
      setLegalPersonId(created.id);
      setMode('existing');
    } else {
      await updateLegalPersonProfile(legalPersonId, {
        tin: customer.tin, countryOfIncorporation: customer.countryOfIncorporation,
        sector: customer.sector,
        directorsAndManagement: customer.directorsAndManagement,
        cifNumber: customer.cifNumber,
        entityType: customer.entityType,
      });
    }

   for (const [docKey, file] of Object.entries(legalDocs)) {
     if (!file) continue;
     try {
       await uploadLegalPersonDocument(legalPersonId, file, DOC_KEY_TO_TYPE[docKey] || 'OTHER');
     } catch (e) {
       console.warn('Legal doc upload failed', docKey, e);
     }
   }

    setTree(null);
    go(1);
  });

  const nextFromStructure = () => {
    if (!tree || tree.shareholders.length === 0) { setError('Add at least one shareholder before continuing.'); return; }
    if (tree.warnings.length > 0 && !window.confirm('Tracing is incomplete (see the warnings). Continue anyway?')) return;
    go(2);
  };

  const saveControl = async (holder) => {
    const d = controlDraft[holder.key];
    const t = await updateNodeControl(legalPersonId, holder.ownershipNodeId, {
      controlBasis: d.controlBasis, controlNotes: d.controlNotes || null,
    });
    setTree(t);
    setControlDraft((x) => ({ ...x, [holder.key]: { ...d, dirty: false } }));
  };

  const nextFromControl = () => run(async () => {
    for (const h of tree.holders) {
      if (controlDraft[h.key]?.dirty && !h.registered) await saveControl(h);
    }
    const t = await refreshTree();
    go(t.holders.some((h) => h.ubo) ? 4 : 3);
  });

  const submitSmo = () => run(async () => {
    setTree(await saveSeniorManagingOfficial(legalPersonId, smo));
    setSmo(EMPTY_SMO);
  });

  const nextFromFallback = () => {
    if (tree?.seniorManagingOfficialAllowed && !tree.seniorManagingOfficial) {
      setError('Record the senior managing official (and the reasonable measures taken) to continue.');
      return;
    }
    go(tree?.seniorManagingOfficialAllowed ? 5 : 4);
  };

  useEffect(() => {
    if ((step !== 4 && step !== 5) || !tree) return;
    const list = tree.holders.filter((h) => h.ubo && (!h.registered || results[h.key]?.status === 'created'))
      .map((h) => ({ key: h.key, kind: 'ubo', holder: h }));
    if (list.length === 0 && tree.seniorManagingOfficialAllowed && tree.seniorManagingOfficial) {
      list.push({ key: 'smo', kind: 'smo', smo: tree.seniorManagingOfficial });
    }
    setSubjects(list);
    setForms((f) => {
      const next = { ...f };
      list.forEach((s) => {
        if (!next[s.key]) next[s.key] = emptySubjectForm(s, personDrafts);
        else if (s.holder) next[s.key] = fillFromDraft(next[s.key], findDraft(personDrafts, s.holder));
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tree, personDrafts]);

  const validateSubjectForm = async (f, subject) => {
    const errs = {};
    if (!f.fullName?.trim()) errs.fullName = 'Full name is required';
    if (!f.nationality?.trim()) errs.nationality = 'Nationality is required';
    if (!f.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    if (!f.residentialAddress?.trim()) errs.residentialAddress = 'Address is required';
    if (!f.countryOfIssue?.trim()) errs.countryOfIssue = 'Country of issue is required';
    if (!f.dateOfIssue) errs.dateOfIssue = 'ID date of issue is required';
    if (!f.dateOfExpiry) errs.dateOfExpiry = 'ID date of expiry is required';

    const idErr = validateIdFor(f.idDocumentType, f.idNumber);
    if (idErr) errs.idNumber = idErr;
    else {
      const unique = await isIdUnique(f.idNumber, f.idDocumentType, subject?.id);
      if (!unique) errs.idNumber = `${ID_DOCUMENT_TYPES.find((t) => t.value === f.idDocumentType)?.label || 'ID'} ${f.idNumber} is already registered.`;
    }

    const phoneErr = validatePhone(f.phoneNumber); if (phoneErr) errs.phoneNumber = phoneErr;
    const emailErr = validateEmail(f.emailAddress); if (emailErr) errs.emailAddress = emailErr;
    if (f.boStatus === 'CEASED' && !f.dateCeasedBo) errs.dateCeasedBo = 'Ceased date is required';

    return errs;
  };

  const setForm = (key, patch) => setForms((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  const incomplete = useMemo(
    () => subjects.filter((s) => results[s.key]?.status !== 'created' && forms[s.key] && personMissing(forms[s.key]).length > 0),
    [subjects, forms, results],
  );

  const nextFromVerify = async () => {
    if (subjects.length === 0) { setError('There is no beneficial owner to register for this customer.'); return; }
    setBusy(true);
    const allErrors = {};
    let hasErrors = false;
    for (const s of subjects) {
      if (results[s.key]?.status === 'created') continue;
      const f = forms[s.key]; if (!f) continue;
      const errs = await validateSubjectForm(f, s);
      if (Object.keys(errs).length > 0) { allErrors[s.key] = errs; hasErrors = true; }
    }
    setBusy(false);
    setFormErrors(allErrors);
    if (hasErrors) { setError('Please fix the validation errors below.'); return; }
    if (incomplete.length > 0) {
      setError(`Complete the verification details for: ${incomplete.map((s) => forms[s.key].fullName || 'person').join(', ')}`);
      return;
    }
    go(5);
  };

  const smoPayload = (s) => ({
    legalPersonId, fullName: s.smo.name.trim(), occupation: s.smo.position,
    additionalInformation: s.smo.justification || null, capacity: 'SENIOR_MANAGING_OFFICIAL',
    ownershipType: 'CONTROL_BY_OTHER_MEANS', ownershipPercentage: 0,
  });

  const finalSubmit = () => run(async () => {
    if (!confirmed) throw new Error('Please confirm the declaration before submitting.');
    const nextResults = { ...results };
    for (const s of subjects) {
      if (nextResults[s.key]?.status === 'created') continue;
      const f = forms[s.key];
      const ownershipPart = s.kind === 'ubo'
        ? {
            ownershipNodeId: s.holder.ownershipNodeId,
            ownershipType: ownershipKind(s.holder) === 'Direct' ? 'DIRECT' : 'INDIRECT',
            ownershipPercentage: Number(s.holder.effectivePercentage),
            votingRights: f.votingRights ? Number(f.votingRights) : null,
            ownershipBasis: f.ownershipBasis,
            jointOwnership: f.jointOwnership,
            jointOwnerNames: f.jointOwnerNames || null,
          }
        : { capacity: 'SENIOR_MANAGING_OFFICIAL', ownershipType: 'CONTROL_BY_OTHER_MEANS', ownershipPercentage: 0 };
      try {
        const created = await createBoRecord(s.kind === 'smo' ? smoPayload(s) : {
          legalPersonId,
          fullName: f.fullName.trim(), gender: f.gender, dateOfBirth: f.dateOfBirth,
          placeOfBirth: f.placeOfBirth.trim(), residentialStatus: f.residentialStatus,
          emailAddress: f.emailAddress.trim(), phoneNumber: f.phoneNumber.trim(),
          occupation: f.occupation.trim(), dateOfIssue: f.dateOfIssue,
          sourceOfInformation: f.sourceOfInformation,
          additionalInformation: f.additionalInformation || null,
          idDocumentType: f.idDocumentType, idVerificationStatus: f.idVerificationStatus,
          idTypeDetail: ID_TYPE_CONFIG[f.idDocumentType]?.detailLabel ? f.idTypeDetail.trim() : null,
          idNumber: f.idNumber.trim(), nationality: f.nationality.trim(),
          residentialAddress: f.residentialAddress.trim(), countryOfIssue: f.countryOfIssue.trim(),
          dateOfExpiry: f.dateOfExpiry, dateBecameBo: f.dateBecameBo,
          boStatus: f.boStatus, dateCeasedBo: f.boStatus === 'CEASED' ? f.dateCeasedBo : null,
          pep: f.pep, pepPosition: f.pepPosition || null, pepCountry: f.pepCountry || null, pepOrganization: f.pepOrganization || null,
          sanctionsScreened: f.sanctionsScreened, sanctionsResult: f.sanctionsResult || null, sanctionsResolution: f.sanctionsResolution || null,
          nbeFreezeScreened: f.nbeFreezeScreened, nbeFreezeResult: f.nbeFreezeResult || null, nbeFreezeResolution: f.nbeFreezeResolution || null,
          adverseMediaScreened: f.adverseMediaScreened, adverseMediaResult: f.adverseMediaResult || null, adverseMediaResolution: f.adverseMediaResolution || null,
          verificationMethod: f.verificationMethod, verificationDate: f.verificationDate, verificationOutcome: f.verificationOutcome || null,
          sourceOfWealth: f.sourceOfWealth || null, sourceOfFunds: f.sourceOfFunds || null,
          ...ownershipPart,
        }, true);
        let docWarning = null;
        for (const file of [f.file, ...f.evidence]) {
          if (!file) continue;
          try { await uploadDocument(created.id, file); }
          catch { docWarning = 'Record submitted, but a document upload failed — upload it again from the record page.'; }
        }
        nextResults[s.key] = { status: 'created', ref: created.boReference, docWarning };
      } catch (err) {
        nextResults[s.key] = { status: 'error', error: failMsg(err, 'Failed to submit') };
      }
      setResults({ ...nextResults });
    }
    setResults(nextResults);
  });

  const reset = () => {
    setStep(0); setTree(null); setSubjects([]); setForms({}); setResults({}); setConfirmed(false);
    setControlDraft({}); setSmo(EMPTY_SMO); setPersonDrafts({}); setViewMode({}); setError(null);
    setCustomerErrors({}); setFormErrors({}); setLegalDocs({});
    if (legalPersons.length > 0) { setMode('existing'); selectCustomer(legalPersons[0]); }
    else { setMode('new'); setCustomer(EMPTY_CUSTOMER); }
  };

  const allCreated = subjects.length > 0 && subjects.every((s) => results[s.key]?.status === 'created');
  const anyFailed = subjects.some((s) => results[s.key]?.status === 'error');
  const hasUbo = !!tree?.holders.some((h) => h.ubo);
  const backTarget = () => {
    if (step === 4 && hasUbo) return 2;
    if (step === 5 && !hasUbo) return 3;
    return step - 1;
  };

  const Nav = ({ onNext, nextLabel = 'Continue', hideBack, disabled }) => (
    <div className="nlr-nav">
      {!hideBack && step > 0 && !allCreated
        ? <button type="button" className="nlr-btn nlr-btn--outline" disabled={busy} onClick={() => go(backTarget())}>← Back</button>
        : <span />}
      {onNext && (
        <button type="button" className="nlr-btn nlr-btn--primary" disabled={busy || disabled} onClick={onNext}>
          {busy ? 'Please wait…' : nextLabel} →
        </button>
      )}
    </div>
  );

  const customerInputCls = (field) => `nlr-input${customerErrors[field] ? ' nlr-input--error' : ''}`;

  return (
    <div className="nlr-root">
      <div className="nlr-container">
        <div className="nlr-page-head">
          <h1 className="nlr-page-head__title">Customer Entity</h1>
          <p className="nlr-page-head__desc">
            Identify the customer, trace the ownership structure, examine control, verify each UBO, then submit for checker approval.
          </p>
        </div>

        <Stepper step={step} onGo={go} />
        {error && <Banner tone="error">{error}</Banner>}

        {step === 0 && (
          <div className="nlr-card">
            <div className="nlr-segmented">
              <button type="button"
                className={`nlr-segmented__btn${mode === 'existing' ? ' nlr-segmented__btn--active' : ''}`}
                disabled={legalPersons.length === 0}
                onClick={() => { setMode('existing'); if (legalPersons[0]) selectCustomer(legalPersons[0]); }}>
                Existing Legal Person
              </button>
              <button type="button"
                className={`nlr-segmented__btn${mode === 'new' ? ' nlr-segmented__btn--active' : ''}`}
                onClick={() => { setMode('new'); setCustomer(EMPTY_CUSTOMER); setLegalPersonId(''); setCustomerErrors({}); setLegalDocs({}); }}>
                New Legal Person
              </button>
            </div>

            {mode === 'existing' && (
              <div style={{ marginBottom: 18 }}>
                <Field label="Legal Name">
                  <Combobox
                    value={legalPersonId}
                    placeholder="Search by name or registration number…"
                    options={legalPersons.map((lp) => ({ value: lp.id, label: lp.name, sub: lp.registrationNumber }))}
                    onChange={(id) => { const lp = legalPersons.find((c) => c.id === id); if (lp) selectCustomer(lp); }}
                  />
                </Field>
              </div>
            )}

            <div className="nlr-grid-3">
              <Field label="Legal Name" required>
                <input className={customerInputCls('name')} value={customer.name} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                <FieldError msg={customerErrors.name} />
              </Field>
              <Field label="Registration number" required>
                <input className={`nlr-input nlr-input--mono${customerErrors.registrationNumber ? ' nlr-input--error' : ''}`}
                  value={customer.registrationNumber} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, registrationNumber: e.target.value })} />
                <FieldError msg={customerErrors.registrationNumber} />
              </Field>
              <Field label="Entity type" required>
                <select className="nlr-input" value={customer.entityType} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, entityType: e.target.value })}>
                  {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="nlr-grid-3">
              <Field label="TIN" required>
                <input className={`nlr-input nlr-input--mono${customerErrors.tin ? ' nlr-input--error' : ''}`}
                  inputMode="numeric" maxLength={10} placeholder="10 digits" value={customer.tin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setCustomer({ ...customer, tin: v });
                    if (customerErrors.tin) setCustomerErrors({ ...customerErrors, tin: null });
                  }} />
                <FieldError msg={customerErrors.tin} />
                {!customerErrors.tin && <FieldHint msg="" />}
              </Field>
              <Field label="CIF number" >
                <input className={`nlr-input nlr-input--mono${customerErrors.cifNumber ? ' nlr-input--error' : ''}`}
                  placeholder="Core Banking CIF" value={customer.cifNumber}
                  onChange={(e) => setCustomer({ ...customer, cifNumber: e.target.value })} />
                <FieldError msg={customerErrors.cifNumber} />
                <FieldHint msg="" />
              </Field>
              <Field label="Country" required>
                <input className={customerInputCls('countryOfIncorporation')} value={customer.countryOfIncorporation}
                  onChange={(e) => setCustomer({ ...customer, countryOfIncorporation: e.target.value })} />
                <FieldError msg={customerErrors.countryOfIncorporation} />
              </Field>
            </div>

            {/* Sector dropdown (replaces free-text nature of business) */}
            <Field label="Sector" required>
              <select
                className={`nlr-input${customerErrors.sector ? ' nlr-input--error' : ''}`}
                value={customer.sector}
                onChange={(e) => {
                  setCustomer({ ...customer, sector: e.target.value });
                  if (customerErrors.sector) setCustomerErrors({ ...customerErrors, sector: null });
                }}
              >
                {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <FieldError msg={customerErrors.sector} />
            </Field>

            {/* Threshold banner — updates live with entity + sector */}
            <ThresholdBanner entityType={customer.entityType} sector={customer.sector} />

            <Field label="Directors and senior management">
              <textarea className="nlr-input" style={{ minHeight: 72, resize: 'vertical' }}
                value={smo.directorsAndManagement}
                onChange={(e) => setSmo({ ...smo, directorsAndManagement: e.target.value })} />
            </Field>

            {customer.entityType === 'ONE_MEMBER_PLC' && (
              <div className="nlr-filled-banner" style={{ marginTop: 14 }}>
                <span style={{ flexShrink: 0 }}>{I.info}</span>
                <div>
                  <strong>One Member PLC:</strong> the sole owner <em>and</em> the general manager must both be registered as beneficial owners.
                </div>
              </div>
            )}

            {isForeign && (
              <div className="nlr-filled-banner" style={{ marginTop: 14 }}>
                <span style={{ flexShrink: 0 }}>{I.info}</span>
                <div>
                  <strong>Foreign legal person:</strong> country of registration is <strong>{customer.countryOfIncorporation || 'not set'}</strong>. Upload a home-jurisdiction official document below.
                </div>
              </div>
            )}

            <div className="nlr-record__section" style={{ marginTop: 20 }}>Supporting documents</div>
            <div className="nlr-grid-2" style={{ marginTop: 10 }}>

             {LEGAL_DOC_TYPES.map((d) => {
               const existing = existingDocs[DOC_KEY_TO_TYPE[d.key]];
               return (
                 <div key={d.key}>
                   <Field label={d.label}>
                     {existing ? (
                       <div style={{
                         display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                         background: 'var(--nlr-success-soft)', border: '1px solid var(--nlr-success-border)',
                         borderRadius: 'var(--nlr-radius-sm)', fontSize: 12.5,
                       }}>
                         <span style={{ color: 'var(--nlr-success)', fontWeight: 700 }}>✓</span>
                         <span style={{ flex: 1, color: 'var(--nlr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                           {existing.fileName}
                         </span>
                         <button type="button"
                           className="nlr-btn nlr-btn--outline nlr-btn--sm"
                           onClick={() => downloadLegalPersonDocument(legalPersonId, existing.id, existing.fileName)}>
                           Download
                         </button>
                       </div>
                     ) : (
                       <>
                         <input
                           className="nlr-input"
                           type="file"
                           onChange={(e) => {
                             const file = e.target.files?.[0] || null;
                             setLegalDocs({ ...legalDocs, [d.key]: file });
                           }}
                         />
                         {legalDocs[d.key] && <FieldHint msg={`Selected: ${legalDocs[d.key].name}`} />}
                       </>
                     )}
                   </Field>
                 </div>
               );
             })}
            </div>

            <Nav onNext={nextFromCustomer} hideBack />
          </div>
        )}

        {/* Structure */}
        {step === 1 && (
          <>
            <OwnershipTree
              legalPersonId={legalPersonId}
              canEdit
              onTreeChange={setTree}
              startWithPerson={startWithPerson}
              onPersonSaved={(p) => setPersonDrafts((d) => ({ ...d, [personKey(p.fullName, p.idNumber)]: p }))}
            />
            <div className="nlr-card"><Nav onNext={nextFromStructure} /></div>
          </>
        )}

        {/* Control */}
        {step === 2 && tree && (
          <div className="nlr-card">
            <h3 className="nlr-h3">Examine control ownership</h3>
            <p className="nlr-hint">
              Effective ownership is calculated for you (threshold {pct(tree.thresholdPercentage)}%). A person is also a UBO
              if control is exercised by other means, even below the threshold — tick the control basis that applies.
            </p>
            {tree.holders.length === 0 && <div className="nlr-hint" style={{ padding: 16, background: 'var(--nlr-bg)', borderRadius: 'var(--nlr-radius-sm)' }}>No natural persons found yet. Go back and trace the structure further.</div>}
            {tree.holders.map((h) => {
              const d = controlDraft[h.key] || { controlBasis: [], controlNotes: '', dirty: false };
              const toggle = (c) => setControlDraft((x) => ({
                ...x,
                [h.key]: {
                  ...d, dirty: true,
                  controlBasis: d.controlBasis.includes(c) ? d.controlBasis.filter((k) => k !== c) : [...d.controlBasis, c],
                },
              }));
              return (
                <div key={h.key} className={`nlr-holder${h.ubo ? ' nlr-holder--ubo' : ''}`}>
                  <div className="nlr-holder__head">
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div className="nlr-holder__name">{h.fullName}</div>
                      <div className="nlr-holder__meta">{[h.idNumber, h.nationality].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="nlr-holder__pct">
                      <div className="nlr-holder__pct-value">{pct(h.effectivePercentage)}%</div>
                      <div className="nlr-holder__pct-label">effective</div>
                    </div>
                    <div className="nlr-holder__chips">
                      {h.qualifiesByOwnership && <span className="nlr-chip nlr-chip--ubo">Ownership UBO</span>}
                      {(h.qualifiesByControl || d.controlBasis.length > 0) && <span className="nlr-chip nlr-chip--control">Control</span>}
                      {!h.ubo && d.controlBasis.length === 0 && <span className="nlr-chip nlr-chip--muted">Below threshold</span>}
                      {h.registered && <span className="nlr-chip nlr-chip--muted">Registered {h.beneficialOwnerReference}</span>}
                    </div>
                  </div>
                  {h.paths.map((p, i) => (
                    <div key={i} className="nlr-holder__paths">{p.chain} <strong>= {pct(p.percentage)}%</strong></div>
                  ))}
                  {!h.registered && (
                    <>
                      <div className="nlr-checkbox-grid">
                        {Object.entries(controlBasisLabel).map(([k, label]) => (
                          <label key={k} className="nlr-checkbox-item">
                            <input type="checkbox" checked={d.controlBasis.includes(k)} onChange={() => toggle(k)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      {d.controlBasis.length > 0 && (
                        <Field label="Control details">
                          <input className="nlr-input" placeholder="e.g. ABC 4 of the shareholders' agreement"
                            value={d.controlNotes}
                            onChange={(e) => setControlDraft((x) => ({ ...x, [h.key]: { ...d, dirty: true, controlNotes: e.target.value } }))} />
                        </Field>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <Nav onNext={nextFromControl} nextLabel="Continue" />
          </div>
        )}

        {/* Fallback */}
        {step === 3 && tree && (
          <div className="nlr-card">
            <h3 className="nlr-h3">Senior managing official fallback</h3>
            {!tree.seniorManagingOfficialAllowed ? (
              <Banner tone="success">A natural-person UBO was identified, so the fallback is not required.</Banner>
            ) : (
              <>
                <p className="nlr-hint">No natural person owns or controls the customer after the measures taken. Record the fallback.</p>
                {tree.seniorManagingOfficial && (
                  <div style={{ background: 'var(--nlr-primary-soft)', border: '1px solid rgba(40,51,117,.2)', borderRadius: 'var(--nlr-radius-sm)', padding: 14, marginBottom: 16 }}>
                    <strong>{tree.seniorManagingOfficial.name}</strong> — {tree.seniorManagingOfficial.position}
                    <div style={{ fontSize: 12.5, color: 'var(--nlr-text-muted)', marginTop: 4 }}>{tree.seniorManagingOfficial.justification}</div>
                  </div>
                )}
                <div className="nlr-grid-2">
                  <Field label="Name" required>
                    <input className="nlr-input" value={smo.name} onChange={(e) => setSmo({ ...smo, name: e.target.value })} />
                  </Field>
                  <Field label="Position / capacity" required>
                    <input className="nlr-input" value={smo.position} onChange={(e) => setSmo({ ...smo, position: e.target.value })} />
                  </Field>
                </div>
                <Field label="Reasonable measures taken" required>
                  <input className="nlr-input" placeholder="What was done to identify the controlling natural person, and why it failed"
                    value={smo.justification} onChange={(e) => setSmo({ ...smo, justification: e.target.value })} />
                </Field>
                <button type="button" className="nlr-btn nlr-btn--primary"
                  disabled={busy || !smo.name || !smo.position || !smo.justification}
                  onClick={submitSmo}>
                  {tree.seniorManagingOfficial ? 'Update' : 'Save'}
                </button>
              </>
            )}
            <div style={{ margin: '18px 0', padding: 14, background: 'var(--nlr-surface-alt)', border: '1px dashed var(--nlr-border-strong)', borderRadius: 'var(--nlr-radius-sm)' }}>
              <button type="button" className="nlr-btn nlr-btn--ghost" disabled={busy}
                onClick={() => { setStartWithPerson(true); go(1); }}>
                + Add natural person (optional)
              </button>
            </div>
            <Nav onNext={nextFromFallback} nextLabel={tree.seniorManagingOfficialAllowed ? 'Continue to final submit' : 'Continue'} />
          </div>
        )}

        {/* Verify */}
        {step === 4 && (
          <div>
            <p className="nlr-hint" style={{ marginBottom: 16 }}>
              For each beneficial owner, obtain and verify identity, ownership, PEP, sanctions and source-of-wealth information.
            </p>
            {subjects.length === 0 && (
              <div className="nlr-card">
                <div className="nlr-hint" style={{ textAlign: 'center', padding: 16 }}>No unregistered beneficial owner found for this customer.</div>
              </div>
            )}

            {subjects.map((s, idx) => {
              const f = forms[s.key];
              if (!f) return null;
              if (results[s.key]?.status === 'created') {
                return (
                  <div key={s.key} className="nlr-card">
                    <div className="nlr-holder__head">
                      <h3 className="nlr-h3" style={{ margin: 0 }}>{idx + 1}. {f.fullName}</h3>
                      <span className="nlr-chip nlr-chip--ubo">✓ Submitted · {results[s.key].ref}</span>
                    </div>
                  </div>
                );
              }
              const miss = personMissing(f);
              const viewAs = viewMode[s.key] ?? (miss.length === 0 ? 'record' : 'form');
              const set = (patch) => {
                setViewMode((v) => (v[s.key] ? v : { ...v, [s.key]: 'form' }));
                setForm(s.key, patch);
              };
              const h = s.holder;
              const wasAutoFilled = h && findDraft(personDrafts, h);
              return (
                <div key={s.key} className="nlr-card">
                  <div className="nlr-holder__head">
                    <h3 className="nlr-h3" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {idx + 1}. {f.fullName || (s.kind === 'smo' ? 'Senior managing official' : 'Beneficial owner')}
                      {s.kind === 'smo' && <span className="nlr-chip nlr-chip--fallback">Fallback</span>}
                    </h3>
                    <span className={`nlr-chip ${miss.length === 0 ? 'nlr-chip--ubo' : 'nlr-chip--muted'}`}>
                      {miss.length === 0 ? '✓ Complete' : `${miss.length} missing`}
                    </span>
                  </div>
                  {wasAutoFilled && (
                    <div className="nlr-filled-banner">
                      <span style={{ flexShrink: 0 }}>{I.info}</span>
                      <div><strong>Details auto-filled</strong> from the ownership structure step.</div>
                    </div>
                  )}
                  <div className="nlr-derived">
                    {h ? (
                      <>
                        <div><strong style={{ color: 'var(--nlr-primary)' }}>{pct(h.effectivePercentage)}%</strong> effective · {ownershipKind(h)} · {h.qualifiesByOwnership ? 'Ownership' : 'Control'} basis</div>
                        {h.paths.map((p, i) => (
                          <div key={i} className="nlr-derived__chain">{p.chain} <strong>= {pct(p.percentage)}%</strong></div>
                        ))}
                      </>
                    ) : (
                      <div><strong>{s.smo.position}</strong> — recorded as the senior managing official (CDD fallback).</div>
                    )}
                  </div>
                  {viewAs === 'form' && miss.length === 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <button type="button" className="nlr-btn nlr-btn--outline"
                        onClick={() => setViewMode((v) => ({ ...v, [s.key]: 'record' }))}>
                        Preview record
                      </button>
                    </div>
                  )}
                  {viewAs === 'record' ? (
                    <RecordView f={f} s={s} />
                  ) : (
                    <RecordEditor f={f} s={s} set={set} idKey={s.key} errors={formErrors[s.key] || {}} />
                  )}
                </div>
              );
            })}
            <div className="nlr-card"><Nav onNext={nextFromVerify} nextLabel="Continue" /></div>
          </div>
        )}

        {/* Confirm & submit */}
        {step === 5 && (
          <div className="nlr-card">
            <h3 className="nlr-h3">Confirm and Final submit</h3>
            <p className="nlr-hint">Submitting sends every beneficial owner below to a checker for approving.</p>

            <div style={{ background: 'var(--nlr-surface-alt)', border: '1px solid var(--nlr-border)', borderRadius: 'var(--nlr-radius-sm)', padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--nlr-text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Customer</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{customer.name}</div>
              <div style={{ fontSize: 13, color: 'var(--nlr-text-muted)', marginTop: 2 }}>
                {customer.registrationNumber} · TIN {customer.tin} · CIF {customer.cifNumber || '—'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--nlr-text-muted)' }}>
                {customer.countryOfIncorporation} · Sector: {SECTORS.find((s) => s.value === customer.sector)?.label || '—'}
              </div>
            </div>

            <div className="nlr-table">
              <table>
                <thead>
                  <tr>
                    {['Full Name', 'Capacity', 'Ownership', 'PEP', 'Screening', 'BO status', 'Document', 'Result'].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => {
                    const f = forms[s.key];
                    const r = results[s.key];
                    return (
                      <tr key={s.key}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{f.fullName}</div>
                          <div className="nlr-table__mono">{f.idNumber}</div>
                        </td>
                        <td>{s.kind === 'smo' ? 'Senior managing official' : (s.holder.qualifiesByOwnership ? 'Ownership' : 'Control')}</td>
                        <td>{s.kind === 'smo' ? '—' : `${pct(s.holder.effectivePercentage)}%`}</td>
                        <td>{s.kind === 'smo' ? '—' : (f.pep ? 'Yes' : 'No')}</td>
                        <td>{[f.sanctionsScreened && 'Sanctions', f.nbeFreezeScreened && 'NBE', f.adverseMediaScreened && 'Media'].filter(Boolean).join(', ') || '—'}</td>
                        <td>{f.boStatus}</td>
                        <td>{[f.file, ...f.evidence].filter(Boolean).length} file(s)</td>
                        <td>
                          {r?.status === 'created' && <><span className="nlr-chip nlr-chip--ubo">✓ Submitted</span> <span className="nlr-table__mono">{r.ref}</span></>}
                          {r?.status === 'error' && <span style={{ fontSize: 11.5, color: 'var(--nlr-danger)' }}>{r.error}</span>}
                          {!r && <span style={{ color: 'var(--nlr-text-faint)' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!allCreated && (
              <label className="nlr-confirm">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>I confirm the information is adequate, accurate and up to date.</span>
              </label>
            )}

            {allCreated ? (
              <>
                <Banner tone="success">All beneficial owners were submitted for checker approval.</Banner>
                <div className="nlr-nav"><span /><button type="button" className="nlr-btn nlr-btn--primary" onClick={reset}>Register another customer</button></div>
              </>
            ) : (
              <Nav onNext={finalSubmit} nextLabel={anyFailed ? 'Retry failed' : 'Final submit'} disabled={!confirmed} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
