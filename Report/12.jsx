import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  listLegalPersons, getOwnershipTree, listAuditLogs,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import {
  Building2, Users, User, Search, Calendar, Filter, Link2, PieChart as PieIcon,
  GitBranch, Download, Printer, AlertTriangle, Copy, X,
} from 'lucide-react';
import '../styles/Reports.css';

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
const isForeignEntity = (entityType) => entityType === 'FOREIGN_LEGAL_PERSON';
const formatDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};

/* ==========================================================================
   Small UI
   ========================================================================== */
function Btn({ variant = 'primary', size = 'sm', icon, children, ...props }) {
  const cls = `rep-btn rep-btn--${variant} rep-btn--${size}`;
  return (
    <button type="button" className={cls} {...props}>
      {icon}{children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="rep-field">
      <span className="rep-field__label">{label}</span>
      {children}
    </label>
  );
}

/* Searchable combobox for entities */
function EntityCombo({ options, value, onChange, placeholder = 'Search entity…', loading }) {
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
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
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
    <Field label="Legal entity">
      <div className="rep-combo" ref={ref}>
        <span className="rep-combo__icon"><Search size={14} /></span>
        <input
          className="rep-input rep-input--combo"
          type="text"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          value={open ? query : (selected ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : '')}
          placeholder={loading ? 'Loading…' : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul className="rep-combo__list" role="listbox">
            {filtered.length === 0 && <li className="rep-combo__empty">No entity found</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`rep-combo__item${i === hi ? ' rep-combo__item--hi' : ''}${o.value === value ? ' rep-combo__item--selected' : ''}`}
              >
                <span>{o.label}</span>
                {o.sub && <span className="rep-combo__sub">{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

/* ==========================================================================
   Ownership tree diagram
   ========================================================================== */
function TreeNodeBox({ kind, label, sub, holder }) {
  let cls = 'rep-tree-node';
  if (kind === 'entity') cls += ' rep-tree-node--entity';
  else if (kind === 'intermediate') cls += ' rep-tree-node--intermediate';
  else if (kind === 'fallback') cls += ' rep-tree-node--fallback';
  else cls += holder && isDirectHolder(holder) ? ' rep-tree-node--ubo-direct' : ' rep-tree-node--ubo-indirect';

  return (
    <div className={cls}>
      <span className="rep-tree-node__icon">
        {kind === 'ubo' || kind === 'fallback' ? <User size={12} /> : <Building2 size={12} />}
      </span>
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
  const controlOnly = (tree.holders || []).filter(
    (h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl),
  );
  const fallback = tree.seniorManagingOfficial;
  const allHolders = [...ubos, ...controlOnly];

  const intermediateMap = new Map();
  allHolders.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) {
        const name = parts[i];
        if (!intermediateMap.has(name)) intermediateMap.set(name, { name, parent: null });
      }
    });
  });
  allHolders.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) {
        const name = parts[i];
        if (i > 1) {
          const parentName = parts[i - 1];
          if (intermediateMap.has(parentName)) intermediateMap.get(name).parent = parentName;
        }
      }
    });
  });

  const intermediates = Array.from(intermediateMap.values());
  const rootIntermediates = intermediates.filter((it) => !it.parent);
  const attachUbos = (parentName) => allHolders.filter((h) => {
    const parts = (h.paths || []).map((p) => splitChain(p.chain)).find(Boolean) || [];
    if (parentName === null) return parts.length === 2;
    return parts.length > 2 && parts[parts.length - 2] === parentName;
  });

  const buildNode = (name) => {
    const children = intermediates.filter((x) => x.parent === name);
    return { name, childrenIntermediates: children.map((c) => buildNode(c.name)), ubos: attachUbos(name) };
  };

  const topNodes = rootIntermediates.map((it) => buildNode(it.name));
  const directUbos = attachUbos(null);

  return (
    <div className="rep-tree">
      <div className="rep-tree__stage">
        <TreeNodeBox
          kind="entity"
          label={entity.name}
          sub={entity.registrationNumber ? `Reg. ${entity.registrationNumber}` : 'Legal entity'}
        />

        {(topNodes.length > 0 || directUbos.length > 0) && <div className="rep-tree__vline rep-tree__vline--tall" />}

        {(topNodes.length > 0 || directUbos.length > 0) && (
          <div className="rep-tree__branch-row">
            <div className="rep-tree__hconnector" />
            <div className="rep-tree__cap rep-tree__cap--left" />
            <div className="rep-tree__cap rep-tree__cap--right" />

            {topNodes.map((node) => (
              <div key={node.name} className="rep-tree__branch">
                <div className="rep-tree__vline rep-tree__vline--med" />
                <TreeNodeBox
                  kind="intermediate"
                  label={node.name}
                  sub={`${node.ubos.length + node.childrenIntermediates.length} downstream`}
                />
                {(node.childrenIntermediates.length > 0 || node.ubos.length > 0) && (
                  <>
                    <div className="rep-tree__vline rep-tree__vline--med" />
                    <div className="rep-tree__children">
                      {node.childrenIntermediates.map((child) => (
                        <div key={child.name} className="rep-tree__branch">
                          <TreeNodeBox
                            kind="intermediate"
                            label={child.name}
                            sub={`${child.ubos.length} UBO${child.ubos.length === 1 ? '' : 's'}`}
                          />
                          {child.ubos.length > 0 && (
                            <>
                              <div className="rep-tree__vline rep-tree__vline--short" />
                              <div className="rep-tree__children">
                                {child.ubos.map((h) => (
                                  <TreeNodeBox
                                    key={h.key}
                                    kind="ubo"
                                    label={h.fullName}
                                    sub={`${h.effectivePercentage}% ${isDirectHolder(h) ? 'direct' : 'indirect'}`}
                                    holder={h}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {node.ubos.map((h) => (
                        <TreeNodeBox
                          key={h.key}
                          kind="ubo"
                          label={h.fullName}
                          sub={`${h.effectivePercentage}% ${isDirectHolder(h) ? 'direct' : 'indirect'}`}
                          holder={h}
                        />
                      ))}
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

/* ==========================================================================
   Chain summary
   ========================================================================== */
function ChainSummary({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;

  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter(
    (h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl),
  );
  const fallback = tree.seniorManagingOfficial;

  const edgesByParent = new Map();
  ubos.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 0; i < parts.length - 1; i++) {
        const from = parts[i];
        const to = parts[i + 1];
        if (!edgesByParent.has(from)) edgesByParent.set(from, []);
        const bucket = edgesByParent.get(from);
        if (!bucket.find((x) => x.to === to)) bucket.push({ to, pct: null });
      }
    });
  });

  const bullets = [];
  edgesByParent.forEach((children, parent) => {
    const list = children.map((c) => (c.pct != null ? `${c.pct}% owned by ${c.to}` : `…% owned by ${c.to}`)).join(' and ');
    bullets.push(`${parent} → ${list}`);
  });
  ubos.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      const eff = Number(h.effectivePercentage ?? p.percentage);
      const isDirect = parts.length === 2;
      if (isDirect) bullets.push(`${h.fullName}'s direct interest = ${eff}%`);
      else {
        const left = Array.from({ length: parts.length - 1 }).map((_, i) => `hop${i + 1}%`).join(' × ');
        bullets.push(`${h.fullName}'s indirect interest = ${left} = ${eff}%`);
      }
    });
  });
  controlOnly.forEach((h) => {
    bullets.push(`${h.fullName} — control via ${(h.controlBasis || []).join(', ') || 'other means'} (no ownership)`);
  });
  if (fallback) bullets.push(`Senior managing official fallback: ${fallback.name}${fallback.position ? ` (${fallback.position})` : ''}`);

  if (bullets.length === 0) return null;

  return (
    <div className="rep-summary">
      <div className="rep-summary__head">
        <Link2 size={12} />
        <span>Ownership chain summary — {entity.name}</span>
      </div>
      <ul className="rep-summary__list">
        {bullets.map((b, i) => <li key={i} className="rep-summary__item">{b}</li>)}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Report builders
   ========================================================================== */
function buildThresholdReport(entities) {
  return entities.map((e) => {
    const tree = e.tree;
    const holders = (tree?.holders || []).filter((h) => h.ubo);
    const threshold = getThreshold(e.entityType, e.sector);
    const above = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) >= threshold) : [];
    const below = threshold != null ? holders.filter((h) => Number(h.effectivePercentage) < threshold) : [];
    const controlOnly = (tree?.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
    return { ...e, threshold, above, below, controlOnly, ubos: holders };
  });
}

function buildOwnershipBreakdown(entities) {
  return entities.map((e) => {
    const holders = (e.tree?.holders || []).filter((h) => h.ubo);
    const direct = holders.filter(isDirectHolder);
    const indirect = holders.filter((h) => !isDirectHolder(h));
    const joint = holders.filter((h) => h.jointOwnership);
    const combined = holders.reduce((s, h) => s + Number(h.effectivePercentage || 0), 0);
    return { entity: e, holders, direct, indirect, joint, combined };
  });
}

function buildExceptionReport(entities) {
  const rows = [];
  entities.forEach((e) => {
    const tree = e.tree;
    if (!tree) {
      rows.push({ entity: e, type: 'NO_STRUCTURE', severity: 'danger', title: 'No ownership structure loaded', desc: 'The tree could not be loaded for this entity.' });
      return;
    }
    const holders = (tree.holders || []).filter((h) => h.ubo);
    const allHolders = tree.holders || [];

    allHolders.forEach((h) => {
      if (!h.idNumber) rows.push({ entity: e, type: 'MISSING_ID', severity: 'warn', title: `${h.fullName} has no ID number`, desc: 'BO record is missing an identification number.' });
    });

    allHolders.forEach((h) => {
      if (h.dateOfExpiry) {
        const exp = new Date(h.dateOfExpiry);
        if (!isNaN(exp) && exp < new Date()) {
          rows.push({ entity: e, type: 'EXPIRED_ID', severity: 'danger', title: `${h.fullName}'s ID expired on ${formatDate(h.dateOfExpiry)}`, desc: 'ID document has expired.' });
        }
      }
    });

    const totalPct = holders.reduce((s, h) => s + Number(h.effectivePercentage || 0), 0);
    if (totalPct > 100.01) {
      rows.push({ entity: e, type: 'PCT_OVER_100', severity: 'danger', title: `Ownership percentages exceed 100% (${totalPct.toFixed(2)}%)`, desc: 'Sum of all effective ownership percentages is greater than 100.' });
    }

    const seenIds = new Map();
    allHolders.forEach((h) => {
      if (!h.idNumber) return;
      const key = h.idNumber.trim();
      if (seenIds.has(key)) {
        rows.push({ entity: e, type: 'DUPLICATE_ID', severity: 'danger', title: `Duplicate ID number ${key}`, desc: `Used by ${seenIds.get(key)} and ${h.fullName}.` });
      } else {
        seenIds.set(key, h.fullName);
      }
    });

    allHolders.forEach((h) => {
      (h.paths || []).forEach((p) => {
        const parts = splitChain(p.chain);
        if (parts[0] === parts[parts.length - 1]) {
          rows.push({ entity: e, type: 'CIRCULAR', severity: 'danger', title: `Circular ownership detected for ${h.fullName}`, desc: `Chain: ${p.chain}` });
        }
      });
    });

    const threshold = getThreshold(e.entityType, e.sector);
    if (threshold != null) {
      holders.forEach((h) => {
        if (Number(h.effectivePercentage) < threshold) {
          rows.push({ entity: e, type: 'BELOW_THRESHOLD', severity: 'warn', title: `${h.fullName} (${h.effectivePercentage}%) below threshold ${threshold}%`, desc: 'Holder is below the applicable threshold for this entity type/sector.' });
        }
      });
    }

    allHolders.forEach((h) => {
      if (h.qualifiesByControl && (!h.controlBasis || h.controlBasis.length === 0)) {
        rows.push({ entity: e, type: 'MISSING_CONTROL_BASIS', severity: 'warn', title: `${h.fullName} qualifies by control but no basis recorded`, desc: 'Control-through-other-means needs a documented basis.' });
      }
    });

    if (isForeignEntity(e.entityType)) {
      rows.push({ entity: e, type: 'FOREIGN_DOCS', severity: 'info', title: 'Foreign legal person — verify home-jurisdiction evidence', desc: 'Ensure home-jurisdiction documentation or attestation is on file.' });
    }
  });
  return rows;
}

function buildComplexityReport(entities) {
  return entities.map((e) => {
    const tree = e.tree;
    const holders = (tree?.holders || []).filter((h) => h.ubo);
    const maxDepth = holders.reduce(
      (max, h) => Math.max(max, ...(h.paths || []).map((p) => splitChain(p.chain).length)),
      0,
    );
    const intermediates = new Set();
    holders.forEach((h) => (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) intermediates.add(parts[i]);
    }));
    const crossOwnership = holders.filter((h) => (h.paths || []).length > 1);
    const layers = maxDepth > 0 ? maxDepth - 1 : 0;
    return {
      entity: e,
      layers,
      intermediates: intermediates.size,
      holders: holders.length,
      crossOwnership,
      isComplex: layers >= 2 || crossOwnership.length > 0,
      isForeign: isForeignEntity(e.entityType),
    };
  });
}

/* ==========================================================================
   Main component
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLegalPersons({ size: 500, sort: 'name' })
      .then((res) => {
        if (cancelled) return;
        setLegalPersons(res.content || []);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load reports'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (legalPersons.length === 0) return;
    let cancelled = false;
    Promise.all(
      legalPersons.map((lp) =>
        getOwnershipTree(lp.id).then((t) => [lp.id, t]).catch(() => [lp.id, null])
      ),
    ).then((pairs) => {
      if (cancelled) return;
      const map = {};
      pairs.forEach(([id, t]) => { map[id] = t; });
      setTrees(map);
    });
    return () => { cancelled = true; };
  }, [legalPersons]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    listAuditLogs({ size: 100 })
      .then((res) => setAuditLogs(res.content || []))
      .catch(() => setAuditLogs([]));
  }, [activeTab]);

  const entities = useMemo(
    () => legalPersons.map((lp) => {
      const tree = trees[lp.id];
      const ubos = (tree?.holders || []).filter((h) => h.ubo);
      return {
        id: lp.id,
        name: lp.name,
        registrationNumber: lp.registrationNumber,
        entityType: lp.entityType,
        sector: lp.sector,
        countryOfIncorporation: lp.countryOfIncorporation,
        tin: lp.tin,
        cifNumber: lp.cifNumber,
        uboCount: ubos.length,
        fallback: tree?.seniorManagingOfficial || null,
        tree,
      };
    }),
    [legalPersons, trees],
  );

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (entityId && e.id !== entityId) return false;
      if (entityTypeFilter && e.entityType !== entityTypeFilter) return false;
      if (sectorFilter && e.sector !== sectorFilter) return false;
      if (thresholdFilter) {
        const th = getThreshold(e.entityType, e.sector);
        if (String(th) !== thresholdFilter) return false;
      }
      if (dateFrom || dateTo) {
        const holders = (e.tree?.holders || []).filter((h) => h.ubo);
        const inRange = holders.some((h) => {
          const d = String(h.dateBecameBo || '').slice(0, 10);
          if (!d) return false;
          if (dateFrom && d < dateFrom) return false;
          if (dateTo && d > dateTo) return false;
          return true;
        });
        if (!inRange) return false;
      }
      return true;
    });
  }, [entities, entityId, entityTypeFilter, sectorFilter, thresholdFilter, dateFrom, dateTo]);

  const selected = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0] || null;

  const filtersActive = entityId || entityTypeFilter || sectorFilter || thresholdFilter || dateFrom || dateTo;
  const clearAll = () => {
    setEntityId(''); setEntityTypeFilter(''); setSectorFilter('');
    setThresholdFilter(''); setDateFrom(''); setDateTo('');
  };

  const recordExport = async (format, scope) => { /* best-effort backend log */ };

  const download = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = (rows, filenamePrefix = 'report') => {
    const header = ['Entity', 'Registration', 'Entity type', 'Sector', 'Threshold %', 'UBOs', 'Fallback'];
    const lines = rows.map((e) => {
      const th = getThreshold(e.entityType, e.sector);
      return [
        e.name,
        e.registrationNumber || '',
        ENTITY_LABELS[e.entityType] || e.entityType || '',
        SECTOR_LABELS[e.sector] || e.sector || '',
        th != null ? th : '',
        e.uboCount,
        e.fallback ? 'Yes' : 'No',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    download([header.join(','), ...lines].join('\n'), `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    recordExport('CSV', filenamePrefix);
  };

  const handleExportExcel = (rows, filenamePrefix = 'report') => {
    const header = ['Entity', 'Registration', 'Entity type', 'Sector', 'Threshold %', 'UBOs', 'Fallback'];
    const lines = rows.map((e) => {
      const th = getThreshold(e.entityType, e.sector);
      return [
        e.name,
        e.registrationNumber || '',
        ENTITY_LABELS[e.entityType] || e.entityType || '',
        SECTOR_LABELS[e.sector] || e.sector || '',
        th != null ? th : '',
        e.uboCount,
        e.fallback ? 'Yes' : 'No',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    download('\uFEFF' + [header.join(','), ...lines].join('\n'), `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    recordExport('EXCEL', filenamePrefix);
  };

  const handleExportPdf = () => {
    window.print();
    recordExport('PDF', activeTab);
  };

  const handleExportWord = (rows, filenamePrefix = 'report') => {
    const header = ['Entity', 'Registration', 'Entity type', 'Sector', 'Threshold %', 'UBOs', 'Fallback'];
    const rowsHtml = rows.map((e) => {
      const th = getThreshold(e.entityType, e.sector);
      return `<tr>
        <td>${e.name}</td>
        <td>${e.registrationNumber || ''}</td>
        <td>${ENTITY_LABELS[e.entityType] || e.entityType || ''}</td>
        <td>${SECTOR_LABELS[e.sector] || e.sector || ''}</td>
        <td>${th != null ? th : '—'}</td>
        <td>${e.uboCount}</td>
        <td>${e.fallback ? 'Yes' : 'No'}</td>
      </tr>`;
    }).join('');
    const html = `
      <html><head><meta charset="utf-8"/><title>BO Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; }
        h1 { font-size: 16pt; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
        th { background: #283375; color: #fff; }
      </style></head>
      <body>
        <h1>Beneficial Ownership Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>`;
    download(html, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.doc`, 'application/msword;charset=utf-8;');
    recordExport('WORD', filenamePrefix);
  };

  /* ==========================================================================
     Render helpers
     ========================================================================== */
  const renderOverview = () => {
    const totals = filtered.reduce(
      (acc, e) => {
        const holders = (e.tree?.holders || []).filter((h) => h.ubo);
        acc.ubos += holders.length;
        acc.verified += holders.filter((h) => h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered).length;
        acc.pending += holders.filter((h) => h.status === 'PENDING').length;
        if (e.fallback) acc.withFallback += 1;
        return acc;
      },
      { ubos: 0, verified: 0, pending: 0, withFallback: 0 },
    );

    return (
      <>
        <div className="rep-kpi-grid rep-printable">
          <div className="rep-kpi">
            <div className="rep-kpi__label">Legal entities</div>
            <div className="rep-kpi__value">{filtered.length}</div>
            <div className="rep-kpi__caption">In current view</div>
          </div>
          <div className="rep-kpi rep-kpi--info">
            <div className="rep-kpi__label">Total UBOs</div>
            <div className="rep-kpi__value">{totals.ubos}</div>
            <div className="rep-kpi__caption">Natural persons</div>
          </div>
          <div className="rep-kpi rep-kpi--success">
            <div className="rep-kpi__label">Verified</div>
            <div className="rep-kpi__value">{totals.verified}</div>
            <div className="rep-kpi__caption">Approved by checker</div>
          </div>
          <div className="rep-kpi rep-kpi--warn">
            <div className="rep-kpi__label">Pending</div>
            <div className="rep-kpi__value">{totals.pending}</div>
            <div className="rep-kpi__caption">Awaiting approval</div>
          </div>
          <div className="rep-kpi rep-kpi--danger">
            <div className="rep-kpi__label">Fallbacks</div>
            <div className="rep-kpi__value">{totals.withFallback}</div>
            <div className="rep-kpi__caption">Senior official</div>
          </div>
        </div>

        <div className="rep-card rep-printable">
          <div className="rep-card__head">
            <div>
              <h3 className="rep-card__title">Entity compliance</h3>
              <div className="rep-card__subtitle">Select a row to inspect its ownership</div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rep-table">
              <thead>
                <tr>
                  <th>Legal entity</th>
                  <th>Type</th>
                  <th>Sector</th>
                  <th>Threshold</th>
                  <th className="rep-table__number">UBOs</th>
                  <th className="rep-table__center">Fallback</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="rep-loading"><span className="rep-spinner" />Loading entities…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="rep-loading">No entities match the current filters.</td></tr>
                )}
                {!loading && filtered.map((e) => {
                  const th = getThreshold(e.entityType, e.sector);
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      style={{
                        cursor: 'pointer',
                        background: selected?.id === e.id ? 'var(--rep-primary-soft)' : undefined,
                      }}
                    >
                      <td>
                        <div className="rep-table__entity">
                          <span className="rep-table__entity-icon"><Building2 size={14} /></span>
                          <div style={{ minWidth: 0 }}>
                            <div className="rep-table__entity-name">{e.name}</div>
                            <div className="rep-table__entity-reg">{e.registrationNumber || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{ENTITY_LABELS[e.entityType] || e.entityType || '—'}</td>
                      <td>{SECTOR_LABELS[e.sector] || e.sector || '—'}</td>
                      <td>
                        {th != null ? (
                          <span className={`rep-threshold${HIGH_RISK_SECTORS.has(e.sector) ? ' rep-threshold--warn' : ''}`}>
                            ≥ {th}%
                          </span>
                        ) : (
                          <span className="rep-chip rep-chip--muted">SPECIAL</span>
                        )}
                      </td>
                      <td className="rep-table__number">{e.uboCount}</td>
                      <td className="rep-table__center">
                        {e.fallback ? <span className="rep-chip rep-chip--warn">Yes</span> : <span style={{ color: 'var(--rep-text-faint)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && selected.tree && (
          <div className="rep-printable">
            <ChainSummary entity={selected} />
            <div className="rep-card">
              <div className="rep-card__head">
                <div>
                  <h3 className="rep-card__title">Ownership tree — {selected.name}</h3>
                  <div className="rep-card__subtitle">Visual diagram with entity, intermediates, UBOs, and control</div>
                </div>
              </div>
              <div className="rep-card__body">
                <OwnershipTreeReport entity={selected} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderThreshold = () => {
    const rows = buildThresholdReport(filtered);
    return (
      <div className="rep-card rep-printable">
        <div className="rep-card__head">
          <div>
            <h3 className="rep-card__title">Threshold-based BO report</h3>
            <div className="rep-card__subtitle">Reports 1–7 — direct / indirect / joint ownership above the applicable threshold</div>
          </div>
          <div className="rep-export-bar rep-no-print">
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportCsv(rows, 'threshold-report')}>CSV</Btn>
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportExcel(rows, 'threshold-report')}>Excel</Btn>
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportWord(rows, 'threshold-report')}>Word</Btn>
            <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rep-table">
            <thead>
              <tr>
                <th>Legal entity</th>
                <th>Type</th>
                <th>Sector</th>
                <th>Threshold</th>
                <th>Criteria met</th>
                <th>Above threshold</th>
                <th className="rep-table__number">BOs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="rep-table__entity">
                      <span className="rep-table__entity-icon"><Building2 size={14} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="rep-table__entity-name">{r.name}</div>
                        <div className="rep-table__entity-reg">{r.registrationNumber}</div>
                      </div>
                    </div>
                  </td>
                  <td>{ENTITY_LABELS[r.entityType] || r.entityType || '—'}</td>
                  <td>{SECTOR_LABELS[r.sector] || r.sector || '—'}</td>
                  <td>{r.threshold != null ? <span className={`rep-threshold${HIGH_RISK_SECTORS.has(r.sector) ? ' rep-threshold--warn' : ''}`}>≥ {r.threshold}%</span> : <span className="rep-chip rep-chip--muted">SPECIAL</span>}</td>
                  <td>{ENTITY_LABELS[r.entityType] || '—'} criteria</td>
                  <td>{r.above.length}</td>
                  <td className="rep-table__number">{r.ubos.length}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="rep-loading">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBreakdown = () => {
    const rows = buildOwnershipBreakdown(filtered);
    return (
      <div className="rep-card rep-printable">
        <div className="rep-card__head">
          <div>
            <h3 className="rep-card__title">Detailed ownership breakdown</h3>
            <div className="rep-card__subtitle">Report 8 — direct, indirect, joint, and combined ownership</div>
          </div>
          <div className="rep-export-bar rep-no-print">
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => {
              const header = ['Entity', 'Holder', 'Type', 'Ownership %', 'Joint?', 'Chain'];
              const lines = [];
              rows.forEach((r) => r.holders.forEach((h) => {
                lines.push([r.entity.name, h.fullName, isDirectHolder(h) ? 'Direct' : 'Indirect', h.effectivePercentage, h.jointOwnership ? 'Yes' : 'No', (h.paths || []).map((p) => p.chain).join('; ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
              }));
              download('\uFEFF' + [header.join(','), ...lines].join('\n'), `ownership-breakdown-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
            }}>CSV</Btn>
            <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rep-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Holder</th>
                <th>Direct / Indirect</th>
                <th className="rep-table__number">Ownership %</th>
                <th className="rep-table__center">Joint</th>
                <th>Chain</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((r) => r.holders.map((h, i) => (
                <tr key={`${r.entity.id}-${h.key}-${i}`}>
                  <td>{r.entity.name}</td>
                  <td><strong>{h.fullName}</strong></td>
                  <td>
                    <span className={`rep-chip ${isDirectHolder(h) ? 'rep-chip--ubo' : 'rep-chip--info'}`}>
                      {isDirectHolder(h) ? 'Direct' : 'Indirect'}
                    </span>
                  </td>
                  <td className="rep-table__number">{h.effectivePercentage}%</td>
                  <td className="rep-table__center">{h.jointOwnership ? <span className="rep-chip rep-chip--warn">Joint</span> : '—'}</td>
                  <td><span className="rep-table__mono">{(h.paths || []).map((p) => p.chain).join('; ')}</span></td>
                </tr>
              )))}
              {rows.length === 0 && <tr><td colSpan={6} className="rep-loading">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderExceptions = () => {
    const rows = buildExceptionReport(filtered);
    const bySeverity = { danger: 0, warn: 0, info: 0 };
    rows.forEach((r) => { bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1; });

    return (
      <>
        <div className="rep-kpi-grid rep-printable">
          <div className="rep-kpi rep-kpi--danger">
            <div className="rep-kpi__label">Critical</div>
            <div className="rep-kpi__value">{bySeverity.danger}</div>
            <div className="rep-kpi__caption">Require action</div>
          </div>
          <div className="rep-kpi rep-kpi--warn">
            <div className="rep-kpi__label">Warnings</div>
            <div className="rep-kpi__value">{bySeverity.warn}</div>
            <div className="rep-kpi__caption">Data quality issues</div>
          </div>
          <div className="rep-kpi rep-kpi--info">
            <div className="rep-kpi__label">Info</div>
            <div className="rep-kpi__value">{bySeverity.info}</div>
            <div className="rep-kpi__caption">For review</div>
          </div>
          <div className="rep-kpi">
            <div className="rep-kpi__label">Total findings</div>
            <div className="rep-kpi__value">{rows.length}</div>
            <div className="rep-kpi__caption">Across all entities</div>
          </div>
        </div>

        <div className="rep-card rep-printable">
          <div className="rep-card__head">
            <div>
              <h3 className="rep-card__title">Data-quality & exception report</h3>
              <div className="rep-card__subtitle">Report 9 — missing IDs, expired documents, duplicates, circular ownership, threshold violations, inconsistent percentages</div>
            </div>
            <div className="rep-export-bar rep-no-print">
              <Btn variant="secondary" icon={<Download size={14} />} onClick={() => {
                const header = ['Severity', 'Entity', 'Type', 'Title', 'Description'];
                const lines = rows.map((r) => [r.severity, r.entity.name, r.type, r.title, r.desc].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
                download('\uFEFF' + [header.join(','), ...lines].join('\n'), `exceptions-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
              }}>CSV</Btn>
              <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
            </div>
          </div>
          <div className="rep-card__body">
            {rows.length === 0 ? (
              <div className="rep-empty">
                <div className="rep-empty__title">No exceptions found</div>
                <div>All entities passed the data-quality checks.</div>
              </div>
            ) : (
              rows.map((r, i) => (
                <div key={i} className={`rep-exception rep-exception--${r.severity}`}>
                  <div className="rep-exception__head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={14} />
                      <span className="rep-exception__title">{r.title}</span>
                    </div>
                    <span className="rep-chip rep-chip--muted">{r.entity.name}</span>
                  </div>
                  <div className="rep-exception__desc">{r.desc}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  const renderComplexity = () => {
    const rows = buildComplexityReport(filtered);
    return (
      <div className="rep-card rep-printable">
        <div className="rep-card__head">
          <div>
            <h3 className="rep-card__title">Complex ownership structures</h3>
            <div className="rep-card__subtitle">Report 10 — multi-layer, cross-ownership, and foreign structures</div>
          </div>
          <div className="rep-export-bar rep-no-print">
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => {
              const header = ['Entity', 'Layers', 'Intermediates', 'Holders', 'Cross-ownership', 'Foreign'];
              const lines = rows.map((r) => [r.entity.name, r.layers, r.intermediates, r.holders, r.crossOwnership.length, r.isForeign ? 'Yes' : 'No'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
              download('\uFEFF' + [header.join(','), ...lines].join('\n'), `complexity-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
            }}>CSV</Btn>
            <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="rep-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th className="rep-table__number">Layers</th>
                <th className="rep-table__number">Intermediates</th>
                <th className="rep-table__number">UBOs</th>
                <th className="rep-table__number">Cross-ownership</th>
                <th className="rep-table__center">Foreign</th>
                <th className="rep-table__center">Complex</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entity.id}>
                  <td>{r.entity.name}</td>
                  <td className="rep-table__number">{r.layers}</td>
                  <td className="rep-table__number">{r.intermediates}</td>
                  <td className="rep-table__number">{r.holders}</td>
                  <td className="rep-table__number">{r.crossOwnership.length}</td>
                  <td className="rep-table__center">{r.isForeign ? <span className="rep-chip rep-chip--warn">Foreign</span> : '—'}</td>
                  <td className="rep-table__center">{r.isComplex ? <span className="rep-chip rep-chip--info">Complex</span> : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="rep-loading">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTree = () => {
    const entity = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0];
    if (!entity?.tree) {
      return (
        <div className="rep-card">
          <div className="rep-empty">
            <div className="rep-empty__title">Select a legal entity</div>
            <div>Choose an entity in the filter above to view its ownership tree.</div>
          </div>
        </div>
      );
    }
    return (
      <>
        <ChainSummary entity={entity} />
        <div className="rep-card rep-printable">
          <div className="rep-card__head">
            <div>
              <h3 className="rep-card__title">Ownership / control tree — {entity.name}</h3>
              <div className="rep-card__subtitle">Report 11 — visual diagram with entities, persons, percentages, layers</div>
            </div>
            <div className="rep-export-bar rep-no-print">
              <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
            </div>
          </div>
          <div className="rep-card__body">
            <OwnershipTreeReport entity={entity} />
          </div>
        </div>
      </>
    );
  };

  const renderAudit = () => (
    <div className="rep-card rep-printable">
      <div className="rep-card__head">
        <div>
          <h3 className="rep-card__title">Audit trail</h3>
          <div className="rep-card__subtitle">All BO changes, exports, and reviewer actions</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="rep-table">
          <thead>
            <tr><th>Timestamp</th><th>Action</th><th>Actor</th><th>Entity</th></tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && <tr><td colSpan={4} className="rep-loading">No audit entries yet.</td></tr>}
            {auditLogs.map((l) => (
              <tr key={l.id}>
                <td className="rep-table__mono">{String(l.createdAt || '').replace('T', ' ').slice(0, 19)}</td>
                <td>{l.action}</td>
                <td>{l.actorUsername || '—'}</td>
                <td className="rep-table__mono">{l.entityRef || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ==========================================================================
     Render
     ========================================================================== */
  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'threshold', label: 'Threshold report' },
    { key: 'breakdown', label: 'Ownership breakdown' },
    { key: 'exceptions', label: 'Exceptions' },
    { key: 'complexity', label: 'Complex structures' },
    { key: 'tree', label: 'Visual tree' },
    { key: 'audit', label: 'Audit trail' },
  ];

  const tabRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const el = tabRefs.current[idx];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab]);

  return (
    <div className="rep-root">
      <div className="rep-header rep-no-print">
        <div>
          <div className="rep-header__title-row">
            <h1 className="rep-header__title">Reporting</h1>
            {filtersActive && <span className="rep-pill"><Filter size={12} /> Filtered</span>}
          </div>
          <div className="rep-header__subtitle">
            BO summary · threshold reports · exceptions · audit trails — exportable to PDF, Excel, CSV, Word
          </div>
        </div>
        <div className="rep-header__actions">
          <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportExcel(filtered, 'all-entities')}>Excel</Btn>
          <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportCsv(filtered, 'all-entities')}>CSV</Btn>
          <Btn variant="secondary" icon={<Download size={14} />} onClick={() => handleExportWord(filtered, 'all-entities')}>Word</Btn>
          <Btn variant="primary" icon={<Printer size={14} />} onClick={handleExportPdf}>PDF</Btn>
        </div>
      </div>

      {error && <div className="rep-error"><AlertTriangle size={14} /><span>{error}</span></div>}

      <div className="rep-tabs rep-no-print" style={{ position: 'relative' }}>
        {TABS.map((t, i) => (
          <button
            key={t.key}
            type="button"
            ref={(el) => { tabRefs.current[i] = el; }}
            className={`rep-tab${activeTab === t.key ? ' rep-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="rep-tab-indicator"
          style={{ position: 'absolute', bottom: 0, height: 2, background: 'var(--rep-primary, #4F46E5)', left: indicator.left, width: indicator.width, borderRadius: 1 }}
        />
      </div>

      <div className="rep-filter-card rep-no-print">
        <div className="rep-filter-card__head">
          <span className="rep-filter-card__label"><Filter size={12} /> Filters</span>
          <span className="rep-filter-card__divider" />
          {filtersActive && <Btn variant="ghost" onClick={clearAll} icon={<X size={12} />}>Clear all</Btn>}
        </div>
        <div className="rep-filter-grid">
          <EntityCombo
            options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))}
            value={entityId}
            onChange={setEntityId}
            loading={loading}
          />
          <Field label="Entity type">
            <select className="rep-input" value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Sector">
            <select className="rep-input" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
              <option value="">All sectors</option>
              {Object.entries(SECTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Threshold">
            <select className="rep-input" value={thresholdFilter} onChange={(e) => setThresholdFilter(e.target.value)}>
              <option value="">Any</option>
              <option value="2">2%</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="25">25%</option>
            </select>
          </Field>
          <Field label="From">
            <input className="rep-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          </Field>
          <Field label="To">
            <input className="rep-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
          </Field>
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
            <span style={{ fontSize: 12, color: 'var(--rep-text-muted)', paddingBottom: 8 }}>
              <strong style={{ color: 'var(--rep-text)' }}>{filtered.length}</strong> of {entities.length} entities
            </span>
          </div>
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
