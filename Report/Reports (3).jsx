import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Building2, Users, Search, Filter, Link2, Download, Printer, AlertTriangle, X,
  ChevronDown, CheckCircle2, Clock, ShieldAlert, FileText,
} from 'lucide-react';
import { listLegalPersons, listAuditLogs } from '../api/bovsApi.js';
import { useBackgroundTrees } from '../components/DashboardKpis.jsx';
import '../styles/Reports.css'; // still provides the .rep-tree-* diagram styles

/* ==========================================================================
   Constants
   ========================================================================== */
const HIGH_RISK_SECTORS = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);

const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate',
  MOTOR_DEALERSHIP: 'Motor Dealership', IMPORT_EXPORT: 'Import / Export',
  FINANCIAL: 'Financial',
};

const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company',
  PRIVATE_LIMITED_COMPANY: 'Private Limited Company',
  ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company',
  GENERAL_PARTNERSHIP: 'General Partnership',
  LIMITED_PARTNERSHIP: 'Limited Partnership',
  LIMITED_LIABILITY_PARTNERSHIP: 'Limited Liability Partnership',
  FINANCIAL_INSTITUTION: 'Financial Institution',
  FOREIGN_LEGAL_PERSON: 'Foreign Legal Person',
  PPP: 'Public Private Partnership',
  CIVIL_SOCIETY_ORGANIZATION: 'Civil Society Organisation',
  GOVERNMENT_OWNED_ENTERPRISE: 'Government-Owned Enterprise',
  COOPERATIVE_ASSOCIATION: 'Cooperative Association',
  PUBLIC_ADMINISTRATION: 'Public Administration',
  RELIGIOUS_INSTITUTION: 'Religious Institution',
  INTERNATIONAL_ORGANIZATION: 'International Organisation',
  TRUST: 'Trust', CHARITY: 'Charity', INDIVIDUAL: 'Individual', OTHER: 'Other',
};

const VERIFIED = ['VERIFIED', 'APPROVED'];
const SEVERITY = {
  danger: { label: 'Critical', color: '#dc2626', soft: 'rgba(220, 38, 38, .10)' },
  warn: { label: 'Warning', color: '#d97706', soft: 'rgba(217, 119, 6, .12)' },
  info: { label: 'Info', color: '#2563eb', soft: 'rgba(59, 91, 219, .10)' },
};

function getThreshold(entityType, sector) {
  switch (entityType) {
    case 'SHARE_COMPANY': return HIGH_RISK_SECTORS.has(sector) ? 5 : 10;
    case 'PRIVATE_LIMITED_COMPANY': return 5;
    case 'FINANCIAL_INSTITUTION': return 2;
    case 'GENERAL_PARTNERSHIP':
    case 'LIMITED_PARTNERSHIP':
    case 'LIMITED_LIABILITY_PARTNERSHIP':
    case 'PPP': return 25;
    default: return null;
  }
}

/* ==========================================================================
   Helpers
   ========================================================================== */
const splitChain = (chain) => String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const isDirectHolder = (holder) => {
  const paths = holder.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};
const isForeignEntity = (t) => t === 'FOREIGN_LEGAL_PERSON';
const holdersOf = (e) => (e.tree?.holders || []).filter((h) => h.ubo);
const formatDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toCsv = (header, rows) =>
  [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
const downloadFile = (content, filename, mime) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
const today = () => new Date().toISOString().slice(0, 10);

/* ==========================================================================
   Report builders
   ========================================================================== */
function buildThresholdReport(entities) {
  return entities.map((e) => {
    const holders = holdersOf(e);
    const threshold = getThreshold(e.entityType, e.sector);
    const above = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) >= threshold) : [];
    const below = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) < threshold) : [];
    const controlOnly = (e.tree?.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
    return { entity: e, threshold, above, below, controlOnly, ubos: holders };
  });
}

function buildBreakdown(entities) {
  return entities.flatMap((e) => holdersOf(e).map((h) => ({ entity: e, holder: h })));
}

function buildExceptions(entities, complete) {
  const rows = [];
  entities.forEach((e) => {
    const tree = e.tree;
    if (!tree) {
      if (complete) rows.push({ entity: e, type: 'NO_STRUCTURE', severity: 'danger', title: 'No ownership structure loaded', desc: 'The ownership tree could not be loaded for this entity.' });
      return;
    }
    const holders = holdersOf(e);
    const all = tree.holders || [];

    all.forEach((h) => {
      if (!h.idNumber) rows.push({ entity: e, type: 'MISSING_ID', severity: 'warn', title: `${h.fullName} has no ID number`, desc: 'BO record is missing an identification number.' });
      if (h.dateOfExpiry) {
        const exp = new Date(h.dateOfExpiry);
        if (!Number.isNaN(exp.getTime()) && exp < new Date()) {
          rows.push({ entity: e, type: 'EXPIRED_ID', severity: 'danger', title: `${h.fullName}'s ID expired on ${formatDate(h.dateOfExpiry)}`, desc: 'ID document has expired.' });
        }
      }
      if (h.qualifiesByControl && (!h.controlBasis || h.controlBasis.length === 0)) {
        rows.push({ entity: e, type: 'MISSING_CONTROL_BASIS', severity: 'warn', title: `${h.fullName} qualifies by control but no basis recorded`, desc: 'Control through other means needs a documented basis.' });
      }
      (h.paths || []).forEach((p) => {
        const parts = splitChain(p.chain);
        if (parts.length > 1 && parts[0] === parts[parts.length - 1]) {
          rows.push({ entity: e, type: 'CIRCULAR', severity: 'danger', title: `Circular ownership detected for ${h.fullName}`, desc: `Chain: ${p.chain}` });
        }
      });
    });

    const totalPct = holders.reduce((s, h) => s + Number(h.effectivePercentage || 0), 0);
    if (totalPct > 100.01) {
      rows.push({ entity: e, type: 'PCT_OVER_100', severity: 'danger', title: `Ownership percentages exceed 100% (${totalPct.toFixed(2)}%)`, desc: 'The sum of all effective ownership percentages is greater than 100.' });
    }

    const seen = new Map();
    all.forEach((h) => {
      if (!h.idNumber) return;
      const key = h.idNumber.trim();
      if (seen.has(key)) rows.push({ entity: e, type: 'DUPLICATE_ID', severity: 'danger', title: `Duplicate ID number ${key}`, desc: `Used by ${seen.get(key)} and ${h.fullName}.` });
      else seen.set(key, h.fullName);
    });

    const threshold = getThreshold(e.entityType, e.sector);
    if (threshold != null) {
      holders.forEach((h) => {
        if (Number(h.effectivePercentage) < threshold && !h.qualifiesByControl) {
          rows.push({ entity: e, type: 'BELOW_THRESHOLD', severity: 'warn', title: `${h.fullName} (${h.effectivePercentage}%) is below the ${threshold}% threshold`, desc: 'Holder is flagged as a beneficial owner but is below the applicable threshold and has no control basis.' });
        }
      });
    }

    if (isForeignEntity(e.entityType)) {
      rows.push({ entity: e, type: 'FOREIGN_DOCS', severity: 'info', title: 'Foreign legal person — verify home-jurisdiction evidence', desc: 'Ensure home-jurisdiction documentation or attestation is on file.' });
    }
  });
  return rows;
}

function buildComplexity(entities) {
  return entities.map((e) => {
    const holders = holdersOf(e);
    const maxDepth = holders.reduce((m, h) => Math.max(m, ...(h.paths || []).map((p) => splitChain(p.chain).length)), 0);
    const intermediates = new Set();
    holders.forEach((h) => (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) intermediates.add(parts[i]);
    }));
    const crossOwnership = holders.filter((h) => (h.paths || []).length > 1);
    const layers = maxDepth > 0 ? maxDepth - 1 : 0;
    return {
      entity: e, layers, intermediates: intermediates.size, holders: holders.length,
      crossOwnership, isComplex: layers >= 2 || crossOwnership.length > 0, isForeign: isForeignEntity(e.entityType),
    };
  });
}

/* ==========================================================================
   Small UI
   ========================================================================== */
function Btn({ variant = 'secondary', icon, children, ...props }) {
  return <button type="button" className={`er-btn er-btn--${variant}`} {...props}>{icon}{children}</button>;
}

function Field({ label, children }) {
  return (
    <label className="er-field">
      <span className="er-field__label">{label}</span>
      {children}
    </label>
  );
}

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
  useEffect(() => { setHi(0); }, [query]);

  const pick = (o) => { onChange(o.value); setOpen(false); setQuery(''); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <Field label="Legal entity">
      <div className="er-combo" ref={ref}>
        <span className="er-combo__icon"><Search size={14} /></span>
        <input
          className="er-input er-input--combo" type="text" role="combobox" aria-expanded={open} disabled={loading}
          value={open ? query : (selected ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : '')}
          placeholder={loading ? 'Loading…' : 'All entities'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul className="er-combo__list" role="listbox">
            {filtered.length === 0 && <li className="er-combo__empty">No entity found</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`er-combo__item${i === hi ? ' er-combo__item--hi' : ''}${o.value === value ? ' er-combo__item--sel' : ''}`}
              >
                <span>{o.label}</span>
                {o.sub && <span className="er-combo__sub">{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function ExportMenu({ onExport, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const items = [
    ['csv', 'CSV (.csv)'], ['excel', 'Excel (.xls)'], ['word', 'Word (.doc)'], ['pdf', 'PDF / Print'],
  ];
  return (
    <div className="er-menu" ref={ref}>
      <Btn variant="primary" icon={<Download size={14} />} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        Export <ChevronDown size={14} />
      </Btn>
      {open && (
        <div className="er-menu__list" role="menu">
          {items.map(([k, label]) => (
            <button key={k} type="button" role="menuitem" className="er-menu__item" onClick={() => { setOpen(false); onExport(k); }}>
              {k === 'pdf' ? <Printer size={14} /> : <FileText size={14} />}{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = 'neutral', caption, meter, loading, partial }) {
  return (
    <div className={`er-kpi er-kpi--${tone}`}>
      <div className="er-kpi__top">
        <span className="er-kpi__label">{label}</span>
        <span className="er-kpi__icon"><Icon size={16} /></span>
      </div>
      {loading ? <div className="er-skel er-skel--value" /> : (
        <div className="er-kpi__value">{Number(value).toLocaleString()}{partial && <span className="er-kpi__partial">+</span>}</div>
      )}
      <div className="er-kpi__caption">{caption}</div>
      {meter != null && !loading && <div className="er-meter"><div className="er-meter__fill" style={{ width: `${Math.min(100, meter)}%` }} /></div>}
    </div>
  );
}

function Section({ no, title, subtitle, children, actions }) {
  return (
    <section className="er-card er-printable">
      <header className="er-card__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="er-card__title">{no != null && <span className="er-card__no">{no}</span>}{title}</h3>
          {subtitle && <div className="er-card__sub">{subtitle}</div>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

const EntityCell = ({ e }) => (
  <div className="er-entity">
    <span className="er-entity__icon"><Building2 size={14} /></span>
    <div style={{ minWidth: 0 }}>
      <div className="er-entity__name">{e.name}</div>
      <div className="er-entity__reg">{e.registrationNumber || '—'}</div>
    </div>
  </div>
);

const ThresholdChip = ({ e }) => {
  const th = getThreshold(e.entityType, e.sector);
  return th != null
    ? <span className={`er-chip ${HIGH_RISK_SECTORS.has(e.sector) ? 'er-chip--warn' : 'er-chip--info'}`}>≥ {th}%</span>
    : <span className="er-chip er-chip--muted">Special</span>;
};

const EmptyRow = ({ cols, children }) => <tr><td colSpan={cols} className="er-empty">{children}</td></tr>;

/* ==========================================================================
   Ownership diagram + chain summary
   ========================================================================== */
function TreeNodeBox({ kind, label, sub, holder }) {
  let cls = 'rep-tree-node';
  if (kind === 'entity') cls += ' rep-tree-node--entity';
  else if (kind === 'intermediate') cls += ' rep-tree-node--intermediate';
  else if (kind === 'fallback') cls += ' rep-tree-node--fallback';
  else cls += holder && isDirectHolder(holder) ? ' rep-tree-node--ubo-direct' : ' rep-tree-node--ubo-indirect';
  return (
    <div className={cls}>
      <span className="rep-tree-node__icon">{kind === 'ubo' || kind === 'fallback' ? <Users size={12} /> : <Building2 size={12} />}</span>
      <div style={{ minWidth: 0 }}>
        <div className="rep-tree-node__label">{label}</div>
        <div className="rep-tree-node__sub">{sub}</div>
      </div>
    </div>
  );
}

function OwnershipTreeReport({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;
  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;
  const allHolders = [...ubos, ...controlOnly];

  const intermediateMap = new Map();
  allHolders.forEach((h) => (h.paths || []).forEach((p) => {
    const parts = splitChain(p.chain);
    for (let i = 1; i < parts.length - 1; i++) if (!intermediateMap.has(parts[i])) intermediateMap.set(parts[i], { name: parts[i], parent: null });
  }));
  allHolders.forEach((h) => (h.paths || []).forEach((p) => {
    const parts = splitChain(p.chain);
    for (let i = 2; i < parts.length - 1; i++) {
      if (intermediateMap.has(parts[i - 1])) intermediateMap.get(parts[i]).parent = parts[i - 1];
    }
  }));

  const intermediates = Array.from(intermediateMap.values());
  const roots = intermediates.filter((it) => !it.parent);
  const attachUbos = (parentName) => allHolders.filter((h) => {
    const parts = (h.paths || []).map((p) => splitChain(p.chain)).find(Boolean) || [];
    if (parentName === null) return parts.length === 2;
    return parts.length > 2 && parts[parts.length - 2] === parentName;
  });
  const buildNode = (name) => ({
    name,
    childrenIntermediates: intermediates.filter((x) => x.parent === name).map((c) => buildNode(c.name)),
    ubos: attachUbos(name),
  });
  const topNodes = roots.map((it) => buildNode(it.name));
  const directUbos = attachUbos(null);
  const hasBranches = topNodes.length > 0 || directUbos.length > 0;
  const holderSub = (h) => `${h.effectivePercentage}% ${isDirectHolder(h) ? 'direct' : 'indirect'}`;

  return (
    <div className="rep-tree">
      <div className="rep-tree__stage">
        <TreeNodeBox kind="entity" label={entity.name} sub={entity.registrationNumber ? `Reg. ${entity.registrationNumber}` : 'Legal entity'} />
        {hasBranches && <div className="rep-tree__vline rep-tree__vline--tall" />}
        {hasBranches && (
          <div className="rep-tree__branch-row">
            <div className="rep-tree__hconnector" />
            <div className="rep-tree__cap rep-tree__cap--left" />
            <div className="rep-tree__cap rep-tree__cap--right" />
            {topNodes.map((node) => (
              <div key={node.name} className="rep-tree__branch">
                <div className="rep-tree__vline rep-tree__vline--med" />
                <TreeNodeBox kind="intermediate" label={node.name} sub={`${node.ubos.length + node.childrenIntermediates.length} downstream`} />
                {(node.childrenIntermediates.length > 0 || node.ubos.length > 0) && (
                  <>
                    <div className="rep-tree__vline rep-tree__vline--med" />
                    <div className="rep-tree__children">
                      {node.childrenIntermediates.map((child) => (
                        <div key={child.name} className="rep-tree__branch">
                          <TreeNodeBox kind="intermediate" label={child.name} sub={`${child.ubos.length} UBO${child.ubos.length === 1 ? '' : 's'}`} />
                          {child.ubos.length > 0 && (
                            <>
                              <div className="rep-tree__vline rep-tree__vline--short" />
                              <div className="rep-tree__children">
                                {child.ubos.map((h) => <TreeNodeBox key={h.key} kind="ubo" label={h.fullName} sub={holderSub(h)} holder={h} />)}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {node.ubos.map((h) => <TreeNodeBox key={h.key} kind="ubo" label={h.fullName} sub={holderSub(h)} holder={h} />)}
                    </div>
                  </>
                )}
              </div>
            ))}
            {directUbos.map((h) => (
              <div key={`direct-${h.key}`} className="rep-tree__branch">
                <div className="rep-tree__vline rep-tree__vline--med" />
                <TreeNodeBox kind="ubo" label={h.fullName} sub={`${h.effectivePercentage}% direct`} holder={h} />
              </div>
            ))}
          </div>
        )}
        {fallback && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="rep-tree__vline rep-tree__vline--med" />
            <TreeNodeBox kind="fallback" label={fallback.name} sub={fallback.position || 'Senior managing official'} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChainSummary({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;
  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;

  const edges = new Map();
  ubos.forEach((h) => (h.paths || []).forEach((p) => {
    const steps = Array.isArray(p.steps) && p.steps.length ? p.steps : null;
    const parts = splitChain(p.chain);
    const list = steps
      ? steps.map((s) => ({ from: s.from, to: s.to, pct: s.pct }))
      : parts.slice(0, -1).map((from, i) => ({ from, to: parts[i + 1], pct: null }));
    list.forEach((s) => {
      if (!edges.has(s.from)) edges.set(s.from, []);
      const bucket = edges.get(s.from);
      if (!bucket.find((x) => x.to === s.to)) bucket.push({ to: s.to, pct: s.pct });
    });
  }));

  const bullets = [];
  edges.forEach((children, parent) => {
    bullets.push(`${parent} → ${children.map((c) => (c.pct != null ? `${c.pct}% owned by ${c.to}` : `owned by ${c.to}`)).join(' and ')}`);
  });
  ubos.forEach((h) => (h.paths || []).forEach((p) => {
    const parts = splitChain(p.chain);
    const eff = Number(h.effectivePercentage ?? p.percentage);
    if (parts.length === 2) { bullets.push(`${h.fullName}'s direct interest = ${eff}%`); return; }
    const steps = Array.isArray(p.steps) && p.steps.length ? p.steps : null;
    bullets.push(`${h.fullName}'s indirect interest = ${steps ? `${steps.map((s) => `${s.pct}%`).join(' × ')} = ` : ''}${eff}%`);
  }));
  controlOnly.forEach((h) => bullets.push(`${h.fullName} — control via ${(h.controlBasis || []).join(', ') || 'other means'} (no ownership)`));
  if (fallback) bullets.push(`Senior managing official fallback: ${fallback.name}${fallback.position ? ` (${fallback.position})` : ''}`);
  if (bullets.length === 0) return null;

  return (
    <div className="er-summary">
      <div className="er-summary__head"><Link2 size={13} /> Ownership chain summary</div>
      <ul className="er-summary__list">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
    </div>
  );
}

/* ==========================================================================
   Charts
   ========================================================================== */
function StatusDonut({ counts }) {
  const data = [
    { name: 'Verified', value: counts.verified, color: '#059669' },
    { name: 'Pending', value: counts.pending, color: '#d97706' },
    { name: 'Rejected', value: counts.rejected, color: '#dc2626' },
    { name: 'Other', value: counts.other, color: '#cbd5e1' },
  ].filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="er-empty-inline">No beneficial owners in scope.</div>;
  return (
    <div className="er-donut">
      <div className="er-donut__chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} cornerRadius={5} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="er-donut__center"><strong>{total}</strong><span>BOs</span></div>
      </div>
      <ul className="er-legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="er-legend__dot" style={{ background: d.color }} />
            <span className="er-legend__name">{d.name}</span>
            <strong>{d.value}</strong>
            <span className="er-legend__pct">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectorBars({ entities }) {
  const data = useMemo(() => {
    const counts = {};
    entities.forEach((e) => { const s = SECTOR_LABELS[e.sector] || 'Other'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [entities]);
  if (data.length === 0) return <div className="er-empty-inline">No sector data.</div>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis type="category" dataKey="name" width={116} tick={{ fontSize: 11, fill: '#475569' }} />
        <Tooltip cursor={{ fill: 'rgba(59,91,219,.06)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
        <Bar dataKey="value" name="Entities" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Styles (scoped with the er- prefix)
   ========================================================================== */
const css = `
.er-root { --er-primary:#0b2a5b; --er-text:#0f172a; --er-muted:#64748b; --er-faint:#94a3b8; --er-border:#e5e7eb; --er-surface:#fff; --er-alt:#f8fafc;
  --er-primary:#2563eb; --er-soft:rgba(59,91,219,.08); color:var(--er-text); }
.er-print-only { display:none; }

.er-head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:20px; }
.er-eyebrow { font-size:11.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--er-primary); margin-bottom:4px; }
.er-title { margin:0; font-size:26px; font-weight:750; letter-spacing:-.025em; }
.er-meta { margin-top:4px; font-size:13px; color:var(--er-muted); display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; }
.er-pill { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11.5px; font-weight:650; color:var(--er-primary); background:var(--er-soft); }
.er-actions { display:flex; gap:8px; align-items:center; }

.er-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:10px; font:inherit; font-size:13px; font-weight:600; cursor:pointer;
  border:1px solid var(--er-border); background:var(--er-surface); color:var(--er-text); transition:background .14s, border-color .14s, box-shadow .14s; }
.er-btn:hover:not(:disabled) { background:var(--er-alt); border-color:#cbd5e1; }
.er-btn:disabled { opacity:.55; cursor:not-allowed; }
.er-btn--primary { background:var(--er-primary); border-color:var(--er-primary); color:#fff; }
.er-btn--primary:hover:not(:disabled) { background:#123a7a; border-color:#123a7a; }
.er-btn--ghost { border-color:transparent; background:transparent; color:var(--er-muted); padding:5px 8px; }

.er-menu { position:relative; }
.er-menu__list { position:absolute; right:0; top:calc(100% + 6px); z-index:30; min-width:190px; padding:6px; background:var(--er-surface);
  border:1px solid var(--er-border); border-radius:12px; box-shadow:0 12px 32px rgba(16,24,40,.14); }
.er-menu__item { display:flex; align-items:center; gap:9px; width:100%; padding:9px 10px; border:0; border-radius:8px; background:transparent;
  font:inherit; font-size:13px; font-weight:550; color:var(--er-text); text-align:left; cursor:pointer; }
.er-menu__item:hover { background:var(--er-alt); }

.er-banner { display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:10px 14px; border-radius:12px; font-size:13px;
  background:var(--er-alt); border:1px solid var(--er-border); color:var(--er-muted); }
.er-banner--err { background:rgba(220,38,38,.06); border-color:rgba(220,38,38,.25); color:#b91c1c; }
.er-banner--warn { background:rgba(217,119,6,.08); border-color:rgba(217,119,6,.3); color:#b45309; }
.er-progress { flex:0 0 140px; height:5px; border-radius:999px; background:#e2e8f0; overflow:hidden; }
.er-progress > div { height:100%; background:var(--er-primary); transition:width .3s; }

.er-tabs { display:flex; gap:4px; overflow-x:auto; margin-bottom:16px; border-bottom:1px solid var(--er-border); }
.er-tab { position:relative; display:inline-flex; align-items:center; gap:7px; padding:11px 14px; border:0; background:transparent; cursor:pointer; white-space:nowrap;
  font:inherit; font-size:13.5px; font-weight:600; color:var(--er-muted); }
.er-tab:hover { color:var(--er-text); }
.er-tab--active { color:var(--er-primary); }
.er-tab--active::after { content:''; position:absolute; left:10px; right:10px; bottom:-1px; height:2px; border-radius:2px; background:var(--er-primary); }
.er-tab__count { padding:1px 7px; border-radius:999px; font-size:11px; font-weight:700; background:#eef2f7; color:var(--er-muted); }
.er-tab__count--danger { background:rgba(220,38,38,.12); color:#dc2626; }

.er-filters { margin-bottom:18px; padding:14px 16px 16px; background:var(--er-surface); border:1px solid var(--er-border); border-radius:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
.er-filters__head { display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--er-muted); }
.er-filters__head .grow { flex:1; }
.er-filter-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; align-items:end; }
.er-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.er-field__label { font-size:11.5px; font-weight:650; color:var(--er-muted); }
.er-input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid var(--er-border); border-radius:10px; background:var(--er-surface); font:inherit; font-size:13px; color:var(--er-text); }
.er-input:focus { outline:2px solid var(--er-soft); border-color:var(--er-primary); }
.er-input--combo { padding-left:32px; }
.er-count { font-size:12.5px; color:var(--er-muted); padding-bottom:9px; }
.er-count strong { color:var(--er-text); }
.er-combo { position:relative; }
.er-combo__icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--er-faint); display:inline-flex; }
.er-combo__list { position:absolute; z-index:25; left:0; right:0; top:calc(100% + 4px); max-height:260px; overflow:auto; margin:0; padding:5px; list-style:none;
  background:var(--er-surface); border:1px solid var(--er-border); border-radius:12px; box-shadow:0 12px 28px rgba(16,24,40,.14); }
.er-combo__item { display:flex; justify-content:space-between; gap:10px; padding:8px 10px; border-radius:8px; font-size:13px; cursor:pointer; }
.er-combo__item--hi { background:var(--er-alt); }
.er-combo__item--sel { font-weight:650; color:var(--er-primary); }
.er-combo__sub, .er-combo__empty { color:var(--er-faint); font-size:12px; }
.er-combo__empty { padding:10px; }

.er-kpis { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:14px; margin-bottom:18px; }
@media (max-width:1180px) { .er-kpis { grid-template-columns:repeat(3, minmax(0, 1fr)); } }
@media (max-width:640px) { .er-kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
.er-kpi { position:relative; overflow:hidden; padding:16px 18px 14px; background:var(--er-surface); border:1px solid var(--er-border); border-radius:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
.er-kpi::before { content:''; position:absolute; inset:0 0 auto 0; height:3px; background:var(--k); }
.er-kpi--neutral { --k:#475569; --ks:rgba(71,85,105,.10); } .er-kpi--info { --k:#2563eb; --ks:rgba(59,91,219,.10); }
.er-kpi--success { --k:#059669; --ks:rgba(5,150,105,.10); } .er-kpi--warn { --k:#d97706; --ks:rgba(217,119,6,.12); }
.er-kpi--danger { --k:#dc2626; --ks:rgba(220,38,38,.10); }
.er-kpi__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.er-kpi__label { font-size:11.5px; font-weight:650; letter-spacing:.05em; text-transform:uppercase; color:var(--er-muted); }
.er-kpi__icon { display:inline-flex; width:30px; height:30px; align-items:center; justify-content:center; border-radius:9px; color:var(--k); background:var(--ks); }
.er-kpi__value { font-size:30px; font-weight:750; letter-spacing:-.03em; line-height:1.15; font-variant-numeric:tabular-nums; }
.er-kpi__partial { margin-left:2px; font-size:18px; color:var(--k); }
.er-kpi__caption { margin-top:2px; font-size:12.5px; color:var(--er-muted); }
.er-meter { margin-top:9px; height:5px; border-radius:999px; background:var(--ks); overflow:hidden; }
.er-meter__fill { height:100%; background:var(--k); border-radius:inherit; transition:width .5s; }
.er-skel { border-radius:8px; background:linear-gradient(90deg,#eef1f5 25%,#f6f8fa 37%,#eef1f5 63%); background-size:400% 100%; animation:er-shimmer 1.3s ease infinite; }
.er-skel--value { height:34px; width:55%; }
@keyframes er-shimmer { 0% { background-position:100% 0; } 100% { background-position:0 0; } }

.er-grid-2 { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; margin-bottom:16px; }
@media (max-width:900px) { .er-grid-2 { grid-template-columns:1fr; } }

.er-card { margin-bottom:16px; background:var(--er-surface); border:1px solid var(--er-border); border-radius:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); overflow:hidden; }
.er-card__head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-bottom:1px solid var(--er-border); }
.er-card__title { margin:0; display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; letter-spacing:-.01em; }
.er-card__no { display:inline-flex; padding:2px 8px; border-radius:7px; font-size:11px; font-weight:750; color:var(--er-primary); background:var(--er-soft); }
.er-card__sub { margin-top:3px; font-size:12.5px; color:var(--er-muted); }
.er-card__body { padding:18px 20px; }
.er-chart { height:250px; padding:12px 16px 8px; }

.er-donut { display:flex; align-items:center; gap:24px; height:250px; padding:12px 24px; }
.er-donut__chart { position:relative; flex:0 0 190px; height:190px; }
.er-donut__center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
.er-donut__center strong { font-size:26px; font-weight:750; line-height:1; }
.er-donut__center span { font-size:11.5px; color:var(--er-muted); }
.er-legend { flex:1; margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:10px; }
.er-legend li { display:flex; align-items:center; gap:9px; font-size:13px; }
.er-legend__dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.er-legend__name { flex:1; color:var(--er-muted); }
.er-legend__pct { width:38px; text-align:right; color:var(--er-faint); font-size:12px; }
.er-empty-inline { display:flex; align-items:center; justify-content:center; height:100%; min-height:120px; font-size:13px; color:var(--er-muted); }

.er-tablewrap { overflow:auto; max-height:560px; }
.er-table { width:100%; border-collapse:collapse; font-size:13px; }
.er-table th { position:sticky; top:0; z-index:1; padding:11px 16px; text-align:left; white-space:nowrap; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  color:var(--er-muted); background:var(--er-alt); border-bottom:1px solid var(--er-border); }
.er-table td { padding:13px 16px; border-bottom:1px solid #eef1f5; vertical-align:middle; }
.er-table tbody tr:last-child td { border-bottom:0; }
.er-table tbody tr.er-row:hover td { background:var(--er-alt); }
.er-table tbody tr.er-row--sel td { background:var(--er-soft); }
.er-table .num { text-align:right; font-variant-numeric:tabular-nums; }
.er-table .ctr { text-align:center; }
.er-mono { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; color:var(--er-muted); word-break:break-word; }
.er-empty { padding:36px 16px !important; text-align:center; color:var(--er-muted); }
.er-spinner { display:inline-block; width:14px; height:14px; margin-right:8px; vertical-align:-2px; border:2px solid #cbd5e1; border-top-color:var(--er-primary); border-radius:50%; animation:er-spin .7s linear infinite; }
@keyframes er-spin { to { transform:rotate(360deg); } }

.er-entity { display:flex; align-items:center; gap:11px; min-width:200px; }
.er-entity__icon { display:inline-flex; width:32px; height:32px; flex-shrink:0; align-items:center; justify-content:center; border-radius:10px; color:var(--er-primary); background:var(--er-soft); }
.er-entity__name { font-weight:650; }
.er-entity__reg { font-size:12px; color:var(--er-muted); font-family:ui-monospace, Menlo, monospace; }

.er-chip { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11.5px; font-weight:650; white-space:nowrap; background:#eef2f7; color:var(--er-muted); }
.er-chip--info { background:rgba(59,91,219,.10); color:#3149b5; } .er-chip--ok { background:rgba(5,150,105,.12); color:#047857; }
.er-chip--warn { background:rgba(217,119,6,.13); color:#b45309; } .er-chip--danger { background:rgba(220,38,38,.12); color:#b91c1c; }
.er-chip--muted { background:#eef2f7; color:var(--er-muted); }

.er-sevbar { display:flex; flex-wrap:wrap; gap:8px; padding:14px 20px; border-bottom:1px solid var(--er-border); }
.er-sevbtn { padding:5px 12px; border-radius:999px; border:1px solid var(--er-border); background:var(--er-surface); font:inherit; font-size:12.5px; font-weight:600; color:var(--er-muted); cursor:pointer; }
.er-sevbtn--active { background:var(--er-text); border-color:var(--er-text); color:#fff; }

.er-summary { margin-bottom:16px; padding:14px 18px; background:var(--er-alt); border:1px solid var(--er-border); border-radius:14px; }
.er-summary__head { display:flex; align-items:center; gap:7px; margin-bottom:8px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--er-muted); }
.er-summary__list { margin:0; padding-left:18px; display:flex; flex-direction:column; gap:5px; font-size:13px; color:#334155; }

.er-empty-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:56px 20px; text-align:center; color:var(--er-muted); }
.er-empty-card strong { font-size:15px; color:var(--er-text); }

@media print {
  .er-no-print { display:none !important; }
  .er-print-only { display:block; margin-bottom:16px; }
  .er-print-only h1 { margin:0 0 4px; font-size:20px; }
  .er-print-only p { margin:2px 0; font-size:12px; color:#475569; }
  .er-card, .er-kpi, .er-filters { box-shadow:none; break-inside:avoid; }
  .er-tablewrap { max-height:none; overflow:visible; }
}
@media (prefers-reduced-motion: reduce) { .er-skel, .er-spinner { animation:none; } .er-meter__fill, .er-progress > div { transition:none; } }
`;

/* ==========================================================================
   Main component
   ========================================================================== */
const TAB_DEFS = [
  { key: 'overview', label: 'Overview' },
  { key: 'threshold', label: 'Threshold report' },
  { key: 'breakdown', label: 'Ownership breakdown' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'complexity', label: 'Complex structures' },
  { key: 'tree', label: 'Visual tree' },
  { key: 'audit', label: 'Audit trail' },
];

export default function Reports() {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [entityId, setEntityId] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [thresholdFilter, setThresholdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [sevFilter, setSevFilter] = useState('all');

  const generatedAt = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLegalPersons({ size: 500, sort: 'name' })
      .then((res) => { if (!cancelled) { setLegalPersons(res.content || []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.friendlyMessage || 'Failed to load reports'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* Every entity's ownership tree loads in the background, a few at a time */
  const { failed } = useBackgroundTrees(legalPersons, trees, setTrees);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    setAuditLoading(true);
    listAuditLogs({ size: 100 })
      .then((res) => setAuditLogs(res.content || []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, [activeTab]);

  const entities = useMemo(
    () => legalPersons.map((lp) => ({
      id: lp.id, name: lp.name, registrationNumber: lp.registrationNumber, entityType: lp.entityType,
      sector: lp.sector, countryOfIncorporation: lp.countryOfIncorporation, tin: lp.tin, cifNumber: lp.cifNumber,
      tree: trees[lp.id],
      uboCount: (trees[lp.id]?.holders || []).filter((h) => h.ubo).length,
      fallback: trees[lp.id]?.seniorManagingOfficial || null,
    })),
    [legalPersons, trees],
  );

  const loadedCount = entities.filter((e) => e.tree).length;
  const syncing = !loading && loadedCount + failed < entities.length;
  const loadPct = entities.length ? Math.round(((loadedCount + failed) / entities.length) * 100) : 0;

  const filtered = useMemo(() => entities.filter((e) => {
    if (entityId && e.id !== entityId) return false;
    if (entityTypeFilter && e.entityType !== entityTypeFilter) return false;
    if (sectorFilter && e.sector !== sectorFilter) return false;
    if (thresholdFilter && String(getThreshold(e.entityType, e.sector)) !== thresholdFilter) return false;
    if (dateFrom || dateTo) {
      const inRange = holdersOf(e).some((h) => {
        const d = String(h.dateBecameBo || '').slice(0, 10);
        return d && !(dateFrom && d < dateFrom) && !(dateTo && d > dateTo);
      });
      if (!inRange) return false;
    }
    return true;
  }), [entities, entityId, entityTypeFilter, sectorFilter, thresholdFilter, dateFrom, dateTo]);

  const selected = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0] || null;

  const thresholdRows = useMemo(() => buildThresholdReport(filtered), [filtered]);
  const breakdownRows = useMemo(() => buildBreakdown(filtered), [filtered]);
  const exceptionRows = useMemo(() => buildExceptions(filtered, !syncing), [filtered, syncing]);
  const complexityRows = useMemo(() => buildComplexity(filtered), [filtered]);

  const findingsByEntity = useMemo(() => {
    const map = {};
    exceptionRows.forEach((r) => {
      const m = (map[r.entity.id] = map[r.entity.id] || { danger: 0, warn: 0, info: 0 });
      m[r.severity] += 1;
    });
    return map;
  }, [exceptionRows]);
  const severityTotals = useMemo(() => {
    const t = { danger: 0, warn: 0, info: 0 };
    exceptionRows.forEach((r) => { t[r.severity] += 1; });
    return t;
  }, [exceptionRows]);

  const statusCounts = useMemo(() => {
    const c = { verified: 0, pending: 0, rejected: 0, other: 0 };
    filtered.forEach((e) => holdersOf(e).forEach((h) => {
      if (VERIFIED.includes(h.status)) c.verified += 1;
      else if (h.status === 'PENDING') c.pending += 1;
      else if (h.status === 'REJECTED') c.rejected += 1;
      else c.other += 1;
    }));
    return c;
  }, [filtered]);
  const totalUbos = statusCounts.verified + statusCounts.pending + statusCounts.rejected + statusCounts.other;
  const share = (n) => (totalUbos ? Math.round((n / totalUbos) * 100) : 0);

  const filterSummary = [
    entityId && `Entity: ${entities.find((e) => e.id === entityId)?.name || ''}`,
    entityTypeFilter && `Type: ${ENTITY_LABELS[entityTypeFilter] || entityTypeFilter}`,
    sectorFilter && `Sector: ${SECTOR_LABELS[sectorFilter] || sectorFilter}`,
    thresholdFilter && `Threshold: ${thresholdFilter}%`,
    dateFrom && `From: ${formatDate(dateFrom)}`,
    dateTo && `To: ${formatDate(dateTo)}`,
  ].filter(Boolean);
  const filtersActive = filterSummary.length > 0;
  const clearAll = () => {
    setEntityId(''); setEntityTypeFilter(''); setSectorFilter(''); setThresholdFilter(''); setDateFrom(''); setDateTo('');
  };

  /* ------------------------------ Export ------------------------------ */
  const exportSpec = useMemo(() => {
    const chains = (h) => (h.paths || []).map((p) => p.chain).join('; ');
    switch (activeTab) {
      case 'threshold':
        return {
          name: 'threshold-report',
          header: ['Entity', 'Registration', 'Type', 'Sector', 'Threshold %', 'BOs above', 'BOs below', 'Control-only', 'Total BOs'],
          rows: thresholdRows.map((r) => [r.entity.name, r.entity.registrationNumber || '', ENTITY_LABELS[r.entity.entityType] || r.entity.entityType || '',
            SECTOR_LABELS[r.entity.sector] || r.entity.sector || '', r.threshold ?? '', r.above.length, r.below.length, r.controlOnly.length, r.ubos.length]),
        };
      case 'breakdown':
      case 'tree':
        return {
          name: activeTab === 'tree' ? 'ownership-tree' : 'ownership-breakdown',
          header: ['Entity', 'Holder', 'Direct / Indirect', 'Ownership %', 'Joint', 'Chain'],
          rows: (activeTab === 'tree' ? breakdownRows.filter((r) => r.entity.id === selected?.id) : breakdownRows)
            .map(({ entity, holder }) => [entity.name, holder.fullName, isDirectHolder(holder) ? 'Direct' : 'Indirect', holder.effectivePercentage, holder.jointOwnership ? 'Yes' : 'No', chains(holder)]),
        };
      case 'exceptions':
        return { name: 'exceptions', header: ['Severity', 'Entity', 'Type', 'Finding', 'Details'],
          rows: exceptionRows.map((r) => [SEVERITY[r.severity].label, r.entity.name, r.type, r.title, r.desc]) };
      case 'complexity':
        return { name: 'complex-structures', header: ['Entity', 'Layers', 'Intermediates', 'BOs', 'Cross-ownership', 'Foreign', 'Complex'],
          rows: complexityRows.map((r) => [r.entity.name, r.layers, r.intermediates, r.holders, r.crossOwnership.length, r.isForeign ? 'Yes' : 'No', r.isComplex ? 'Yes' : 'No']) };
      case 'audit':
        return { name: 'audit-trail', header: ['Timestamp', 'Action', 'Actor', 'Entity'],
          rows: auditLogs.map((l) => [String(l.createdAt || '').replace('T', ' ').slice(0, 19), l.action, l.actorUsername || '', l.entityRef || '']) };
      default:
        return { name: 'entity-overview', header: ['Entity', 'Registration', 'Type', 'Sector', 'Threshold %', 'BOs', 'Verified', 'Pending', 'Fallback'],
          rows: filtered.map((e) => {
            const hs = holdersOf(e);
            return [e.name, e.registrationNumber || '', ENTITY_LABELS[e.entityType] || e.entityType || '', SECTOR_LABELS[e.sector] || e.sector || '',
              getThreshold(e.entityType, e.sector) ?? '', e.uboCount, hs.filter((h) => VERIFIED.includes(h.status)).length,
              hs.filter((h) => h.status === 'PENDING').length, e.fallback ? 'Yes' : 'No'];
          }) };
    }
  }, [activeTab, thresholdRows, breakdownRows, exceptionRows, complexityRows, auditLogs, filtered, selected]);

  const handleExport = (fmt) => {
    if (fmt === 'pdf') { window.print(); return; }
    const { name, header, rows } = exportSpec;
    const file = `${name}-${today()}`;
    if (fmt === 'csv') downloadFile(`\uFEFF${toCsv(header, rows)}`, `${file}.csv`, 'text/csv;charset=utf-8;');
    else if (fmt === 'excel') downloadFile(`\uFEFF${toCsv(header, rows)}`, `${file}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    else {
      const html = `<html><head><meta charset="utf-8"/><title>BO Report</title><style>
        body{font-family:Arial,sans-serif;font-size:11pt} h1{font-size:16pt} table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #333;padding:4px 8px;text-align:left} th{background:#283375;color:#fff}</style></head><body>
        <h1>Beneficial Ownership Report — ${esc(TAB_DEFS.find((t) => t.key === activeTab)?.label)}</h1>
        <p>Generated: ${esc(new Date().toLocaleString())}${filterSummary.length ? ` · ${esc(filterSummary.join(' · '))}` : ''}</p>
        <table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
      downloadFile(html, `${file}.doc`, 'application/msword;charset=utf-8;');
    }
  };

  /* ------------------------------ Tab views ------------------------------ */
  const renderOverview = () => (
    <>
      <div className="er-kpis er-printable">
        <Kpi label="Legal entities" value={filtered.length} icon={Building2} caption={`${entities.length} registered in total`} loading={loading} />
        <Kpi label="Beneficial owners" value={totalUbos} icon={Users} tone="info" caption={`Across ${filtered.filter((e) => e.tree).length} loaded entities`} loading={loading} partial={syncing} />
        <Kpi label="Verified" value={statusCounts.verified} icon={CheckCircle2} tone="success" caption={totalUbos ? `${share(statusCounts.verified)}% of beneficial owners` : 'Approved by a checker'} meter={totalUbos ? share(statusCounts.verified) : null} loading={loading} partial={syncing} />
        <Kpi label="Pending" value={statusCounts.pending} icon={Clock} tone="warn" caption={totalUbos ? `${share(statusCounts.pending)}% awaiting approval` : 'Awaiting approval'} meter={totalUbos ? share(statusCounts.pending) : null} loading={loading} partial={syncing} />
        <Kpi label="Critical findings" value={severityTotals.danger} icon={ShieldAlert} tone="danger" caption={`${severityTotals.warn} warnings · ${severityTotals.info} info`} loading={loading} partial={syncing} />
      </div>

      <div className="er-grid-2 er-printable">
        <Section title="Verification status" subtitle="Beneficial owners in the current view">
          <StatusDonut counts={statusCounts} />
        </Section>
        <Section title="Entities by sector" subtitle="Registered customers in the current view">
          <div className="er-chart"><SectorBars entities={filtered} /></div>
        </Section>
      </div>

      <Section title="Entity compliance" subtitle="Select a row to inspect its ownership structure below">
        <div className="er-tablewrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>Legal entity</th><th>Type</th><th>Sector</th><th>Threshold</th>
                <th className="num">BOs</th><th className="num">Verified / Pending</th><th>Findings</th><th className="ctr">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={8}><span className="er-spinner" />Loading entities…</EmptyRow>}
              {!loading && filtered.length === 0 && <EmptyRow cols={8}>No entities match the current filters.</EmptyRow>}
              {!loading && filtered.map((e) => {
                const hs = holdersOf(e);
                const f = findingsByEntity[e.id];
                return (
                  <tr key={e.id} className={`er-row${selected?.id === e.id ? ' er-row--sel' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(e.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(e.id); } }} aria-selected={selected?.id === e.id}>
                    <td><EntityCell e={e} /></td>
                    <td>{ENTITY_LABELS[e.entityType] || e.entityType || '—'}</td>
                    <td>{SECTOR_LABELS[e.sector] || e.sector || '—'}</td>
                    <td><ThresholdChip e={e} /></td>
                    <td className="num">{e.tree ? e.uboCount : '…'}</td>
                    <td className="num">{e.tree ? `${hs.filter((h) => VERIFIED.includes(h.status)).length} / ${hs.filter((h) => h.status === 'PENDING').length}` : '…'}</td>
                    <td>
                      {!e.tree ? <span style={{ color: 'var(--er-faint)' }}>…</span>
                        : !f ? <span className="er-chip er-chip--ok">Clean</span>
                          : (
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              {f.danger > 0 && <span className="er-chip er-chip--danger">{f.danger} critical</span>}
                              {f.warn > 0 && <span className="er-chip er-chip--warn">{f.warn} warn</span>}
                              {f.info > 0 && <span className="er-chip er-chip--info">{f.info} info</span>}
                            </span>
                          )}
                    </td>
                    <td className="ctr">{e.fallback ? <span className="er-chip er-chip--warn">Yes</span> : <span style={{ color: 'var(--er-faint)' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {selected?.tree && (
        <>
          <div className="er-printable"><ChainSummary entity={selected} /></div>
          <Section title={`Ownership tree — ${selected.name}`} subtitle="Entity, intermediates, beneficial owners and control">
            <div className="er-card__body"><OwnershipTreeReport entity={selected} /></div>
          </Section>
        </>
      )}
    </>
  );

  const renderThreshold = () => (
    <Section no="1–7" title="Threshold-based BO report" subtitle="Direct, indirect and joint ownership against the applicable threshold">
      <div className="er-tablewrap">
        <table className="er-table">
          <thead>
            <tr><th>Legal entity</th><th>Type</th><th>Sector</th><th>Threshold</th><th className="num">At / above</th><th className="num">Below</th><th className="num">Control-only</th><th className="num">Total BOs</th></tr>
          </thead>
          <tbody>
            {thresholdRows.length === 0 && <EmptyRow cols={8}>No data</EmptyRow>}
            {thresholdRows.map((r) => (
              <tr key={r.entity.id} className="er-row">
                <td><EntityCell e={r.entity} /></td>
                <td>{ENTITY_LABELS[r.entity.entityType] || r.entity.entityType || '—'}</td>
                <td>{SECTOR_LABELS[r.entity.sector] || r.entity.sector || '—'}</td>
                <td><ThresholdChip e={r.entity} /></td>
                <td className="num">{r.above.length}</td>
                <td className="num">{r.below.length > 0 ? <span className="er-chip er-chip--warn">{r.below.length}</span> : 0}</td>
                <td className="num">{r.controlOnly.length}</td>
                <td className="num"><strong>{r.ubos.length}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const renderBreakdown = () => (
    <Section no="8" title="Detailed ownership breakdown" subtitle="Direct, indirect, joint and combined ownership per beneficial owner">
      <div className="er-tablewrap">
        <table className="er-table">
          <thead>
            <tr><th>Entity</th><th>Holder</th><th>Direct / Indirect</th><th className="num">Ownership %</th><th className="ctr">Joint</th><th>Chain</th></tr>
          </thead>
          <tbody>
            {breakdownRows.length === 0 && <EmptyRow cols={6}>No data</EmptyRow>}
            {breakdownRows.map(({ entity, holder: h }, i) => (
              <tr key={`${entity.id}-${h.key}-${i}`} className="er-row">
                <td>{entity.name}</td>
                <td><strong>{h.fullName}</strong></td>
                <td><span className={`er-chip ${isDirectHolder(h) ? 'er-chip--ok' : 'er-chip--info'}`}>{isDirectHolder(h) ? 'Direct' : 'Indirect'}</span></td>
                <td className="num">{h.effectivePercentage}%</td>
                <td className="ctr">{h.jointOwnership ? <span className="er-chip er-chip--warn">Joint</span> : '—'}</td>
                <td><span className="er-mono">{(h.paths || []).map((p) => p.chain).join('; ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const renderExceptions = () => {
    const visible = sevFilter === 'all' ? exceptionRows : exceptionRows.filter((r) => r.severity === sevFilter);
    return (
      <>
        <div className="er-kpis er-printable" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Kpi label="Critical" value={severityTotals.danger} icon={ShieldAlert} tone="danger" caption="Require action" loading={loading} partial={syncing} />
          <Kpi label="Warnings" value={severityTotals.warn} icon={AlertTriangle} tone="warn" caption="Data-quality issues" loading={loading} partial={syncing} />
          <Kpi label="Info" value={severityTotals.info} icon={FileText} tone="info" caption="For review" loading={loading} partial={syncing} />
          <Kpi label="Total findings" value={exceptionRows.length} icon={Building2} caption={`Across ${filtered.length} entities`} loading={loading} partial={syncing} />
        </div>
        <Section no="9" title="Data-quality & exception report" subtitle="Missing IDs, expired documents, duplicates, circular ownership, threshold violations, inconsistent percentages">
          <div className="er-sevbar er-no-print">
            {[['all', `All (${exceptionRows.length})`], ['danger', `Critical (${severityTotals.danger})`], ['warn', `Warnings (${severityTotals.warn})`], ['info', `Info (${severityTotals.info})`]].map(([k, label]) => (
              <button key={k} type="button" className={`er-sevbtn${sevFilter === k ? ' er-sevbtn--active' : ''}`} onClick={() => setSevFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="er-tablewrap">
            <table className="er-table">
              <thead><tr><th>Severity</th><th>Finding</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {visible.length === 0 && <EmptyRow cols={4}>{syncing ? 'Checking entities…' : 'No exceptions found — all entities passed the data-quality checks.'}</EmptyRow>}
                {visible.map((r, i) => (
                  <tr key={i} className="er-row">
                    <td><span className="er-chip" style={{ background: SEVERITY[r.severity].soft, color: SEVERITY[r.severity].color }}>{SEVERITY[r.severity].label}</span></td>
                    <td><strong>{r.title}</strong></td>
                    <td>{r.entity.name}</td>
                    <td style={{ color: 'var(--er-muted)' }}>{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </>
    );
  };

  const renderComplexity = () => (
    <Section no="10" title="Complex ownership structures" subtitle="Multi-layer, cross-ownership and foreign structures">
      <div className="er-tablewrap">
        <table className="er-table">
          <thead>
            <tr><th>Entity</th><th className="num">Layers</th><th className="num">Intermediates</th><th className="num">BOs</th><th className="num">Cross-ownership</th><th className="ctr">Foreign</th><th className="ctr">Complex</th></tr>
          </thead>
          <tbody>
            {complexityRows.length === 0 && <EmptyRow cols={7}>No data</EmptyRow>}
            {complexityRows.map((r) => (
              <tr key={r.entity.id} className="er-row">
                <td><EntityCell e={r.entity} /></td>
                <td className="num">{r.layers}</td>
                <td className="num">{r.intermediates}</td>
                <td className="num">{r.holders}</td>
                <td className="num">{r.crossOwnership.length}</td>
                <td className="ctr">{r.isForeign ? <span className="er-chip er-chip--warn">Foreign</span> : '—'}</td>
                <td className="ctr">{r.isComplex ? <span className="er-chip er-chip--info">Complex</span> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const renderTree = () => {
    if (!selected?.tree) {
      return (
        <div className="er-card">
          <div className="er-empty-card">
            <Building2 size={32} />
            <strong>Select a legal entity</strong>
            <span>{syncing ? 'Ownership structures are still loading…' : 'Choose an entity in the filters above to view its ownership tree.'}</span>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="er-printable"><ChainSummary entity={selected} /></div>
        <Section no="11" title={`Ownership / control tree — ${selected.name}`} subtitle="Entities, persons, percentages and layers">
          <div className="er-card__body"><OwnershipTreeReport entity={selected} /></div>
        </Section>
      </>
    );
  };

  const renderAudit = () => (
    <Section title="Audit trail" subtitle="BO changes, exports and reviewer actions (latest 100)">
      <div className="er-tablewrap">
        <table className="er-table">
          <thead><tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Entity</th></tr></thead>
          <tbody>
            {auditLoading && <EmptyRow cols={4}><span className="er-spinner" />Loading audit entries…</EmptyRow>}
            {!auditLoading && auditLogs.length === 0 && <EmptyRow cols={4}>No audit entries yet.</EmptyRow>}
            {!auditLoading && auditLogs.map((l) => (
              <tr key={l.id} className="er-row">
                <td><span className="er-mono">{String(l.createdAt || '').replace('T', ' ').slice(0, 19)}</span></td>
                <td>{l.action}</td>
                <td>{l.actorUsername || '—'}</td>
                <td><span className="er-mono">{l.entityRef || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );

  const tabCount = (key) => (key === 'exceptions' && !syncing ? severityTotals.danger : null);

  return (
    <div className="er-root">
      <style>{css}</style>

      {/* Print-only report header */}
      <div className="er-print-only">
        <h1>Beneficial Ownership Report — {TAB_DEFS.find((t) => t.key === activeTab)?.label}</h1>
        <p>Generated {generatedAt.toLocaleString()} · {filtered.length} of {entities.length} entities</p>
        {filterSummary.length > 0 && <p>Filters: {filterSummary.join(' · ')}</p>}
      </div>

      <header className="er-head er-no-print">
        <div>
          <div className="er-eyebrow">Compliance reporting</div>
          <h1 className="er-title">Beneficial ownership reports</h1>
          <div className="er-meta">
            <span>Generated {generatedAt.toLocaleString()}</span>
            <span>{filtered.length} of {entities.length} entities in scope</span>
            {filtersActive && <span className="er-pill"><Filter size={11} /> Filtered</span>}
          </div>
        </div>
        <div className="er-actions">
          <ExportMenu onExport={handleExport} disabled={loading} />
        </div>
      </header>

      {error && <div className="er-banner er-banner--err er-no-print"><AlertTriangle size={14} /><span>{error}</span></div>}
      {syncing && (
        <div className="er-banner er-no-print" role="status">
          <div className="er-progress"><div style={{ width: `${loadPct}%` }} /></div>
          <span>Loading ownership structures — {loadedCount + failed} of {entities.length} entities. Totals and findings update as they arrive.</span>
        </div>
      )}
      {!syncing && failed > 0 && (
        <div className="er-banner er-banner--warn er-no-print" role="alert">
          <AlertTriangle size={14} /><span>{failed} {failed === 1 ? 'entity' : 'entities'} could not be loaded — figures may be incomplete. Refresh to retry.</span>
        </div>
      )}

      <nav className="er-tabs er-no-print" aria-label="Reports">
        {TAB_DEFS.map((t) => {
          const count = tabCount(t.key);
          return (
            <button key={t.key} type="button" className={`er-tab${activeTab === t.key ? ' er-tab--active' : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
              {count > 0 && <span className="er-tab__count er-tab__count--danger">{count}</span>}
            </button>
          );
        })}
      </nav>

      <div className="er-filters er-no-print">
        <div className="er-filters__head">
          <Filter size={12} /> Filters
          <span className="grow" />
          {filtersActive && <Btn variant="ghost" icon={<X size={12} />} onClick={clearAll}>Clear all</Btn>}
        </div>
        <div className="er-filter-grid">
          <EntityCombo
            options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))}
            value={entityId} onChange={(v) => { setEntityId(v); setSelectedId(''); }} loading={loading}
          />
          <Field label="Entity type">
            <select className="er-input" value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Sector">
            <select className="er-input" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
              <option value="">All sectors</option>
              {Object.entries(SECTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Threshold">
            <select className="er-input" value={thresholdFilter} onChange={(e) => setThresholdFilter(e.target.value)}>
              <option value="">Any</option>
              {['2', '5', '10', '25'].map((t) => <option key={t} value={t}>{t}%</option>)}
            </select>
          </Field>
          <Field label="BO since (from)">
            <input className="er-input" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="BO since (to)">
            <input className="er-input" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <div className="er-count"><strong>{filtered.length}</strong> of {entities.length} entities</div>
        </div>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'threshold' && renderThreshold()}
      {activeTab === 'breakdown' && renderBreakdown()}
      {activeTab === 'exceptions' && renderExceptions()}
      {activeTab === 'complexity' && renderComplexity()}
      {activeTab === 'tree' && renderTree()}
      {activeTab === 'audit' && renderAudit()}
    </div>
  );
}
