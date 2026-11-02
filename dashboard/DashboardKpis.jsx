import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { getOwnershipTree } from '../api/bovsApi.js';

/* ==========================================================================
   Loads the ownership tree of EVERY legal entity in the background, a few at a
   time, so the KPI totals cover all entities instead of only the ones the user
   has opened. Results are merged into the Dashboard's existing `trees` state.
   ========================================================================== */
export function useBackgroundTrees(legalPersons, trees, setTrees, concurrency = 4) {
  const treesRef = useRef(trees);
  treesRef.current = trees;
  const requested = useRef(new Set());
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    if (!legalPersons.length) return undefined;
    let stopped = false;
    const queue = legalPersons.map((lp) => lp.id);

    const worker = async () => {
      while (!stopped && queue.length) {
        const id = queue.shift();
        if (requested.current.has(id) || treesRef.current[id]) continue;
        requested.current.add(id);
        try {
          const tree = await getOwnershipTree(id);
          setTrees((prev) => (prev[id] ? prev : { ...prev, [id]: tree }));
        } catch {
          setFailed((n) => n + 1);
        }
      }
    };
    Array.from({ length: concurrency }, worker);

    return () => { stopped = true; };
  }, [legalPersons, setTrees, concurrency]);

  return { failed };
}

/* ==========================================================================
   Count-up that animates from the value currently shown (not from 0 each time),
   so numbers tick smoothly while more entities finish loading.
   ========================================================================== */
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    const to = Number(target) || 0;
    const from = shown.current;
    if (from === to) { setVal(to); return undefined; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      const next = Math.round(from + (to - from) * eased);
      shown.current = next;
      setVal(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ==========================================================================
   Single KPI card
   ========================================================================== */
const TONES = {
  neutral: { accent: '#475569', soft: 'rgba(71, 85, 105, .10)' },
  info:    { accent: '#3b5bdb', soft: 'rgba(59, 91, 219, .10)' },
  success: { accent: '#059669', soft: 'rgba(5, 150, 105, .10)' },
  warn:    { accent: '#d97706', soft: 'rgba(217, 119, 6, .12)' },
};

function KpiCard({ label, value, tone = 'neutral', icon: Icon, caption, meter, loading, partial }) {
  const t = TONES[tone];
  const counted = useCountUp(loading ? 0 : value);
  return (
    <div className="kpis-card" style={{ '--k-accent': t.accent, '--k-soft': t.soft }}>
      <div className="kpis-card__top">
        <span className="kpis-card__label">{label}</span>
        <span className="kpis-card__icon"><Icon size={16} /></span>
      </div>

      {loading
        ? <div className="kpis-skel kpis-skel--value" />
        : (
          <div className="kpis-card__value">
            {counted.toLocaleString()}
            {partial && <span className="kpis-card__partial" title="Still calculating">+</span>}
          </div>
        )}

      {loading
        ? <div className="kpis-skel kpis-skel--caption" />
        : <div className="kpis-card__caption">{caption}</div>}

      {meter != null && !loading && (
        <div className="kpis-meter" role="img" aria-label={`${meter}%`}>
          <div className="kpis-meter__fill" style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   KPI row — every number is computed from real data (no sample trends)
   ========================================================================== */
const VERIFIED = ['VERIFIED', 'APPROVED'];

export function DashboardKpis({ legalPersons, trees, loadingList, failed = 0 }) {
  const stats = useMemo(() => {
    const total = legalPersons.length;
    let loaded = 0; let ubos = 0; let verified = 0; let pending = 0;
    legalPersons.forEach((lp) => {
      const tree = trees[lp.id];
      if (!tree) return;
      loaded += 1;
      (tree.holders || []).filter((h) => h.ubo).forEach((h) => {
        ubos += 1;
        if (VERIFIED.includes(h.status)) verified += 1;
        else if (h.status === 'PENDING') pending += 1;
      });
    });
    return { total, loaded, ubos, verified, pending };
  }, [legalPersons, trees]);

  const syncing = !loadingList && stats.loaded + failed < stats.total;
  const share = (n) => (stats.ubos > 0 ? Math.round((n / stats.ubos) * 100) : 0);
  const loadPct = stats.total > 0 ? Math.round(((stats.loaded + failed) / stats.total) * 100) : 0;
  const treeLoading = loadingList || (stats.loaded === 0 && stats.total > 0 && syncing);

  return (
    <section className="kpis" aria-label="Key figures">
      <style>{css}</style>

      <div className="kpis-grid">
        <KpiCard
          label="Legal entities" value={stats.total} icon={Building2} tone="neutral"
          caption="Registered customers" loading={loadingList}
        />
        <KpiCard
          label="Beneficial owners" value={stats.ubos} icon={Users} tone="info"
          caption={`Across ${stats.loaded} of ${stats.total} entities`}
          loading={treeLoading} partial={syncing}
        />
        <KpiCard
          label="Verified" value={stats.verified} icon={CheckCircle2} tone="success"
          caption={stats.ubos > 0 ? `${share(stats.verified)}% of beneficial owners` : 'Approved by a checker'}
          meter={stats.ubos > 0 ? share(stats.verified) : null}
          loading={treeLoading} partial={syncing}
        />
        <KpiCard
          label="Pending" value={stats.pending} icon={Clock} tone="warn"
          caption={stats.ubos > 0 ? `${share(stats.pending)}% awaiting approval` : 'Awaiting approval'}
          meter={stats.ubos > 0 ? share(stats.pending) : null}
          loading={treeLoading} partial={syncing}
        />
      </div>

      {syncing && (
        <div className="kpis-note" role="status">
          <div className="kpis-note__bar"><div className="kpis-note__fill" style={{ width: `${loadPct}%` }} /></div>
          <span>Calculating from {stats.loaded + failed} of {stats.total} entities…</span>
        </div>
      )}
      {!syncing && failed > 0 && (
        <div className="kpis-note kpis-note--warn" role="alert">
          <AlertTriangle size={14} />
          <span>{failed} {failed === 1 ? 'entity' : 'entities'} could not be loaded — totals may be incomplete. Refresh to retry.</span>
        </div>
      )}
    </section>
  );
}

/* ==========================================================================
   Styles (scoped with the kpis- prefix)
   ========================================================================== */
const css = `
.kpis { margin-bottom: 20px; }
.kpis-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 1100px) { .kpis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px)  { .kpis-grid { grid-template-columns: 1fr; } }

.kpis-card {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column; gap: 6px;
  padding: 18px 20px 16px;
  background: var(--dash-surface, #fff);
  border: 1px solid var(--dash-border, #e5e7eb);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.kpis-card::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 3px;
  background: var(--k-accent); opacity: .85;
}
.kpis-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(16, 24, 40, .08); border-color: var(--k-soft); }

.kpis-card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kpis-card__label {
  font-size: 12px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase;
  color: var(--dash-text-muted, #64748b);
}
.kpis-card__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 10px;
  color: var(--k-accent); background: var(--k-soft);
}
.kpis-card__value {
  font-size: 34px; font-weight: 750; letter-spacing: -.03em; line-height: 1.1;
  font-variant-numeric: tabular-nums; color: var(--dash-text, #0f172a);
}
.kpis-card__partial { margin-left: 2px; font-size: 20px; color: var(--k-accent); animation: kpis-blink 1.2s ease-in-out infinite; }
.kpis-card__caption { font-size: 12.5px; color: var(--dash-text-muted, #64748b); }

.kpis-meter { margin-top: 8px; height: 6px; border-radius: 999px; background: var(--k-soft); overflow: hidden; }
.kpis-meter__fill { height: 100%; border-radius: inherit; background: var(--k-accent); transition: width .5s cubic-bezier(.2, .8, .2, 1); }

.kpis-skel {
  border-radius: 8px;
  background: linear-gradient(90deg, #eef1f5 25%, #f6f8fa 37%, #eef1f5 63%);
  background-size: 400% 100%; animation: kpis-shimmer 1.3s ease infinite;
}
.kpis-skel--value { height: 36px; width: 56%; margin: 2px 0; }
.kpis-skel--caption { height: 12px; width: 78%; }

.kpis-note {
  display: flex; align-items: center; gap: 10px; margin-top: 12px;
  font-size: 12.5px; color: var(--dash-text-muted, #64748b);
}
.kpis-note__bar { flex: 0 0 140px; height: 5px; border-radius: 999px; background: #e8ecf2; overflow: hidden; }
.kpis-note__fill { height: 100%; background: #3b5bdb; border-radius: inherit; transition: width .3s ease; }
.kpis-note--warn { color: #b45309; }

@keyframes kpis-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@keyframes kpis-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) {
  .kpis-card, .kpis-meter__fill, .kpis-note__fill { transition: none; }
  .kpis-skel, .kpis-card__partial { animation: none; }
}
@media print { .kpis-card { box-shadow: none; transform: none; } .kpis-note { display: none; } }
`;
