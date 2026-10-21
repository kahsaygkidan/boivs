import { useCallback, useEffect, useId, useState } from 'react';
import {
  addOwnershipNode,
  deleteOwnershipNode,
  getOwnershipTree,
} from '../api/bovsApi.js';
import { controlBasisLabel } from '../data/records.js';
import { failMsg } from '../utils/errors.js';

/* ==========================================================================
   Ownership tree — traces a customer's ownership through every intermediate
   company down to the natural person(s), calculating effective % per path.
   ========================================================================== */

const EMPTY_NODE = {
  nodeType: 'COMPANY',
  name: '',
  registrationNumber: '',
  idNumber: '',
  nationality: '',
  ownershipPercentage: '',
  controlBasis: [],
  controlNotes: '',
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
const countBelow = (n) => (n.children || []).reduce((t, c) => t + 1 + countBelow(c), 0);
const allocatedOf = (children) =>
  Math.round(children.reduce((t, c) => t + Number(c.ownershipPercentage || 0), 0) * 100) / 100;

/* ---------- Inline add-shareholder form ---------- */
function AddNodeForm({ parentName, available, form, setForm, busy, onSubmit, onCancel }) {
  const uid = useId();
  const id = (k) => `${uid}-${k}`;
  const individual = form.nodeType === 'INDIVIDUAL';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleControl = (key) =>
    setForm((f) => ({
      ...f,
      controlBasis: f.controlBasis.includes(key)
        ? f.controlBasis.filter((k) => k !== key)
        : [...f.controlBasis, key],
    }));

  return (
    <form className="node-form" onSubmit={onSubmit}>
      <div className="node-form-title">Add shareholder of <strong>{parentName}</strong></div>

      <div className="segmented" role="group" aria-label="Shareholder type">
        <button type="button" aria-pressed={!individual} className={!individual ? 'active' : ''} onClick={() => set('nodeType', 'COMPANY')}>
          Company (keep tracing)
        </button>
        <button type="button" aria-pressed={individual} className={individual ? 'active' : ''} onClick={() => set('nodeType', 'INDIVIDUAL')}>
          Natural person
        </button>
      </div>

      <div className="grid-3">
        <div className="form-field">
          <label htmlFor={id('name')}>{individual ? 'Full name' : 'Company name'} <span className="req">*</span></label>
          <input id={id('name')} autoComplete="off" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor={id('ref')}>
            {individual ? 'ID / passport number' : 'Registration number'}
            {individual && <span className="req"> *</span>}
          </label>
          <input
            id={id('ref')}
            className="mono"
            autoComplete="off"
            required
            aria-describedby={individual ? id('refhint') : undefined}
            value={individual ? form.idNumber : form.registrationNumber}
            onChange={(e) => set(individual ? 'idNumber' : 'registrationNumber', e.target.value)}
          />
          {individual && (
            <div className="hint" id={id('refhint')} style={{ margin: '4px 0 0' }}>
              Needed to recognise the same person in other branches and add their stakes together.
            </div>
          )}
        </div>
        <div className="form-field">
          <label htmlFor={id('pct')}>Direct stake in {parentName} <span className="req">*</span></label>
          <div className="input-affix">
            <input
              id={id('pct')}
              type="number" step="0.01" min="0" max={available}
              aria-describedby={id('pcthint')}
              value={form.ownershipPercentage}
              onChange={(e) => set('ownershipPercentage', e.target.value)}
              required
            />
            <span>%</span>
          </div>
          <div className="hint" id={id('pcthint')} style={{ margin: '4px 0 0' }}>
            {available}% still available. Enter 0 for control without shareholding.
          </div>
        </div>
      </div>

      {individual && (
        <>
          <div className="form-field">
            <label htmlFor={id('nat')}>Nationality</label>
            <input id={id('nat')} value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
          </div>
          <div className="form-field">
            <span className="label" id={id('ctl')}>Control basis (tick any that apply — control can make a person a UBO below the threshold)</span>
            <div className="checkbox-grid" role="group" aria-labelledby={id('ctl')}>
              {Object.entries(controlBasisLabel).map(([key, label]) => (
                <label key={key} className="checkbox-item">
                  <input type="checkbox" checked={form.controlBasis.includes(key)} onChange={() => toggleControl(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
          {form.controlBasis.length > 0 && (
            <div className="form-field">
              <label htmlFor={id('cn')}>Control details</label>
              <input
                id={id('cn')}
                placeholder="e.g. clause 4 of the shareholders' agreement dated …"
                value={form.controlNotes}
                onChange={(e) => set('controlNotes', e.target.value)}
              />
            </div>
          )}
        </>
      )}

      <div className="node-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-blue" disabled={busy}>{busy ? 'Saving…' : 'Add'}</button>
      </div>
    </form>
  );
}

/* ---------- One tree row (recursive) ---------- */
function NodeRow({ node, ctx }) {
  const company = node.nodeType === 'COMPANY';
  const hasUntraced = company && Number(node.untracedPercentage) > 0;
  const showForm = ctx.addingTo === node.id;
  const allocated = allocatedOf(node.children);

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
              <button type="button" className="btn btn-outline" disabled={ctx.busy} onClick={() => ctx.openAdd(node.id)}>
                + Shareholder
              </button>
            )}
            <button type="button" className="btn btn-outline" disabled={ctx.busy || node.registered}
              title={node.registered ? 'Already registered as a beneficial owner' : undefined}
              aria-label={`Remove ${node.name}`} onClick={() => ctx.remove(node)}>
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
          {showForm && <li>{ctx.renderForm(node.name, allocated)}</li>}
        </ul>
      )}
    </li>
  );
}

/* ==========================================================================
   Main component
   ========================================================================== */
export default function OwnershipTree({ legalPersonId, canEdit, onTreeChange }) {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addingTo, setAddingTo] = useState(undefined); // undefined = closed, null = customer, string = company node id
  const [form, setForm] = useState(EMPTY_NODE);
  const [pendingRemove, setPendingRemove] = useState(null);

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
      .catch((err) => setError(failMsg(err, 'Failed to load ownership structure')));
  }, [legalPersonId]);

  useEffect(() => {
    setAddingTo(undefined);
    setForm(EMPTY_NODE);
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const t = await fn();
      if (t) setTree(t);
    } catch (err) {
      setError(failMsg(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  };

  const openAdd = (parentId) => {
    setForm(EMPTY_NODE);
    setAddingTo(parentId);
  };

  const submitNode = (e) => {
    e.preventDefault();
    run(async () => {
      const individual = form.nodeType === 'INDIVIDUAL';
      const t = await addOwnershipNode(legalPersonId, {
        parentId: addingTo,
        nodeType: form.nodeType,
        name: form.name.trim(),
        registrationNumber: individual ? null : form.registrationNumber || null,
        idNumber: individual ? form.idNumber || null : null,
        nationality: individual ? form.nationality || null : null,
        ownershipPercentage: Number(form.ownershipPercentage),
        controlBasis: individual ? form.controlBasis : [],
        controlNotes: individual ? form.controlNotes || null : null,
      });
      setAddingTo(undefined);
      setForm(EMPTY_NODE);
      return t;
    });
  };

  // Removing a company also removes everything beneath it, so confirm in the page (not window.confirm).
  const removeNode = (node) => setPendingRemove(node);
  const confirmRemove = () => {
    const node = pendingRemove;
    setPendingRemove(null);
    run(() => deleteOwnershipNode(legalPersonId, node.id));
  };

  if (!legalPersonId) {
    return <div className="hint">Select a customer to view its ownership structure.</div>;
  }
  if (!tree) {
    return error ? <div className="banner-error"><span>{error}</span></div> : <div className="hint">Loading…</div>;
  }

  const renderForm = (parentName, allocated) => (
    <AddNodeForm
      parentName={parentName}
      available={Math.max(0, Math.round((100 - allocated) * 100) / 100)}
      form={form}
      setForm={setForm}
      busy={busy}
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
      ) : tree.shareholders.length > 0 ? (
        <div className="banner-success"><span>Every layer has been traced down to natural persons.</span></div>
      ) : (
        <div className="hint">Add the customer's shareholders to start tracing.</div>
      )}

      {pendingRemove && (
        <div className="banner-warn" role="alertdialog" aria-labelledby="rm-title">
          <strong id="rm-title">Remove {pendingRemove.name}?</strong>
          <div>
            {countBelow(pendingRemove) > 0
              ? `This also removes ${countBelow(pendingRemove)} shareholder(s) beneath it, and cannot be undone.`
              : 'This cannot be undone.'}
          </div>
          <div className="node-form-actions">
            <button type="button" className="btn btn-outline" autoFocus onClick={() => setPendingRemove(null)}>Cancel</button>
            <button type="button" className="btn btn-blue" onClick={confirmRemove}>Remove</button>
          </div>
        </div>
      )}

      {/* ---------- Tree ---------- */}
      <div className="form-card">
        <div className="tree-head">
          <div>
            <h3>Ownership structure</h3>
            <div className="hint">
              Trace each company down to the natural person(s). Effective % = product of the stakes along each path;
              a person in several branches is added together. UBO threshold: {pct(tree.thresholdPercentage)}% or any control basis.
            </div>
          </div>
          {canEdit && (
            <button type="button" className="btn btn-blue" disabled={busy} onClick={() => openAdd(null)}>
              + Add shareholder
            </button>
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
                {addingTo === null && <li>{renderForm(tree.legalPersonName, allocatedOf(tree.shareholders))}</li>}
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
