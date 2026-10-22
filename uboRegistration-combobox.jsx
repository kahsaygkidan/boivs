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
import { ID_TYPE_CONFIG, personMissing, today } from '../data/uboForm.js';
import Field from '../components/Field.jsx';
import PersonFields from '../components/PersonFields.jsx';

/* ==========================================================================
   UBO registration — guided process, then one final submit to the checker
   10.1 Customer  ->  10.2/10.3 Ownership structure  ->  10.4 Control
   ->  10.5 Senior managing official fallback  ->  10.6 Verify each UBO  ->  Submit
   ========================================================================== */

const STEPS = [
  { key: 'customer', title: 'Customer' },
  { key: 'structure', title: 'Ownership structure' },
  { key: 'control', title: 'Control & UBOs' },
  { key: 'fallback', title: 'Fallback' },
  { key: 'verify', title: 'Verify Detail' },
  { key: 'submit', title: 'Confirm & Final submit' },
];

const ENTITY_TYPES = [
  { value: 'SHARE_COMPANY', label: 'Share Company' },
  { value: 'PRIVATE_LIMITED_COMPANY', label: 'Private Limited Company' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'OTHER_LEGAL_ARRANGEMENT', label: 'Other legal arrangement' },
];

const EMPTY_CUSTOMER = {
  name: '',
  registrationNumber: '',
  entityType: 'SHARE_COMPANY',
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

const EMPTY_SMO = { name: '', position: '', justification: '' ,directorsAndManagement:''};

const pct = (v) => String(Number(v ?? 0));

const emptySubjectForm = (subject) => ({
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
});

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

/* ---------- Searchable combobox ---------- */
function SearchableSelect({ options, value, onChange, placeholder = 'Search…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (o) =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.registrationNumber || '').toLowerCase().includes(q) ||
        (o.tin || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  const pick = (o) => {
    onChange(o.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : (selected ? `${selected.name} (${selected.registrationNumber})` : '')}
        placeholder={selected ? '' : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        style={{ width: '100%' }}
      />
      {open && (
        <div
          className="combobox-list"
          style={{
            position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0,
            background: '#fff', border: '1px solid #ccc', borderRadius: 4,
            maxHeight: 240, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,.12)',
          }}
        >
          {filtered.length === 0 && (
            <div className="hint" style={{ padding: 8, margin: 0 }}>No matches</div>
          )}
          {filtered.map((o) => (
            <div
              key={o.id}
              onClick={() => pick(o)}
              style={{
                padding: '8px 10px', cursor: 'pointer',
                background: o.id === value ? '#eef4ff' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = o.id === value ? '#eef4ff' : 'transparent')}
            >
              <strong>{o.name}</strong>
              <div className="hint" style={{ margin: 0 }}>
                {o.registrationNumber} · TIN {o.tin || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Record summary list ---------- */
function RecordSummary({ f }) {
  const rows = [
    ['Full name', f.fullName],
    ['Gender', f.gender],
    ['Date of birth', f.dateOfBirth],
    ['Place of birth', f.placeOfBirth],
    ['Residential status', f.residentialStatus],
    ['Email', f.emailAddress],
    ['Phone', f.phoneNumber],
    ['Occupation', f.occupation],
    ['ID document', f.idDocumentType],
    ['ID number', f.idNumber],
    ['Nationality', f.nationality],
    ['Country of issue', f.countryOfIssue],
    ['Date of issue', f.dateOfIssue],
    ['Date of expiry', f.dateOfExpiry],
    ['Residential address', f.residentialAddress],
    ['Source of info', f.sourceOfInformation],
    ['Date became BO', f.dateBecameBo],
    ['PEP', f.pep ? 'Yes' : 'No'],
    ['PEP details', f.pepDetails],
    ['Sanctions screened', f.sanctionsScreened ? 'Yes' : 'No'],
    ['Source of wealth', f.sourceOfWealth],
    ['Source of funds', f.sourceOfFunds],
    ['Additional info', f.additionalInformation],
  ];
  return (
    <details className="record-summary" style={{ margin: '12px 0', border: '1px solid #e5e7eb', borderRadius: 6 }}>
      <summary style={{ padding: 10, cursor: 'pointer', fontWeight: 600 }}>Record summary</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0 }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: '6px 12px', borderBottom: '1px solid #f1f2f4',
              borderRight: '1px solid #f1f2f4', display: 'flex',
              justifyContent: 'space-between', gap: 12,
            }}
          >
            <span className="hint" style={{ margin: 0 }}>{label}</span>
            <strong style={{ textAlign: 'right' }}>{value || '—'}</strong>
          </div>
        ))}
      </div>
    </details>
  );
}

/* ==========================================================================
   Main wizard
   ========================================================================== */
export default function UboRegistration() {
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

  /*  verification + final submit */
  const [subjects, setSubjects] = useState([]);
  const [forms, setForms] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState({}); // key -> { status, ref, error, docWarning }

  /* natural person manual entry */
  const [naturalPersonMode, setNaturalPersonMode] = useState(false);

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
    go(4);
  };

  /* Build the list of people to verify when entering step 5 */
  useEffect(() => {
    if (step !== 4 || !tree) return;
    // keep people already submitted in this session in the list, so the whole batch stays visible
    const list = tree.holders.filter((h) => h.ubo && (!h.registered || results[h.key]?.status === 'created'))
      .map((h) => ({ key: h.key, kind: 'ubo', holder: h }));
    if (list.length === 0 && tree.seniorManagingOfficialAllowed && tree.seniorManagingOfficial) {
      list.push({ key: 'smo', kind: 'smo', smo: tree.seniorManagingOfficial });
    }
    setSubjects(list);
    setForms((f) => {
      const next = { ...f };
      list.forEach((s) => { if (!next[s.key]) next[s.key] = emptySubjectForm(s); });
      return next;
    });
  }, [step, tree]);

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
  const finalSubmit = () => run(async () => {
    if (!confirmed) throw new Error('Please confirm the declaration before submitting.');
    const nextResults = { ...results };
    for (const s of subjects) {
      if (nextResults[s.key]?.status === 'created') continue;
      const f = forms[s.key];
      let ownershipPart;
      if (s.kind === 'ubo') {
        ownershipPart = {
          ownershipNodeId: s.holder.ownershipNodeId,
          ownershipType: 'INDIRECT',
          ownershipPercentage: Number(s.holder.effectivePercentage),
        };
      } else if (s.kind === 'smo') {
        ownershipPart = {
          capacity: 'SENIOR_MANAGING_OFFICIAL',
          ownershipType: 'CONTROL_BY_OTHER_MEANS',
          ownershipPercentage: 0,
        };
      } else {
        // manual natural person
        ownershipPart = {
          ownershipType: 'DIRECT',
          ownershipPercentage: 100,
        };
      }
      try {
        const created = await createBoRecord({
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
    setControlDraft({}); setSmo(EMPTY_SMO); setError(null);
    setNaturalPersonMode(false);
    if (legalPersons.length > 0) { setMode('existing'); selectCustomer(legalPersons[0]); }
    else { setMode('new'); setCustomer(EMPTY_CUSTOMER); }
  };

  const allCreated = subjects.length > 0 && subjects.every((s) => results[s.key]?.status === 'created');
  const anyFailed = subjects.some((s) => results[s.key]?.status === 'error');

  /* ==========================================================================
     Render
     ========================================================================== */
  const Nav = ({ onNext, nextLabel = 'Continue', hideBack, disabled }) => (
    <div className="wizard-nav">
      {!hideBack && step > 0 && !allCreated
        ? <button type="button" className="btn btn-blue" disabled={busy} onClick={() => go(step === 4 && tree?.holders.some((h) => h.ubo) ? 2 : step - 1)}>Back</button>
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
          <h1>UBO registration</h1>
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
          <h3>Identify the customer / legal entity</h3>
          <div className="hint"> customer .</div>

          <div className="segmented">
            <button type="button" className={mode === 'existing' ? 'active' : ''}
              disabled={legalPersons.length === 0}
              onClick={() => { setMode('existing'); if (legalPersons[0]) selectCustomer(legalPersons[0]); }}>
              Existing customer
            </button>
            <button type="button" className={mode === 'new' ? 'active' : ''}
              onClick={() => { setMode('new'); setCustomer(EMPTY_CUSTOMER); setLegalPersonId(''); }}>
              New customer
            </button>
          </div>

          {mode === 'existing' && (
            <Field label="Customer">
              <SearchableSelect
                options={legalPersons}
                value={legalPersonId}
                placeholder="Search by name, registration number or TIN…"
                onChange={(id) => {
                  const lp = legalPersons.find((c) => c.id === id);
                  if (lp) selectCustomer(lp);
                }}
              />
            </Field>
          )}

          <div className="grid-3">
            <Field label="Company name" required>
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
          </div>

          <div style={{ margin: '10px 0 18px', display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-blue"
              disabled={!legalPersonId}
              onClick={() => {
                if (!legalPersonId) {
                  setError('Select or create a customer first.');
                  return;
                }
                setNaturalPersonMode(true);
                go(4);
              }}
            >
              For natural person
            </button>
          </div>

          <Nav onNext={nextFromCustomer} hideBack />
        </div>
      )}

      {/* ===================== 2  Structure ===================== */}
      {step === 1 && (
        <>
            <OwnershipTree legalPersonId={legalPersonId} canEdit onTreeChange={setTree} />
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
                        <Field label="Directors and senior management" required>
                          <input  value={smo.directorsAndManagement}
                            onChange={(e) => setSmo({ ...smo, directorsAndManagement: e.target.value })} />
                        </Field>
              <button type="button" className="btn btn-blue" disabled={busy || !smo.name || !smo.position || !smo.justification}
                onClick={submitSmo}>
                {tree.seniorManagingOfficial ? 'Update ' : 'Save'}
              </button>
            </>
          )}
          <Nav onNext={nextFromFallback} />
        </div>
      )}

      {/* ===================== 5 Natural person manual entry ===================== */}
      {step === 4 && naturalPersonMode && subjects.length === 0 && (
        <div className="form-card">
          <h3>Natural person details</h3>
          <div className="hint">Enter the full personal information for this individual.</div>
          <PersonFields
            f={forms['__manual'] || emptySubjectForm({ holder: {} })}
            set={(patch) =>
              setForms((prev) => ({
                ...prev,
                __manual: { ...(prev['__manual'] || emptySubjectForm({ holder: {} })), ...patch },
              }))
            }
            idKey="__manual"
            showFile
          />
          <div className="wizard-nav">
            <button type="button" className="btn btn-blue" disabled={busy} onClick={() => { setNaturalPersonMode(false); go(0); }}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-blue"
              disabled={busy}
              onClick={() => {
                const f = forms['__manual'];
                if (!f || !String(f.fullName || '').trim()) {
                  setError('Enter at least the full name of the natural person.');
                  return;
                }
                const key = 'manual-' + Date.now();
                setForms((prev) => ({ ...prev, [key]: f }));
                setSubjects((subs) => [...subs, { key, kind: 'manual' }]);
                setForms((prev) => {
                  const next = { ...prev };
                  delete next['__manual'];
                  return next;
                });
                setNaturalPersonMode(false);
                setError(null);
              }}
            >
              Save person
            </button>
          </div>
        </div>
      )}

      {/* ===================== 6 Verify each UBO ===================== */}
      {step === 4 && !(naturalPersonMode && subjects.length === 0) && (
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
            const set = (patch) => setForm(s.key, patch);
            const h = s.holder;
            return (
              <div key={s.key} className="form-card">
                <div className="holder-head">
                  <h3 style={{ margin: 0 }}>
                    {idx + 1}. {f.fullName || (s.kind === 'smo' ? 'Senior managing official' : s.kind === 'manual' ? 'Natural person' : 'Beneficial owner')}
                    {s.kind === 'smo' && <span className="chip chip-control">Fallback</span>}
                    {s.kind === 'manual' && <span className="chip chip-control">Direct entry</span>}
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
                  ) : s.kind === 'smo' ? (
                    <div><strong>{s.smo.position}</strong> — recorded as the senior managing official (CDD fallback), not as a UBO.</div>
                  ) : (
                    <div>Manually entered natural person — direct 100% ownership.</div>
                  )}
                </div>

                <RecordSummary f={f} />

                <PersonFields f={f} set={set} idKey={s.key} showFile />
                <Field label="Supporting evidence documents">
                  <input type="file" multiple
                    onChange={(e) => set({ evidence: Array.from(e.target.files || []) })} />
                </Field>
              </div>
            );
          })}
          <div className="form-card"><Nav onNext={nextFromVerify} nextLabel="Continue" /></div>
        </div>
      )}

      {/* ===================== 7 Confirm & final submit ===================== */}
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
                <tr><th>Person</th><th>Capacity</th><th>Ownership</th><th>PEP</th><th>Sanctions</th><th>Document</th><th>Result</th></tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const f = forms[s.key];
                  const r = results[s.key];
                  return (
                    <tr key={s.key}>
                      <td>{f.fullName}<div className="hint" style={{ margin: 0 }}>{f.idNumber}</div></td>
                      <td>
                        {s.kind === 'smo' ? 'Senior managing official'
                          : s.kind === 'manual' ? 'Direct natural person'
                          : (s.holder.qualifiesByOwnership ? 'Ownership' : 'Control')}
                      </td>
                      <td>{s.kind === 'smo' ? '—' : s.kind === 'manual' ? '100%' : `${pct(s.holder.effectivePercentage)}%`}</td>
                      <td>{f.pep ? 'Yes' : 'No'}</td>
                      <td>{f.sanctionsScreened ? 'Screened' : '—'}</td>
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
