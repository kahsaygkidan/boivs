import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Building2, Users, AlertTriangle, ShieldAlert, ShieldCheck, Shield,
  Search, X, Filter, Link2, PieChart as PieIcon, GitBranch,
  Loader2, RefreshCw, Sparkles,
} from 'lucide-react';
import { listLegalPersons, getOwnershipTree } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { fmtWhen, humanize } from '../components/ui.jsx';
import { controlBasisLabel } from '../utils/records.js';
import { DashboardKpis, useBackgroundTrees, STATUS_KPIS } from '../components/DashboardKpis.jsx';
import PortfolioAnalytics from '../components/DashboardAnalytics.jsx';
import {
  HIGH_RISK_SECTORS, HIGH_RISK_SECTOR_LABELS,
} from '../utils/uboForm.js';
import '../styles/Dashboard.css';

/* ==========================================================================
   Helpers
   ========================================================================== */
const splitChain = (chain) =>
  String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

const formatGender = (g) => {
  if (!g) return '—';
  const s = String(g).toUpperCase();
  if (s === 'M' || s === 'MALE') return 'Male';
  if (s === 'F' || s === 'FEMALE') return 'Female';
  return g;
};

const fmtPct = (n) => Math.round((Number(n) || 0) * 100) / 100;

const formatDate = (v) => (v ? (fmtWhen(v) || '—') : '—');

const isDirectHolder = (holder) => {
  const paths = holder.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};

/* ==========================================================================
   Risk model — derived only from real API fields
   ========================================================================== */
const RISK_BANDS = [
  { key: 'LOW',    label: 'Low',    min: 0,  max: 29,  tone: 'success' },
  { key: 'MEDIUM', label: 'Medium', min: 30, max: 59,  tone: 'warn' },
  { key: 'HIGH',   label: 'High',   min: 60, max: 100, tone: 'danger' },
];

const bandFor = (score) =>
  RISK_BANDS.find((b) => score >= b.min && score <= b.max) || RISK_BANDS[0];

function computeRisk(lp, tree) {
  const reasons = [];
  let score = 0;

  const sector = lp?.sector || tree?.sector;
  if (HIGH_RISK_SECTORS.has(sector)) {
    score += 40;
    reasons.push(`High-risk sector — ${HIGH_RISK_SECTOR_LABELS[sector] || sector}`);
  }

  if (lp?.entityType === 'FOREIGN_LEGAL_PERSON') {
    score += 10;
    reasons.push('Foreign legal person');
  }

  const holders = tree?.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const fallback = tree?.seniorManagingOfficial || null;

  if (ubos.length === 0) {
    score += fallback ? 20 : 15;
    reasons.push(fallback ? 'Fallback only — no natural-person UBO' : 'No UBO recorded');
  }

  if (ubos.some((h) => h.pep)) {
    score += 10;
    reasons.push('UBO is a PEP');
  }

  if (ubos.some((h) => h.sanctionsScreened && h.sanctionsResult && h.sanctionsResult !== 'CLEAR')) {
    score += 10;
    reasons.push('Sanctions screening match');
  }

  if (ubos.some((h) => ['PENDING', 'FAILED', 'EXPIRED'].includes(String(h.status || '').toUpperCase()))) {
    score += 10;
    reasons.push('UBO verification incomplete');
  }

  if (ubos.length > 0 && !fallback) {
    const total = ubos.reduce((s, h) => s + (Number(h.effectivePercentage) || 0), 0);
    if (total < 99.99) {
      score += 10;
      reasons.push(`Ownership gap — ${total.toFixed(2)}% traced`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const band = bandFor(score);
  return { score, band, reasons, ubos, fallback };
}

const riskChipCls = (bandKey) => `dash-risk-chip dash-risk-chip--${bandKey.toLowerCase()}`;

function RiskBadge({ risk, compact = false }) {
  if (!risk) return null;
  const { band, score } = risk;
  return (
    <span
      className={riskChipCls(band.key)}
      title={risk.reasons.length ? risk.reasons.join(' · ') : 'No risk factors'}
    >
      <span className="dash-risk-chip__dot" />
      <span className="dash-risk-chip__label">{band.label}</span>
      {!compact && <span className="dash-risk-chip__score">{score}</span>}
    </span>
  );
}

/* ==========================================================================
   Button
   ========================================================================== */
function Btn({ variant = 'primary', size = 'md', icon, children, ...props }) {
  const cls = ['dash-btn', `dash-btn--${variant}`, `dash-btn--${size}`].join(' ');
  return (
    <button type="button" className={cls} {...props}>
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ==========================================================================
   Skeleton
   ========================================================================== */
function Skeleton({ h = 16, w = '100%', r = 8, className = '' }) {
  return (
    <div
      className={`dash-skeleton ${className}`}
      style={{ height: h, width: w, borderRadius: r }}
    />
  );
}

/* ==========================================================================
   Searchable entity combobox (with risk badge inside rows)
   ========================================================================== */
function EntityCombobox({ options, value, onChange, placeholder = 'Search entity…', loading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const [focused, setFocused] = useState(false);
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

  const displayValue = open ? query : (selected ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : '');
  const hasValue = Boolean(selected) || open;

  return (
    <label className="dash-combo">
      <span className="dash-combo__label">Legal entity</span>
      <div className="dash-combo__wrap" ref={ref}>
        <span className="dash-combo__icon"><Search size={14} /></span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          value={displayValue}
          placeholder={loading ? 'Loading entities…' : placeholder}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          className={`dash-combo__input${hasValue ? ' dash-combo__input--has-value' : ''}${focused ? ' dash-combo__input--focused' : ''}`}
        />
        {open && (
          <ul className="dash-combo__list" role="listbox">
            {filtered.length === 0 && <li className="dash-combo__empty">No entity found</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                className={`dash-combo__item${i === hi ? ' dash-combo__item--hi' : ''}${o.value === value ? ' dash-combo__item--selected' : ''}`}
              >
                <span className="dash-combo__item-main">
                  <span>{o.label}</span>
                  {o.sub && <span className="dash-combo__sub">{o.sub}</span>}
                </span>
                {o.risk && <RiskBadge risk={o.risk} compact />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

/* ==========================================================================
   Field
   ========================================================================== */
function Field({ k, v, mono }) {
  return (
    <div>
      <div className="dash-field__label">{k}</div>
      <div className={`dash-field__value${mono ? ' dash-field__value--mono' : ''}`}>{v}</div>
    </div>
  );
}

/* ==========================================================================
   Risk panel
   ========================================================================== */
function RiskPanel({ risk }) {
  if (!risk) return null;
  const { band, score, reasons } = risk;
  return (
    <div className={`dash-risk-panel dash-risk-bar--${band.key.toLowerCase()}`}>
      <div className="dash-risk-panel__head">
        <span className="dash-risk-panel__icon">
          {band.key === 'HIGH' ? <ShieldAlert size={16} /> : band.key === 'MEDIUM' ? <Shield size={16} /> : <ShieldCheck size={16} />}
        </span>
        <div className="dash-risk-panel__title-block">
          <div className="dash-risk-panel__title">Risk profile</div>
          <div className="dash-risk-panel__sub">{band.label} risk · score {score}/100</div>
        </div>
        <RiskBadge risk={risk} />
      </div>
      <div className="dash-risk-panel__meter" aria-hidden="true">
        <div className="dash-risk-panel__meter-fill" style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      {reasons.length > 0 ? (
        <ul className="dash-risk-panel__reasons">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      ) : (
        <div className="dash-risk-panel__clean">No risk factors detected for this entity.</div>
      )}
    </div>
  );
}

/* ==========================================================================
   Ownership summary
   ========================================================================== */
function OwnershipSummaryCard({ entity }) {
  const tree = entity?.tree;
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
      const apiSteps = Array.isArray(p.steps) && p.steps.length ? p.steps : null;
      if (apiSteps) {
        apiSteps.forEach((s) => {
          if (!edgesByParent.has(s.from)) edgesByParent.set(s.from, []);
          const bucket = edgesByParent.get(s.from);
          if (!bucket.find((x) => x.to === s.to)) bucket.push({ to: s.to, pct: s.pct });
        });
      } else {
        for (let i = 0; i < parts.length - 1; i++) {
          const from = parts[i];
          const to = parts[i + 1];
          if (!edgesByParent.has(from)) edgesByParent.set(from, []);
          const bucket = edgesByParent.get(from);
          if (!bucket.find((x) => x.to === to)) bucket.push({ to, pct: null });
        }
      }
    });
  });

  const bullets = [];
  edgesByParent.forEach((children, parent) => {
    const list = children
      .map((c) => (c.pct != null ? `${c.pct}% owned by ${c.to}` : `…% owned by ${c.to}`))
      .join(' and ');
    bullets.push(`${parent} → ${list}`);
  });

  ubos.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      const eff = Number(h.effectivePercentage ?? p.percentage);
      const isDirect = parts.length === 2;
      const apiSteps = Array.isArray(p.steps) && p.steps.length ? p.steps : null;
      if (isDirect) bullets.push(`${h.fullName}'s direct interest = ${eff}%`);
      else {
        const left = apiSteps
          ? apiSteps.map((s) => `${s.pct}%`).join(' × ')
          : Array.from({ length: parts.length - 1 }).map((_, i) => `hop${i + 1}%`).join(' × ');
        bullets.push(`${h.fullName}'s indirect interest = ${left} = ${eff}%`);
      }
    });
  });

  controlOnly.forEach((h) =>
    bullets.push(`${h.fullName} — control via ${(h.controlBasis || []).join(', ') || 'other means'} (no ownership)`),
  );
  if (fallback) bullets.push(`Senior managing official fallback: ${fallback.name}${fallback.position ? ` (${fallback.position})` : ''}`);

  if (bullets.length === 0) return null;

  return (
    <div className="dash-summary">
      <div className="dash-summary__head">
        <span className="dash-summary__head-icon"><Link2 size={12} /></span>
        <span className="dash-summary__title">Ownership chain summary — {entity.name}</span>
      </div>
      <ul className="dash-summary__list">
        {bullets.map((b, i) => <li key={i} className="dash-summary__item">{b}</li>)}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Pie chart
   ========================================================================== */
const COLORS = { direct: '#059669', indirect: '#2563eb', other: '#cbd5e1' };

function OwnershipPieChart({ entity }) {
  const tree = entity?.tree;
  const ubos = useMemo(() => (tree?.holders || []).filter((h) => h.ubo), [tree]);

  const chartData = useMemo(() => {
    let directTotal = 0, indirectTotal = 0;
    const directHolders = [], indirectHolders = [];
    ubos.forEach((h) => {
      const pct = Number(h.effectivePercentage) || 0;
      if (pct <= 0) return;
      if (isDirectHolder(h)) { directTotal += pct; directHolders.push({ name: h.fullName, pct }); }
      else { indirectTotal += pct; indirectHolders.push({ name: h.fullName, pct }); }
    });
    const slices = [];
    if (directTotal > 0) slices.push({ name: `Direct (${directHolders.length})`, value: directTotal, kind: 'direct', holders: directHolders });
    if (indirectTotal > 0) slices.push({ name: `Indirect (${indirectHolders.length})`, value: indirectTotal, kind: 'indirect', holders: indirectHolders });
    const total = directTotal + indirectTotal;
    if (total > 0 && total < 100) slices.push({ name: 'Other', value: 100 - total, kind: 'other' });
    return slices;
  }, [ubos]);

  const total = chartData.reduce((s, r) => s + r.value, 0);
  const directSlice = chartData.find((r) => r.kind === 'direct');
  const indirectSlice = chartData.find((r) => r.kind === 'indirect');

  const verifiedCount = ubos.filter((h) => ['VERIFIED', 'APPROVED'].includes(h.status) || h.registered).length;
  const pendingCount = ubos.filter((h) => h.status === 'PENDING').length;

  if (!tree) return <div className="dash-empty-inline">No ownership data loaded yet.</div>;
  if (chartData.length === 0) return <div className="dash-empty-inline">No UBO ownership recorded.</div>;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="dash-pie-tooltip">
        <div className="dash-pie-tooltip__title">{item.name}</div>
        <div className="dash-pie-tooltip__meta">
          <strong style={{ color: item.payload.kind === 'direct' ? COLORS.direct : item.payload.kind === 'indirect' ? COLORS.indirect : 'var(--dash-text-muted)' }}>
            {item.value}%
          </strong>{' '}· {pct}% of total
        </div>
        {item.payload.holders && item.payload.holders.length > 0 && (
          <div className="dash-pie-tooltip__list">
            {item.payload.holders.map((h, i) => (
              <div key={i} className="dash-pie-tooltip__row">
                <span className="dash-pie-tooltip__name">{h.name}</span>
                <strong className="dash-pie-tooltip__pct">{h.pct}%</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dash-pie-layout">
      <div className="dash-pie-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={112}
              paddingAngle={3}
              cornerRadius={6}
              stroke="var(--dash-surface, #fff)"
              strokeWidth={3}
              isAnimationActive
              animationDuration={700}
              labelLine={false}
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                if (percent < 0.06) return null;
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                return (
                  <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} style={{ pointerEvents: 'none' }}>
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                );
              }}
            >
              {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={COLORS[entry.kind] || COLORS.other} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dash-pie-center">
          <div className="dash-pie-center__label">Allocated</div>
          <div className="dash-pie-center__value">{fmtPct(total)}%</div>
          <div className="dash-pie-center__sub">{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</div>
          <div className="dash-pie-center__pills">
            <span className="pill pill--success">{verifiedCount} ✓</span>
            <span className="pill pill--warn">{pendingCount} ⏳</span>
          </div>
        </div>
      </div>

      <div className="dash-pie-legend">
        {directSlice && (
          <div className="dash-pie-legend__card dash-pie-legend__card--direct">
            <div className="dash-pie-legend__row">
              <span className="dash-pie-legend__swatch dash-pie-legend__swatch--direct" />
              <span className="dash-pie-legend__label dash-pie-legend__label--direct">Direct</span>
            </div>
            <div className="dash-pie-legend__value">{fmtPct(directSlice.value)}%</div>
            <div className="dash-pie-legend__names">{directSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
        {indirectSlice && (
          <div className="dash-pie-legend__card dash-pie-legend__card--indirect">
            <div className="dash-pie-legend__row">
              <span className="dash-pie-legend__swatch dash-pie-legend__swatch--indirect" />
              <span className="dash-pie-legend__label dash-pie-legend__label--indirect">Indirect</span>
            </div>
            <div className="dash-pie-legend__value">{fmtPct(indirectSlice.value)}%</div>
            <div className="dash-pie-legend__names">{indirectSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Tree diagram
   ========================================================================== */
function TreeNodeBox({ kind, label, sub, holder }) {
  let cls = 'dash-tree-node';
  if (kind === 'entity') cls += ' dash-tree-node--entity';
  else if (kind === 'intermediate') cls += ' dash-tree-node--intermediate';
  else if (kind === 'fallback') cls += ' dash-tree-node--fallback';
  else if (kind === 'ubo') cls += holder && isDirectHolder(holder) ? ' dash-tree-node--ubo-direct' : ' dash-tree-node--ubo-indirect';
  return (
    <div className={cls}>
      <span className="dash-tree-node__icon">
        {kind === 'ubo' || kind === 'fallback' ? <Users size={14} /> : <Building2 size={14} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="dash-tree-node__label">{label}</div>
        <div className="dash-tree-node__sub">{sub}</div>
      </div>
    </div>
  );
}

function OwnershipTreeDiagram({ entity }) {
  const tree = entity.tree;
  if (!tree) return <div className="dash-empty-inline">No structure loaded.</div>;

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
    return {
      name,
      childrenIntermediates: children.map((c) => buildNode(c.name)),
      ubos: attachUbos(name),
    };
  };

  const topNodes = rootIntermediates.map((it) => buildNode(it.name));
  const directUbos = attachUbos(null);

  return (
    <div className="dash-tree">
      <div className="dash-tree__stage">
        <TreeNodeBox
          kind="entity"
          label={entity.name}
          sub={entity.registrationNumber ? `Reg. ${entity.registrationNumber}` : 'Legal entity'}
        />

        {(topNodes.length > 0 || directUbos.length > 0) && <div className="dash-tree__vline dash-tree__vline--tall" />}

        {(topNodes.length > 0 || directUbos.length > 0) ? (
          <div className="dash-tree__branch-row">
            <div className="dash-tree__hconnector" />
            <div className="dash-tree__cap dash-tree__cap--left" />
            <div className="dash-tree__cap dash-tree__cap--right" />

            {topNodes.map((node) => (
              <div key={`int-${node.name}`} className="dash-tree__branch">
                <div className="dash-tree__vline dash-tree__vline--med" />
                <TreeNodeBox
                  kind="intermediate"
                  label={node.name}
                  sub={`${node.ubos.length + node.childrenIntermediates.length} downstream`}
                />
                {(node.childrenIntermediates.length > 0 || node.ubos.length > 0) && (
                  <>
                    <div className="dash-tree__vline dash-tree__vline--med" />
                    <div className="dash-tree__children">
                      {node.childrenIntermediates.map((child) => (
                        <div key={`child-${child.name}`} className="dash-tree__branch">
                          <TreeNodeBox
                            kind="intermediate"
                            label={child.name}
                            sub={`${child.ubos.length} UBO${child.ubos.length === 1 ? '' : 's'}`}
                          />
                          {child.ubos.length > 0 && (
                            <>
                              <div className="dash-tree__vline dash-tree__vline--short" />
                              <div className="dash-tree__stack">
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
              <div key={`direct-${h.key}`} className="dash-tree__branch">
                <div className="dash-tree__vline dash-tree__vline--med" />
                <TreeNodeBox kind="ubo" label={h.fullName} sub={`${h.effectivePercentage}% direct`} holder={h} />
              </div>
            ))}
          </div>
        ) : null}

        {fallback && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="dash-tree__vline dash-tree__vline--med" />
            <TreeNodeBox kind="fallback" label={fallback.name} sub={fallback.position || 'Senior managing official'} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Chain trace
   ========================================================================== */
function ChainTraceBlock({ holder }) {
  const traceRows = (holder.paths || []).map((p) => ({
    chain: splitChain(p.chain),
    effective: Number(holder.effectivePercentage ?? p.percentage),
  }));
  if (traceRows.length === 0) return null;

  return (
    <div className="dash-chain">
      <div className="dash-chain__head">
        <span className="dash-chain__head-icon"><Link2 size={12} /></span>
        <span className="dash-chain__title">Chain</span>
      </div>
      {traceRows.map((row, rowIdx) => {
        const { chain, effective } = row;
        const isDirect = chain.length === 2;
        return (
          <div key={rowIdx} style={{ marginTop: rowIdx > 0 ? 8 : 0 }}>
            <div className="dash-chain__trace">
              {chain.map((part, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span className="dash-chain__arrow">→</span>}
                  <span className={`dash-chain__node${i === chain.length - 1 ? (isDirect ? ' dash-chain__node--end-direct' : ' dash-chain__node--end-indirect') : ''}`}>
                    {part}
                  </span>
                </span>
              ))}
            </div>
            <div className="dash-chain__result">
              <strong className={isDirect ? 'dash-chain__result-strong--direct' : 'dash-chain__result-strong--indirect'}>
                {effective}%
              </strong>{' '}{isDirect ? 'direct' : 'indirect'} interest
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Person card
   ========================================================================== */
function PersonDetailCard({ holder, kind = 'ubo' }) {
  const controls = holder.controlBasis || [];
  const idExpired = holder.idExpired ?? (holder.dateOfExpiry ? Date.parse(holder.dateOfExpiry) < Date.now() : false);
  return (
    <div className="dash-person">
      <div className="dash-person__head">
        <span className="dash-person__avatar"><Users size={14} /></span>
        <span className="dash-person__name">{holder.fullName || '—'}</span>
        {kind === 'ubo' && <span className="dash-chip dash-chip--ubo">UBO</span>}
        {kind === 'control' && <span className="dash-chip dash-chip--control">Control</span>}
        {holder.pep && <span className="dash-chip dash-chip--pep">PEP</span>}
        {idExpired && <span className="dash-chip dash-chip--pep">ID expired</span>}
        {holder.status && <StatusBadge status={holder.status} />}
        {holder.effectivePercentage != null && (
          <span className="dash-person__pct">
            <span className="dash-person__pct-value">{holder.effectivePercentage}%</span>
            <span className={`dash-person__pct-kind ${isDirectHolder(holder) ? 'dash-person__pct-kind--direct' : 'dash-person__pct-kind--indirect'}`}>
              {isDirectHolder(holder) ? 'direct' : 'indirect'}
            </span>
          </span>
        )}
      </div>
      <div className="dash-person__details">
        <Field k="Full name" v={holder.fullName || '—'} />
        {holder.boReference && <Field k="BO reference" v={holder.boReference} mono />}
        <Field k="Capacity" v={humanize(holder.capacity) || '—'} />
        <Field k="Ownership type" v={humanize(holder.ownershipType) || '—'} />
        <Field k="Control basis" v={controls.length ? controls.map((c) => controlBasisLabel[c] || humanize(c)).join(', ') : 'None recorded'} />
        <Field k="Gender" v={formatGender(holder.gender)} />
        <Field k="Nationality" v={holder.nationality || '—'} />
        <Field k="Place of birth" v={holder.placeOfBirth || '—'} />
        <Field k="Date of birth" v={formatDate(holder.dateOfBirth)} />
        <Field k="ID document type" v={humanize(holder.idDocumentType) || '—'} />
        <Field k="Fayda number" v={holder.idNumber || '—'} mono />
        <Field k="ID expiry" v={holder.dateOfExpiry ? `${formatDate(holder.dateOfExpiry)}${idExpired ? ' (expired)' : ''}` : '—'} />
        <Field k="Phone" v={holder.phoneNumber || holder.phone || holder.mobileNumber || holder.mobile || '—'} mono />
        <Field k="Email" v={holder.emailAddress || holder.email || '—'} />
        <Field k="Occupation" v={holder.occupation || '—'} />
        <Field k="Residential address" v={holder.residentialAddress || '—'} />
        <Field k="Politically exposed" v={holder.pep ? 'Yes' : 'No'} />
        <Field k="Sanctions screening" v={holder.sanctionsScreened ? (holder.sanctionsResult ? humanize(holder.sanctionsResult) : 'Screened') : 'Not screened'} />
        <Field k="Date became BO" v={formatDate(holder.dateBecameBo)} />
        {holder.dateCeased && <Field k="Date ceased" v={formatDate(holder.dateCeased)} />}
      </div>
      <ChainTraceBlock holder={holder} />
    </div>
  );
}

function FallbackDetailCard({ fallback }) {
  return (
    <div className="dash-fallback">
      <div className="dash-fallback__head">
        <span className="dash-fallback__avatar"><Users size={14} /></span>
        <span className="dash-fallback__name">{fallback.name}</span>
        <span className="dash-fallback__badge">Fallback</span>
      </div>
      <div className="dash-fallback__details">
        <Field k="Position" v={fallback.position || '—'} />
        <Field k="Justification" v={fallback.justification || '—'} />
      </div>
    </div>
  );
}

/* ==========================================================================
   Full structure
   ========================================================================== */
function OwnershipStructure({ entity }) {
  const tree = entity.tree;
  if (!tree) return null;
  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter(
    (h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl),
  );
  const fallback = tree.seniorManagingOfficial;

  return (
    <div className="dash-structure">
      {ubos.length > 0 && (
        <div className="dash-structure__section">
          <div className="dash-structure__label">Beneficial owners ({ubos.length})</div>
          {ubos.map((h) => <PersonDetailCard key={h.key} holder={h} kind="ubo" />)}
        </div>
      )}

      <OwnershipSummaryCard entity={entity} />

      {controlOnly.length > 0 && (
        <div className="dash-structure__section">
          <div className="dash-structure__label">Control-only holders ({controlOnly.length})</div>
          {controlOnly.map((h) => <PersonDetailCard key={h.key} holder={h} kind="control" />)}
        </div>
      )}

      {fallback && (
        <div className="dash-structure__section">
          <div className="dash-structure__label">Senior managing official (fallback)</div>
          <FallbackDetailCard fallback={fallback} />
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Risk distribution strip
   ========================================================================== */
function RiskDistribution({ entities, activeBand, onBandChange }) {
  const counts = useMemo(() => {
    const c = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    entities.forEach((e) => { if (e.risk) c[e.risk.band.key] += 1; });
    return c;
  }, [entities]);

  const total = counts.LOW + counts.MEDIUM + counts.HIGH;
  if (total === 0) return null;

  const chips = [
    { key: 'ALL', label: 'All', count: total, cls: 'dash-risk-chip--all' },
    ...RISK_BANDS.map((b) => ({
      key: b.key, label: b.label, count: counts[b.key],
      cls: `dash-risk-chip--${b.key.toLowerCase()}`,
    })),
  ];

  return (
    <div className="dash-risk-dist">
      <div className="dash-risk-dist__bar" aria-hidden="true">
        {RISK_BANDS.map((b) => {
          const pct = total > 0 ? (counts[b.key] / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={b.key} className={`dash-risk-dist__seg dash-risk-dist__seg--${b.key.toLowerCase()}`} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="dash-risk-dist__chips">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`dash-risk-chip ${c.cls}${activeBand === c.key ? ' dash-risk-chip--active' : ''}`}
            onClick={() => onBandChange(c.key)}
            aria-pressed={activeBand === c.key}
          >
            <span className="dash-risk-chip__dot" />
            <span className="dash-risk-chip__label">{c.label}</span>
            <span className="dash-risk-chip__score">{c.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Dashboard
   ========================================================================== */
const EXPLORER_TABS = [
  { key: 'overview', label: 'Risk & ownership' },
  { key: 'tree',     label: 'Structure tree' },
  { key: 'owners',   label: 'Owners' },
];

export default function Dashboard({ onRegister, canRegister }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [entityId, setEntityId] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);
  const [riskBand, setRiskBand] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('overview');

  /* Shared KPI/analytics background loader */
  const { failed: kpiFailed, retry: retryTrees } = useBackgroundTrees(legalPersons, trees, setTrees);
  const failed = useMemo(() => new Set(kpiFailed || []), [kpiFailed]);

  /* List of legal entities */
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    listLegalPersons({ size: 500, sort: 'createdAt,desc' })
      .then((listRes) => {
        if (cancelled) return;
        const list = listRes.content || [];
        setLegalPersons(list);
        if (list.length > 0 && !entityId) setEntityId(list[0].id);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load dashboard'))
      .finally(() => !cancelled && setLoadingList(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasTree = Boolean(trees[entityId]);

  /* Fetch the selected tree synchronously so the panel never sits blank.
     Depends on hasTree (not the whole map) so background loads don't abort it. */
  useEffect(() => {
    if (!entityId || hasTree) return undefined;
    let cancelled = false;
    setLoadingTree(true);
    const controller = new AbortController();
    getOwnershipTree(entityId, { signal: controller.signal })
      .then((t) => { if (!cancelled) setTrees((prev) => ({ ...prev, [entityId]: t })); })
      .catch((err) => {
        if (!cancelled && err?.name !== 'AbortError') {
          setError(err.friendlyMessage || 'Failed to load ownership structure');
        }
      })
      .finally(() => { if (!cancelled) setLoadingTree(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [entityId, hasTree]);

  /* Entities + risk, memoized */
  const entities = useMemo(
    () => legalPersons.map((lp) => {
      const tree = trees[lp.id];
      const risk = tree ? computeRisk(lp, tree) : null;
      return {
        id: lp.id,
        name: lp.name,
        registrationNumber: lp.registrationNumber,
        entityType: lp.entityType,
        sector: lp.sector,
        countryOfIncorporation: lp.countryOfIncorporation,
        createdAt: lp.createdAt,
        uboCount: (tree?.holders || []).filter((h) => h.ubo).length,
        fallback: tree?.seniorManagingOfficial || null,
        tree,
        risk,
      };
    }),
    [legalPersons, trees],
  );

  const filteredEntities = useMemo(() => {
    let list = entities;
    if (riskBand !== 'ALL') list = list.filter((e) => e.risk && e.risk.band.key === riskBand);
    if (statusFilter) {
      list = list.filter((e) => {
        const holders = (e.tree?.holders || []).filter((h) => h.ubo);
        if (holders.length === 0) return false;
        return holders.some((h) => {
          const s = String(h.status || '').toUpperCase();
          return statusFilter === 'VERIFIED' ? ['VERIFIED', 'APPROVED'].includes(s) : s === statusFilter;
        });
      });
    }
    return list;
  }, [entities, riskBand, statusFilter]);

  const selectedEntity = entities.find((e) => e.id === entityId) || null;

  /* Non-blocking filter change */
  const selectEntity = useCallback((id) => {
    startTransition(() => setEntityId(id));
  }, []);

  const retryFailed = useCallback(() => {
    retryTrees();
    setStatsRefreshKey((k) => k + 1);
  }, [retryTrees]);

  const handleStatusSelect = useCallback((key) => {
    // 'total' clears the filter; the other keys map 1:1 to Records.jsx statuses
    const next = key === 'total' ? '' : key.toUpperCase();
    startTransition(() => setStatusFilter((cur) => (cur === next ? '' : next)));
  }, []);

  return (
    <div className="dashboard-root">
      {/* Header */}
      <div className="dashboard-header dashboard-no-print">
        <div>
          <div className="dashboard-header__title-row">
            <h1 className="dashboard-header__title">Overview</h1>
            {(riskBand !== 'ALL' || statusFilter) && <span className="dashboard-pill"><Filter size={12} /> Filtered</span>}
            {riskBand !== 'ALL' && (
              <span className={`dash-risk-chip dash-risk-chip--${riskBand.toLowerCase()} dash-risk-chip--small`}>
                <span className="dash-risk-chip__dot" />
                <span className="dash-risk-chip__label">{riskBand} risk</span>
                <button type="button" className="dash-risk-chip__x" aria-label="Clear risk filter" onClick={() => setRiskBand('ALL')}>
                  <X size={10} />
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="dash-status-chip dash-status-chip--small">
                <span className="dash-status-chip__label">{statusFilter}</span>
                <button type="button" className="dash-risk-chip__x" aria-label="Clear status filter" onClick={() => setStatusFilter('')}>
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
          <div className="dashboard-header__subtitle">
            Beneficial ownership by legal entity — chart, summary, tree, risk & status
          </div>
        </div>

        <div className="dashboard-header__actions">
          {failed.size > 0 && (
            <Btn variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={retryFailed}>
              Retry {failed.size} failed
            </Btn>
          )}
          {isPending && (
            <span className="dash-header__pending" aria-live="polite">
              <Loader2 size={12} className="dash-spin" /> Updating…
            </span>
          )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="dash-error"
          >
            <AlertTriangle size={14} /><span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI row — same source as Records.jsx, includes Rejected & Ceased */}
      <div className="dashboard-printable">
        <DashboardKpis
          legalPersons={legalPersons}
          trees={trees}
          loadingList={loadingList}
          failed={failed}
          activeStatus={statusFilter ? statusFilter.toLowerCase() : 'total'}
          onSelectStatus={handleStatusSelect}
          refreshKey={statsRefreshKey}
        />
      </div>

      {/* Portfolio analytics */}
      <div className="dashboard-printable">
        <PortfolioAnalytics
          legalPersons={legalPersons}
          trees={trees}
          loadingList={loadingList}
          onSelectEntity={(id) => {
            selectEntity(id);
            document.getElementById('dash-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      </div>

      {/* Risk distribution */}
      <div className="dashboard-no-print">
        <RiskDistribution
          entities={entities}
          activeBand={riskBand}
          onBandChange={(b) => startTransition(() => setRiskBand(b))}
        />
      </div>

      {/* Entity explorer */}
      <div id="dash-explorer" className="dashboard-no-print" style={{ scrollMarginTop: 80, margin: '8px 0 12px' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.015em' }}>Entity explorer</h2>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Pick a legal entity to see its ownership distribution, tree, beneficial owners, and risk profile.</div>
      </div>

      {/* Filter */}
      <div className="dash-filter-card dashboard-no-print">
        <div className="dash-filter-card__head">
          <span className="dash-filter-card__label"><Filter size={12} /> Filter by legal entity</span>
          <span className="dash-filter-card__divider" />
          {entityId && (
            <Btn variant="ghost" size="sm" icon={<X size={12} />} onClick={() => selectEntity('')}>
              Clear
            </Btn>
          )}
        </div>
        <EntityCombobox
          options={filteredEntities.map((e) => ({
            value: e.id, label: e.name, sub: e.registrationNumber, risk: e.risk,
          }))}
          value={entityId}
          onChange={selectEntity}
          loading={loadingList}
        />
        {selectedEntity && (
          <div className="dash-filter-card__meta">
            <span>Showing structure for</span>
            <strong>{selectedEntity.name}</strong>
            {selectedEntity.registrationNumber && <span className="dash-filter-card__meta-mono">· {selectedEntity.registrationNumber}</span>}
            <span className="dash-filter-card__meta-ubo">
              <span className="dash-filter-card__dot" />
              <span style={{ fontWeight: 600, color: 'var(--dash-success)' }}>
                {selectedEntity.uboCount} UBO{selectedEntity.uboCount === 1 ? '' : 's'}
              </span>
            </span>
            {selectedEntity.risk && <RiskBadge risk={selectedEntity.risk} />}
          </div>
        )}
      </div>

      {/* Loading skeleton for the selected tree */}
      {entityId && loadingTree && !selectedEntity?.tree && (
        <div className="dash-bento dashboard-printable">
          <div className="dash-panel col-12">
            <div className="dash-panel__head">
              <Skeleton h={14} w={140} r={6} />
            </div>
            <div className="dash-skeleton-stack">
              <Skeleton h={220} r={14} />
              <Skeleton h={180} r={14} />
              <Skeleton h={260} r={14} />
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!entityId && (
        <div className="dash-empty">
          <span className="dash-empty__icon"><Building2 size={36} /></span>
          <div className="dash-empty__title">Select a legal entity</div>
          <div className="dash-empty__desc">Choose an entity to view its chart, summary, tree, risk profile, and structure.</div>
        </div>
      )}

      {/* Filtered-empty state */}
      {entityId && (riskBand !== 'ALL' || statusFilter) && filteredEntities.length === 0 && (
        <div className="dash-empty">
          <span className="dash-empty__icon"><Sparkles size={36} /></span>
          <div className="dash-empty__title">No entities match the current filters</div>
          <div className="dash-empty__desc">Clear the risk or status filter to see all entities.</div>
          <Btn variant="outline" size="sm" onClick={() => { setRiskBand('ALL'); setStatusFilter(''); }}>Clear filters</Btn>
        </div>
      )}

      {entityId && selectedEntity && selectedEntity.tree && (
        <div className="dash-explorer-body dashboard-printable">
          <div className="dash-tabs dashboard-no-print" role="tablist" aria-label="Entity details">
            {EXPLORER_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`dash-tab${tab === t.key ? ' dash-tab--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === 'owners' && <span className="dash-tab__count">{selectedEntity.uboCount}</span>}
              </button>
            ))}
          </div>

          <div className="dash-bento dash-tabpanel" hidden={tab !== 'overview'}>
            <div className="dash-panel col-5">
              <div className="dash-panel__head">
                <span className="dash-panel__head-icon"><ShieldAlert size={14} /></span>
                <span className="dash-panel__title">Risk profile</span>
              </div>
              <RiskPanel risk={selectedEntity.risk} />
            </div>
            <div className="dash-panel col-7">
              <div className="dash-panel__head">
                <span className="dash-panel__head-icon"><PieIcon size={14} /></span>
                <span className="dash-panel__title">Ownership distribution</span>
              </div>
              <div className="dash-pie-wrap">
                <OwnershipPieChart entity={selectedEntity} />
              </div>
            </div>
          </div>

          <div className="dash-bento dash-tabpanel" hidden={tab !== 'tree'}>
            <div className="dash-panel col-12">
              <div className="dash-panel__head">
                <span className="dash-panel__head-icon"><GitBranch size={14} /></span>
                <span className="dash-panel__title">Ownership tree — {selectedEntity.name}</span>
              </div>
              <OwnershipTreeDiagram entity={selectedEntity} />
            </div>
          </div>

          <div className="dash-bento dash-tabpanel" hidden={tab !== 'owners'}>
            <div className="dash-panel col-12">
              <div className="dash-panel__head">
                <span className="dash-panel__head-icon"><Users size={14} /></span>
                <span className="dash-panel__title">Detailed structure</span>
              </div>
              <OwnershipStructure entity={selectedEntity} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
