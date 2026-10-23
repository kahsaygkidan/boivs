import { useCallback, useEffect, useState } from 'react';
import {
  addOwnershipNode,
  deleteOwnershipNode,
  getOwnershipTree,
} from '../api/bovsApi.js';
import { controlBasisLabel } from '../data/records.js';
import { today } from '../data/uboForm.js';
import PersonFields from './PersonFields.jsx';

/* ==========================================================================
   Ownership tree — traces a customer's ownership through every intermediate
   company down to the natural person(s), calculating effective % per path.
   ========================================================================== */

export const EMPTY_PERSON = {
  fullName: '',
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
  idNumber: '',
  nationality: '',
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
  evidence: [],
};

let entrySeq = 0;
// one natural person inside the add form: own stake, personal details and control basis
const newEntry = () => ({
  id: `p${Date.now()}-${entrySeq++}`,
  ownershipPercentage: '',
  person: EMPTY_PERSON,
  controlBasis: [],
  controlNotes: '',
});

const EMPTY_NODE = {
  nodeType: 'COMPANY',
  name: '',
  registrationNumber: '',
  ownershipPercentage: '', // company stake
  persons: [newEntry()],   // natural persons (any number, together within the 100% limit)
};

const num = (v) => Number(v) || 0;
const round = (v) => Math.round(v * 100) / 100;

// nodes that already hold a direct stake in the same parent
const siblingsOf = (tree, parentId) => {
  if (!tree) return [];
  if (parentId == null) return tree.shareholders || [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.id === parentId) return n.children || [];
      const r = walk(n.children || []);
      if (r) return r;
    }
    return null;
  };
  return walk(tree.shareholders || []) || [];
};

function CompanyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 14V3.5L8 1.5V14M8 14V6l6 2v6M4.5 5h1M4.5 8h1M4.5 11h1M11 9.5h1M11 12h1"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.2" r="2.7" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.8 14c.4-2.6 2.3-4 5.2-4s4.8 1.4 5.2 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const pct = (v) => (v == null ? '0' : String(Number(v)));

/* ---------- Inline add-shareholder form ---------- */
function AddNodeForm({ parentName, form, setForm, busy, existingTotal, onSubmit, onCancel }) {
  const individual = form.nodeType === 'INDIVIDUAL';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const updateEntry = (id, patch) =>
    setForm((f) => ({ ...f, persons: f.persons.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const updatePerson = (id, patch) =>
    setForm((f) => ({
      ...f,
      persons: f.persons.map((e) => (e.id === id ? { ...e, person: { ...e.person, ...patch } } : e)),
    }));
  const toggleControl = (id, key) =>
    setForm((f) => ({
      ...f,
      persons: f.persons.map((e) => (e.id !== id ? e : {
        ...e,
        controlBasis: e.controlBasis.includes(key)
          ? e.controlBasis.filter((k) => k !== key)
          : [...e.controlBasis, key],
      })),
    }));
  const addEntry = () => setForm((f) => ({ ...f, persons: [...f.persons, newEntry()] }));
  const removeEntry = (id) => setForm((f) => ({ ...f, persons: f.persons.filter((e) => e.id !== id) }));

  const newTotal = individual
    ? form.persons.reduce((t, e) => t + num(e.ownershipPercentage), 0)
    : num(form.ownershipPercentage);
  const remaining = round(100 - existingTotal - newTotal);
  const over = remaining < 0;

  const stakeInput = (value, onChange) => (
    <div className="input-affix">
      <input type="number" step="any" min="0" max="100" value={value}
        onChange={(e) => onChange(e.target.value)} required />
      <span>%</span>
    </div>
  );

  return (
    <form className="node-form" onSubmit={onSubmit}>
      <div className="node-form-title">Add shareholder of <strong>{parentName}</strong></div>

      <div className="segmented" role="tablist" aria-label="Shareholder type">
        <button type="button" className={!individual ? 'active' : ''} onClick={() => set('nodeType', 'COMPANY')}>
          Company (keep tracing)
        </button>
        <button type="button" className={individual ? 'active' : ''} onClick={() => set('nodeType', 'INDIVIDUAL')}>
          Natural person
        </button>
      </div>

      {!individual && (
        <div className="grid-3">
          <div className="form-field">
            <label>Company name <span className="req">*</span></label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Registration number</label>
            <input className="mono" value={form.registrationNumber}
              onChange={(e) => set('registrationNumber', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Direct stake in {parentName} <span className="req">*</span></label>
            {stakeInput(form.ownershipPercentage, (v) => set('ownershipPercentage', v))}
          </div>
        </div>
      )}

      {individual && form.persons.map((en, i) => (
        <div key={en.id} className="person-card">
          <div className="person-card-head">
            <strong>Natural person {i + 1}</strong>
            {form.persons.length > 1 && (
              <button type="button" className="btn btn-danger-outline btn-sm" disabled={busy}
                onClick={() => removeEntry(en.id)}>Remove</button>
            )}
          </div>

          <div className="form-field" style={{ maxWidth: 260 }}>
            <label>Direct stake in {parentName} <span className="req">*</span></label>
            {stakeInput(en.ownershipPercentage, (v) => updateEntry(en.id, { ownershipPercentage: v }))}
          </div>

          <PersonFields f={en.person} set={(patch) => updatePerson(en.id, patch)} idKey={`node-${en.id}`} showFile />

          <div className="form-field">
            <label>Supporting evidence documents</label>
            <input type="file" multiple
              onChange={(e) => updatePerson(en.id, { evidence: Array.from(e.target.files || []) })} />
          </div>

          <div className="form-field">
            <label>Control basis (tick any that apply — control can make a person a UBO below the threshold)</label>
            <div className="checkbox-grid">
              {Object.entries(controlBasisLabel).map(([key, label]) => (
                <label key={key} className="checkbox-item">
                  <input type="checkbox" checked={en.controlBasis.includes(key)} onChange={() => toggleControl(en.id, key)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {en.controlBasis.length > 0 && (
            <div className="form-field">
              <label>Control details</label>
              <input placeholder="e.g. clause 4 of the shareholders' agreement dated …"
                value={en.controlNotes} onChange={(e) => updateEntry(en.id, { controlNotes: e.target.value })} />
            </div>
          )}
        </div>
      ))}

      {individual && (
        <button type="button" className="btn btn-outline" disabled={busy || remaining <= 0} onClick={addEntry}>
          + Add another natural person
        </button>
      )}

      <div className={`stake-meter${over ? ' over' : ''}`}>
        <span>
          {existingTotal > 0 && <>Already held in {parentName}: <b>{round(existingTotal)}%</b> · </>}
          This form: <b>{round(newTotal)}%</b>
        </span>
        <span>{over ? `Over the 100% limit by ${Math.abs(remaining)}%` : `Remaining: ${remaining}%`}</span>
      </div>

      <div className="node-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-blue" disabled={busy || over}>
          {busy ? 'Saving…' : individual && form.persons.length > 1 ? `Add ${form.persons.length} people` : 'Add'}
        </button>
      </div>
    </form>
  );
}

/* ---------- One tree row (recursive) ---------- */
function NodeRow({ node, ctx }) {
  const company = node.nodeType === 'COMPANY';
  const hasUntraced = company && Number(node.untracedPercentage) > 0;
  const showForm = ctx.addingTo === node.id;

  return (
    <li className="tree-item">
      <div className={`tree-row${node.ubo ? ' tree-row--ubo' : ''}`}>
        <span className={`tree-icon ${company ? 'company' : 'person'}`}>
          {company ? <CompanyIcon /> : <PersonIcon />}
        </span>
        <div className="tree-main">
          <div className="tree-name">
            {node.name}
            {node.ubo && <span className="chip chip-ubo">UBO</span>}
          </div>
          <div className="tree-meta">
            {company
              ? (node.registrationNumber || 'Legal person')
              : [node.idNumber, node.nationality].filter(Boolean).join(' · ') || 'Natural person'}
            {node.controlBasis?.map((c) => (
              <span key={c} className="chip chip-control">{controlBasisLabel[c] || c}</span>
            ))}
          </div>
        </div>
        <div className="tree-pct"><strong>{pct(node.ownershipPercentage)}%</strong><span>direct</span></div>
        <div className="tree-pct"><strong>{pct(node.effectivePercentage)}%</strong><span>of customer</span></div>
        {ctx.canEdit && (
          <div className="tree-actions">
            {company && (
              <>
                <button type="button" className="btn btn-blue" disabled={ctx.busy} onClick={() => ctx.openAdd(node.id)}>
                  + Shareholder
                </button>
                <button type="button" className="btn btn-outline" disabled={ctx.busy} onClick={() => ctx.openAdd(node.id, 'INDIVIDUAL')}>
                  + Natural person
                </button>
              </>
            )}
            <button type="button" className="btn btn-danger-outline btn-sm" disabled={ctx.busy} onClick={() => ctx.remove(node)}>
              Remove
            </button>
          </div>
        )}
      </div>

      {hasUntraced && (
        <div className="tree-warn">
          {pct(node.untracedPercentage)}% of {node.name} is not yet traced to a shareholder.
        </div>
      )}

      {(node.children.length > 0 || showForm) && (
        <ul className="tree-children">
          {node.children.map((c) => <NodeRow key={c.id} node={c} ctx={ctx} />)}
          {showForm && <li>{ctx.renderForm(node.name)}</li>}
        </ul>
      )}
    </li>
  );
}

/* ==========================================================================
   Main component
   ========================================================================== */
export default function OwnershipTree({ legalPersonId, canEdit, onTreeChange, onPersonSaved, startWithPerson = false }) {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addingTo, setAddingTo] = useState(undefined); // undefined = closed, null = customer, string = company node id
  const [form, setForm] = useState(EMPTY_NODE);

  useEffect(() => {
    onTreeChange?.(tree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const load = useCallback(() => {
    if (!legalPersonId) {
      setTree(null);
      return Promise.resolve();
    }
    setError(null);
    return getOwnershipTree(legalPersonId)
      .then(setTree)
      .catch((err) => setError(err.friendlyMessage || 'Failed to load ownership structure'));
  }, [legalPersonId]);

  useEffect(() => {
    setAddingTo(undefined);
    setForm(EMPTY_NODE);
    load();
  }, [load]);

  // Opened from the Fallback step: start with the "Natural person" form open under the customer
  useEffect(() => {
    if (startWithPerson && canEdit && legalPersonId) {
      setForm({ ...EMPTY_NODE, persons: [newEntry()], nodeType: 'INDIVIDUAL' });
      setAddingTo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWithPerson, legalPersonId]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const t = await fn();
      if (t) setTree(t);
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openAdd = (parentId, nodeType = 'COMPANY') => {
    setForm({ ...EMPTY_NODE, persons: [newEntry()], nodeType });
    setAddingTo(parentId);
  };

  const submitNode = (e) => {
    e.preventDefault();
    run(async () => {
      const individual = form.nodeType === 'INDIVIDUAL';
      const held = siblingsOf(tree, addingTo).reduce((t, n) => t + num(n.ownershipPercentage), 0);
      const incoming = individual
        ? form.persons.reduce((t, en) => t + num(en.ownershipPercentage), 0)
        : num(form.ownershipPercentage);
      if (round(held + incoming) > 100) {
        throw new Error(`Total direct stake would be ${round(held + incoming)}% — it cannot exceed 100%.`);
      }

      if (!individual) {
        const t = await addOwnershipNode(legalPersonId, {
          parentId: addingTo,
          nodeType: 'COMPANY',
          name: form.name.trim(),
          registrationNumber: form.registrationNumber || null,
          idNumber: null,
          nationality: null,
          ownershipPercentage: Number(form.ownershipPercentage),
          controlBasis: [],
          controlNotes: null,
        });
        setAddingTo(undefined);
        setForm(EMPTY_NODE);
        return t;
      }

      form.persons.forEach((en, i) => {
        if (!en.person.fullName.trim()) throw new Error(`Natural person ${i + 1}: full name is required.`);
        if (!(num(en.ownershipPercentage) > 0)) throw new Error(`Natural person ${i + 1}: enter a direct stake above 0%.`);
      });

      // The node endpoint only needs the tracing fields; full personal details are
      // submitted later with the BO record (Verify Detail step).
      let last = null;
      const saved = [];
      try {
        for (const en of form.persons) {
          last = await addOwnershipNode(legalPersonId, {
            parentId: addingTo,
            nodeType: 'INDIVIDUAL',
            name: en.person.fullName.trim(),
            registrationNumber: null,
            idNumber: en.person.idNumber || null,
            nationality: en.person.nationality || null,
            ownershipPercentage: Number(en.ownershipPercentage),
            controlBasis: en.controlBasis,
            controlNotes: en.controlNotes || null,
          });
          saved.push(en.id);
          onPersonSaved?.(en.person); // hand the full details to the wizard
        }
      } catch (err) {
        // keep what was already saved in the tree and leave only the unsaved people in the form
        if (last) setTree(last);
        setForm((f) => ({ ...f, persons: f.persons.filter((x) => !saved.includes(x.id)) }));
        throw err;
      }
      setAddingTo(undefined);
      setForm(EMPTY_NODE);
      return last;
    });
  };

  const removeNode = (node) => {
    const extra = node.children?.length ? ` and everything beneath it` : '';
    if (!window.confirm(`Remove ${node.name}${extra} from the ownership structure?`)) return;
    run(() => deleteOwnershipNode(legalPersonId, node.id));
  };

  if (!legalPersonId) {
    return <div className="hint">Select a customer to view its ownership structure.</div>;
  }
  if (!tree) {
    return error ? <div className="banner-error"><span>{error}</span></div> : <div className="hint">Loading…</div>;
  }

  const renderForm = (parentName) => (
    <AddNodeForm
      parentName={parentName}
      form={form}
      setForm={setForm}
      busy={busy}
      existingTotal={siblingsOf(tree, addingTo).reduce((t, n) => t + num(n.ownershipPercentage), 0)}
      onSubmit={submitNode}
      onCancel={() => setAddingTo(undefined)}
    />
  );
  const ctx = { canEdit, busy, addingTo, openAdd, remove: removeNode, renderForm };
  const hasNodes = tree.shareholders.length > 0;

  return (
    <div className="ownership">
      {error && <div className="banner-error"><span>{error}</span></div>}

      {/* ---------- Tracing checks ---------- */}
      {tree.warnings.length > 0 ? (
        <div className="banner-warn">
          <strong>Tracing is incomplete</strong>
          <ul>{tree.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      ) : (
        <div className="banner-success"><span>Every layer has been traced down to natural persons.</span></div>
      )}

      {/* ---------- Tree ---------- */}
      <div className="form-card">
        <div className="tree-head">
          <div>
            <h3>Ownership structure</h3>
          </div>
          {canEdit && (
            <div className="tree-head-actions">
              <button type="button" className="btn btn-blue" disabled={busy} onClick={() => openAdd(null)}>
                + Add shareholder
              </button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => openAdd(null, 'INDIVIDUAL')}>
                + Add natural person
              </button>
            </div>
          )}
        </div>

        <ul className="tree-list">
          <li className="tree-item">
            <div className="tree-row tree-row--root">
              <span className="tree-icon company"><CompanyIcon /></span>
              <div className="tree-main">
                <div className="tree-name">{tree.legalPersonName}</div>
                <div className="tree-meta">Customer · {tree.registrationNumber}</div>
              </div>
              <div className="tree-pct"><strong>100%</strong><span>customer</span></div>
            </div>
            {(hasNodes || addingTo === null) && (
              <ul className="tree-children">
                {tree.shareholders.map((n) => <NodeRow key={n.id} node={n} ctx={ctx} />)}
                {addingTo === null && <li>{renderForm(tree.legalPersonName)}</li>}
              </ul>
            )}
          </li>
        </ul>
        {!hasNodes && addingTo !== null && (
          <div className="hint" style={{ marginTop: 12 }}>No shareholders recorded yet.</div>
        )}
      </div>
    </div>
  );
}
