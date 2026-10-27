
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createBoRecord,
  createLegalPerson,
  getOwnershipTree,
  listLegalPersons,
  saveSeniorManagingOfficial,
  updateLegalPersonProfile,
  updateNodeControl,
  uploadDocument,
} from '../api/bovsApi.js';
import OwnershipTree from '../components/OwnershipTree.jsx';
import { controlBasisLabel } from '../data/records.js';
import {
  ID_DOCUMENT_TYPES,
  ID_TYPE_CONFIG,
  ID_VERIFICATION_STATUSES,
  SOURCES_OF_INFORMATION,
  personMissing,
  today,
} from '../data/uboForm.js';
import Field from '../components/Field.jsx';

/* ==========================================================================
   Design tokens & style helpers
   ========================================================================== */
const T = {
  bg: '#f6f8fb',
  surface: '#ffffff',
  border: '#e3e8ef',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primarySoft: '#eff6ff',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
  shadowMd: '0 4px 12px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

const s = {
  page: { fontFamily: T.font, background: T.bg, minHeight: '100vh', padding: '32px 24px', color: T.text, fontSize: 14, lineHeight: 1.55 },
  container: { maxWidth: 960, margin: '0 auto' },
  h1: { fontSize: 26, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-.02em' },
  h3: { fontSize: 17, fontWeight: 650, margin: '0 0 4px', letterSpacing: '-.01em' },
  desc: { color: T.textMuted, fontSize: 13.5, margin: 0, maxWidth: 620 },
  card: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, boxShadow: T.shadow, marginBottom: 18 },
  hint: { color: T.textMuted, fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 4 },
  input: {
    width: '100%', padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit',
    border: `1px solid ${T.borderStrong}`, borderRadius: T.radiusSm, background: '#fff',
    color: T.text, transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box',
  },
  monoInput: { fontFamily: T.mono, fontSize: 13 },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` },
  btn: {
    padding: '10px 20px', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
    borderRadius: T.radiusSm, border: 'none', cursor: 'pointer',
    transition: 'background .15s, opacity .15s, transform .05s', whiteSpace: 'nowrap',
  },
  btnPrimary: { background: T.primary, color: '#fff' },
  btnOutline: { background: '#fff', color: T.text, border: `1px solid ${T.borderStrong}` },
  btnGhost: { background: 'transparent', color: T.primary, border: `1px solid ${T.primary}33` },
  banner: { padding: '12px 16px', borderRadius: T.radiusSm, fontSize: 13, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' },
  chip: { display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' },
};

const b = (key, extra) => ({ ...s.btn, ...s[key], ...(extra || {}) });

/* ==========================================================================
   Guided process steps
   ========================================================================== */
const STEPS = [
  { key: 'customer', title: 'Customer', sub: 'Add legal entity' },
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
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'ONE_MEMBER_PLC', label: 'One Member PLC' },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company' },
  { value: 'GENERAL_PARTNERSHIP', label: 'General Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'PPP', label: 'Public Private Partnership' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'PARTNERSHIP', label: 'Partnership (Other)' },
];

const EMPTY_CUSTOMER = { name: '', registrationNumber: '', entityType: '', tin: '', countryOfIncorporation: '', natureOfBusiness: '', directorsAndManagement: '' };
const CUSTOMER_REQUIRED = [
  ['name', 'Company name'],
  ['registrationNumber', 'Registration number'],
  ['tin', 'TIN'],
  ['countryOfIncorporation', 'Country of incorporation'],
  ['natureOfBusiness', 'Nature of business'],
];
const EMPTY_SMO = { name: '', position: '', justification: '', directorsAndManagement: '' };

const pct = (v) => String(Number(v ?? 0));
const personKey = (name, id) => `${(name || '').trim().toLowerCase()}|${(id || '').trim()}`;

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
    idNumber: subject.holder?.idNumber || '', nationality: subject.holder?.nationality || '',
    residentialAddress: '', countryOfIssue: '', dateOfExpiry: '', dateBecameBo: today(),
    pep: false, pepDetails: '', sanctionsScreened: false, sourceOfWealth: '', sourceOfFunds: '',
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

/* ==========================================================================
   Record view (read-only)
   ========================================================================== */
function RecordView({ f, s: subj }) {
  const h = subj.holder;
  const idType = ID_DOCUMENT_TYPES.find((t) => t.value === f.idDocumentType)?.label || f.idDocumentType;
  const idLine = [idType, f.idNumber].filter(Boolean).join(' · ');
  const docLine = f.file ? `Verified document: ${f.file.name}` : 'No verified document attached';

  const control = h
    ? ([h.qualifiesByOwnership && 'Ownership', ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c)].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';

  const rows = [
    ['Full name', f.fullName || '—'],
    ['Nationality', f.nationality || '—'],
    ['Date of birth', fmtDate(f.dateOfBirth)],
    ['ID / passport', `${idLine || '—'} — ${docLine}`],
    ['Address', f.residentialAddress || '—'],
    ['Ownership %', h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'],
    ['Direct / indirect', h ? ownershipKind(h) : '—'],
    ['Ownership chain', h ? h.paths.map((p) => p.chain).join('; ') : '—'],
    ['Control basis', control],
    ['PEP status', f.pep ? `PEP${f.pepDetails ? ` — ${f.pepDetails}` : ''}` : 'Not a PEP'],
    ['Sanctions', f.sanctionsScreened ? 'Screened' : 'Not screened'],
    ['Source of wealth', f.sourceOfWealth || '—'],
    ['Source of funds', f.sourceOfFunds || '—'],
  ];

  return (
    <dl style={{ margin: 0, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, overflow: 'hidden' }}>
      {rows.map(([label, value], i) => (
        <div key={label} style={{
          display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16,
          padding: '10px 16px', background: i % 2 ? '#fafbfc' : '#fff',
          borderTop: i ? `1px solid ${T.border}` : 'none', fontSize: 13,
        }}>
          <dt style={{ color: T.textMuted, fontWeight: 500 }}>{label}</dt>
          <dd style={{ margin: 0, color: T.text, wordBreak: 'break-word' }}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ==========================================================================
   Record editor (rows mirror RecordView)
   ========================================================================== */
function EditRow({ label, req, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, padding: '10px 16px', borderTop: `1px solid ${T.border}`, alignItems: 'center' }}>
      <dt style={{ color: T.textMuted, fontWeight: 500, fontSize: 13 }}>
        {label}{req && <span style={{ color: T.danger }}> *</span>}
      </dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </div>
  );
}

function RecordEditor({ f, s: subj, set, idKey }) {
  const h = subj.holder;
  const cfg = ID_TYPE_CONFIG[f.idDocumentType] || ID_TYPE_CONFIG.OTHER;
  const control = h
    ? ([h.qualifiesByOwnership && 'Ownership', ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c)].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';

  const input = (props) => <input {...props} style={{ ...s.input, ...(props?.mono ? s.monoInput : {}) }} />;
  const select = (props) => <select {...props} style={s.input} />;

  return (
    <dl style={{ margin: 0, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, overflow: 'hidden' }}>
      <EditRow label="Full name" req>{input({ value: f.fullName, onChange: (e) => set({ fullName: e.target.value }) })}</EditRow>
      <EditRow label="Nationality" req>{input({ value: f.nationality, onChange: (e) => set({ nationality: e.target.value }) })}</EditRow>
      <EditRow label="Date of birth" req>
        {input({ type: 'date', max: today(), value: f.dateOfBirth, onChange: (e) => set({ dateOfBirth: e.target.value }) })}
      </EditRow>
      <EditRow label="ID / passport" req>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {select({
            value: f.idDocumentType,
            onChange: (e) => set({ idDocumentType: e.target.value, idNumber: '', idTypeDetail: '' }),
            children: ID_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>),
          })}
          <input
            id={`idnum-${idKey}`}
            style={{ ...s.input, ...s.monoInput }}
            inputMode={cfg.numeric ? 'numeric' : 'text'}
            placeholder={cfg.numberLabel}
            value={f.idNumber}
            onChange={(e) => {
              let v = e.target.value;
              if (cfg.numeric) v = v.replace(/\D/g, '');
              if (cfg.upper) v = v.toUpperCase();
              set({ idNumber: v });
            }}
          />
          {cfg.detailLabel && (
            <input style={s.input} placeholder={cfg.detailLabel} value={f.idTypeDetail} onChange={(e) => set({ idTypeDetail: e.target.value })} />
          )}
          <input type="file" style={{ ...s.input, padding: 6 }} onChange={(e) => set({ file: e.target.files?.[0] || null })} />
        </div>
      </EditRow>
      <EditRow label="Address" req>{input({ value: f.residentialAddress, onChange: (e) => set({ residentialAddress: e.target.value }) })}</EditRow>

      <EditRow label="Ownership %">{h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'}</EditRow>
      <EditRow label="Direct / indirect">{h ? ownershipKind(h) : '—'}</EditRow>
      <EditRow label="Ownership chain">{h ? h.paths.map((p) => p.chain).join('; ') : '—'}</EditRow>
      <EditRow label="Control basis">{control}</EditRow>

      <EditRow label="PEP status">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle on={f.pep} label="Toggle PEP" onClick={() => set({ pep: !f.pep })} />
          {f.pep && input({ placeholder: 'PEP details', value: f.pepDetails, onChange: (e) => set({ pepDetails: e.target.value }) })}
        </div>
      </EditRow>
      <EditRow label="Sanctions">
        <Toggle on={f.sanctionsScreened} label="Toggle sanctions screened" onClick={() => set({ sanctionsScreened: !f.sanctionsScreened })} />
      </EditRow>
      <EditRow label="Source of wealth" req={f.pep}>
        {input({ placeholder: 'Obtained where required', value: f.sourceOfWealth, onChange: (e) => set({ sourceOfWealth: e.target.value }) })}
      </EditRow>
      <EditRow label="Source of funds">
        {input({ placeholder: 'Obtained where required', value: f.sourceOfFunds, onChange: (e) => set({ sourceOfFunds: e.target.value }) })}
      </EditRow>

      <div style={{ padding: '10px 16px', background: T.primarySoft, borderTop: `1px solid ${T.border}`, fontWeight: 600, fontSize: 12.5, color: T.primary, letterSpacing: '.02em' }}>
        Other required details
      </div>
      <EditRow label="Gender" req>
        {select({
          value: f.gender, onChange: (e) => set({ gender: e.target.value }),
          children: [<option key="" value="">Select…</option>, <option key="M" value="MALE">Male</option>, <option key="F" value="FEMALE">Female</option>],
        })}
      </EditRow>
      <EditRow label="Place of birth" req>{input({ value: f.placeOfBirth, onChange: (e) => set({ placeOfBirth: e.target.value }) })}</EditRow>
      <EditRow label="Residential status" req>
        {select({
          value: f.residentialStatus, onChange: (e) => set({ residentialStatus: e.target.value }),
          children: [<option key="R" value="RESIDENT">Resident</option>, <option key="N" value="NON_RESIDENT">Non-resident</option>],
        })}
      </EditRow>
      <EditRow label="Email address" req>{input({ type: 'email', value: f.emailAddress, onChange: (e) => set({ emailAddress: e.target.value }) })}</EditRow>
      <EditRow label="Telephone number" req>{input({ value: f.phoneNumber, onChange: (e) => set({ phoneNumber: e.target.value }) })}</EditRow>
      <EditRow label="Occupation / profession">{input({ value: f.occupation, onChange: (e) => set({ occupation: e.target.value }) })}</EditRow>
      <EditRow label="ID verification status" req>
        {select({
          value: f.idVerificationStatus, onChange: (e) => set({ idVerificationStatus: e.target.value }),
          children: ID_VERIFICATION_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>),
        })}
      </EditRow>
      <EditRow label="Country of issue" req>{input({ value: f.countryOfIssue, onChange: (e) => set({ countryOfIssue: e.target.value }) })}</EditRow>
      <EditRow label="ID date of issue" req>{input({ type: 'date', max: today(), value: f.dateOfIssue, onChange: (e) => set({ dateOfIssue: e.target.value }) })}</EditRow>
      <EditRow label="ID expiry date" req>{input({ type: 'date', value: f.dateOfExpiry, onChange: (e) => set({ dateOfExpiry: e.target.value }) })}</EditRow>
      <EditRow label="Date became BO" req>{input({ type: 'date', max: today(), value: f.dateBecameBo, onChange: (e) => set({ dateBecameBo: e.target.value }) })}</EditRow>
      <EditRow label="Source of information" req>
        {select({
          value: f.sourceOfInformation, onChange: (e) => set({ sourceOfInformation: e.target.value }),
          children: SOURCES_OF_INFORMATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>),
        })}
      </EditRow>
      <EditRow label="Remark">{input({ value: f.additionalInformation, onChange: (e) => set({ additionalInformation: e.target.value }) })}</EditRow>
      <EditRow label="Supporting evidence">
        <input type="file" multiple style={{ ...s.input, padding: 6 }} onChange={(e) => set({ evidence: Array.from(e.target.files || []) })} />
      </EditRow>
    </dl>
  );
}

function Toggle({ on, label, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        position: 'relative', width: 40, height: 22, borderRadius: 22, border: 'none', cursor: 'pointer',
        background: on ? T.primary : T.borderStrong, transition: 'background .18s', padding: 0, flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  );
}

/* ==========================================================================
   Searchable combobox
   ========================================================================== */
function Combobox({ options, value, onChange, placeholder = 'Search…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

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

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        style={s.input}
        value={open ? query : (selected ? `${selected.label}${selected.sub ? ` (${selected.sub})` : ''}` : '')}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
          background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
          boxShadow: T.shadowMd, margin: 0, padding: 4, listStyle: 'none', maxHeight: 260, overflowY: 'auto',
        }} role="listbox">
          {filtered.length === 0 && <li style={{ padding: '10px 12px', color: T.textMuted, fontSize: 13 }}>No customer found</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              style={{
                padding: '9px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
                background: i === hi ? T.primarySoft : 'transparent',
                color: o.value === value ? T.primary : T.text, fontWeight: o.value === value ? 600 : 400,
              }}
            >
              <span>{o.label}</span>
              {o.sub && <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.textMuted }}>{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ==========================================================================
   Stepper
   ========================================================================== */
function Stepper({ step, onGo }) {
  return (
    <ol style={{
      display: 'flex', gap: 0, listStyle: 'none', padding: 0, margin: '0 0 24px',
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadow,
    }}>
      {STEPS.map((st, i) => {
        const active = i === step;
        const done = i < step;
        const clickable = done;
        return (
          <li
            key={st.key}
            onClick={() => clickable && onGo(i)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 12px',
              borderRight: i < STEPS.length - 1 ? `1px solid ${T.border}` : 'none',
              cursor: clickable ? 'pointer' : 'default', position: 'relative',
              background: active ? T.primarySoft : 'transparent', transition: 'background .15s',
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: active ? T.primary : done ? T.success : '#f1f5f9',
              color: active || done ? '#fff' : T.textFaint,
            }}>{done ? '✓' : i + 1}</span>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? T.primary : done ? T.text : T.textMuted, lineHeight: 1.2 }}>{st.title}</span>
              <span style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.sub}</span>
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

  const [tree, setTree] = useState(null);
  const [controlDraft, setControlDraft] = useState({});
  const [smo, setSmo] = useState(EMPTY_SMO);
  const [personDrafts, setPersonDrafts] = useState({});
  const [startWithPerson, setStartWithPerson] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [forms, setForms] = useState({});
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
        if (list.length > 0) selectCustomer(list[0]);
        else setMode('new');
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
      natureOfBusiness: lp.natureOfBusiness || '',
      directorsAndManagement: lp.directorsAndManagement || '',
    });
  };

  const refreshTree = async () => {
    const t = await getOwnershipTree(legalPersonId);
    setTree(t);
    setControlDraft((d) => {
      const next = { ...d };
      t.holders.forEach((h) => {
        if (!next[h.key] || !next[h.key].dirty) next[h.key] = { controlBasis: h.controlBasis, controlNotes: '', dirty: false };
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
    try { await fn(); } catch (err) { setError(failMsg(err, 'Action failed')); } finally { setBusy(false); }
  };

  const nextFromCustomer = () => run(async () => {
    const missing = CUSTOMER_REQUIRED.filter(([k]) => !String(customer[k] || '').trim()).map(([, l]) => l);
    if (missing.length) throw new Error(`Please complete: ${missing.join(', ')}`);
    if (mode === 'new') {
      const created = await createLegalPerson(customer);
      setLegalPersons((l) => [...l, created]);
      setLegalPersonId(created.id);
      setMode('existing');
    } else {
      await updateLegalPersonProfile(legalPersonId, {
        tin: customer.tin, countryOfIncorporation: customer.countryOfIncorporation,
        natureOfBusiness: customer.natureOfBusiness, directorsAndManagement: customer.directorsAndManagement,
      });
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
    for (const h of tree.holders) if (controlDraft[h.key]?.dirty && !h.registered) await saveControl(h);
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
      list.forEach((sub) => {
        if (!next[sub.key]) next[sub.key] = emptySubjectForm(sub, personDrafts);
        else if (sub.holder) next[sub.key] = fillFromDraft(next[sub.key], findDraft(personDrafts, sub.holder));
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tree, personDrafts]);

  const setForm = (key, patch) => setForms((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const incomplete = useMemo(
    () => subjects.filter((sub) => results[sub.key]?.status !== 'created' && forms[sub.key] && personMissing(forms[sub.key]).length > 0),
    [subjects, forms, results],
  );

  const nextFromVerify = () => {
    if (subjects.length === 0) { setError('There is no beneficial owner to register for this customer.'); return; }
    if (incomplete.length > 0) {
      setError(`Complete the verification details for: ${incomplete.map((sub) => forms[sub.key].fullName || 'person').join(', ')}`);
      return;
    }
    go(5);
  };

  const smoPayload = (sub) => ({
    legalPersonId, fullName: sub.smo.name.trim(), occupation: sub.smo.position,
    additionalInformation: sub.smo.justification || null, capacity: 'SENIOR_MANAGING_OFFICIAL',
    ownershipType: 'CONTROL_BY_OTHER_MEANS', ownershipPercentage: 0,
  });

  const finalSubmit = () => run(async () => {
    if (!confirmed) throw new Error('Please confirm the declaration before submitting.');
    const nextResults = { ...results };
    for (const sub of subjects) {
      if (nextResults[sub.key]?.status === 'created') continue;
      const f = forms[sub.key];
      const ownershipPart = sub.kind === 'ubo'
        ? { ownershipNodeId: sub.holder.ownershipNodeId, ownershipType: 'INDIRECT', ownershipPercentage: Number(sub.holder.effectivePercentage) }
        : { capacity: 'SENIOR_MANAGING_OFFICIAL', ownershipType: 'CONTROL_BY_OTHER_MEANS', ownershipPercentage: 0 };
      try {
        const created = await createBoRecord(sub.kind === 'smo' ? smoPayload(sub) : {
          legalPersonId, fullName: f.fullName.trim(), gender: f.gender, dateOfBirth: f.dateOfBirth,
          placeOfBirth: f.placeOfBirth.trim(), residentialStatus: f.residentialStatus,
          emailAddress: f.emailAddress.trim(), phoneNumber: f.phoneNumber.trim(), occupation: f.occupation.trim(),
          dateOfIssue: f.dateOfIssue, sourceOfInformation: f.sourceOfInformation,
          additionalInformation: f.additionalInformation || null, idDocumentType: f.idDocumentType,
          idVerificationStatus: f.idVerificationStatus,
          idTypeDetail: ID_TYPE_CONFIG[f.idDocumentType]?.detailLabel ? f.idTypeDetail.trim() : null,
          idNumber: f.idNumber.trim(), nationality: f.nationality.trim(),
          residentialAddress: f.residentialAddress.trim(), countryOfIssue: f.countryOfIssue.trim(),
          dateOfExpiry: f.dateOfExpiry, dateBecameBo: f.dateBecameBo, pep: f.pep,
          pepDetails: f.pep ? f.pepDetails : null, sourceOfWealth: f.sourceOfWealth || null,
          sourceOfFunds: f.sourceOfFunds || null, sanctionsScreened: f.sanctionsScreened, ...ownershipPart,
        }, true);
        let docWarning = null;
        for (const file of [f.file, ...f.evidence]) {
          if (!file) continue;
          try { await uploadDocument(created.id, file); }
          catch { docWarning = 'Record submitted, but a document upload failed — upload it again from the record page.'; }
        }
        nextResults[sub.key] = { status: 'created', ref: created.boReference, docWarning };
      } catch (err) {
        nextResults[sub.key] = { status: 'error', error: failMsg(err, 'Failed to submit') };
      }
      setResults({ ...nextResults });
    }
    setResults(nextResults);
  });

  const reset = () => {
    setStep(0); setTree(null); setSubjects([]); setForms({}); setResults({}); setConfirmed(false);
    setControlDraft({}); setSmo(EMPTY_SMO); setPersonDrafts({}); setViewMode({}); setError(null);
    if (legalPersons.length > 0) { setMode('existing'); selectCustomer(legalPersons[0]); }
    else { setMode('new'); setCustomer(EMPTY_CUSTOMER); }
  };

  const allCreated = subjects.length > 0 && subjects.every((sub) => results[sub.key]?.status === 'created');
  const anyFailed = subjects.some((sub) => results[sub.key]?.status === 'error');

  const hasUbo = !!tree?.holders.some((h) => h.ubo);
  const backTarget = () => {
    if (step === 4 && hasUbo) return 2;
    if (step === 5 && !hasUbo) return 3;
    return step - 1;
  };

  const Nav = ({ onNext, nextLabel = 'Continue', hideBack, disabled }) => (
    <div style={s.nav}>
      {!hideBack && step > 0 && !allCreated
        ? <button type="button" style={b('btnOutline')} disabled={busy} onClick={() => go(backTarget())}>← Back</button>
        : <span />}
      {onNext && (
        <button
          type="button" style={b('btnPrimary', { opacity: busy || disabled ? 0.55 : 1, cursor: busy || disabled ? 'not-allowed' : 'pointer' })}
          disabled={busy || disabled} onClick={onNext}
        >
          {busy ? 'Please wait…' : nextLabel} →
        </button>
      )}
    </div>
  );

  /* ---------- banner helpers ---------- */
  const Banner = ({ tone, children }) => {
    const map = {
      error: { bg: T.dangerSoft, fg: T.danger, icon: '⚠' },
      success: { bg: T.successSoft, fg: T.success, icon: '✓' },
      warn: { bg: T.warnSoft, fg: T.warn, icon: '⚑' },
    }[tone];
    return (
      <div style={{ ...s.banner, background: map.bg, color: map.fg, border: `1px solid ${map.fg}22` }}>
        <span style={{ fontWeight: 700, flexShrink: 0 }}>{map.icon}</span>
        <div>{children}</div>
      </div>
    );
  };

  /* ==========================================================================
     Render
     ========================================================================== */
  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        input:focus, select:focus, textarea:focus { outline: none; border-color: ${T.primary} !important; box-shadow: 0 0 0 3px ${T.primary}1a !important; }
        button:focus-visible { outline: 2px solid ${T.primary}; outline-offset: 2px; }
        input:disabled { background: #f8fafc; color: ${T.textMuted}; cursor: not-allowed; }
        @media (max-width: 640px) {
          .stepper-sub { display: none; }
        }
      `}</style>

      <div style={s.container}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={s.h1}>Customer Entity</h1>
          <p style={s.desc}>
            Identify the customer, trace the ownership structure to the natural person(s), examine control,
            verify each UBO, then submit once for checker approval.
          </p>
        </div>

        <Stepper step={step} onGo={go} />
        {error && <Banner tone="error">{error}</Banner>}

        {/* ===================== 1. Customer ===================== */}
        {step === 0 && (
          <div style={s.card}>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: T.radiusSm, padding: 4, marginBottom: 20 }}>
              {[
                { key: 'existing', label: 'Existing Legal Person', disabled: legalPersons.length === 0 },
                { key: 'new', label: 'New Legal Person', disabled: false },
              ].map((m) => (
                <button
                  key={m.key} type="button" disabled={m.disabled}
                  onClick={() => {
                    setMode(m.key);
                    if (m.key === 'existing' && legalPersons[0]) selectCustomer(legalPersons[0]);
                    if (m.key === 'new') { setCustomer(EMPTY_CUSTOMER); setLegalPersonId(''); }
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
                    fontFamily: 'inherit', cursor: m.disabled ? 'not-allowed' : 'pointer',
                    background: mode === m.key ? '#fff' : 'transparent',
                    color: mode === m.key ? T.text : T.textMuted,
                    boxShadow: mode === m.key ? T.shadow : 'none',
                    opacity: m.disabled ? 0.5 : 1,
                  }}
                >{m.label}</button>
              ))}
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

            <div style={s.grid3}>
              <Field label="Legal Name" required>
                <input style={{ ...s.input, ...(mode === 'existing' ? { background: '#f8fafc', color: T.textMuted } : {}) }}
                  value={customer.name} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </Field>
              <Field label="Registration number" required>
                <input style={{ ...s.input, ...s.monoInput, ...(mode === 'existing' ? { background: '#f8fafc', color: T.textMuted } : {}) }}
                  value={customer.registrationNumber} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, registrationNumber: e.target.value })} />
              </Field>
              <Field label="Entity type" required>
                <select style={{ ...s.input, ...(mode === 'existing' ? { background: '#f8fafc', color: T.textMuted } : {}) }}
                  value={customer.entityType} disabled={mode === 'existing'}
                  onChange={(e) => setCustomer({ ...customer, entityType: e.target.value })}>
                  {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <div style={s.grid3}>
              <Field label="TIN" required>
                <input style={{ ...s.input, ...s.monoInput }} value={customer.tin} onChange={(e) => setCustomer({ ...customer, tin: e.target.value })} />
              </Field>
              <Field label="Country of incorporation" required>
                <input style={s.input} value={customer.countryOfIncorporation} onChange={(e) => setCustomer({ ...customer, countryOfIncorporation: e.target.value })} />
              </Field>
              <Field label="Nature of business" required>
                <input style={s.input} value={customer.natureOfBusiness} onChange={(e) => setCustomer({ ...customer, natureOfBusiness: e.target.value })} />
              </Field>
            </div>

            <div style={{ marginTop: 4 }}>
              <Field label="Directors and senior management">
                <textarea style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
                  value={smo.directorsAndManagement} onChange={(e) => setSmo({ ...smo, directorsAndManagement: e.target.value })} />
              </Field>
            </div>

            <Nav onNext={nextFromCustomer} hideBack />
          </div>
        )}

        {/* ===================== 2. Structure ===================== */}
        {step === 1 && (
          <>
            <OwnershipTree
              legalPersonId={legalPersonId}
              canEdit
              onTreeChange={setTree}
              startWithPerson={startWithPerson}
              onPersonSaved={(p) => setPersonDrafts((d) => ({ ...d, [personKey(p.fullName, p.idNumber)]: p }))}
            />
            <div style={s.card}><Nav onNext={nextFromStructure} /></div>
          </>
        )}

        {/* ===================== 3. Control ===================== */}
        {step === 2 && tree && (
          <div style={s.card}>
            <h3 style={s.h3}>Examine control, not only percentage ownership</h3>
            <p style={s.hint}>
              Effective ownership is calculated for you (threshold {pct(tree.thresholdPercentage)}%). A person is also a UBO
              if control is exercised by other means, even below the threshold — tick the control basis that applies.
            </p>
            {tree.holders.length === 0 && <div style={{ ...s.hint, padding: 16, background: T.bg, borderRadius: T.radiusSm }}>No natural persons found yet. Go back and trace the structure further.</div>}
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
                <div key={h.key} style={{
                  border: `1px solid ${h.ubo ? T.primary + '44' : T.border}`,
                  background: h.ubo ? T.primarySoft : '#fafbfc',
                  borderRadius: T.radiusSm, padding: 18, marginBottom: 14,
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <strong style={{ fontSize: 14.5 }}>{h.fullName}</strong>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                        {[h.idNumber, h.nationality].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: h.ubo ? T.primary : T.text, lineHeight: 1 }}>{pct(h.effectivePercentage)}%</div>
                      <div style={{ fontSize: 10.5, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>effective</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {h.qualifiesByOwnership && <span style={{ ...s.chip, background: T.successSoft, color: T.success }}>Ownership UBO</span>}
                      {(h.qualifiesByControl || d.controlBasis.length > 0) && <span style={{ ...s.chip, background: T.primarySoft, color: T.primary }}>Control</span>}
                      {!h.ubo && d.controlBasis.length === 0 && <span style={{ ...s.chip, background: '#f1f5f9', color: T.textMuted }}>Below threshold</span>}
                      {h.registered && <span style={{ ...s.chip, background: '#f1f5f9', color: T.textMuted }}>Registered {h.beneficialOwnerReference}</span>}
                    </div>
                  </div>

                  {h.paths.map((p, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: T.textMuted, padding: '3px 0', fontFamily: T.mono }}>
                      {p.chain} <b style={{ color: T.text }}>= {pct(p.percentage)}%</b>
                    </div>
                  ))}

                  {!h.registered && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginTop: 14 }}>
                        {Object.entries(controlBasisLabel).map(([k, label]) => (
                          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', padding: 6, borderRadius: 6, background: d.controlBasis.includes(k) ? '#fff' : 'transparent' }}>
                            <input type="checkbox" checked={d.controlBasis.includes(k)} onChange={() => toggle(k)} style={{ accentColor: T.primary, width: 15, height: 15 }} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      {d.controlBasis.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Field label="Control details">
                            <input style={s.input} placeholder="e.g. clause 4 of the shareholders' agreement"
                              value={d.controlNotes}
                              onChange={(e) => setControlDraft((x) => ({ ...x, [h.key]: { ...d, dirty: true, controlNotes: e.target.value } }))} />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <Nav onNext={nextFromControl} nextLabel="Continue" />
          </div>
        )}

        {/* ===================== 4. Fallback ===================== */}
        {step === 3 && tree && (
          <div style={s.card}>
            <h3 style={s.h3}>Senior managing official fallback</h3>
            {!tree.seniorManagingOfficialAllowed ? (
              <Banner tone="success">A natural-person UBO was identified, so the fallback is not required.</Banner>
            ) : (
              <>
                <p style={s.hint}>
                  No natural person owns or controls the customer after the measures taken. Record the appropriate senior
                  managing official and the capacity. This does not make the CEO the UBO automatically; it is fallback
                  after reasonable measures.
                </p>
                {tree.seniorManagingOfficial && (
                  <div style={{ background: T.primarySoft, border: `1px solid ${T.primary}33`, borderRadius: T.radiusSm, padding: 14, marginBottom: 16 }}>
                    <strong>{tree.seniorManagingOfficial.name}</strong> — {tree.seniorManagingOfficial.position}
                    <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 4 }}>{tree.seniorManagingOfficial.justification}</div>
                  </div>
                )}
                <div style={s.grid2}>
                  <Field label="Name" required>
                    <input style={s.input} value={smo.name} onChange={(e) => setSmo({ ...smo, name: e.target.value })} />
                  </Field>
                  <Field label="Position / capacity" required>
                    <input style={s.input} value={smo.position} onChange={(e) => setSmo({ ...smo, position: e.target.value })} />
                  </Field>
                </div>
                <Field label="Reasonable measures taken" required>
                  <input style={s.input} placeholder="What was done to identify the controlling natural person, and why it failed"
                    value={smo.justification} onChange={(e) => setSmo({ ...smo, justification: e.target.value })} />
                </Field>

                <button type="button" style={b('btnPrimary', { marginTop: 8, opacity: busy || !smo.name || !smo.position || !smo.justification ? 0.55 : 1, cursor: busy || !smo.name || !smo.position || !smo.justification ? 'not-allowed' : 'pointer' })}
                  disabled={busy || !smo.name || !smo.position || !smo.justification} onClick={submitSmo}>
                  {tree.seniorManagingOfficial ? 'Update' : 'Save'}
                </button>
              </>
            )}

            <div style={{ margin: '18px 0', padding: 14, background: '#fafbfc', border: `1px dashed ${T.borderStrong}`, borderRadius: T.radiusSm }}>
              <button type="button" style={b('btnGhost')} disabled={busy} onClick={() => { setStartWithPerson(true); go(1); }}>
                + Add natural person (optional)
              </button>
              <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 8 }}>
                Found a natural person after all? Add them to the ownership structure with their full details.
              </div>
            </div>

            <Nav onNext={nextFromFallback} nextLabel={tree.seniorManagingOfficialAllowed ? 'Continue to final submit' : 'Continue'} />
          </div>
        )}

        {/* ===================== 5. Verify ===================== */}
        {step === 4 && (
          <div>
            <p style={{ ...s.hint, marginBottom: 16 }}>
              For each beneficial owner, obtain and verify identity, ownership, PEP, sanctions and
              source-of-wealth information. Ownership %, direct/indirect, chain and control basis are calculated from the structure.
            </p>
            {subjects.length === 0 && (
              <div style={s.card}>
                <div style={{ ...s.hint, margin: 0, padding: 16, textAlign: 'center' }}>
                  No unregistered beneficial owner found for this customer.
                </div>
              </div>
            )}

            {subjects.map((sub, idx) => {
              const f = forms[sub.key];
              if (!f) return null;
              if (results[sub.key]?.status === 'created') {
                return (
                  <div key={sub.key} style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <h3 style={{ ...s.h3, margin: 0 }}>{idx + 1}. {f.fullName}</h3>
                      <span style={{ ...s.chip, background: T.successSoft, color: T.success }}>✓ Submitted · {results[sub.key].ref}</span>
                    </div>
                  </div>
                );
              }
              const miss = personMissing(f);
              const viewAs = viewMode[sub.key] ?? (miss.length === 0 ? 'record' : 'form');
              const set = (patch) => {
                setViewMode((v) => (v[sub.key] ? v : { ...v, [sub.key]: 'form' }));
                setForm(sub.key, patch);
              };
              const h = sub.holder;
              return (
                <div key={sub.key} style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                    <h3 style={{ ...s.h3, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {idx + 1}. {f.fullName || (sub.kind === 'smo' ? 'Senior managing official' : 'Beneficial owner')}
                      {sub.kind === 'smo' && <span style={{ ...s.chip, background: T.primarySoft, color: T.primary }}>Fallback</span>}
                    </h3>
                    <span style={{ ...s.chip, background: miss.length === 0 ? T.successSoft : T.warnSoft, color: miss.length === 0 ? T.success : T.warn }}>
                      {miss.length === 0 ? '✓ Complete' : `${miss.length} missing`}
                    </span>
                  </div>

                  <div style={{ background: '#fafbfc', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 14, marginBottom: 14, fontSize: 13 }}>
                    {h ? (
                      <>
                        <div><strong style={{ color: T.primary }}>{pct(h.effectivePercentage)}%</strong> effective ·{' '}
                          {h.paths.length === 1 && (h.paths[0].chain.match(/ → /g) || []).length === 1 ? 'Direct' : 'Indirect'} · {h.qualifiesByOwnership ? 'Ownership' : 'Control'} basis</div>
                        {h.paths.map((p, i) => (
                          <div key={i} style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, marginTop: 6 }}>{p.chain} <b style={{ color: T.text }}>= {pct(p.percentage)}%</b></div>
                        ))}
                        {h.controlBasis.length > 0 && (
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6 }}>Control: {h.controlBasis.map((c) => controlBasisLabel[c] || c).join(', ')}</div>
                        )}
                      </>
                    ) : (
                      <div><strong>{sub.smo.position}</strong> — recorded as the senior managing official (CDD fallback), not as a UBO.</div>
                    )}
                  </div>

                  {viewAs === 'form' && miss.length === 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <button type="button" style={b('btnOutline')} onClick={() => setViewMode((v) => ({ ...v, [sub.key]: 'record' }))}>
                        Preview record
                      </button>
                    </div>
                  )}

                  {viewAs === 'record' ? <RecordView f={f} s={sub} /> : <RecordEditor f={f} s={sub} set={set} idKey={sub.key} />}
                </div>
              );
            })}
            <div style={s.card}><Nav onNext={nextFromVerify} nextLabel="Continue" /></div>
          </div>
        )}

        {/* ===================== 6. Confirm & submit ===================== */}
        {step === 5 && (
          <div style={s.card}>
            <h3 style={s.h3}>Confirm and Final submit</h3>
            <p style={s.hint}>Submitting sends every beneficial owner below to a checker for approving.</p>

            <div style={{ background: '#fafbfc', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Customer</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{customer.name}</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{customer.registrationNumber} · TIN {customer.tin}</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>{customer.countryOfIncorporation} · {customer.natureOfBusiness}</div>
              {customer.directorsAndManagement && (
                <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  <strong style={{ color: T.text }}>Directors / senior management:</strong> {customer.directorsAndManagement}
                </div>
              )}
            </div>

            {tree?.warnings.length > 0 && (
              <Banner tone="warn">
                <strong>Tracing notes</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{tree.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </Banner>
            )}

            <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#fafbfc', borderBottom: `1px solid ${T.border}` }}>
                    {['Full Name', 'Capacity', 'Ownership', 'PEP', 'Sanctions', 'Document', 'Result'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: T.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub) => {
                    const f = forms[sub.key];
                    const r = results[sub.key];
                    return (
                      <tr key={sub.key} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{f.fullName}</div>
                          <div style={{ fontSize: 11.5, color: T.textMuted, fontFamily: T.mono }}>{f.idNumber}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>{sub.kind === 'smo' ? 'Senior managing official' : (sub.holder.qualifiesByOwnership ? 'Ownership' : 'Control')}</td>
                        <td style={{ padding: '10px 12px' }}>{sub.kind === 'smo' ? '—' : `${pct(sub.holder.effectivePercentage)}%`}</td>
                        <td style={{ padding: '10px 12px' }}>{sub.kind === 'smo' ? '—' : (f.pep ? 'Yes' : 'No')}</td>
                        <td style={{ padding: '10px 12px' }}>{sub.kind === 'smo' ? '—' : (f.sanctionsScreened ? 'Screened' : '—')}</td>
                        <td style={{ padding: '10px 12px' }}>{[f.file, ...f.evidence].filter(Boolean).length} file(s)</td>
                        <td style={{ padding: '10px 12px' }}>
                          {r?.status === 'created' && <><span style={{ ...s.chip, background: T.successSoft, color: T.success }}>✓ Submitted</span> <span style={{ fontFamily: T.mono, fontSize: 11 }}>{r.ref}</span>
                            {r.docWarning && <div style={{ fontSize: 11.5, color: T.warn, marginTop: 4 }}>{r.docWarning}</div>}</>}
                          {r?.status === 'error' && <span style={{ fontSize: 11.5, color: T.danger }}>{r.error}</span>}
                          {!r && <span style={{ color: T.textFaint }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!allCreated && (
              <label style={{ display: 'flex', gap: 10, padding: 14, background: T.primarySoft, border: `1px solid ${T.primary}33`, borderRadius: T.radiusSm, marginBottom: 16, cursor: 'pointer', fontSize: 13, lineHeight: 1.5 }}>
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ accentColor: T.primary, width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                <span>I confirm the information is adequate, accurate and up to date, and that reasonable measures were taken to verify the identity and beneficial-owner status of each person above.</span>
              </label>
            )}

            {allCreated ? (
              <>
                <Banner tone="success">All beneficial owners were submitted for checker approval.</Banner>
                <div style={s.nav}><span /><button type="button" style={b('btnPrimary')} onClick={reset}>Register another customer</button></div>
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
