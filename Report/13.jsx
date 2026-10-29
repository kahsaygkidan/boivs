import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area,
} from 'recharts';
import {
  Building2, Users, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Search, X, Filter, Printer, Link2, PieChart as PieIcon, GitBranch, Plus,
} from 'lucide-react';
import { listLegalPersons, getOwnershipTree } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import './Dashboard.css';

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

const formatDate = (v) => {
  if (!v) return '—';
  const [y, m, d] = String(v).split('-');
  return y && m && d ? `${d}/${m}/${y}` : v;
};

const isDirectHolder = (holder) => {
  const paths = holder.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};

const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate',
  MOTOR_DEALERSHIP: 'Motor Dealership', IMPORT_EXPORT: 'Import / Export',
  FINANCIAL: 'Financial',
};

/* Count-up hook for KPI values */
function useCountUp(target, duration = 650) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target == null) { setVal(0); return; }
    const start = performance.now();
    const from = 0;
    const to = Number(target);
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
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
   KPI tile (modern, with count-up + sparkline + delta)
   ========================================================================== */
const KPI_TONE = {
  neutral: { accent: '#64748B', bg: '#F1F5F9' },
  success: { accent: '#10B981', bg: '#ECFDF5' },
  warn:    { accent: '#F59E0B', bg: '#FFFBEB' },
  danger:  { accent: '#EF4444', bg: '#FEF2F2' },
  info:    { accent: '#3B82F6', bg: '#EFF6FF' },
};

function ModernKpi({ label, value, tone = 'neutral', icon: Icon, caption, delta, spark, loading }) {
  const t = KPI_TONE[tone];
  const counted = useCountUp(loading ? 0 : value);
  const up = delta != null && delta >= 0;
  const gradientId = `spark-${label.replace(/\s+/g, '-')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="kpi-card"
      style={{ '--accent': t.accent, '--tone-bg': t.bg }}
    >
      <div className="kpi-card__head">
        <span className="kpi-card__icon">{Icon && <Icon size={16} />}</span>
        <span className="kpi-card__label">{label}</span>
      </div>
      <div className="kpi-card__row">
        <span className="kpi-card__value">{loading ? '—' : (value == null ? '—' : counted)}</span>
        {delta != null && (
          <span className={`kpi-card__delta ${up ? 'is-up' : 'is-down'}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {caption && <div className="kpi-card__caption">{caption}</div>}
      {spark?.length > 0 && (
        <div className="kpi-card__spark">
          <ResponsiveContainer width="100%" height={36}>
            <AreaChart data={spark}>
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={t.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="v" stroke={t.accent} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

/* ==========================================================================
   Searchable entity combobox
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
                <span>{o.label}</span>
                {o.sub && <span className="dash-combo__sub">{o.sub}</span>}
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
  const ubos = (tree?.holders || []).filter((h) => h.ubo);

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

  if (!tree) return (
    <div className="dash-empty-inline">No ownership data loaded yet.</div>
  );
  if (chartData.length === 0) return (
    <div className="dash-empty-inline">No UBO ownership recorded.</div>
  );

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
          <div className="dash-pie-center__value">{total}%</div>
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
            <div className="dash-pie-legend__value">{directSlice.value}%</div>
            <div className="dash-pie-legend__names">{directSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
        {indirectSlice && (
          <div className="dash-pie-legend__card dash-pie-legend__card--indirect">
            <div className="dash-pie-legend__row">
              <span className="dash-pie-legend__swatch dash-pie-legend__swatch--indirect" />
              <span className="dash-pie-legend__label dash-pie-legend__label--indirect">Indirect</span>
            </div>
            <div className="dash-pie-legend__value">{indirectSlice.value}%</div>
            <div className="dash-pie-legend__names">{indirectSlice.holders.map((h) => h.name).join(', ')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   UBO status stacked bar
   ========================================================================== */
function UboStatusChart({ entities }) {
  const data = useMemo(
    () => entities.filter((e) => e.tree).map((e) => {
      const hs = (e.tree.holders || []).filter((h) => h.ubo);
      return {
        name: e.name.length > 18 ? e.name.slice(0, 17) + '…' : e.name,
        Verified: hs.filter((h) => ['VERIFIED', 'APPROVED'].includes(h.status) || h.registered).length,
        Pending: hs.filter((h) => h.status === 'PENDING').length,
        Rejected: hs.filter((h) => h.status === 'REJECTED').length,
      };
    }),
    [entities],
  );

  if (data.length === 0) return <div className="dash-empty-inline">No UBOs loaded.</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-15} dy={8} height={50} />
        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Verified" stackId="a" fill="#10B981" />
        <Bar dataKey="Pending" stackId="a" fill="#F59E0B" />
        <Bar dataKey="Rejected" stackId="a" fill="#EF4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Sector radar
   ========================================================================== */
function SectorRadar({ entities }) {
  const data = useMemo(() => {
    const counts = {};
    entities.forEach((e) => {
      const s = SECTOR_LABELS[e.sector] || 'Other';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([sector, v]) => ({ sector, v }));
  }, [entities]);

  if (data.length === 0) return <div className="dash-empty-inline">No sector data.</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="sector" tick={{ fontSize: 11, fill: '#475569' }} />
        <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
        <Radar dataKey="v" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.25} strokeWidth={2} isAnimationActive />
      </RadarChart>
    </ResponsiveContainer>
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
  return (
    <div className="dash-person">
      <div className="dash-person__head">
        <span className="dash-person__avatar"><Users size={14} /></span>
        <span className="dash-person__name">{holder.fullName || '—'}</span>
        {kind === 'ubo' && <span className="dash-chip dash-chip--ubo">UBO</span>}
        {kind === 'control' && <span className="dash-chip dash-chip--control">Control</span>}
        {holder.pep && <span className="dash-chip dash-chip--pep">PEP</span>}
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
        <Field k="Gender" v={formatGender(holder.gender)} />
        <Field k="Nationality" v={holder.nationality || '—'} />
        <Field k="Place of birth" v={holder.placeOfBirth || '—'} />
        <Field k="Date of birth" v={formatDate(holder.dateOfBirth)} />
        <Field k="Fayda number" v={holder.idNumber || '—'} mono />
        <Field k="Phone" v={holder.phoneNumber || '—'} mono />
        <Field k="Email" v={holder.emailAddress || '—'} />
        <Field k="Occupation" v={holder.occupation || '—'} />
        <Field k="Residential address" v={holder.residentialAddress || '—'} />
        <Field k="Date became BO" v={formatDate(holder.dateBecameBo)} />
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
   Order: Beneficial owners → Ownership chain summary → Control-only → Fallback
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

      {/* Ownership chain summary — rendered BELOW the beneficial owners list */}
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
   Dashboard
   ========================================================================== */
export default function Dashboard({ onRegister, canRegister }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [entityId, setEntityId] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!entityId || trees[entityId]) return;
    let cancelled = false;
    setLoadingTree(true);
    getOwnershipTree(entityId)
      .then((t) => { if (!cancelled) setTrees((prev) => ({ ...prev, [entityId]: t })); })
      .catch((err) => { if (!cancelled) setError(err.friendlyMessage || 'Failed to load ownership structure'); })
      .finally(() => { if (!cancelled) setLoadingTree(false); });
    return () => { cancelled = true; };
  }, [entityId, trees]);

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
        createdAt: lp.createdAt,
        uboCount: ubos.length,
        fallback: tree?.seniorManagingOfficial || null,
        tree,
      };
    }),
    [legalPersons, trees],
  );

  const selectedEntity = entities.find((e) => e.id === entityId) || null;

  const totals = useMemo(() => {
    const loaded = entities.filter((e) => e.tree);
    const totalUbos = loaded.reduce((s, e) => s + e.uboCount, 0);
    const verified = loaded.reduce(
      (s, e) => s + (e.tree?.holders || []).filter(
        (h) => h.ubo && (h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered),
      ).length,
      0,
    );
    const pending = loaded.reduce(
      (s, e) => s + (e.tree?.holders || []).filter((h) => h.ubo && h.status === 'PENDING').length,
      0,
    );
    return { totalUbos, verified, pending };
  }, [entities]);

  /* Fake spark data so the KPI tiles feel alive (replace with real history later) */
  const spark = (base) => [...Array(8)].map((_, i) => ({ v: base + i * 2 + (i % 3) }));

  return (
    <div className="dashboard-root">
      {/* Header */}
      <div className="dashboard-header dashboard-no-print">
        <div>
          <div className="dashboard-header__title-row">
            <h1 className="dashboard-header__title">Overview</h1>
            {entityId && <span className="dashboard-pill"><Filter size={12} /> Filtered</span>}
          </div>
          <div className="dashboard-header__subtitle">
            Beneficial ownership by legal entity — chart, summary & tree
          </div>
        </div>
        <div className="dashboard-header__actions">
          {entityId && (
            <Btn variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>
              Print
            </Btn>
          )}
          {canRegister && (
            <Btn variant="primary" size="lg" icon={<Plus size={14} />} onClick={onRegister}>
              New record
            </Btn>
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

      {/* KPI row */}
      <div className="dash-kpi-grid dashboard-printable">
        <ModernKpi label="Legal entities" value={entities.length} icon={Building2} caption="Registered customers" loading={loadingList} spark={spark(8)} delta={4.2} />
        <ModernKpi label="Total UBOs" value={totals.totalUbos} icon={Users} tone="info" caption={selectedEntity ? 'In selected entity' : 'Across loaded entities'} loading={loadingTree && !selectedEntity} spark={spark(12)} delta={8.1} />
        <ModernKpi label="Verified" value={totals.verified} icon={CheckCircle2} tone="success" caption="Approved by checker" loading={loadingTree && !selectedEntity} spark={spark(6)} delta={12.5} />
        <ModernKpi label="Pending" value={totals.pending} icon={Clock} tone="warn" caption="Awaiting approval" loading={loadingTree && !selectedEntity} spark={spark(4)} delta={-3.1} />
      </div>

      {/* Filter */}
      <div className="dash-filter-card dashboard-no-print">
        <div className="dash-filter-card__head">
          <span className="dash-filter-card__label"><Filter size={12} /> Filter by legal entity</span>
          <span className="dash-filter-card__divider" />
          {entityId && (
            <Btn variant="ghost" size="sm" icon={<X size={12} />} onClick={() => setEntityId('')}>
              Clear
            </Btn>
          )}
        </div>
        <EntityCombobox
          options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))}
          value={entityId}
          onChange={setEntityId}
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
          </div>
        )}
      </div>

      {/* Empty state */}
      {!entityId && (
        <div className="dash-empty">
          <span className="dash-empty__icon"><Building2 size={36} /></span>
          <div className="dash-empty__title">Select a legal entity</div>
          <div className="dash-empty__desc">Choose an entity to view its chart, summary, tree, and structure.</div>
        </div>
      )}

      {/* Bento grid — every panel full-width so charts and trees never get squeezed */}
      {entityId && selectedEntity && (
        <div className="dash-bento dashboard-printable">
          {selectedEntity.tree && (
            <>
              {/* 1) Ownership distribution — full-width row */}
              <div className="dash-panel col-12">
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><PieIcon size={14} /></span>
                  <span className="dash-panel__title">Ownership distribution</span>
                </div>
                <div className="dash-pie-wrap">
                  <OwnershipPieChart entity={selectedEntity} />
                </div>
              </div>

              {/* 2) Sector radar — full-width row */}
              <div className="dash-panel col-12" style={{ minHeight: 280 }}>
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><Building2 size={14} /></span>
                  <span className="dash-panel__title">Entities by sector</span>
                </div>
                <div style={{ height: 240 }}>
                  <SectorRadar entities={entities} />
                </div>
              </div>

              {/* 3) UBO status stacked bar — full-width row */}
              <div className="dash-panel col-12" style={{ minHeight: 320 }}>
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><Users size={14} /></span>
                  <span className="dash-panel__title">UBO status by entity</span>
                </div>
                <div style={{ height: 280 }}>
                  <UboStatusChart entities={entities} />
                </div>
              </div>

              {/* 4) Ownership tree — full-width row */}
              <div className="dash-panel col-12">
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><GitBranch size={14} /></span>
                  <span className="dash-panel__title">Ownership tree — {selectedEntity.name}</span>
                </div>
                <OwnershipTreeDiagram entity={selectedEntity} />
              </div>

              {/* 5) Detailed structure — UBO list, then ownership summary beneath it */}
              <div className="dash-panel col-12">
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><Users size={14} /></span>
                  <span className="dash-panel__title">Detailed structure</span>
                </div>
                <OwnershipStructure entity={selectedEntity} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
