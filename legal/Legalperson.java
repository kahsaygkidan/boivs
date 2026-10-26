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
   Customer Entity — guided process, then one final submit to the checker
   10.1 Customer  ->  10.2/10.3 Ownership structure  ->  10.4 Control
   ->  10.5 Senior managing official fallback  ->  10.6 Verify each UBO  ->  Submit
   ========================================================================== */

const STEPS = [
  { key: 'customer', title: 'Add Legal Entity' },
  { key: 'structure', title: 'Add Ownership ' },
  { key: 'control', title: 'Add Control ' },
  { key: 'fallback', title: 'Fallback' },
  { key: 'verify', title: 'Verify ' },
  { key: 'submit', title: 'Confirm & submit' },
];

const ENTITY_TYPES = [
    { value:"", label: 'Select'},
  { value: 'SHARE_COMPANY', label: 'Share Company' },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company' },
 { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'ONE_MEMBER_PLC', label: 'One Member PLC' },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company' },
  { value: 'PUBLIC_LIMITED_COMPANY', label: 'Public Limited Company' },
  { value: 'GENERAL_PARTNERSHIP', label: 'General Partnership' },
  { value: 'LIMITED_PARTNERSHIP', label: 'Limited Partnership' },
  { value: 'LIMITED_LIABILITY_PARTNERSHIP', label: 'Limited Liability Partnership' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'PPP', label: 'Public Private Partnership' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'PARTNERSHIP', label: 'Partnership (Other)' },
];

const EMPTY_CUSTOMER = {
  name: '',
  registrationNumber: '',
  entityType: '',
  tin: '',
  countryOfIncorporation: '',
  natureOfBusiness: '',
  directorsAndManagement: '',
};

const CUSTOMER_REQUIRED = [
  ['name', 'Company name'],
  ['registrationNumber', 'Registration number'],
  ['tin', 'TIN'],
  ['countryOfIncorporation', 'Country of incorporation'],
  ['natureOfBusiness', 'Nature of business'],
//   ['directorsAndManagement', 'Directors and senior management'],
];

const EMPTY_SMO = { name: '', position: '', justification: '', directorsAndManagement: '' };

const pct = (v) => String(Number(v ?? 0));

/* ---------- Person details entered in the ownership tree ---------- */
const personKey = (name, id) => `${(name || '').trim().toLowerCase()}|${(id || '').trim()}`;

const findDraft = (drafts, holder) => {
  if (!holder) return null;
  const exact = drafts[personKey(holder.fullName, holder.idNumber)];
  if (exact) return exact;
  const all = Object.values(drafts);
  const id = (holder.idNumber || '').trim();
  const byId = id && all.find((d) => (d.idNumber || '').trim() === id);
  if (byId) return byId;
  // fall back to name only, in case the server normalised the ID number
  const name = (holder.fullName || '').trim().toLowerCase();
  return all.find((d) => (d.fullName || '').trim().toLowerCase() === name) || null;
};

const isFilled = (v) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);

// copy values from the draft that were typed in the tree; never overwrites what is already filled in
const fillFromDraft = (form, draft) => {
  if (!draft) return form;
  const next = { ...form };
  Object.entries(draft).forEach(([k, v]) => {
    if (!isFilled(next[k]) && isFilled(v)) next[k] = v;
  });
  return next;
};

const emptySubjectForm = (subject, drafts = {}) => {
  const base = {
    fullName: subject.holder?.fullName || subject.smo?.name || '',
    gender: '',
    dateOfBirth: '',
    placeOfBirth: '',
    residentialStatus: 'RESIDENT',
    emailAddress: '',
    phoneNumber: '',
    occupation: '',
    dateOfIssue: '',
    sourceOfInformation: 'CUSTOMER',
    additionalInformation: '',
    idDocumentType: 'FAYDA_ID',
    idVerificationStatus: 'PENDING',
    idTypeDetail: '',
    idNumber: subject.holder?.idNumber || '',
    nationality: subject.holder?.nationality || '',
    residentialAddress: '',
    countryOfIssue: '',
    dateOfExpiry: '',
    dateBecameBo: today(),
    pep: false,
    pepDetails: '',
    sanctionsScreened: false,
    sourceOfWealth: '',
    sourceOfFunds: '',
    file: null,
    evidence: [], // supporting documents: shareholder register, agreements, proof of address ...
  };
  const draft = findDraft(drafts, subject.holder);
  if (!draft) return base;
  // values typed in the tree win over the defaults (e.g. ID type, dates)
  const filled = Object.fromEntries(Object.entries(draft).filter(([, v]) => isFilled(v)));
  return { ...base, ...filled };
};

/* ---------- Record view (Verify step) ---------- */
const fmtDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};

const ownershipKind = (h) =>
  h.paths.length === 1 && (h.paths[0].chain.match(/ → /g) || []).length === 1 ? 'Direct' : 'Indirect';

function RecordView({ f, s }) {
  const h = s.holder;
  const idType = ID_DOCUMENT_TYPES.find((t) => t.value === f.idDocumentType)?.label || f.idDocumentType;
  const idLine = [idType, f.idNumber].filter(Boolean).join(' · ');
  const docLine = f.file ? `Verified document: ${f.file.name}` : 'No verified document attached';

  const control = h
    ? ([
      h.qualifiesByOwnership && 'Ownership',
      ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c),
    ].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';

  const rows = [
    ['Full name', f.fullName || '—'],
    ['Nationality', f.nationality || '—'],
    ['Date of birth', fmtDate(f.dateOfBirth)],
    ['ID/passport', `${idLine || '—'} — ${docLine}`],
    ['Address', f.residentialAddress || '—'],
    ['Ownership %', h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'],
    ['Direct/indirect', h ? ownershipKind(h) : '—'],
    ['Ownership chain', h ? h.paths.map((p) => p.chain).join('; ') : '—'],
    ['Control basis', control],
    ['PEP status', f.pep ? `PEP${f.pepDetails ? ` — ${f.pepDetails}` : ''}` : 'Not a PEP'],
    ['Sanctions', f.sanctionsScreened ? 'Screened' : 'Not screened'],
    ['Source of wealth', f.sourceOfWealth || '—'],
    ['Source of funds', f.sourceOfFunds || '—'],
  ];

  return (
    <dl className="record-list">
      {rows.map(([label, value]) => (
        <div key={label} className="record-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- Edit form laid out exactly like the record view ---------- */
function EditRow({ label, req, children }) {
  return (
    <div className="record-row">
      <dt>{label}{req && <span className="req"> *</span>}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RecordEditor({ f, s, set, idKey }) {
  const h = s.holder;
  const cfg = ID_TYPE_CONFIG[f.idDocumentType] || ID_TYPE_CONFIG.OTHER;
  const control = h
    ? ([
      h.qualifiesByOwnership && 'Ownership',
      ...(h.controlBasis || []).map((c) => controlBasisLabel[c] || c),
    ].filter(Boolean).join(' / ') || '—')
    : 'Senior managing official (fallback)';

  return (
    <dl className="record-list record-edit">
      <EditRow label="Full name" req>
        <input value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} />
      </EditRow>
      <EditRow label="Nationality" req>
        <input value={f.nationality} onChange={(e) => set({ nationality: e.target.value })} />
      </EditRow>
      <EditRow label="Date of birth" req>
        <input type="date" max={today()} value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
      </EditRow>
      <EditRow label="ID/passport" req>
        <div className="record-stack">
          <select value={f.idDocumentType} onChange={(e) => set({ idDocumentType: e.target.value, idNumber: '', idTypeDetail: '' })}>
            {ID_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input
            id={`idnum-${idKey}`}
            className="mono"
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
            <input placeholder={cfg.detailLabel} value={f.idTypeDetail}
              onChange={(e) => set({ idTypeDetail: e.target.value })} />
          )}
          <input type="file" onChange={(e) => set({ file: e.target.files?.[0] || null })} />
        </div>
      </EditRow>
      <EditRow label="Address" req>
        <input value={f.residentialAddress} onChange={(e) => set({ residentialAddress: e.target.value })} />
      </EditRow>

      {/* calculated from the ownership structure — read only */}
      <EditRow label="Ownership %">{h ? `${pct(h.effectivePercentage)}% ${ownershipKind(h).toLowerCase()}` : '—'}</EditRow>
      <EditRow label="Direct/indirect">{h ? ownershipKind(h) : '—'}</EditRow>
      <EditRow label="Ownership chain">{h ? h.paths.map((p) => p.chain).join('; ') : '—'}</EditRow>
      <EditRow label="Control basis">{control}</EditRow>

      <EditRow label="PEP status">
        <div className="record-stack">
          <button type="button" className={`switch${f.pep ? ' on' : ''}`} aria-pressed={f.pep}
            aria-label="Toggle PEP" onClick={() => set({ pep: !f.pep })} />
          {f.pep && (
            <input placeholder="PEP details" value={f.pepDetails} onChange={(e) => set({ pepDetails: e.target.value })} />
          )}
        </div>
      </EditRow>
      <EditRow label="Sanctions">
        <button type="button" className={`switch${f.sanctionsScreened ? ' on' : ''}`} aria-pressed={f.sanctionsScreened}
          aria-label="Toggle sanctions screened" onClick={() => set({ sanctionsScreened: !f.sanctionsScreened })} />
      </EditRow>
      <EditRow label="Source of wealth" req={f.pep}>
        <input placeholder="Obtained where required" value={f.sourceOfWealth}
          onChange={(e) => set({ sourceOfWealth: e.target.value })} />
      </EditRow>
      <EditRow label="Source of funds">
        <input placeholder="Obtained where required" value={f.sourceOfFunds}
          onChange={(e) => set({ sourceOfFunds: e.target.value })} />
      </EditRow>

      {/* remaining required details that the record summary does not show */}
      <div className="record-section">Other required details</div>
      <EditRow label="Gender" req>
        <select value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
          <option value="">Select…</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </EditRow>
      <EditRow label="Place of birth" req>
        <input value={f.placeOfBirth} onChange={(e) => set({ placeOfBirth: e.target.value })} />
      </EditRow>
      <EditRow label="Residential status" req>
        <select value={f.residentialStatus} onChange={(e) => set({ residentialStatus: e.target.value })}>
          <option value="RESIDENT">Resident</option>
          <option value="NON_RESIDENT">Non-resident</option>
        </select>
      </EditRow>
      <EditRow label="Email address" req>
        <input type="email" value={f.emailAddress} onChange={(e) => set({ emailAddress: e.target.value })} />
      </EditRow>
      <EditRow label="Telephone number" req>
        <input value={f.phoneNumber} onChange={(e) => set({ phoneNumber: e.target.value })} />
      </EditRow>
      <EditRow label="Occupation / profession">
        <input value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} />
      </EditRow>
      <EditRow label="ID verification status" req>
        <select value={f.idVerificationStatus} onChange={(e) => set({ idVerificationStatus: e.target.value })}>
          {ID_VERIFICATION_STATUSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </EditRow>
      <EditRow label="Country of issue" req>
        <input value={f.countryOfIssue} onChange={(e) => set({ countryOfIssue: e.target.value })} />
      </EditRow>
      <EditRow label="ID date of issue" req>
        <input type="date" max={today()} value={f.dateOfIssue} onChange={(e) => set({ dateOfIssue: e.target.value })} />
      </EditRow>
      <EditRow label="ID expiry date" req>
        <input type="date" value={f.dateOfExpiry} onChange={(e) => set({ dateOfExpiry: e.target.value })} />
      </EditRow>
      <EditRow label="Date became BO" req>
        <input type="date" max={today()} value={f.dateBecameBo} onChange={(e) => set({ dateBecameBo: e.target.value })} />
      </EditRow>
      <EditRow label="Source of information" req>
        <select value={f.sourceOfInformation} onChange={(e) => set({ sourceOfInformation: e.target.value })}>
          {SOURCES_OF_INFORMATION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </EditRow>
      <EditRow label="Remark">
        <input value={f.additionalInformation} onChange={(e) => set({ additionalInformation: e.target.value })} />
      </EditRow>
      <EditRow label="Supporting evidence">
        <input type="file" multiple onChange={(e) => set({ evidence: Array.from(e.target.files || []) })} />
      </EditRow>
    </dl>
  );
}

/* ---------- Searchable combobox ---------- */
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
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); }
    };
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
    <div className="combobox" ref={ref}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        value={open ? query : (selected ? `${selected.label}${selected.sub ? ` (${selected.sub})` : ''}` : '')}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="combobox-list" role="listbox">
          {filtered.length === 0 && <li className="combobox-empty">No customer found</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`combobox-item${i === hi ? ' hi' : ''}${o.value === value ? ' sel' : ''}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
            >
              <span>{o.label}</span>
              {o.sub && <span className="mono combobox-sub">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Stepper ---------- */
function Stepper({ step, onGo }) {
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}
          onClick={() => i < step && onGo(i)}
        >
          <span className="step-num">{i < step ? '✓' : i + 1}</span>
          <span className="step-text">
            <span className="step-title">{s.title}</span>
          </span>
        </li>
      ))}
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

  /*  customer */
  const [legalPersons, setLegalPersons] = useState([]);
  const [mode, setMode] = useState('existing'); // existing | new
  const [legalPersonId, setLegalPersonId] = useState('');
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);

  /* tree + control + fallback */
  const [tree, setTree] = useState(null);
  const [controlDraft, setControlDraft] = useState({}); // holderKey -> { controlBasis, controlNotes, dirty }
  const [smo, setSmo] = useState(EMPTY_SMO);
  const [personDrafts, setPersonDrafts] = useState({}); // details typed in the tree for natural persons
  const [startWithPerson, setStartWithPerson] = useState(false); // open the tree with the natural-person form

  /*  verification + final submit */
  const [subjects, setSubjects] = useState([]);
  const [forms, setForms] = useState({});
  const [viewMode, setViewMode] = useState({}); // key -> 'form' | 'record'
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState({}); // key -> { status, ref, error, docWarning }

  // Include the server's field-level details (e.g. "emailAddress: must be a well-formed email address").
  const failMsg = (err, fallback) => {
    const base = err?.friendlyMessage || err?.message || fallback;
    const details = Array.isArray(err?.details) ? err.details : [];
    return details.length ? `${base} — ${details.join('; ')}` : base;
  };

  /* ---------- load customers ---------- */
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
      name: lp.name || '',
      registrationNumber: lp.registrationNumber || '',
      entityType: lp.entityType || 'SHARE_COMPANY',
      tin: lp.tin || '',
      countryOfIncorporation: lp.countryOfIncorporation || '',
      natureOfBusiness: lp.natureOfBusiness || '',
      directorsAndManagement: lp.directorsAndManagement || '',
    });
  };

  /* ---------- refresh the tree when entering steps 3-6 ---------- */
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
    if (step >= 2 && legalPersonId) {
      refreshTree().catch((err) => setError(failMsg(err, 'Failed to load ownership structure')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, legalPersonId]);

  // the "add natural person" shortcut only applies for one visit to the structure step
  useEffect(() => { if (step !== 1) setStartWithPerson(false); }, [step]);

  const go = (i) => {
    setError(null);
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(failMsg(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  /* ==========================================================================
     Step actions
     ========================================================================== */
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
        tin: customer.tin,
        countryOfIncorporation: customer.countryOfIncorporation,
        natureOfBusiness: customer.natureOfBusiness,
        directorsAndManagement: customer.directorsAndManagement,
      });
    }
    setTree(null);
    go(1);
  });

  const nextFromStructure = () => {
    if (!tree || tree.shareholders.length === 0) {
      setError('Add at least one shareholder before continuing.');
      return;
    }
    if (tree.warnings.length > 0 &&
      !window.confirm('Tracing is incomplete (see the warnings). Continue anyway?')) {
      return;
    }
    go(2);
  };

  const saveControl = async (holder) => {
    const d = controlDraft[holder.key];
    const t = await updateNodeControl(legalPersonId, holder.ownershipNodeId, {
      controlBasis: d.controlBasis,
      controlNotes: d.controlNotes || null,
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
    // No natural-person UBO -> skip the personal-details step and go straight to final submit
    go(tree?.seniorManagingOfficialAllowed ? 5 : 4);
  };

  /* Build the list of people to verify when entering step 5 */
  useEffect(() => {
    if ((step !== 4 && step !== 5) || !tree) return;
    // keep people already submitted in this session in the list, so the whole batch stays visible
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

  const setForm = (key, patch) => setForms((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const incomplete = useMemo(
    () => subjects.filter((s) => results[s.key]?.status !== 'created'
      && forms[s.key] && personMissing(forms[s.key]).length > 0),
    [subjects, forms, results],
  );

  const nextFromVerify = () => {
    if (subjects.length === 0) {
      setError('There is no beneficial owner to register for this customer.');
      return;
    }
    if (incomplete.length > 0) {
      setError(`Complete the verification details for: ${incomplete.map((s) => forms[s.key].fullName || 'person').join(', ')}`);
      return;
    }
    go(5);
  };

  /* ---------- FINAL SUBMIT ---------- */
  // Fallback route: only the fields captured in the Fallback step are sent (no personal details form).
  const smoPayload = (s) => ({
    legalPersonId,
    fullName: s.smo.name.trim(),
    occupation: s.smo.position,
    additionalInformation: s.smo.justification || null,
    capacity: 'SENIOR_MANAGING_OFFICIAL',
    ownershipType: 'CONTROL_BY_OTHER_MEANS',
    ownershipPercentage: 0,
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
          ownershipType: 'INDIRECT',
          ownershipPercentage: Number(s.holder.effectivePercentage),
        }
        : {
          capacity: 'SENIOR_MANAGING_OFFICIAL',
          ownershipType: 'CONTROL_BY_OTHER_MEANS',
          ownershipPercentage: 0,
        };
      try {
        const created = await createBoRecord(s.kind === 'smo' ? smoPayload(s) : {
          legalPersonId,
          fullName: f.fullName.trim(),
          gender: f.gender,
          dateOfBirth: f.dateOfBirth,
          placeOfBirth: f.placeOfBirth.trim(),
          residentialStatus: f.residentialStatus,
          emailAddress: f.emailAddress.trim(),
          phoneNumber: f.phoneNumber.trim(),
          occupation: f.occupation.trim(),
          dateOfIssue: f.dateOfIssue,
          sourceOfInformation: f.sourceOfInformation,
          additionalInformation: f.additionalInformation || null,
          idDocumentType: f.idDocumentType,
          idVerificationStatus: f.idVerificationStatus,
          idTypeDetail: ID_TYPE_CONFIG[f.idDocumentType]?.detailLabel ? f.idTypeDetail.trim() : null,
          idNumber: f.idNumber.trim(),
          nationality: f.nationality.trim(),
          residentialAddress: f.residentialAddress.trim(),
          countryOfIssue: f.countryOfIssue.trim(),
          dateOfExpiry: f.dateOfExpiry,
          dateBecameBo: f.dateBecameBo,
          pep: f.pep,
          pepDetails: f.pep ? f.pepDetails : null,
          sourceOfWealth: f.sourceOfWealth || null,
          sourceOfFunds: f.sourceOfFunds || null,
          sanctionsScreened: f.sanctionsScreened,
          ...ownershipPart,
        }, true);
        let docWarning = null;
        for (const file of [f.file, ...f.evidence]) {
          if (!file) continue;
          try {
            await uploadDocument(created.id, file);
          } catch {
            docWarning = 'Record submitted, but a document upload failed — upload it again from the record page.';
          }
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
    if (legalPersons.length > 0) { setMode('existing'); selectCustomer(legalPersons[0]); }
    else { setMode('new'); setCustomer(EMPTY_CUSTOMER); }
  };

  const allCreated = subjects.length > 0 && subjects.every((s) => results[s.key]?.status === 'created');
  const anyFailed = subjects.some((s) => results[s.key]?.status === 'error');

  /* ==========================================================================
     Render
     ========================================================================== */
  const hasUbo = !!tree?.holders.some((h) => h.ubo);
  const backTarget = () => {
    if (step === 4 && hasUbo) return 2;      // control step -> (skip fallback)
    if (step === 5 && !hasUbo) return 3;     // final submit -> fallback (verify was skipped)
    return step - 1;
  };
  const Nav = ({ onNext, nextLabel = 'Continue', hideBack, disabled }) => (
    <div className="wizard-nav">
      {!hideBack && step > 0 && !allCreated
        ? <button type="button" className="btn btn-blue" disabled={busy} onClick={() => go(backTarget())}>Back</button>
        : <span />}
      {onNext && (
        <button type="button" className="btn btn-blue" disabled={busy || disabled} onClick={onNext}>
          {busy ? 'Please wait…' : nextLabel}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Customer Entity</h1>
          <div className="desc">
            Identify the customer, trace the ownership structure to the natural person(s), examine control,
            verify each UBO, then submit once for checker approval.
          </div>
        </div>
      </div>

      <Stepper step={step} onGo={go} />
      {error && <div className="banner-error"><span>{error}</span></div>}

      {/* ===================== 1 Customer ===================== */}
      {step === 0 && (
        <div className="form-card">



          <div className="segmented">
            <button type="button" className={mode === 'existing' ? 'active' : ''}
              disabled={legalPersons.length === 0}
              onClick={() => { setMode('existing'); if (legalPersons[0]) selectCustomer(legalPersons[0]); }}>
              Existing Legal Person
            </button>
            <button type="button" className={mode === 'new' ? 'active' : ''}
              onClick={() => { setMode('new'); setCustomer(EMPTY_CUSTOMER); setLegalPersonId(''); }}>
              New Legal Person
            </button>
          </div>

          {mode === 'existing' && (
            <Field label="Legal Name ">
              <Combobox
                value={legalPersonId}
                placeholder="Search by name or registration number…"
                options={legalPersons.map((lp) => ({ value: lp.id, label: lp.name, sub: lp.registrationNumber }))}
                onChange={(id) => {
                  const lp = legalPersons.find((c) => c.id === id);
                  if (lp) selectCustomer(lp);
                }}
              />
            </Field>
          )}

          <div className="grid-3">
            <Field label="Legal Name " required>
              <input value={customer.name} disabled={mode === 'existing'}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            </Field>
            <Field label="Registration number" required>
              <input className="mono" value={customer.registrationNumber} disabled={mode === 'existing'}
                onChange={(e) => setCustomer({ ...customer, registrationNumber: e.target.value })} />
            </Field>
            <Field label="Entity type" required>
              <select value={customer.entityType} disabled={mode === 'existing'}
                onChange={(e) => setCustomer({ ...customer, entityType: e.target.value })}>
                {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid-3">
            <Field label="TIN" required>
              <input className="mono" value={customer.tin} onChange={(e) => setCustomer({ ...customer, tin: e.target.value })} />
            </Field>
            <Field label="Country of incorporation" required>
              <input value={customer.countryOfIncorporation}
                onChange={(e) => setCustomer({ ...customer, countryOfIncorporation: e.target.value })} />
            </Field>
            <Field label="Nature of business" required>
              <input value={customer.natureOfBusiness}
                onChange={(e) => setCustomer({ ...customer, natureOfBusiness: e.target.value })} />
            </Field>
             <Field label="Directors and senior management" >
                            <textarea value={smo.directorsAndManagement}
                              onChange={(e) => setSmo({ ...smo, directorsAndManagement: e.target.value })} />
                          </Field>
          </div>

          <Nav onNext={nextFromCustomer} hideBack />
        </div>
      )}

      {/* ===================== 2  Structure ===================== */}
      {step === 1 && (
        <>
          <OwnershipTree
            legalPersonId={legalPersonId}
            canEdit
            onTreeChange={setTree}
            startWithPerson={startWithPerson}
            onPersonSaved={(p) => setPersonDrafts((d) => ({ ...d, [personKey(p.fullName, p.idNumber)]: p }))}
          />
          <div className="form-card"><Nav onNext={nextFromStructure} /></div>
        </>
      )}

      {/* ===================== 3 Control & UBO assessment ===================== */}
      {step === 2 && tree && (
        <div className="form-card">
          <h3> Examine control, not only percentage ownership</h3>
          <div className="hint">
            Effective ownership is calculated for you (threshold {pct(tree.thresholdPercentage)}%). A person is also a UBO
            if control is exercised by other means, even below the threshold — tick the control basis that applies.
          </div>
          {tree.holders.length === 0 && <div className="hint">No natural persons found yet. Go back and trace the structure further.</div>}
          {tree.holders.map((h) => {
            const d = controlDraft[h.key] || { controlBasis: [], controlNotes: '', dirty: false };
            const toggle = (c) => setControlDraft((x) => ({
              ...x,
              [h.key]: {
                ...d,
                dirty: true,
                controlBasis: d.controlBasis.includes(c) ? d.controlBasis.filter((k) => k !== c) : [...d.controlBasis, c],
              },
            }));
            return (
              <div key={h.key} className={`holder-card${h.ubo ? ' holder-card--ubo' : ''}`}>
                <div className="holder-head">
                  <div>
                    <strong>{h.fullName}</strong>
                    <div className="hint" style={{ margin: 0 }}>{[h.idNumber, h.nationality].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="holder-pct"><strong>{pct(h.effectivePercentage)}%</strong><span>effective</span></div>
                  <div>
                    {h.qualifiesByOwnership && <span className="chip chip-ubo">Ownership UBO</span>}
                    {(h.qualifiesByControl || d.controlBasis.length > 0) && <span className="chip chip-control">Control</span>}
                    {!h.ubo && d.controlBasis.length === 0 && <span className="chip chip-muted">Below threshold</span>}
                    {h.registered && <span className="chip chip-muted">Already registered {h.beneficialOwnerReference}</span>}
                  </div>
                </div>
                {h.paths.map((p, i) => <div key={i} className="chain">{p.chain} <b>= {pct(p.percentage)}%</b></div>)}
                {!h.registered && (
                  <>
                    <div className="checkbox-grid">
                      {Object.entries(controlBasisLabel).map(([k, label]) => (
                        <label key={k} className="checkbox-item">
                          <input type="checkbox" checked={d.controlBasis.includes(k)} onChange={() => toggle(k)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    {d.controlBasis.length > 0 && (
                      <Field label="Control details">
                        <input placeholder="e.g. clause 4 of the shareholders' agreement"
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

      {/* ===================== 4 Senior managing official ===================== */}
      {step === 3 && tree && (
        <div className="form-card">
          <h3> Senior managing official fallback</h3>
          {!tree.seniorManagingOfficialAllowed ? (
            <div className="banner-success"><span>A natural-person UBO was identified, so the fallback is not required.</span></div>
          ) : (
            <>
              <div className="hint">
                No natural person owns or controls the customer after the measures taken. Record the appropriate senior
                managing official and the capacity. This does not make the CEO the UBO automatically; it is fallback
                after reasonable measures.
              </div>
              {tree.seniorManagingOfficial && (
                <div className="smo-summary">
                  <strong>{tree.seniorManagingOfficial.name}</strong> — {tree.seniorManagingOfficial.position}
                  <div className="hint" style={{ margin: '4px 0 0' }}>{tree.seniorManagingOfficial.justification}</div>
                </div>
              )}
              <div className="grid-2" style={{ marginTop: 14 }}>
                <Field label="Name" required>
                  <input value={smo.name} onChange={(e) => setSmo({ ...smo, name: e.target.value })} />
                </Field>
                <Field label="Position / capacity" required>
                  <input value={smo.position} onChange={(e) => setSmo({ ...smo, position: e.target.value })} />
                </Field>
              </div>
              <Field label="Reasonable measures taken" required>
                <input placeholder="What was done to identify the controlling natural person, and why it failed"
                  value={smo.justification} onChange={(e) => setSmo({ ...smo, justification: e.target.value })} />
              </Field>

              <button type="button" className="btn btn-blue" disabled={busy || !smo.name || !smo.position || !smo.justification}
                onClick={submitSmo}>
                {tree.seniorManagingOfficial ? 'Update ' : 'Save'}
              </button>
            </>
          )}
          <div style={{ margin: '14px 0' }}>
            <button type="button" className="btn btn-outline" disabled={busy}
              onClick={() => { setStartWithPerson(true); go(1); }}>
              + Add natural person (optional)
            </button>
            <div className="hint" style={{ margin: '6px 0 0' }}>
              Found a natural person after all? Add them to the ownership structure with their full details.
            </div>
          </div>
          <Nav onNext={nextFromFallback} nextLabel={tree.seniorManagingOfficialAllowed ? 'Continue to final submit' : 'Continue'} />
        </div>
      )}

      {/* ===================== 5 Verify each UBO ===================== */}
      {step === 4 && (
        <div>
          <div className="hint" style={{ marginBottom: 12 }}>
            For each beneficial owner, obtain and verify identity, ownership, PEP, sanctions and
            source-of-wealth information. Ownership %, direct/indirect, chain and control basis are calculated from the structure.
          </div>
          {subjects.length === 0 && <div className="form-card"><div className="hint" style={{ margin: 0 }}>
            No unregistered beneficial owner found for this customer.</div></div>}

          {subjects.map((s, idx) => {
            const f = forms[s.key];
            if (!f) return null;
            if (results[s.key]?.status === 'created') {
              return (
                <div key={s.key} className="form-card">
                  <div className="holder-head">
                    <h3 style={{ margin: 0 }}>{idx + 1}. {f.fullName}</h3>
                    <span className="chip chip-ubo">Already submitted · {results[s.key].ref}</span>
                  </div>
                </div>
              );
            }
            const miss = personMissing(f);
            const viewAs = viewMode[s.key] ?? (miss.length === 0 ? 'record' : 'form');
            // the first edit pins the card to the form, so it does not flip to the record while typing
            const set = (patch) => {
              setViewMode((v) => (v[s.key] ? v : { ...v, [s.key]: 'form' }));
              setForm(s.key, patch);
            };
            const h = s.holder;
            return (
              <div key={s.key} className="form-card">
                <div className="holder-head">
                  <h3 style={{ margin: 0 }}>
                    {idx + 1}. {f.fullName || (s.kind === 'smo' ? 'Senior managing official' : 'Beneficial owner')}
                    {s.kind === 'smo' && <span className="chip chip-control">Fallback</span>}
                  </h3>
                  <span className={`chip ${miss.length === 0 ? 'chip-ubo' : 'chip-muted'}`}>
                    {miss.length === 0 ? 'Complete' : `${miss.length} missing`}
                  </span>
                </div>

                <div className="derived-box">
                  {h ? (
                    <>
                      <div><strong>{pct(h.effectivePercentage)}%</strong> effective ·{' '}
                        {h.paths.length === 1 && (h.paths[0].chain.match(/ → /g) || []).length === 1
                          ? 'Direct' : 'Indirect'} · {h.qualifiesByOwnership ? 'Ownership' : 'Control'} basis</div>
                      {h.paths.map((p, i) => <div key={i} className="chain">{p.chain} <b>= {pct(p.percentage)}%</b></div>)}
                      {h.controlBasis.length > 0 && (
                        <div className="chain">Control: {h.controlBasis.map((c) => controlBasisLabel[c] || c).join(', ')}</div>
                      )}
                    </>
                  ) : (
                    <div><strong>{s.smo.position}</strong> — recorded as the senior managing official (CDD fallback), not as a UBO.</div>
                  )}
                </div>

                {viewAs === 'form' && miss.length === 0 && (
                  <div style={{ margin: '10px 0' }}>
                    <button type="button" className="btn btn-outline"
                      onClick={() => setViewMode((v) => ({ ...v, [s.key]: 'record' }))}>Preview record</button>
                  </div>
                )}

                {viewAs === 'record' ? (
                  <RecordView f={f} s={s} />
                ) : (
                  <RecordEditor f={f} s={s} set={set} idKey={s.key} />
                )}
              </div>
            );
          })}
          <div className="form-card"><Nav onNext={nextFromVerify} nextLabel="Continue" /></div>
        </div>
      )}

      {/* ===================== Confirm & final submit ===================== */}
      {step === 5 && (
        <div className="form-card">
          <h3>Confirm and Final submit</h3>
          <div className="hint">Submitting sends every beneficial owner below to a checker for Approving.</div>

          <div className="review-block">
            <div className="hint">Customer</div>
            <div><strong>{customer.name}</strong> · {customer.registrationNumber} · TIN {customer.tin}</div>
            <div>{customer.countryOfIncorporation} · {customer.natureOfBusiness}</div>
            <div>Directors / senior management: {customer.directorsAndManagement}</div>
          </div>

          {tree?.warnings.length > 0 && (
            <div className="banner-warn"><strong>Tracing notes</strong>
              <ul>{tree.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
          )}

          <div className="table-card">
            <table>
              <thead>
                <tr><th>Full Name</th><th>Capacity</th><th>Ownership</th><th>PEP</th><th>Sanctions</th><th>Document</th><th>Result</th></tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const f = forms[s.key];
                  const r = results[s.key];
                  return (
                    <tr key={s.key}>
                      <td>{f.fullName}<div className="hint" style={{ margin: 0 }}>{f.idNumber}</div></td>
                      <td>{s.kind === 'smo' ? 'Senior managing official' : (s.holder.qualifiesByOwnership ? 'Ownership' : 'Control')}</td>
                      <td>{s.kind === 'smo' ? '—' : `${pct(s.holder.effectivePercentage)}%`}</td>
                      <td>{s.kind === 'smo' ? '—' : (f.pep ? 'Yes' : 'No')}</td>
                      <td>{s.kind === 'smo' ? '—' : (f.sanctionsScreened ? 'Screened' : '—')}</td>
                      <td>{[f.file, ...f.evidence].filter(Boolean).length} file(s)<div className="hint" style={{ margin: 0 }}>{f.file?.name}</div></td>
                      <td>
                        {r?.status === 'created' && <><span className="chip chip-ubo">Submitted</span> <span className="mono">{r.ref}</span>
                          {r.docWarning && <div className="tree-warn" style={{ margin: 0 }}>{r.docWarning}</div>}</>}
                        {r?.status === 'error' && <span className="tree-warn" style={{ margin: 0 }}>{r.error}</span>}
                        {!r && '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!allCreated && (
            <label className="checkbox-item" style={{ margin: '14px 0' }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>I confirm the information is adequate, accurate and up to date, and that reasonable measures were taken to verify the identity and beneficial-owner status of each person above.</span>
            </label>
          )}

          {allCreated ? (
            <>
              <div className="banner-success"><span>All beneficial owners were submitted for checker approval.</span></div>
              <div className="wizard-nav"><span /><button type="button" className="btn btn-blue" onClick={reset}>Register another customer</button></div>
            </>
          ) : (
            <Nav onNext={finalSubmit} nextLabel={anyFailed ? 'Retry failed' : 'Final submit'} disabled={!confirmed} />
          )}
        </div>
      )}
    </div>
  );
}
