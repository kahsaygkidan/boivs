import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Building2, Users, Search, Filter, Link2, Download, Printer, AlertTriangle, X,
  ChevronDown, CheckCircle2, Clock, ShieldAlert, FileText, Phone,
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

/* Beneficial-owner status filter (APPROVED is treated as VERIFIED) */
const VERIFIED = ['VERIFIED', 'APPROVED'];
const STATUS_OPTIONS = [
  ['VERIFIED', 'Verified'],
  ['PENDING', 'Pending'],
  ['REJECTED', 'Rejected'],
  ['DRAFT', 'Draft'],
  ['CEASED', 'Ceased'],
  ['NOT_REGISTERED', 'Not yet registered'],
];
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS);
const STATUS_TONE = { VERIFIED: 'ok', PENDING: 'warn', REJECTED: 'danger', DRAFT: 'muted', CEASED: 'muted', NOT_REGISTERED: 'muted' };

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
const holderStatus = (h) => {
  const s = String(h.status || '').toUpperCase();
  if (VERIFIED.includes(s)) return 'VERIFIED';
  return s || 'NOT_REGISTERED';
};
/* Beneficial owners of an entity, optionally narrowed to one status */
const holdersOf = (e, status = '') =>
  (e.tree?.holders || []).filter((h) => h.ubo && (!status || holderStatus(h) === status));
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
function buildThresholdReport(entities, status) {
  return entities.map((e) => {
    const holders = holdersOf(e, status);
    const threshold = getThreshold(e.entityType, e.sector);
    const above = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) >= threshold) : [];
    const below = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) < threshold) : [];
    const controlOnly = (e.tree?.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
    return { entity: e, threshold, above, below, controlOnly, ubos: holders };
  });
}

function buildBreakdown(entities, status) {
  return entities.flatMap((e) => holdersOf(e, status).map((h) => ({ entity: e, holder: h })));
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

const StatusChip = ({ holder }) => {
  const key = holderStatus(holder);
  return <span className={`er-chip er-chip--${STATUS_TONE[key] || 'muted'}`}>{STATUS_LABEL[key] || key}</span>;
};

const PhoneLink = ({ value }) => {
  if (!value) return <span style={{ color: 'var(--er-faint)' }}>—</span>;
  return (
    <a className="er-d-phone" href={`tel:${String(value).replace(/[^\d+]/g, '')}`}>
      <Phone size={12} />{value}
    </a>
  );
};

const EmptyRow = ({ cols, children }) => <tr><td colSpan={cols} className="er-empty">{children}</td></tr>;

/* ==========================================================================
   Entity detail — profile, its beneficial owners (with phone) and fallback
   ========================================================================== */
const detailCss = `
.er-d-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:14px 20px; margin:0; padding:18px 20px; border-bottom:1px solid var(--er-border, #e5e7eb); }
.er-d-item dt { margin:0 0 3px; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--er-muted, #64748b); }
.er-d-item dd { margin:0; font-size:13.5px; font-weight:600; word-break:break-word; }
.er-d-sub { display:flex; align-items:center; gap:8px; padding:16px 20px 8px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--er-muted, #64748b); }
.er-d-phone { display:inline-flex; align-items:center; gap:6px; color:inherit; text-decoration:none; white-space:nowrap; font-variant-numeric:tabular-nums; }
.er-d-phone:hover { color:var(--er-primary, #3b5bdb); text-decoration:underline; }
.er-d-person { min-width:170px; }
.er-d-person__name { display:flex; align-items:center; gap:6px; font-weight:650; }
.er-d-person__id { font-size:12px; color:var(--er-muted, #64748b); font-family:ui-monospace, Menlo, monospace; }
.er-d-fallback { margin:6px 20px 20px; padding:16px 18px; border:1px solid rgba(217, 119, 6, .35); background:rgba(217, 119, 6, .06); border-radius:14px; }
.er-d-fallback__head { display:flex; align-items:center; gap:10px; margin-bottom:12px; font-weight:700; }
.er-d-fallback .er-d-grid { padding:0; border:0; }
.er-d-hint { padding:22px 20px; font-size:13px; color:var(--er-muted, #64748b); text-align:center; }
`;

function EntityDetail({ entity, status }) {
  if (!entity) return null;
  const th = getThreshold(entity.entityType, entity.sector);
  const ubos = holdersOf(entity, status);
  const fb = entity.fallback;

  const profile = [
    ['Registration no.', entity.registrationNumber || '—'],
    ['Entity type', ENTITY_LABELS[entity.entityType] || entity.entityType || '—'],
    ['Sector', SECTOR_LABELS[entity.sector] || entity.sector || '—'],
    ['Threshold', th != null ? `≥ ${th}%` : 'Special'],
    ['TIN', entity.tin || '—'],
    ['CIF number', entity.cifNumber || '—'],
    ['Country', entity.countryOfIncorporation || '—'],
  ];

  return (
    <Section title={entity.name} subtitle="Legal entity profile, beneficial owners and senior-official fallback">
      <dl className="er-d-grid">
        {profile.map(([k, v]) => (
          <div className="er-d-item" key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>

      {!entity.tree ? (
        <div className="er-d-hint">Ownership structure is still loading…</div>
      ) : (
        <>
          <div className="er-d-sub"><Users size={13} /> Beneficial owners ({ubos.length}){status ? ` · ${STATUS_LABEL[status]}` : ''}</div>
          {ubos.length === 0 ? (
            <div className="er-d-hint">
              {status
                ? `No beneficial owners with status “${STATUS_LABEL[status]}” for this entity.`
                : (fb ? 'No natural-person beneficial owner — the senior managing official is recorded as the fallback below.' : 'No beneficial owner or fallback recorded for this entity.')}
            </div>
          ) : (
            <div className="er-tablewrap">
              <table className="er-table">
                <thead>
                  <tr>
                    <th>Beneficial owner</th><th>Phone</th><th>Email</th><th>Nationality</th>
                    <th className="num">Ownership</th><th>Status</th><th>BO since</th>
                  </tr>
                </thead>
                <tbody>
                  {ubos.map((h, i) => (
                    <tr key={`${h.key}-${i}`} className="er-row">
                      <td>
                        <div className="er-d-person">
                          <div className="er-d-person__name">
                            {h.fullName || '—'}
                            {h.pep && <span className="er-chip er-chip--danger">PEP</span>}
                          </div>
                          <div className="er-d-person__id">{h.idNumber || 'No ID number'}</div>
                        </div>
                      </td>
                      <td><PhoneLink value={h.phoneNumber} /></td>
                      <td>{h.emailAddress || <span style={{ color: 'var(--er-faint)' }}>—</span>}</td>
                      <td>{h.nationality || '—'}</td>
                      <td className="num">
                        <strong>{h.effectivePercentage}%</strong>{' '}
                        <span className={`er-chip ${isDirectHolder(h) ? 'er-chip--ok' : 'er-chip--info'}`}>{isDirectHolder(h) ? 'Direct' : 'Indirect'}</span>
                      </td>
                      <td><StatusChip holder={h} /></td>
                      <td>{formatDate(h.dateBecameBo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fb && (
            <>
              <div className="er-d-sub"><ShieldAlert size={13} /> Senior managing official (fallback)</div>
              <div className="er-d-fallback">
                <div className="er-d-fallback__head">{fb.name}<span className="er-chip er-chip--warn">Fallback</span></div>
                <dl className="er-d-grid">
                  <div className="er-d-item"><dt>Position</dt><dd>{fb.position || '—'}</dd></div>
                  <div className="er-d-item"><dt>Phone</dt><dd><PhoneLink value={fb.phoneNumber} /></dd></div>
                  <div className="er-d-item" style={{ gridColumn: '1 / -1' }}><dt>Reasonable measures taken</dt><dd style={{ fontWeight: 500 }}>{fb.justification || '—'}</dd></div>
                </dl>
              </div>
            </>
          )}
        </>
      )}
    </Section>
  );
}

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
        <div className="er-donut__center"><strong>{total}</strong><span>UBOs</span></div>
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
   Main component
   ========================================================================== */
const TAB_DEFS = [
  { key: 'overview', label: 'Overview' },
  { key: 'threshold', label: 'Threshold report' },
  { key: 'breakdown', label: 'Ownership breakdown' },
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
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState('');

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
    const scoped = holdersOf(e, statusFilter);
    if (statusFilter && scoped.length === 0) return false;
    if (dateFrom || dateTo) {
      const inRange = scoped.some((h) => {
        const d = String(h.dateBecameBo || '').slice(0, 10);
        return d && !(dateFrom && d < dateFrom) && !(dateTo && d > dateTo);
      });
      if (!inRange) return false;
    }
    return true;
  }), [entities, entityId, entityTypeFilter, sectorFilter, thresholdFilter, statusFilter, dateFrom, dateTo]);

  /* The entity whose detail is shown: a clicked row, the entity filter, or the only entity in scope */
  const focus = entities.find((e) => e.id === (selectedId || entityId)) || (filtered.length === 1 ? filtered[0] : null);
  /* The Visual tree tab always needs an entity */
  const selected = focus || filtered[0] || null;

  const thresholdRows = useMemo(() => buildThresholdReport(filtered, statusFilter), [filtered, statusFilter]);
  const breakdownRows = useMemo(() => buildBreakdown(filtered, statusFilter), [filtered, statusFilter]);

  const statusCounts = useMemo(() => {
    const c = { verified: 0, pending: 0, rejected: 0, other: 0 };
    filtered.forEach((e) => holdersOf(e, statusFilter).forEach((h) => {
      const s = holderStatus(h);
      if (s === 'VERIFIED') c.verified += 1;
      else if (s === 'PENDING') c.pending += 1;
      else if (s === 'REJECTED') c.rejected += 1;
      else c.other += 1;
    }));
    return c;
  }, [filtered, statusFilter]);
  const totalUbos = statusCounts.verified + statusCounts.pending + statusCounts.rejected + statusCounts.other;
  const share = (n) => (totalUbos ? Math.round((n / totalUbos) * 100) : 0);
  const fallbackCount = filtered.filter((e) => e.fallback).length;

  const filterSummary = [
    entityId && `Entity: ${entities.find((e) => e.id === entityId)?.name || ''}`,
    entityTypeFilter && `Type: ${ENTITY_LABELS[entityTypeFilter] || entityTypeFilter}`,
    sectorFilter && `Sector: ${SECTOR_LABELS[sectorFilter] || sectorFilter}`,
    thresholdFilter && `Threshold: ${thresholdFilter}%`,
    statusFilter && `Status: ${STATUS_LABEL[statusFilter]}`,
    dateFrom && `From: ${formatDate(dateFrom)}`,
    dateTo && `To: ${formatDate(dateTo)}`,
  ].filter(Boolean);
  const filtersActive = filterSummary.length > 0;
  const clearAll = () => {
    setEntityId(''); setEntityTypeFilter(''); setSectorFilter(''); setThresholdFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('');
  };

  /* ------------------------------ Export ------------------------------ */
  const exportSpec = useMemo(() => {
    const chains = (h) => (h.paths || []).map((p) => p.chain).join('; ');
    switch (activeTab) {
      case 'threshold':
        return {
          name: 'threshold-report',
          header: ['Entity', 'Registration', 'Type', 'Sector', 'Threshold %', 'BOs at/above', 'BOs below', 'Control-only', 'Total BOs'],
          rows: thresholdRows.map((r) => [r.entity.name, r.entity.registrationNumber || '', ENTITY_LABELS[r.entity.entityType] || r.entity.entityType || '',
            SECTOR_LABELS[r.entity.sector] || r.entity.sector || '', r.threshold ?? '', r.above.length, r.below.length, r.controlOnly.length, r.ubos.length]),
        };
      case 'breakdown':
      case 'tree':
        return {
          name: activeTab === 'tree' ? 'ownership-tree' : 'ownership-breakdown',
          header: ['Entity', 'Holder', 'ID number', 'Phone', 'Email', 'Direct / Indirect', 'Ownership %', 'Status', 'Joint', 'Chain'],
          rows: (activeTab === 'tree' ? breakdownRows.filter((r) => r.entity.id === selected?.id) : breakdownRows)
            .map(({ entity, holder }) => [entity.name, holder.fullName, holder.idNumber || '', holder.phoneNumber || '', holder.emailAddress || '',
              isDirectHolder(holder) ? 'Direct' : 'Indirect', holder.effectivePercentage, STATUS_LABEL[holderStatus(holder)] || holderStatus(holder),
              holder.jointOwnership ? 'Yes' : 'No', chains(holder)]),
        };
      case 'audit':
        return { name: 'audit-trail', header: ['Timestamp', 'Action', 'Actor', 'Entity'],
          rows: auditLogs.map((l) => [String(l.createdAt || '').replace('T', ' ').slice(0, 19), l.action, l.actorUsername || '', l.entityRef || '']) };
      default:
        return { name: 'entity-overview', header: ['Entity', 'Registration', 'Type', 'Sector', 'Threshold %', 'BOs', 'Verified', 'Pending', 'Fallback'],
          rows: filtered.map((e) => {
            const hs = holdersOf(e, statusFilter);
            return [e.name, e.registrationNumber || '', ENTITY_LABELS[e.entityType] || e.entityType || '', SECTOR_LABELS[e.sector] || e.sector || '',
              getThreshold(e.entityType, e.sector) ?? '', hs.length, hs.filter((h) => holderStatus(h) === 'VERIFIED').length,
              hs.filter((h) => holderStatus(h) === 'PENDING').length, e.fallback ? 'Yes' : 'No'];
          }) };
    }
  }, [activeTab, thresholdRows, breakdownRows, auditLogs, filtered, selected, statusFilter]);

  const handleExport = (fmt) => {
    const { name, header, rows } = exportSpec;
    const reportTitle = `Beneficial Ownership Report - ${TAB_DEFS.find((t) => t.key === activeTab)?.label || 'Overview'}`;
    const generated = new Date().toLocaleString();
    const file = `${name}-${today()}`;
    const safeCell = (value) => {
      const text = String(value ?? '');
      // Prevent spreadsheet formula execution when exported data is opened in Excel.
      return /^[\s]*[=+@]/.test(text) || /^[\s]*-/.test(text) ? `'${text}` : text;
    };
    const tableHead = header.map((cell) => `<th>${esc(cell)}</th>`).join('');
    const tableBody = rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td class="empty" colspan="${Math.max(header.length, 1)}">No report records match the selected filters.</td></tr>`;
    const commonHtml = (heading) => `<!doctype html>
      <html><head><meta charset="utf-8"/><title>${esc(heading)}</title>
      <style>
        *{box-sizing:border-box}body{font:10pt/1.45 Arial,Helvetica,sans-serif;color:#172033;margin:0}
        .report-head{border-bottom:3px solid #0b2a5b;padding:0 0 12px;margin-bottom:14px}
        .report-brand{display:flex;align-items:center;gap:13px;margin-bottom:8px;min-height:54px}
        .report-logo{display:block;width:auto;height:48px;max-width:190px;object-fit:contain}
        .brand{color:#0b2a5b;font-size:9pt;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}
        .brand-sub{margin-top:3px;color:#64748b;font-size:8pt}
        h1{margin:5px 0;color:#102a50;font-size:19pt}.meta{margin:3px 0;color:#526176;font-size:9pt}
        .scope{margin:12px 0;padding:9px 11px;border:1px solid #d8e0eb;background:#f5f8fc}
        table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}
        tr{break-inside:avoid;page-break-inside:avoid}th{padding:8px 7px;background:#0b2a5b;color:#fff;text-align:left;font-size:8.5pt;border:1px solid #0b2a5b}
        td{padding:7px;border:1px solid #d7dee8;vertical-align:top;overflow-wrap:anywhere;font-size:8.5pt}
        tbody tr:nth-child(even){background:#f6f8fb}.empty{text-align:center;color:#64748b;padding:18px}
        .foot{margin-top:12px;color:#64748b;font-size:8pt}
        @page{size:landscape;margin:14mm}
        @media screen{body{padding:22px}.print-action{margin-bottom:16px;padding:9px 15px;border:0;border-radius:7px;background:#0b2a5b;color:#fff;cursor:pointer}}
        @media print{.print-action{display:none}}
      </style></head><body>
      <div class="report-head"><div class="report-brand">
        <img class="report-logo" src="/dashenlogo.png" alt="Dashen Bank logo" onerror="this.style.display='none'" />
        <div><div class="brand">Dashen Bank</div><div class="brand-sub">Compliance reporting</div></div>
      </div><h1>${esc(heading)}</h1><p class="meta">Generated: ${esc(generated)} · Records: ${rows.length}</p></div>
      <div class="scope"><strong>Applied filters:</strong> ${filterSummary.length ? esc(filterSummary.join(' · ')) : 'None'}</div>
      <table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
      <p class="foot">Confidential · Beneficial Ownership Reporting</p>`;

    if (fmt === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        window.alert('The print window was blocked. Please allow pop-ups for this site and try again.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(`<button class="print-action" onclick="window.print()">Print / Save as PDF</button>${commonHtml(reportTitle)}<script>window.addEventListener('load',()=>{window.focus();window.print();});</script></body></html>`);
      printWindow.document.close();
      return;
    }

    if (fmt === 'csv') {
      const csv = [header, ...rows].map((row) => row.map((value) => `"${safeCell(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      downloadFile(`\uFEFF${csv}`, `${file}.csv`, 'text/csv;charset=utf-8;');
      return;
    }

    if (fmt === 'excel') {
      // Excel-readable HTML workbook; keeps the correct .xls extension and table structure.
      const excelHtml = `${commonHtml(reportTitle)}</body></html>`;
      downloadFile(`\uFEFF${excelHtml}`, `${file}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }

    if (fmt === 'word') {
      const wordHtml = `${commonHtml(reportTitle)}</body></html>`;
      downloadFile(`\uFEFF${wordHtml}`, `${file}.doc`, 'application/msword;charset=utf-8;');
    }
  };

  /* ------------------------------ Tab views ------------------------------ */
  const renderOverview = () => (
    <>




      <Section title="Entity compliance" subtitle="Select a row to see its beneficial owners, phone numbers and fallback below">
        <div className="er-tablewrap">
          <table className="er-table">
            <thead>
              <tr>
                <th>Legal entity</th><th>Type</th><th>Sector</th><th>Threshold</th>
                <th className="num">BOs</th><th className="num">Verified / Pending</th><th className="ctr">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {loading && <EmptyRow cols={7}><span className="er-spinner" />Loading entities…</EmptyRow>}
              {!loading && filtered.length === 0 && <EmptyRow cols={7}>No entities match the current filters.</EmptyRow>}
              {!loading && filtered.map((e) => {
                const hs = holdersOf(e, statusFilter);
                return (
                  <tr
                    key={e.id}
                    className={`er-row${focus?.id === e.id ? ' er-row--sel' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedId(e.id)}
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(e.id); } }}
                    aria-selected={focus?.id === e.id}
                  >
                    <td><EntityCell e={e} /></td>
                    <td>{ENTITY_LABELS[e.entityType] || e.entityType || '—'}</td>
                    <td>{SECTOR_LABELS[e.sector] || e.sector || '—'}</td>
                    <td><ThresholdChip e={e} /></td>
                    <td className="num">{e.tree ? hs.length : '…'}</td>
                    <td className="num">{e.tree ? `${hs.filter((h) => holderStatus(h) === 'VERIFIED').length} / ${hs.filter((h) => holderStatus(h) === 'PENDING').length}` : '…'}</td>
                    <td className="ctr">{e.fallback ? <span className="er-chip er-chip--warn">Yes</span> : <span style={{ color: 'var(--er-faint)' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {focus ? (
        <>
          <EntityDetail entity={focus} status={statusFilter} />
          {focus.tree && (
            <>
              <div className="er-printable"><ChainSummary entity={focus} /></div>
              <Section title={`Ownership tree — ${focus.name}`} subtitle="Entity, intermediates, beneficial owners and control">
                <div className="er-card__body"><OwnershipTreeReport entity={focus} /></div>
              </Section>
            </>
          )}
        </>
      ) : (
        !loading && filtered.length > 1 && (
          <div className="er-card er-no-print"><div className="er-d-hint">Select an entity above, or filter by legal entity, to see its beneficial owners and fallback.</div></div>
        )
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
    <Section no="8" title="Detailed ownership breakdown" subtitle="Direct, indirect, joint and combined ownership per beneficial owner, with contact details">
      <div className="er-tablewrap">
        <table className="er-table">
          <thead>
            <tr><th>Entity</th><th>Holder</th><th>Phone</th><th>Direct / Indirect</th><th className="num">Ownership %</th><th>Status</th><th className="ctr">Joint</th><th>Chain</th></tr>
          </thead>
          <tbody>
            {breakdownRows.length === 0 && <EmptyRow cols={8}>No data</EmptyRow>}
            {breakdownRows.map(({ entity, holder: h }, i) => (
              <tr key={`${entity.id}-${h.key}-${i}`} className="er-row">
                <td>{entity.name}</td>
                <td>
                  <strong>{h.fullName}</strong>
                  <div className="er-d-person__id">{h.idNumber || ''}</div>
                </td>
                <td><PhoneLink value={h.phoneNumber} /></td>
                <td><span className={`er-chip ${isDirectHolder(h) ? 'er-chip--ok' : 'er-chip--info'}`}>{isDirectHolder(h) ? 'Direct' : 'Indirect'}</span></td>
                <td className="num">{h.effectivePercentage}%</td>
                <td><StatusChip holder={h} /></td>
                <td className="ctr">{h.jointOwnership ? <span className="er-chip er-chip--warn">Joint</span> : '—'}</td>
                <td><span className="er-mono">{(h.paths || []).map((p) => p.chain).join('; ')}</span></td>
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
        <EntityDetail entity={selected} status={statusFilter} />
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

  return (
    <div className="er-root">
      <style>{detailCss}</style>

      {/* Print-only report header */}
      <div className="er-print-only">
        <h1>Beneficial Ownership Report - {TAB_DEFS.find((t) => t.key === activeTab)?.label}</h1>
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
          <ExportMenu onExport={handleExport} disabled={loading || syncing || (activeTab === 'audit' && auditLoading)} />
        </div>
      </header>

      {error && <div className="er-banner er-banner--err er-no-print"><AlertTriangle size={14} /><span>{error}</span></div>}
      {syncing && (
        <div className="er-banner er-no-print" role="status">
          <div className="er-progress"><div style={{ width: `${loadPct}%` }} /></div>
          <span>Loading ownership structures - {loadedCount + failed} of {entities.length} entities. Totals update as they arrive.</span>
        </div>
      )}
      {!syncing && failed > 0 && (
        <div className="er-banner er-banner--warn er-no-print" role="alert">
          <AlertTriangle size={14} /><span>{failed} {failed === 1 ? 'entity' : 'entities'} could not be loaded - figures may be incomplete. Refresh to retry.</span>
        </div>
      )}

      <nav className="er-tabs er-no-print" aria-label="Reports">
        {TAB_DEFS.map((t) => (
          <button key={t.key} type="button" className={`er-tab${activeTab === t.key ? ' er-tab--active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
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
          <Field label="BO status">
            <select className="er-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
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
      {activeTab === 'tree' && renderTree()}
      {activeTab === 'audit' && renderAudit()}
    </div>
  );
}