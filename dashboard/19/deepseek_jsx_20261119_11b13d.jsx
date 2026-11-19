import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, CheckCircle2, Clock, XCircle, Archive,
  Building2, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';
import { getDashboardStats, getOwnershipTree } from '../api/bovsApi.js';

/* ==========================================================================
   Status keys — MUST match Records.jsx STATUS_TABS exactly.
   The dashboard reads the same getDashboardStats() payload the Records page
   uses, so both views always agree.
   ========================================================================== */
export const STATUS_KPIS = [
  { key: 'total',    label: 'Total records',  icon: Users,        tone: 'neutral' },
  { key: 'pending',  label: 'Pending review', icon: Clock,        tone: 'warn'    },
  { key: 'verified', label: 'Verified',       icon: CheckCircle2, tone: 'success' },
  { key: 'rejected', label: 'Rejected',       icon: XCircle,      tone: 'danger'  },
  { key: 'ceased',   label: 'Ceased',         icon: Archive,      tone: 'muted'   },
];

/* ==========================================================================
   Shared background tree loader — bounded concurrency, deduped, abortable.
   Returns a Set of entity ids whose tree fetch failed.
   ========================================================================== */
export function useBackgroundTrees(legalPersons, trees, setTrees) {
  const inflight = useRef(new Map());
  const attempted = useRef(new Set());
  const [failed, setFailed] = useState(() => new Set());

  useEffect(() => {
    if (!legalPersons?.length) return undefined;

    const CONCURRENCY = 6;
    const pending = legalPersons
      .map((lp) => lp.id)
      .filter((id) => !trees[id] && !attempted.current.has(id) && !inflight.current.has(id));
    if (pending.length === 0) return undefined;

    let active = 0;
    let cursor = 0;
    let cancelled = false;

    const pump = () => {
      if (cancelled) return;
      while (active < CONCURRENCY && cursor < pending.length) {
        const id = pending[cursor++];
        active += 1;
        attempted.current.add(id);

        const controller = new AbortController();
        inflight.current.set(id, controller);

        getOwnershipTree(id, { signal: controller.signal })
          .then((t) => {
            if (cancelled) return;
            setTrees((prev) => (prev[id] ? prev : { ...prev, [id]: t }));
          })
          .catch(() => {
            if (cancelled) return;
            setFailed((prev) => {
              const next = new Set(prev);
              next.add(id);
              return next;
            });
          })
          .finally(() => {
            inflight.current.delete(id);
            active -= 1;
            pump();
          });
      }
    };
    pump();

    return () => {
      cancelled = true;
      inflight.current.forEach((c) => c.abort());
      inflight.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalPersons]);

  return { failed };
}

/* ==========================================================================
   KPI tile
   ========================================================================== */
const KpiCard = memo(function KpiCard({ kpi, value, loading, isActive, onClick }) {
  const Icon = kpi.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`dash-kpi dash-kpi--${kpi.tone}${isActive ? ' dash-kpi--active' : ''}${loading ? ' dash-kpi--loading' : ''}`}
    >
      <span className="dash-kpi__icon"><Icon size={18} /></span>
      <span className="dash-kpi__body">
        <span className="dash-kpi__label">{kpi.label}</span>
        <span className="dash-kpi__value">
          {loading
            ? <span className="dash-kpi__spinner"><Loader2 size={14} className="dash-spin" /></span>
            : (value ?? '—')}
        </span>
      </span>
    </button>
  );
});

/* ==========================================================================
   KPI row — reads from getDashboardStats() exactly like Records.jsx
   ========================================================================== */
export function DashboardKpis({
  legalPersons = [],
  trees = {},
  loadingList = false,
  failed = new Set(),
  onSelectStatus,
  activeStatus = '',
  refreshKey = 0,
}) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [statsReloadKey, setStatsReloadKey] = useState(0);

  const loadStats = useCallback(() => {
    let cancelled = false;
    setLoadingStats(true);
    getDashboardStats()
      .then((s) => { if (!cancelled) { setStats(s); setStatsError(null); } })
      .catch((err) => {
        if (cancelled) return;
        setStats(null);
        setStatsError(err?.friendlyMessage || 'Failed to load stats');
      })
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => loadStats(), [loadStats, statsReloadKey, refreshKey]);

  /* Fallback: if the stats endpoint is unavailable, derive secondary metrics
     from the entity/tree data we already have so the row never goes blank. */
  const derived = useMemo(() => {
    if (stats) return null;
    let ubos = 0;
    let pep = 0;
    let withFallback = 0;
    let noUbo = 0;
    legalPersons.forEach((lp) => {
      const t = trees[lp.id];
      if (!t) return;
      const holders = (t.holders || []).filter((h) => h.ubo);
      ubos += holders.length;
      pep += holders.filter((h) => h.pep).length;
      if (t.seniorManagingOfficial) withFallback += 1;
      if (holders.length === 0) noUbo += 1;
    });
    return { ubos, pep, withFallback, noUbo };
  }, [stats, legalPersons, trees]);

  const values = {
    total:    stats?.total    ?? null,
    pending:  stats?.pending  ?? null,
    verified: stats?.verified ?? null,
    rejected: stats?.rejected ?? null,
    ceased:   stats?.ceased   ?? null,
  };

  const anyLoading = loadingStats && !stats;
  const failedCount = failed instanceof Set ? failed.size : (failed?.length || 0);

  return (
    <section className="dash-kpi-section" aria-label="Key metrics">
      <div className="dash-kpi-grid">
        {STATUS_KPIS.map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            value={values[kpi.key]}
            loading={anyLoading}
            isActive={activeStatus === kpi.key}
            onClick={() => onSelectStatus?.(kpi.key)}
          />
        ))}
      </div>

      {/* Secondary line: derived data + health */}
      <div className="dash-kpi-meta">
        {derived && (
          <>
            <span className="dash-kpi-meta__item">
              <Users size={12} /> {derived.ubos} natural-person UBO{derived.ubos === 1 ? '' : 's'}
            </span>
            {derived.pep > 0 && (
              <span className="dash-kpi-meta__item dash-kpi-meta__item--warn">
                <AlertTriangle size={12} /> {derived.pep} PEP{derived.pep === 1 ? '' : 's'}
              </span>
            )}
            {derived.withFallback > 0 && (
              <span className="dash-kpi-meta__item">
                <Archive size={12} /> {derived.withFallback} fallback-only
              </span>
            )}
            {derived.noUbo > 0 && (
              <span className="dash-kpi-meta__item dash-kpi-meta__item--danger">
                <XCircle size={12} /> {derived.noUbo} without UBO
              </span>
            )}
          </>
        )}

        {statsError && (
          <span className="dash-kpi-meta__item dash-kpi-meta__item--danger">
            <AlertTriangle size={12} /> {statsError}
            <button
              type="button"
              className="dash-kpi-meta__retry"
              onClick={() => setStatsReloadKey((k) => k + 1)}
            >
              <RefreshCw size={11} /> Retry
            </button>
          </span>
        )}

        {failedCount > 0 && (
          <span className="dash-kpi-meta__item dash-kpi-meta__item--warn">
            <AlertTriangle size={12} /> {failedCount} structure load{failedCount === 1 ? '' : 's'} failed
          </span>
        )}

        {loadingList && !legalPersons.length && (
          <span className="dash-kpi-meta__item">
            <Loader2 size={12} className="dash-spin" /> Loading entities…
          </span>
        )}

        {!loadingList && legalPersons.length > 0 && (
          <span className="dash-kpi-meta__item">
            <Building2 size={12} /> {legalPersons.length} legal entit{legalPersons.length === 1 ? 'y' : 'ies'}
          </span>
        )}
      </div>
    </section>
  );
}

export default DashboardKpis;