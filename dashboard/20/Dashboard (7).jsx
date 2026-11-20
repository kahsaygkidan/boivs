import {
  lazy, Suspense, memo, useCallback, useEffect, useId, useMemo, useRef, useState, useTransition,
} from 'react';
import {
  Building2, Users, AlertTriangle, ShieldAlert, ShieldCheck, Shield,
  Search, X, Filter, Link2, PieChart as PieIcon, GitBranch,
  Loader2, RefreshCw, Sparkles,
} from 'lucide-react';
import { listLegalPersons, getOwnershipTree } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { DashboardKpis, useBackgroundTrees } from '../components/DashboardKpis.jsx';
import { splitChain, isDirectHolder, RISK_BANDS, computeRiskCached } from '../utils/dashboardModel.js';
import '../styles/Dashboard.css';

/* Charts (recharts) load on demand so KPIs and the entity list paint first. */
const PortfolioAnalytics = lazy(() => import('../components/DashboardAnalytics.jsx'));
const OwnershipPieChart = lazy(() => import('../components/OwnershipPie.jsx'));

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
const MAX_OPTIONS = 100;

const EntityCombobox = memo(function EntityCombobox({ options, value, onChange, placeholder = 'Search entity…', loading }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const listId = useId();
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q));
  }, [options, query]);
  // Render at most MAX_OPTIONS rows — 500 DOM rows per keystroke is the slow part.
  const filtered = useMemo(() => matches.slice(0, MAX_OPTIONS), [matches]);

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
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${hi}`)?.scrollIntoView({ block: 'nearest' });
  }, [hi, open, listId]);

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
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[hi] ? `${listId}-${hi}` : undefined}
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
          <ul className="dash-combo__list" role="listbox" id={listId}>
            {filtered.length === 0 && <li className="dash-combo__empty">No entity found</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
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
            {matches.length > MAX_OPTIONS && (
              <li className="dash-combo__empty">Showing {MAX_OPTIONS} of {matches.length} — keep typing to narrow</li>
            )}
          </ul>
        )}
      </div>
    </label>
  );
});

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
      .map((c) => (c.pct != null ? `${c.pct}% owned by ${c.to}` : `owned by ${c.to}`))
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
        <span className="dash-summary__title">Ownership summary — {entity.name}</span>
      </div>
      <ul className="dash-summary__list">
        {bullets.map((b, i) => <li key={i} className="dash-summary__item">{b}</li>)}
      </ul>
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

const LoadingInline = <div className="dash-empty-inline">Loading…</div>;

export default function Dashboard({ onRegister, canRegister }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [totalEntities, setTotalEntities] = useState(null);
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

  /* Shared KPI/analytics background loader (batched, retryable) */
  const { failed, retry: retryTrees } = useBackgroundTrees(legalPersons, trees, setTrees);

  /* List of legal entities */
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    listLegalPersons({ size: 500, sort: 'createdAt,desc' })
      .then((listRes) => {
        if (cancelled) return;
        const list = listRes.content || [];
        setLegalPersons(list);
        setTotalEntities(Number.isFinite(listRes.totalElements) ? listRes.totalElements : list.length);
        if (list.length > 0) setEntityId((cur) => cur || list[0].id);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load dashboard'))
      .finally(() => !cancelled && setLoadingList(false));
    return () => { cancelled = true; };
  }, []);

  const hasTree = Boolean(trees[entityId]);

  /* Selected entity's tree is fetched immediately so the panel never sits blank. */
  useEffect(() => {
    if (!entityId || hasTree) return undefined;
    let cancelled = false;
    setLoadingTree(true);
    const controller = new AbortController();
    getOwnershipTree(entityId, { signal: controller.signal })
      .then((t) => { if (!cancelled) setTrees((prev) => (prev[entityId] ? prev : { ...prev, [entityId]: t })); })
      .catch((err) => {
        if (!cancelled && err?.name !== 'AbortError') {
          setError(err.friendlyMessage || 'Failed to load ownership structure');
        }
      })
      .finally(() => { if (!cancelled) setLoadingTree(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [entityId, hasTree]);

  /* Entities + risk (risk is cached per tree, so a batch only scores new trees) */
  const entities = useMemo(
    () => legalPersons.map((lp) => {
      const tree = trees[lp.id];
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
        risk: computeRiskCached(lp, tree),
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

  const comboOptions = useMemo(
    () => filteredEntities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber, risk: e.risk })),
    [filteredEntities],
  );

  const selectedEntity = useMemo(() => entities.find((e) => e.id === entityId) || null, [entities, entityId]);
  const truncated = totalEntities != null && totalEntities > legalPersons.length;

  const selectEntity = useCallback((id) => {
    startTransition(() => setEntityId(id));
  }, []);

  const openInExplorer = useCallback((id) => {
    startTransition(() => setEntityId(id));
    document.getElementById('dash-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const retryFailed = useCallback(() => {
    retryTrees();
    setStatsRefreshKey((k) => k + 1);
  }, [retryTrees]);

  const handleStatusSelect = useCallback((key) => {
    const next = key === 'total' ? '' : key.toUpperCase();
    startTransition(() => setStatusFilter((cur) => (cur === next ? '' : next)));
  }, []);

  const onTabKey = (e) => {
    const i = EXPLORER_TABS.findIndex((t) => t.key === tab);
    let n;
    if (e.key === 'ArrowRight') n = (i + 1) % EXPLORER_TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + EXPLORER_TABS.length) % EXPLORER_TABS.length;
    else return;
    e.preventDefault();
    const k = EXPLORER_TABS[n].key;
    setTab(k);
    document.getElementById(`dash-tab-${k}`)?.focus();
  };

  return (
    <div className="dashboard-root">
      {/* Header + KPI row */}
      <div className="dashboard-header dashboard-no-print">
        <div>
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
          <div className="dashboard-header__title-row">
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

      {error && (
        <div className="dash-error" role="alert">
          <AlertTriangle size={14} /><span>{error}</span>
        </div>
      )}

      {/* A silently truncated portfolio is a compliance risk — say so. */}
      {truncated && (
        <div className="dash-error" role="alert">
          <AlertTriangle size={14} />
          <span>Showing {legalPersons.length} of {totalEntities} entities. Portfolio charts and risk bands cover only these.</span>
        </div>
      )}

      {/* Portfolio analytics */}
      <div className="dashboard-printable">
        <Suspense fallback={<Skeleton h={236} r={16} />}>
          <PortfolioAnalytics
            legalPersons={legalPersons}
            trees={trees}
            loadingList={loadingList}
            onSelectEntity={openInExplorer}
          />
        </Suspense>
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
          options={comboOptions}
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
      {(riskBand !== 'ALL' || statusFilter) && filteredEntities.length === 0 && (
        <div className="dash-empty">
          <span className="dash-empty__icon"><Sparkles size={36} /></span>
          <div className="dash-empty__title">No entities match the current filters</div>
          <div className="dash-empty__desc">Clear the risk or status filter to see all entities.</div>
          <Btn variant="outline" size="sm" onClick={() => { setRiskBand('ALL'); setStatusFilter(''); }}>Clear filters</Btn>
        </div>
      )}

      {entityId && selectedEntity && selectedEntity.tree && (
        <div className="dash-explorer-body dashboard-printable">
          <div className="dash-tabs dashboard-no-print" role="tablist" aria-label="Entity details" onKeyDown={onTabKey}>
            {EXPLORER_TABS.map((t) => (
              <button
                key={t.key}
                id={`dash-tab-${t.key}`}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                aria-controls={`dash-panel-${t.key}`}
                tabIndex={tab === t.key ? 0 : -1}
                className={`dash-tab${tab === t.key ? ' dash-tab--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === 'owners' && <span className="dash-tab__count">{selectedEntity.uboCount}</span>}
              </button>
            ))}
          </div>

          {/* Only the active tab is mounted — the other two no longer render in the background. */}
          {tab === 'overview' && (
            <div className="dash-bento dash-tabpanel" role="tabpanel" id="dash-panel-overview" aria-labelledby="dash-tab-overview">
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
                  <Suspense fallback={LoadingInline}>
                    <OwnershipPieChart entity={selectedEntity} />
                  </Suspense>
                </div>
              </div>
            </div>
          )}

          {tab === 'tree' && (
            <div className="dash-bento dash-tabpanel" role="tabpanel" id="dash-panel-tree" aria-labelledby="dash-tab-tree">
              <div className="dash-panel col-12">
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><GitBranch size={14} /></span>
                  <span className="dash-panel__title">Ownership tree — {selectedEntity.name}</span>
                </div>
                <OwnershipTreeDiagram entity={selectedEntity} />
              </div>
            </div>
          )}

          {tab === 'owners' && (
            <div className="dash-bento dash-tabpanel" role="tabpanel" id="dash-panel-owners" aria-labelledby="dash-tab-owners">
              <div className="dash-panel col-12">
                <div className="dash-panel__head">
                  <span className="dash-panel__head-icon"><Users size={14} /></span>
                  <span className="dash-panel__title">Detailed structure</span>
                </div>
                <OwnershipStructure entity={selectedEntity} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
