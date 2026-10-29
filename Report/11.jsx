import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import * as api from '../api/bovsApi.js';
import '../styles/Reports.css';
// Install once: npm i xlsx   (loaded lazily, only when "Excel" is clicked)

/* ==========================================================================
   Constants & domain rules  (move to src/utils/boRules.js and share with Dashboard)
   ========================================================================== */
const HIGH_RISK_SECTORS = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);
const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate', MOTOR_DEALERSHIP: 'Motor Dealership',
  IMPORT_EXPORT: 'Import / Export', FINANCIAL: 'Financial',
};
const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company', PRIVATE_LIMITED_COMPANY: 'Private Limited Company', ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company', GENERAL_PARTNERSHIP: 'General Partnership',
  LIMITED_PARTNERSHIP: 'Limited Partnership', LIMITED_LIABILITY_PARTNERSHIP: 'Limited Liability Partnership',
  FINANCIAL_INSTITUTION: 'Financial Institution', FOREIGN_LEGAL_PERSON: 'Foreign Legal Person',
  PPP: 'Public Private Partnership', CIVIL_SOCIETY_ORGANIZATION: 'Civil Society Organisation',
  GOVERNMENT_OWNED_ENTERPRISE: 'Government-Owned Enterprise', COOPERATIVE_ASSOCIATION: 'Cooperative Association',
  PUBLIC_ADMINISTRATION: 'Public Administration', RELIGIOUS_INSTITUTION: 'Religious Institution',
  INTERNATIONAL_ORGANIZATION: 'International Organisation', TRUST: 'Trust', CHARITY: 'Charity',
  INDIVIDUAL: 'Individual', OTHER: 'Other',
};
/* NBE directive: returns { pct, basis } or null when the entity type has no % threshold */
function getRule(type, sector) {
  switch (type) {
    case 'SHARE_COMPANY': return HIGH_RISK_SECTORS.has(sector) ? { pct: 5, basis: 'Share company, high-risk sector' } : { pct: 10, basis: 'Share company' };
    case 'PRIVATE_LIMITED_COMPANY': return { pct: 5, basis: 'Private limited company' };
    case 'FINANCIAL_INSTITUTION': return { pct: 2, basis: 'Financial institution' };
    case 'GENERAL_PARTNERSHIP': case 'LIMITED_PARTNERSHIP': case 'LIMITED_LIABILITY_PARTNERSHIP': case 'PPP':
      return { pct: 25, basis: ENTITY_LABELS[type] };
    default: return null;
  }
}
const getThreshold = (t, s) => getRule(t, s)?.pct ?? null;

/* ==========================================================================
   Helpers
   ========================================================================== */
const splitChain = (c) => String(c || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const isDirect = (h) => (h.paths || []).every((p) => splitChain(p.chain).length === 2);
const isForeign = (t) => t === 'FOREIGN_LEGAL_PERSON';
const isControlOnly = (h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl);
const isVerified = (h) => h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered;
const pct = (h) => Number(h.effectivePercentage || 0);
const label = (map, k) => map[k] || k || '—';
const formatDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};
const today = () => new Date().toISOString().slice(0, 10);

/* ==========================================================================
   Export engine — real .xlsx, injection-safe CSV, escaped Word HTML, print-to-PDF.
   Every export is reported to the backend audit trail if api.logExport exists.
   ========================================================================== */
const csvSafe = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; }; // blocks formula injection
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const saveBlob = (content, filename, mime) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
};
async function exportData(format, name, header, rows, meta = '') {
  const file = `${name}-${today()}`;
  if (format === 'csv') {
    const body = [header, ...rows].map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    saveBlob('\uFEFF' + body, `${file}.csv`, 'text/csv;charset=utf-8');
  } else if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map(csvSafe))]);
    ws['!cols'] = header.map((h, i) => ({ wch: Math.min(48, Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)) + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    XLSX.writeFile(wb, `${file}.xlsx`);
  } else if (format === 'doc') {
    const html = `<html><head><meta charset="utf-8"/><title>${esc(name)}</title><style>
      body{font-family:Arial,sans-serif;font-size:10pt} table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #333;padding:4px 6px;text-align:left} th{background:#283375;color:#fff}</style></head><body>
      <h1>${esc(name)}</h1><p>Generated ${esc(new Date().toLocaleString())}${meta ? ` · ${esc(meta)}` : ''}</p>
      <table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    saveBlob(html, `${file}.doc`, 'application/msword;charset=utf-8');
  } else if (format === 'pdf') {
    window.print();
  }
  try { await api.logExport?.({ format: format.toUpperCase(), report: name, rows: rows.length }); } catch { /* best-effort */ }
}

/* ==========================================================================
   Small UI
   ========================================================================== */
const ic = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const I = {
  building: <svg {...ic}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01" /></svg>,
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  download: <svg {...ic}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  filter: <svg {...ic}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  link: <svg {...ic}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  warning: <svg {...ic}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /></svg>,
};

function Btn({ variant = 'secondary', icon, children, ...p }) {
  return <button type="button" className={`rep-btn rep-btn--${variant} rep-btn--sm`} {...p}>{icon}{children}</button>;
}
function Field({ label: l, children }) {
  return <label className="rep-field"><span className="rep-field__label">{l}</span>{children}</label>;
}

/* Export buttons for whichever dataset the current tab shows */
function ExportBar({ name, header, rows, meta, pdf = true }) {
  const [busy, setBusy] = useState('');
  const go = async (f) => { setBusy(f); try { await exportData(f, name, header, rows, meta); } finally { setBusy(''); } };
  return (
    <div className="rep-export-bar rep-no-print">
      <Btn icon={I.download} disabled={!!busy || !rows.length} onClick={() => go('csv')}>CSV</Btn>
      <Btn disabled={!!busy || !rows.length} onClick={() => go('xlsx')}>{busy === 'xlsx' ? 'Preparing…' : 'Excel'}</Btn>
      <Btn disabled={!!busy || !rows.length} onClick={() => go('doc')}>Word</Btn>
      {pdf && <Btn variant="primary" disabled={!!busy} onClick={() => go('pdf')}>PDF</Btn>}
    </div>
  );
}

/* Sortable table: cols = [{ key, label, render?, value?, cls? }] */
function DataTable({ cols, rows, rowKey, empty = 'No data', onRow, activeKey, loading }) {
  const [sort, setSort] = useState(null);
  const data = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.key === sort.key);
    const v = (r) => (c.value ? c.value(r) : r[c.key]);
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      return sort.dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? '')));
    });
  }, [rows, sort, cols]);
  const toggle = (k) => setSort((s) => (s?.key !== k ? { key: k, dir: 1 } : s.dir === 1 ? { key: k, dir: -1 } : null));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="rep-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.cls} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => toggle(c.key)} style={{ all: 'inherit', cursor: 'pointer', padding: 0 }}>
                  {c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={cols.length} className="rep-loading"><span className="rep-spinner" />Loading…</td></tr>}
          {!loading && data.length === 0 && <tr><td colSpan={cols.length} className="rep-loading">{empty}</td></tr>}
          {!loading && data.map((r) => (
            <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : undefined, background: activeKey === rowKey(r) ? 'var(--rep-primary-soft)' : undefined }}>
              {cols.map((c) => <td key={c.key} className={c.cls}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const EntityCell = (e) => (
  <div className="rep-table__entity">
    <span className="rep-table__entity-icon">{I.building}</span>
    <div style={{ minWidth: 0 }}>
      <div className="rep-table__entity-name">{e.name}</div>
      <div className="rep-table__entity-reg">{e.registrationNumber || '—'}</div>
    </div>
  </div>
);
const ThresholdCell = (e) => {
  const t = getThreshold(e.entityType, e.sector);
  return t != null
    ? <span className={`rep-threshold${HIGH_RISK_SECTORS.has(e.sector) ? ' rep-threshold--warn' : ''}`}>≥ {t}%</span>
    : <span className="rep-chip rep-chip--muted">SPECIAL</span>;
};
const Kpi = ({ tone, label: l, value, caption }) => (
  <div className={`rep-kpi${tone ? ` rep-kpi--${tone}` : ''}`}>
    <div className="rep-kpi__label">{l}</div><div className="rep-kpi__value">{value}</div><div className="rep-kpi__caption">{caption}</div>
  </div>
);
const CardHead = ({ title, subtitle, children }) => (
  <div className="rep-card__head"><div><h3 className="rep-card__title">{title}</h3><div className="rep-card__subtitle">{subtitle}</div></div>{children}</div>
);

/* Searchable entity combobox */
function EntityCombo({ options, value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => setHi(0), [query]);
  const pick = (o) => { onChange(o.value); setOpen(false); setQuery(''); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };
  return (
    <Field label="Legal entity">
      <div className="rep-combo" ref={ref}>
        <input className="rep-input" type="text" role="combobox" aria-expanded={open} disabled={loading}
          value={open ? query : (selected ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : '')}
          placeholder={loading ? 'Loading…' : 'Search entity…'} onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onKeyDown={onKey} />
        {open && (
          <ul className="rep-combo__list" role="listbox">
            {filtered.length === 0 && <li className="rep-combo__empty">No entity found</li>}
            {filtered.map((o, i) => (
              <li key={o.value} role="option" aria-selected={o.value === value} onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`rep-combo__item${i === hi ? ' rep-combo__item--hi' : ''}${o.value === value ? ' rep-combo__item--selected' : ''}`}>
                <span>{o.label}</span>{o.sub && <span className="rep-combo__sub">{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

/* ==========================================================================
   Ownership tree (built from chain paths; a holder with several paths appears under each)
   ========================================================================== */
function buildTrie(holders) {
  const root = { name: null, children: new Map(), holders: [] };
  holders.forEach((h) => (h.paths || []).forEach((p) => {
    const parts = splitChain(p.chain);
    let node = root;
    for (let i = 1; i < parts.length - 1; i++) {
      if (!node.children.has(parts[i])) node.children.set(parts[i], { name: parts[i], children: new Map(), holders: [] });
      node = node.children.get(parts[i]);
    }
    if (!node.holders.includes(h)) node.holders.push(h);
  }));
  return root;
}
function TreeNodeBox({ kind, label: l, sub, holder }) {
  const k = kind === 'ubo' ? (holder && isDirect(holder) ? 'ubo-direct' : 'ubo-indirect') : kind;
  return (
    <div className={`rep-tree-node rep-tree-node--${k}`}>
      <span className="rep-tree-node__icon">{kind === 'ubo' || kind === 'fallback' ? I.person : I.building}</span>
      <div style={{ minWidth: 0 }}><div className="rep-tree-node__label">{l}</div><div className="rep-tree-node__sub">{sub}</div></div>
    </div>
  );
}
const holderBox = (h) => (
  <TreeNodeBox key={h.key} kind="ubo" holder={h} label={h.fullName}
    sub={isControlOnly(h) ? 'control' : `${h.effectivePercentage}% ${isDirect(h) ? 'direct' : 'indirect'}`} />
);
function Branch({ node }) {
  const kids = [...node.children.values()];
  return (
    <div className="rep-tree__branch">
      <div className="rep-tree__vline rep-tree__vline--med" />
      <TreeNodeBox kind="intermediate" label={node.name} sub={`${node.holders.length + kids.length} downstream`} />
      {(kids.length > 0 || node.holders.length > 0) && (
        <>
          <div className="rep-tree__vline rep-tree__vline--short" />
          <div className="rep-tree__children">{kids.map((k) => <Branch key={k.name} node={k} />)}{node.holders.map(holderBox)}</div>
        </>
      )}
    </div>
  );
}
function OwnershipTree({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;
  const root = buildTrie((tree.holders || []).filter((h) => h.ubo || isControlOnly(h)));
  const kids = [...root.children.values()];
  const fb = tree.seniorManagingOfficial;
  return (
    <div className="rep-tree"><div className="rep-tree__stage">
      <TreeNodeBox kind="entity" label={entity.name} sub={entity.registrationNumber ? `Reg. ${entity.registrationNumber}` : 'Legal entity'} />
      {(kids.length > 0 || root.holders.length > 0) && (
        <>
          <div className="rep-tree__vline rep-tree__vline--tall" />
          <div className="rep-tree__branch-row">
            <div className="rep-tree__hconnector" /><div className="rep-tree__cap rep-tree__cap--left" /><div className="rep-tree__cap rep-tree__cap--right" />
            {kids.map((k) => <Branch key={k.name} node={k} />)}
            {root.holders.map((h) => <div key={h.key} className="rep-tree__branch"><div className="rep-tree__vline rep-tree__vline--med" />{holderBox(h)}</div>)}
          </div>
        </>
      )}
      {fb && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="rep-tree__vline rep-tree__vline--med" />
          <TreeNodeBox kind="fallback" label={fb.name} sub={fb.position || 'Senior managing official'} />
        </div>
      )}
    </div></div>
  );
}

/* Chain summary — uses real per-hop percentages (path.steps) when the API provides them */
function ChainSummary({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;
  const holders = tree.holders || [];
  const bullets = [];
  const edges = new Map();
  holders.filter((h) => h.ubo).forEach((h) => (h.paths || []).forEach((p) => {
    const steps = Array.isArray(p.steps) && p.steps.length ? p.steps : splitChain(p.chain).slice(0, -1).map((from, i, a) => ({ from, to: splitChain(p.chain)[i + 1], pct: null }));
    steps.forEach((s) => {
      if (!edges.has(s.from)) edges.set(s.from, []);
      if (!edges.get(s.from).some((x) => x.to === s.to)) edges.get(s.from).push(s);
    });
  }));
  edges.forEach((list, parent) => bullets.push(`${parent} → ${list.map((s) => (s.pct != null ? `${s.pct}% owned by ${s.to}` : `owned by ${s.to}`)).join(' and ')}`));
  holders.filter((h) => h.ubo).forEach((h) => (h.paths || []).forEach((p) => {
    const steps = Array.isArray(p.steps) ? p.steps : [];
    const eff = pct(h) || Number(p.percentage || 0);
    if (splitChain(p.chain).length === 2) bullets.push(`${h.fullName}: direct interest = ${eff}%`);
    else bullets.push(`${h.fullName}: indirect interest ${steps.length ? `${steps.map((s) => `${s.pct}%`).join(' × ')} = ` : 'via '}${steps.length ? '' : p.chain + ' = '}${eff}%`);
  }));
  holders.filter(isControlOnly).forEach((h) => bullets.push(`${h.fullName}: control via ${(h.controlBasis || []).join(', ') || 'other means'} (no ownership)`));
  const fb = tree.seniorManagingOfficial;
  if (fb) bullets.push(`Senior managing official fallback: ${fb.name}${fb.position ? ` (${fb.position})` : ''}`);
  if (!bullets.length) return null;
  return (
    <div className="rep-summary">
      <div className="rep-summary__head">{I.link}<span>Ownership chain summary — {entity.name}</span></div>
      <ul className="rep-summary__list">{bullets.map((b, i) => <li key={i} className="rep-summary__item">{b}</li>)}</ul>
    </div>
  );
}

/* ==========================================================================
   Report builders
   ========================================================================== */
const ubosOf = (e) => (e.tree?.holders || []).filter((h) => h.ubo);

function buildThreshold(entities) {
  return entities.map((e) => {
    const rule = getRule(e.entityType, e.sector);
    const ubos = ubosOf(e);
    const above = rule ? ubos.filter((h) => pct(h) >= rule.pct) : [];
    const below = rule ? ubos.filter((h) => pct(h) < rule.pct) : [];
    return { ...e, rule, above, below, ubos, control: (e.tree?.holders || []).filter(isControlOnly) };
  });
}
function buildBreakdown(entities) {
  return entities.flatMap((e) => ubosOf(e).map((h) => ({
    id: `${e.id}-${h.key}`, entity: e.name, holder: h.fullName, kind: isDirect(h) ? 'Direct' : 'Indirect',
    pct: pct(h), joint: !!h.jointOwnership, chain: (h.paths || []).map((p) => p.chain).join('; '),
  })));
}
const EXC_TYPES = ['NO_STRUCTURE', 'MISSING_ID', 'EXPIRED_ID', 'EXPIRING_ID', 'PCT_OVER_100', 'DUPLICATE_ID', 'CIRCULAR', 'BELOW_THRESHOLD', 'MISSING_CONTROL_BASIS', 'FOREIGN_DOCS'];
const EXC_LABELS = { NO_STRUCTURE: 'No structure', MISSING_ID: 'Missing ID', EXPIRED_ID: 'Expired ID', EXPIRING_ID: 'ID expiring', PCT_OVER_100: '> 100%', DUPLICATE_ID: 'Duplicate ID', CIRCULAR: 'Circular', BELOW_THRESHOLD: 'Below threshold', MISSING_CONTROL_BASIS: 'No control basis', FOREIGN_DOCS: 'Foreign docs' };
function buildExceptions(entities) {
  const rows = [];
  const now = new Date();
  const soon = new Date(Date.now() + 90 * 864e5);
  entities.forEach((e) => {
    const add = (type, severity, title, desc) => rows.push({ id: `${e.id}-${rows.length}`, entity: e.name, entityId: e.id, type, severity, title, desc });
    if (!e.tree) return add('NO_STRUCTURE', 'danger', 'No ownership structure loaded', 'The tree could not be loaded for this entity.');
    const all = e.tree.holders || [];
    const ubos = ubosOf(e);
    all.forEach((h) => {
      if (!h.idNumber) add('MISSING_ID', 'warn', `${h.fullName} has no ID number`, 'BO record is missing an identification number.');
      const exp = h.dateOfExpiry ? new Date(h.dateOfExpiry) : null;
      if (exp && !isNaN(exp)) {
        if (exp < now) add('EXPIRED_ID', 'danger', `${h.fullName}'s ID expired on ${formatDate(h.dateOfExpiry)}`, 'ID document has expired.');
        else if (exp < soon) add('EXPIRING_ID', 'warn', `${h.fullName}'s ID expires on ${formatDate(h.dateOfExpiry)}`, 'Expires within 90 days — request a renewed document.');
      }
      if (h.qualifiesByControl && !(h.controlBasis || []).length) add('MISSING_CONTROL_BASIS', 'warn', `${h.fullName} qualifies by control but no basis recorded`, 'Control through other means needs a documented basis.');
      (h.paths || []).forEach((p) => {
        const parts = splitChain(p.chain);
        if (new Set(parts).size !== parts.length) add('CIRCULAR', 'danger', `Circular ownership for ${h.fullName}`, `Chain: ${p.chain}`);
      });
    });
    const total = ubos.reduce((s, h) => s + pct(h), 0);
    if (total > 100.01) add('PCT_OVER_100', 'danger', `Ownership exceeds 100% (${total.toFixed(2)}%)`, 'Sum of effective percentages is greater than 100.');
    const seen = new Map();
    all.forEach((h) => {
      const k = (h.idNumber || '').trim();
      if (!k) return;
      if (seen.has(k)) add('DUPLICATE_ID', 'danger', `Duplicate ID number ${k}`, `Used by ${seen.get(k)} and ${h.fullName}.`);
      else seen.set(k, h.fullName);
    });
    const t = getThreshold(e.entityType, e.sector);
    if (t != null) ubos.forEach((h) => { if (pct(h) < t) add('BELOW_THRESHOLD', 'warn', `${h.fullName} (${h.effectivePercentage}%) is below the ${t}% threshold`, 'Marked as UBO but below the applicable threshold — confirm the control basis.'); });
    if (isForeign(e.entityType)) add('FOREIGN_DOCS', 'info', 'Foreign legal person — verify home-jurisdiction evidence', 'Ensure home-jurisdiction documentation or attestation is on file.');
  });
  return rows;
}
function buildComplexity(entities) {
  return entities.map((e) => {
    const ubos = ubosOf(e);
    const inter = new Set();
    let depth = 0;
    ubos.forEach((h) => (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      depth = Math.max(depth, parts.length);
      parts.slice(1, -1).forEach((x) => inter.add(x));
    }));
    const cross = ubos.filter((h) => (h.paths || []).length > 1).length;
    const layers = Math.max(depth - 1, 0);
    return { id: e.id, entity: e.name, layers, intermediates: inter.size, holders: ubos.length, cross, foreign: isForeign(e.entityType), complex: layers >= 2 || cross > 0 };
  });
}

/* ==========================================================================
   Main
   ========================================================================== */
const TABS = [
  ['overview', 'Overview'], ['threshold', 'Threshold report'], ['breakdown', 'Ownership breakdown'], ['exceptions', 'Exceptions'],
  ['complexity', 'Complex structures'], ['tree', 'Visual tree'], ['audit', 'Audit trail'],
];
const SEV_COLOR = { danger: '#c0392b', warn: '#d98e04', info: '#5b78d6' };

export default function Reports() {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [treesLoading, setTreesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [f, setF] = useState({ entityId: '', type: '', sector: '', threshold: '', from: '', to: '' });
  const [selectedId, setSelectedId] = useState('');
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const input = (k) => (e) => set(k)(e.target.value);

  useEffect(() => {
    let off = false;
    api.listLegalPersons({ size: 500, sort: 'name' })
      .then((r) => !off && (setLegalPersons(r.content || []), setError(null)))
      .catch((e) => !off && setError(e.friendlyMessage || 'Failed to load reports'))
      .finally(() => !off && setLoading(false));
    return () => { off = true; };
  }, []);

  /* Load trees 6 at a time instead of up to 500 at once */
  useEffect(() => {
    if (!legalPersons.length) return undefined;
    let off = false;
    setTreesLoading(true);
    (async () => {
      const queue = [...legalPersons];
      const worker = async () => {
        while (queue.length && !off) {
          const lp = queue.shift();
          const t = await api.getOwnershipTree(lp.id).catch(() => null);
          if (!off) setTrees((p) => ({ ...p, [lp.id]: t }));
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      if (!off) setTreesLoading(false);
    })();
    return () => { off = true; };
  }, [legalPersons]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    api.listAuditLogs({ size: 100 }).then((r) => setAuditLogs(r.content || [])).catch(() => setAuditLogs([]));
  }, [activeTab]);

  const entities = useMemo(() => legalPersons.map((lp) => {
    const tree = trees[lp.id];
    return { ...lp, tree, uboCount: (tree?.holders || []).filter((h) => h.ubo).length, fallback: tree?.seniorManagingOfficial || null };
  }), [legalPersons, trees]);

  const filtered = useMemo(() => entities.filter((e) => {
    if (f.entityId && e.id !== f.entityId) return false;
    if (f.type && e.entityType !== f.type) return false;
    if (f.sector && e.sector !== f.sector) return false;
    if (f.threshold) {
      const t = getThreshold(e.entityType, e.sector);
      if (f.threshold === 'special' ? t != null : String(t) !== f.threshold) return false;
    }
    if (f.from || f.to) {
      const ok = ubosOf(e).some((h) => {
        const d = String(h.dateBecameBo || '').slice(0, 10);
        return d && (!f.from || d >= f.from) && (!f.to || d <= f.to);
      });
      if (!ok) return false;
    }
    return true;
  }), [entities, f]);

  const filtersActive = Object.values(f).some(Boolean);
  const selected = filtered.find((e) => e.id === selectedId) || filtered[0] || null;
  const filterText = Object.entries({ Type: f.type && label(ENTITY_LABELS, f.type), Sector: f.sector && label(SECTOR_LABELS, f.sector), Threshold: f.threshold && (f.threshold === 'special' ? 'Special' : `${f.threshold}%`), From: f.from, To: f.to })
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'No filters';

  const thresholdRows = useMemo(() => buildThreshold(filtered), [filtered]);
  const breakdownRows = useMemo(() => buildBreakdown(filtered), [filtered]);
  const exceptionRows = useMemo(() => buildExceptions(filtered), [filtered]);
  const complexityRows = useMemo(() => buildComplexity(filtered), [filtered]);

  /* ---------------- Overview ---------------- */
  const renderOverview = () => {
    const t = filtered.reduce((a, e) => {
      const u = ubosOf(e);
      a.ubos += u.length; a.verified += u.filter(isVerified).length; a.pending += u.filter((h) => h.status === 'PENDING').length;
      if (e.fallback) a.fb += 1;
      return a;
    }, { ubos: 0, verified: 0, pending: 0, fb: 0 });
    const header = ['Entity', 'Registration', 'Entity type', 'Sector', 'Threshold %', 'UBOs', 'Fallback'];
    const data = filtered.map((e) => [e.name, e.registrationNumber || '', label(ENTITY_LABELS, e.entityType), label(SECTOR_LABELS, e.sector), getThreshold(e.entityType, e.sector) ?? 'Special', e.uboCount, e.fallback ? 'Yes' : 'No']);
    return (
      <>
        <div className="rep-kpi-grid rep-printable">
          <Kpi label="Legal entities" value={filtered.length} caption="In current view" />
          <Kpi tone="info" label="Total UBOs" value={t.ubos} caption="Natural persons" />
          <Kpi tone="success" label="Verified" value={t.verified} caption="Approved by checker" />
          <Kpi tone="warn" label="Pending" value={t.pending} caption="Awaiting approval" />
          <Kpi tone="danger" label="Fallbacks" value={t.fb} caption="Senior official" />
        </div>
        <div className="rep-card rep-printable">
          <CardHead title="Entity compliance" subtitle="Select a row to inspect its ownership">
            <ExportBar name="entity-compliance" header={header} rows={data} meta={filterText} />
          </CardHead>
          <DataTable loading={loading} rowKey={(e) => e.id} activeKey={selected?.id} onRow={(e) => setSelectedId(e.id)}
            empty="No entities match the current filters." rows={filtered}
            cols={[
              { key: 'name', label: 'Legal entity', render: EntityCell },
              { key: 'entityType', label: 'Type', render: (e) => label(ENTITY_LABELS, e.entityType) },
              { key: 'sector', label: 'Sector', render: (e) => label(SECTOR_LABELS, e.sector) },
              { key: 'th', label: 'Threshold', render: ThresholdCell, value: (e) => getThreshold(e.entityType, e.sector) ?? 999 },
              { key: 'uboCount', label: 'UBOs', cls: 'rep-table__number' },
              { key: 'fallback', label: 'Fallback', cls: 'rep-table__center', value: (e) => (e.fallback ? 1 : 0), render: (e) => (e.fallback ? <span className="rep-chip rep-chip--warn">Yes</span> : '—') },
            ]} />
        </div>
        {selected?.tree && (
          <div className="rep-printable">
            <ChainSummary entity={selected} />
            <div className="rep-card">
              <CardHead title={`Ownership tree — ${selected.name}`} subtitle="Entity, intermediates, UBOs and control" />
              <div className="rep-card__body"><OwnershipTree entity={selected} /></div>
            </div>
          </div>
        )}
      </>
    );
  };

  /* ---------------- Threshold (Reports 1–7) ---------------- */
  const renderThreshold = () => {
    const header = ['Entity', 'Registration', 'Entity type', 'Sector', 'Threshold %', 'Criteria', 'UBOs', 'At or above', 'Below', 'Below-threshold owners'];
    const data = thresholdRows.map((r) => [r.name, r.registrationNumber || '', label(ENTITY_LABELS, r.entityType), label(SECTOR_LABELS, r.sector), r.rule?.pct ?? 'Special', r.rule?.basis || 'No % threshold — control / senior official test', r.ubos.length, r.above.length, r.below.length, r.below.map((h) => `${h.fullName} (${h.effectivePercentage}%)`).join('; ')]);
    return (
      <div className="rep-card rep-printable">
        <CardHead title="Threshold-based BO report" subtitle="Reports 1–7 — ownership measured against the threshold for each entity type and sector">
          <ExportBar name="threshold-report" header={header} rows={data} meta={filterText} />
        </CardHead>
        <DataTable loading={loading} rowKey={(r) => r.id} rows={thresholdRows}
          cols={[
            { key: 'name', label: 'Legal entity', render: EntityCell },
            { key: 'entityType', label: 'Type', render: (r) => label(ENTITY_LABELS, r.entityType) },
            { key: 'sector', label: 'Sector', render: (r) => label(SECTOR_LABELS, r.sector) },
            { key: 'th', label: 'Threshold', render: ThresholdCell, value: (r) => r.rule?.pct ?? 999 },
            { key: 'basis', label: 'Criteria', value: (r) => r.rule?.basis || '', render: (r) => r.rule?.basis || 'Control / senior official' },
            { key: 'above', label: 'At or above', cls: 'rep-table__number', value: (r) => r.above.length, render: (r) => r.above.length },
            { key: 'below', label: 'Below', cls: 'rep-table__number', value: (r) => r.below.length, render: (r) => (r.below.length ? <span className="rep-chip rep-chip--warn">{r.below.length}</span> : 0) },
            { key: 'ubos', label: 'BOs', cls: 'rep-table__number', value: (r) => r.ubos.length, render: (r) => r.ubos.length },
          ]} />
      </div>
    );
  };

  /* ---------------- Breakdown (Report 8) ---------------- */
  const renderBreakdown = () => {
    const header = ['Entity', 'Holder', 'Direct / Indirect', 'Ownership %', 'Joint', 'Chain'];
    const data = breakdownRows.map((r) => [r.entity, r.holder, r.kind, r.pct, r.joint ? 'Yes' : 'No', r.chain]);
    const byEntity = Object.values(breakdownRows.reduce((m, r) => {
      m[r.entity] ||= { name: r.entity, Direct: 0, Indirect: 0 };
      m[r.entity][r.kind] += r.pct;
      return m;
    }, {})).sort((a, b) => b.Direct + b.Indirect - a.Direct - a.Indirect).slice(0, 10);
    return (
      <>
        {byEntity.length > 0 && (
          <div className="rep-card rep-printable">
            <CardHead title="Direct vs indirect ownership" subtitle="Top 10 entities by total beneficial ownership (%)" />
            <div className="rep-card__body" style={{ height: 280 }}>
              <ResponsiveContainer><BarChart data={byEntity}>
                <CartesianGrid vertical={false} stroke="#e6eaf6" /><XAxis dataKey="name" tick={false} /><YAxis unit="%" /><Tooltip /><Legend />
                <Bar dataKey="Direct" stackId="a" fill="#1f8a5b" /><Bar dataKey="Indirect" stackId="a" fill="#283375" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="rep-card rep-printable">
          <CardHead title="Detailed ownership breakdown" subtitle="Report 8 — direct, indirect, joint, and combined ownership">
            <ExportBar name="ownership-breakdown" header={header} rows={data} meta={filterText} />
          </CardHead>
          <DataTable loading={loading} rowKey={(r) => r.id} rows={breakdownRows}
            cols={[
              { key: 'entity', label: 'Entity' },
              { key: 'holder', label: 'Holder', render: (r) => <strong>{r.holder}</strong> },
              { key: 'kind', label: 'Direct / Indirect', render: (r) => <span className={`rep-chip ${r.kind === 'Direct' ? 'rep-chip--ubo' : 'rep-chip--info'}`}>{r.kind}</span> },
              { key: 'pct', label: 'Ownership %', cls: 'rep-table__number', render: (r) => `${r.pct}%` },
              { key: 'joint', label: 'Joint', cls: 'rep-table__center', value: (r) => (r.joint ? 1 : 0), render: (r) => (r.joint ? <span className="rep-chip rep-chip--warn">Joint</span> : '—') },
              { key: 'chain', label: 'Chain', render: (r) => <span className="rep-table__mono">{r.chain}</span> },
            ]} />
        </div>
      </>
    );
  };

  /* ---------------- Exceptions (Report 9) ---------------- */
  const renderExceptions = () => {
    const sev = { danger: 0, warn: 0, info: 0 };
    exceptionRows.forEach((r) => { sev[r.severity] += 1; });
    const header = ['Severity', 'Entity', 'Type', 'Finding', 'Description'];
    const data = exceptionRows.map((r) => [r.severity, r.entity, EXC_LABELS[r.type], r.title, r.desc]);
    const withIssues = [...new Set(exceptionRows.map((r) => r.entityId))].slice(0, 15);
    const cell = (id, type) => exceptionRows.filter((r) => r.entityId === id && r.type === type);
    const typeChart = EXC_TYPES.map((t) => ({ name: EXC_LABELS[t], value: exceptionRows.filter((r) => r.type === t).length, sev: exceptionRows.find((r) => r.type === t)?.severity || 'info' })).filter((d) => d.value);
    return (
      <>
        <div className="rep-kpi-grid rep-printable">
          <Kpi tone="danger" label="Critical" value={sev.danger} caption="Require action" />
          <Kpi tone="warn" label="Warnings" value={sev.warn} caption="Data quality issues" />
          <Kpi tone="info" label="Info" value={sev.info} caption="For review" />
          <Kpi label="Total findings" value={exceptionRows.length} caption="Across filtered entities" />
        </div>
        {exceptionRows.length > 0 && (
          <div className="rep-card rep-printable">
            <CardHead title="Findings by check" subtitle="Where data quality problems concentrate" />
            <div className="rep-card__body" style={{ height: 240 }}>
              <ResponsiveContainer><BarChart data={typeChart} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} fontSize={12} /><Tooltip />
                <Bar dataKey="value" name="Findings" radius={[0, 4, 4, 0]}>{typeChart.map((d) => <Cell key={d.name} fill={SEV_COLOR[d.sev]} />)}</Bar>
              </BarChart></ResponsiveContainer>
            </div>
          </div>
        )}
        {withIssues.length > 0 && (
          <div className="rep-card rep-printable">
            <CardHead title="Entity × check heatmap" subtitle="First 15 entities with findings. Number = count of findings" />
            <div className="rep-card__body" style={{ overflowX: 'auto' }}>
              <table className="rep-heat">
                <thead><tr><th>Entity</th>{EXC_TYPES.map((t) => <th key={t}>{EXC_LABELS[t]}</th>)}</tr></thead>
                <tbody>{withIssues.map((id) => (
                  <tr key={id}><th scope="row">{entities.find((e) => e.id === id)?.name}</th>
                    {EXC_TYPES.map((t) => {
                      const c = cell(id, t);
                      return <td key={t} style={c.length ? { background: SEV_COLOR[c[0].severity], color: '#fff' } : undefined}>{c.length || ''}</td>;
                    })}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        <div className="rep-card rep-printable">
          <CardHead title="Data-quality & exception report" subtitle="Report 9 — missing or expiring IDs, duplicates, circular ownership, threshold and percentage problems">
            <ExportBar name="exceptions" header={header} rows={data} meta={filterText} />
          </CardHead>
          <DataTable loading={treesLoading && !exceptionRows.length} rowKey={(r) => r.id} rows={exceptionRows} empty="No exceptions found. All entities passed the checks."
            cols={[
              { key: 'severity', label: 'Severity', render: (r) => <span className={`rep-chip rep-chip--${r.severity === 'danger' ? 'warn' : r.severity === 'warn' ? 'muted' : 'info'}`}>{r.severity === 'danger' ? 'Critical' : r.severity === 'warn' ? 'Warning' : 'Info'}</span> },
              { key: 'entity', label: 'Entity' },
              { key: 'type', label: 'Check', value: (r) => EXC_LABELS[r.type], render: (r) => EXC_LABELS[r.type] },
              { key: 'title', label: 'Finding', render: (r) => <div><div style={{ fontWeight: 600 }}>{r.title}</div><div className="rep-exception__desc">{r.desc}</div></div> },
            ]} />
        </div>
      </>
    );
  };

  /* ---------------- Complexity (Report 10) ---------------- */
  const renderComplexity = () => {
    const header = ['Entity', 'Layers', 'Intermediates', 'UBOs', 'Cross-ownership', 'Foreign', 'Complex'];
    const data = complexityRows.map((r) => [r.entity, r.layers, r.intermediates, r.holders, r.cross, r.foreign ? 'Yes' : 'No', r.complex ? 'Yes' : 'No']);
    const dist = [0, 1, 2, 3].map((n) => ({ name: n === 3 ? '3+ layers' : n === 0 ? 'Direct only' : `${n} layer${n > 1 ? 's' : ''}`, value: complexityRows.filter((r) => (n === 3 ? r.layers >= 3 : r.layers === n)).length }));
    return (
      <>
        <div className="rep-card rep-printable">
          <CardHead title="Structure depth" subtitle="Entities by number of intermediate layers" />
          <div className="rep-card__body" style={{ height: 200 }}>
            <ResponsiveContainer><BarChart data={dist}>
              <XAxis dataKey="name" tickLine={false} /><YAxis allowDecimals={false} hide /><Tooltip />
              <Bar dataKey="value" name="Entities" fill="#283375" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </div>
        <div className="rep-card rep-printable">
          <CardHead title="Complex ownership structures" subtitle="Report 10 — multi-layer, cross-ownership, and foreign structures">
            <ExportBar name="complex-structures" header={header} rows={data} meta={filterText} />
          </CardHead>
          <DataTable loading={loading} rowKey={(r) => r.id} rows={complexityRows}
            cols={[
              { key: 'entity', label: 'Entity' },
              { key: 'layers', label: 'Layers', cls: 'rep-table__number' },
              { key: 'intermediates', label: 'Intermediates', cls: 'rep-table__number' },
              { key: 'holders', label: 'UBOs', cls: 'rep-table__number' },
              { key: 'cross', label: 'Cross-ownership', cls: 'rep-table__number' },
              { key: 'foreign', label: 'Foreign', cls: 'rep-table__center', value: (r) => (r.foreign ? 1 : 0), render: (r) => (r.foreign ? <span className="rep-chip rep-chip--warn">Foreign</span> : '—') },
              { key: 'complex', label: 'Complex', cls: 'rep-table__center', value: (r) => (r.complex ? 1 : 0), render: (r) => (r.complex ? <span className="rep-chip rep-chip--info">Complex</span> : '—') },
            ]} />
        </div>
      </>
    );
  };

  /* ---------------- Tree (Report 11) ---------------- */
  const renderTree = () => {
    if (!selected?.tree) {
      return <div className="rep-card"><div className="rep-empty"><div className="rep-empty__title">Select a legal entity</div><div>Choose an entity in the filter above to view its ownership tree.</div></div></div>;
    }
    const header = ['Entity', 'Owner', 'Type', 'Effective %', 'Chain'];
    const data = (selected.tree.holders || []).map((h) => [selected.name, h.fullName, h.ubo ? (isDirect(h) ? 'Direct UBO' : 'Indirect UBO') : 'Control', h.effectivePercentage ?? '', (h.paths || []).map((p) => p.chain).join('; ')]);
    return (
      <>
        <ChainSummary entity={selected} />
        <div className="rep-card rep-printable">
          <CardHead title={`Ownership / control tree — ${selected.name}`} subtitle="Report 11 — entities, persons, percentages, layers">
            <ExportBar name={`ownership-tree-${selected.registrationNumber || selected.id}`} header={header} rows={data} meta={selected.name} />
          </CardHead>
          <div className="rep-card__body"><OwnershipTree entity={selected} /></div>
        </div>
      </>
    );
  };

  /* ---------------- Audit ---------------- */
  const renderAudit = () => {
    const rows = auditLogs.map((l) => ({ ...l, ts: String(l.createdAt || '').replace('T', ' ').slice(0, 19) }));
    const header = ['Timestamp', 'Action', 'Actor', 'Entity'];
    const data = rows.map((l) => [l.ts, l.action, l.actorUsername || '', l.entityRef || '']);
    return (
      <div className="rep-card rep-printable">
        <CardHead title="Audit trail" subtitle="All BO changes, exports, and reviewer actions — latest 100">
          <ExportBar name="audit-trail" header={header} rows={data} meta="Latest 100 entries" />
        </CardHead>
        <DataTable rowKey={(l) => l.id} rows={rows} empty="No audit entries yet."
          cols={[
            { key: 'ts', label: 'Timestamp', cls: 'rep-table__mono' },
            { key: 'action', label: 'Action' },
            { key: 'actorUsername', label: 'Actor', render: (l) => l.actorUsername || '—' },
            { key: 'entityRef', label: 'Entity', cls: 'rep-table__mono', render: (l) => l.entityRef || '—' },
          ]} />
      </div>
    );
  };

  const content = { overview: renderOverview, threshold: renderThreshold, breakdown: renderBreakdown, exceptions: renderExceptions, complexity: renderComplexity, tree: renderTree, audit: renderAudit }[activeTab];
  const onTabKey = (e) => {
    const i = TABS.findIndex(([k]) => k === activeTab);
    if (e.key === 'ArrowRight') setActiveTab(TABS[(i + 1) % TABS.length][0]);
    if (e.key === 'ArrowLeft') setActiveTab(TABS[(i + TABS.length - 1) % TABS.length][0]);
  };

  return (
    <div className="rep-root">
      <style>{`.rep-print-only{display:none}
        @media print{.rep-print-only{display:block;margin-bottom:12px;font-size:12px}.rep-print-only h1{font-size:18px;margin:0 0 4px}}
        .rep-heat{border-collapse:collapse;font-size:12px}.rep-heat th,.rep-heat td{border:1px solid #e6eaf6;padding:5px 8px;text-align:center;min-width:44px}
        .rep-heat thead th{font-weight:600;white-space:normal}.rep-heat tbody th{text-align:left;font-weight:500;white-space:nowrap}`}</style>

      <div className="rep-print-only">
        <h1>Beneficial Ownership Report — {TABS.find(([k]) => k === activeTab)[1]}</h1>
        <div>Generated {new Date().toLocaleString()} · {filterText} · {filtered.length} of {entities.length} entities</div>
      </div>

      <div className="rep-header rep-no-print">
        <div>
          <div className="rep-header__title-row">
            <h1 className="rep-header__title">Reporting</h1>
            {filtersActive && <span className="rep-pill">{I.filter} Filtered</span>}
            {treesLoading && <span className="rep-pill">Loading ownership data… {Object.keys(trees).length}/{legalPersons.length}</span>}
          </div>
          <div className="rep-header__subtitle">BO summary · threshold reports · exceptions · audit trail. Export buttons on each report download that report.</div>
        </div>
      </div>

      {error && <div className="rep-error" role="alert">{I.warning}<span>{error}</span></div>}

      <div className="rep-tabs rep-no-print" role="tablist" aria-label="Report sections" onKeyDown={onTabKey}>
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={activeTab === k} tabIndex={activeTab === k ? 0 : -1}
            className={`rep-tab${activeTab === k ? ' rep-tab--active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      <div className="rep-filter-card rep-no-print">
        <div className="rep-filter-card__head">
          <span className="rep-filter-card__label">{I.filter} Filters</span><span className="rep-filter-card__divider" />
          {filtersActive && <Btn variant="ghost" onClick={() => setF({ entityId: '', type: '', sector: '', threshold: '', from: '', to: '' })}>Clear all</Btn>}
        </div>
        <div className="rep-filter-grid">
          <EntityCombo options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))} value={f.entityId} onChange={set('entityId')} loading={loading} />
          <Field label="Entity type">
            <select className="rep-input" value={f.type} onChange={input('type')}><option value="">All types</option>{Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Sector">
            <select className="rep-input" value={f.sector} onChange={input('sector')}><option value="">All sectors</option>{Object.entries(SECTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Threshold">
            <select className="rep-input" value={f.threshold} onChange={input('threshold')}>
              <option value="">Any</option><option value="2">2%</option><option value="5">5%</option><option value="10">10%</option><option value="25">25%</option><option value="special">Special (no %)</option>
            </select>
          </Field>
          <Field label="BO since (from)"><input className="rep-input" type="date" value={f.from} onChange={input('from')} max={f.to || undefined} /></Field>
          <Field label="BO since (to)"><input className="rep-input" type="date" value={f.to} onChange={input('to')} min={f.from || undefined} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 9, fontSize: 12, color: 'var(--rep-text-muted)' }}>
            <span><strong style={{ color: 'var(--rep-text)' }}>{filtered.length}</strong> of {entities.length} entities</span>
          </div>
        </div>
      </div>

      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`}>{content()}</div>
    </div>
  );
}
