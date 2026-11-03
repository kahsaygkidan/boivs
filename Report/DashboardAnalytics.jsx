import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, Info } from 'lucide-react';
import { listAuditLogs } from '../api/bovsApi.js';

/* ==========================================================================
   Constants & helpers
   ========================================================================== */
const VERIFIED = ['VERIFIED', 'APPROVED'];
const COLORS = { primary: '#3b5bdb', success: '#059669', warn: '#d97706', danger: '#dc2626', muted: '#cbd5e1', teal: '#0d9488' };

const ENTITY_LABELS = {
  SHARE_COMPANY: 'Share Company', PRIVATE_LIMITED_COMPANY: 'Private Ltd', ONE_MEMBER_PLC: 'One Member PLC',
  PUBLIC_LIMITED_COMPANY: 'Public Ltd', GENERAL_PARTNERSHIP: 'General Partnership', LIMITED_PARTNERSHIP: 'Limited Partnership',
  LIMITED_LIABILITY_PARTNERSHIP: 'LLP', FINANCIAL_INSTITUTION: 'Financial Inst.', FOREIGN_LEGAL_PERSON: 'Foreign Entity',
  PPP: 'PPP', CIVIL_SOCIETY_ORGANIZATION: 'Civil Society', GOVERNMENT_OWNED_ENTERPRISE: 'Gov. Enterprise',
  COOPERATIVE_ASSOCIATION: 'Cooperative', PUBLIC_ADMINISTRATION: 'Public Admin.', RELIGIOUS_INSTITUTION: 'Religious Inst.',
  INTERNATIONAL_ORGANIZATION: 'International Org.', TRUST: 'Trust', CHARITY: 'Charity', INDIVIDUAL: 'Individual', OTHER: 'Other',
};
const SECTOR_LABELS = {
  OTHER: 'Other', MINING: 'Mining', REAL_ESTATE: 'Real Estate', MOTOR_DEALERSHIP: 'Motor Dealership',
  IMPORT_EXPORT: 'Import / Export', FINANCIAL: 'Financial',
};

const monthKey = (v) => String(v || '').slice(0, 7);
const lastMonths = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleString('en-US', { month: 'short' }) + (d.getMonth() === 0 || i === n - 1 ? ` ’${String(d.getFullYear()).slice(2)}` : '') });
  }
  return out;
};
const lastDays = (n) => {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({ key, label: d.toLocaleString('en-US', { month: 'short', day: 'numeric' }) });
  }
  return out;
};
const humanize = (v) => String(v || '').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const relativeTime = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} d ago` : new Date(t).toLocaleDateString();
};
const tooltipStyle = { borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 8px 24px rgba(16,24,40,.12)' };
const axisTick = { fontSize: 11, fill: '#64748b' };

/* ==========================================================================
   Styles (scoped with dx-)
   ========================================================================== */
const css = `
.dx { margin-bottom: 8px; }
.dx-head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:10px; margin:6px 0 12px; }
.dx-head h2 { margin:0; font-size:17px; font-weight:700; letter-spacing:-.015em; }
.dx-head span { font-size:12.5px; color:#64748b; }
.dx-insights { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
.dx-insight { display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:999px; font-size:12.5px; font-weight:600; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
.dx-insight--ok { background:rgba(5,150,105,.09); color:#047857; border-color:rgba(5,150,105,.25); }
.dx-insight--warn { background:rgba(217,119,6,.10); color:#b45309; border-color:rgba(217,119,6,.28); }
.dx-insight--info { background:rgba(59,91,219,.08); color:#3149b5; border-color:rgba(59,91,219,.22); }

.dx-grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:16px; margin-bottom:16px; }
.dx-s4 { grid-column:span 4; } .dx-s6 { grid-column:span 6; } .dx-s8 { grid-column:span 8; }
@media (max-width:1100px) { .dx-s8, .dx-s6, .dx-full-md { grid-column:span 12; } .dx-s4 { grid-column:span 6; } }
@media (max-width:700px) { .dx-s4 { grid-column:span 12; } }

.dx-card { display:flex; flex-direction:column; min-width:0; background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 1px 2px rgba(16,24,40,.04); overflow:hidden; }
.dx-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 18px 4px; }
.dx-card__title { margin:0; font-size:14.5px; font-weight:700; letter-spacing:-.01em; }
.dx-card__sub { margin-top:2px; font-size:12px; color:#64748b; }
.dx-card__body { flex:1; min-height:0; padding:8px 14px 14px; }
.dx-chart { height:236px; }
.dx-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; height:100%; min-height:150px; padding:16px; text-align:center; font-size:13px; color:#64748b; }
.dx-skel { height:100%; min-height:150px; border-radius:12px; background:linear-gradient(90deg,#eef1f5 25%,#f6f8fa 37%,#eef1f5 63%); background-size:400% 100%; animation:dx-shimmer 1.3s ease infinite; }
@keyframes dx-shimmer { 0% { background-position:100% 0; } 100% { background-position:0 0; } }

.dx-seg { display:inline-flex; padding:3px; border-radius:10px; background:#f1f5f9; }
.dx-seg button { padding:4px 11px; border:0; border-radius:8px; background:transparent; font:inherit; font-size:12px; font-weight:650; color:#64748b; cursor:pointer; }
.dx-seg button[aria-pressed="true"] { background:#fff; color:#0f172a; box-shadow:0 1px 3px rgba(16,24,40,.12); }

.dx-donut { display:flex; align-items:center; gap:14px; height:236px; }
.dx-donut__chart { position:relative; flex:0 0 160px; height:160px; }
.dx-donut__center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
.dx-donut__center strong { font-size:26px; font-weight:750; line-height:1; letter-spacing:-.02em; }
.dx-donut__center span { margin-top:3px; font-size:11px; color:#64748b; }
.dx-legend { flex:1; min-width:0; margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:9px; }
.dx-legend li { display:flex; align-items:center; gap:8px; font-size:12.5px; }
.dx-legend i { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
.dx-legend .n { flex:1; color:#64748b; }
.dx-legend .p { width:34px; text-align:right; color:#94a3b8; font-size:11.5px; }

.dx-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; }
.dx-row { display:flex; align-items:center; gap:12px; width:100%; padding:10px 8px; border:0; border-radius:10px; background:transparent; text-align:left; font:inherit; cursor:pointer; transition:background .12s; }
.dx-row:hover, .dx-row:focus-visible { background:#f8fafc; outline:none; }
.dx-row__icon { display:inline-flex; width:32px; height:32px; flex-shrink:0; align-items:center; justify-content:center; border-radius:10px; }
.dx-row__icon--danger { background:rgba(220,38,38,.10); color:#dc2626; } .dx-row__icon--warn { background:rgba(217,119,6,.12); color:#d97706; } .dx-row__icon--info { background:rgba(59,91,219,.10); color:#3b5bdb; }
.dx-row__main { flex:1; min-width:0; }
.dx-row__title { font-size:13px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dx-row__sub { font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dx-row__go { color:#94a3b8; flex-shrink:0; }
.dx-more { padding:8px 10px 2px; font-size:12px; color:#94a3b8; }

.dx-feed { display:flex; flex-direction:column; gap:2px; margin-top:6px; }
.dx-feed__item { display:flex; align-items:flex-start; gap:10px; padding:8px; border-radius:10px; }
.dx-feed__dot { width:8px; height:8px; margin-top:6px; border-radius:50%; background:#3b5bdb; flex-shrink:0; }
.dx-feed__text { flex:1; min-width:0; font-size:12.5px; }
.dx-feed__text strong { font-weight:650; }
.dx-feed__text span { display:block; color:#64748b; font-size:11.5px; }
.dx-feed__time { font-size:11.5px; color:#94a3b8; white-space:nowrap; }

@media (prefers-reduced-motion: reduce) { .dx-skel { animation:none; } }
@media print { .dx-card { box-shadow:none; break-inside:avoid; } .dx-seg, .dx-row__go { display:none; } }
`;

/* ==========================================================================
   Building blocks
   ========================================================================== */
function Card({ title, subtitle, action, className = '', loading, empty, emptyText, children }) {
  return (
    <section className={`dx-card ${className}`}>
      <header className="dx-card__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="dx-card__title">{title}</h3>
          {subtitle && <div className="dx-card__sub">{subtitle}</div>}
        </div>
        {action}
      </header>
      <div className="dx-card__body">
        {loading ? <div className="dx-skel" />
          : empty ? <div className="dx-empty"><Info size={20} />{emptyText || 'No data yet.'}</div>
            : children}
      </div>
    </section>
  );
}

function HBars({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 18, bottom: 2, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={104} tick={{ ...axisTick, fill: '#475569' }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(59,91,219,.06)' }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Count" fill={color} radius={[0, 6, 6, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ==========================================================================
   Portfolio analytics
   ========================================================================== */
export default function PortfolioAnalytics({ legalPersons, trees, loadingList, onSelectEntity }) {
  const [range, setRange] = useState(12);
  const [logs, setLogs] = useState(null); // null = loading, [] = none/unavailable
  const [logsFailed, setLogsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAuditLogs({ size: 200 })
      .then((res) => { if (!cancelled) setLogs(res.content || []); })
      .catch(() => { if (!cancelled) { setLogs([]); setLogsFailed(true); } });
    return () => { cancelled = true; };
  }, []);

  const loaded = useMemo(() => legalPersons.filter((lp) => trees[lp.id]), [legalPersons, trees]);
  const treesReady = loaded.length > 0;

  const model = useMemo(() => {
    const status = { verified: 0, pending: 0, rejected: 0, other: 0 };
    const buckets = [
      { name: '< 5%', value: 0 }, { name: '5–10%', value: 0 }, { name: '10–25%', value: 0 },
      { name: '25–50%', value: 0 }, { name: '50–100%', value: 0 },
    ];
    const boByMonth = {};
    const attention = [];
    const now = Date.now();

    loaded.forEach((lp) => {
      const tree = trees[lp.id];
      const ubos = (tree.holders || []).filter((h) => h.ubo);
      let pending = 0; let rejected = 0; let expired = 0;
      ubos.forEach((h) => {
        const s = String(h.status || '').toUpperCase();
        if (VERIFIED.includes(s)) status.verified += 1;
        else if (s === 'PENDING') { status.pending += 1; pending += 1; }
        else if (s === 'REJECTED') { status.rejected += 1; rejected += 1; }
        else status.other += 1;

        const pct = Number(h.effectivePercentage) || 0;
        buckets[pct < 5 ? 0 : pct < 10 ? 1 : pct < 25 ? 2 : pct < 50 ? 3 : 4].value += 1;

        const mk = monthKey(h.dateBecameBo);
        if (mk) boByMonth[mk] = (boByMonth[mk] || 0) + 1;
        if (h.dateOfExpiry && Date.parse(h.dateOfExpiry) < now) expired += 1;
      });

      const noOwner = ubos.length === 0 && !tree.seniorManagingOfficial;
      const reasons = [];
      if (rejected) reasons.push({ w: 3, level: 'danger', text: `${rejected} rejected beneficial owner${rejected > 1 ? 's' : ''}` });
      if (expired) reasons.push({ w: 3, level: 'danger', text: `${expired} expired ID${expired > 1 ? 's' : ''}` });
      if (noOwner) reasons.push({ w: 2, level: 'warn', text: 'No beneficial owner or fallback recorded' });
      if (pending) reasons.push({ w: 1, level: 'info', text: `${pending} awaiting approval` });
      if (reasons.length) {
        reasons.sort((a, b) => b.w - a.w);
        attention.push({ id: lp.id, name: lp.name, score: reasons[0].w * 10 + reasons.length, level: reasons[0].level, text: reasons.map((r) => r.text).join(' · ') });
      }
    });
    attention.sort((a, b) => b.score - a.score);

    const regByMonth = {};
    legalPersons.forEach((lp) => { const mk = monthKey(lp.createdAt); if (mk) regByMonth[mk] = (regByMonth[mk] || 0) + 1; });

    const count = (list, keyFn, labels) => {
      const map = {};
      list.forEach((lp) => { const k = labels[keyFn(lp)] || humanize(keyFn(lp)) || 'Other'; map[k] = (map[k] || 0) + 1; });
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };
    const types = count(legalPersons, (lp) => lp.entityType, ENTITY_LABELS);
    const topTypes = types.length > 6
      ? [...types.slice(0, 5), { name: 'Others', value: types.slice(5).reduce((s, t) => s + t.value, 0) }]
      : types;

    return { status, buckets, boByMonth, regByMonth, attention, topTypes, sectors: count(legalPersons, (lp) => lp.sector, SECTOR_LABELS) };
  }, [loaded, trees, legalPersons]);

  const totalUbos = model.status.verified + model.status.pending + model.status.rejected + model.status.other;
  const coverage = totalUbos ? Math.round((model.status.verified / totalUbos) * 100) : 0;

  const trend = useMemo(() => lastMonths(range).map((m) => ({
    label: m.label, 'New entities': model.regByMonth[m.key] || 0, 'New beneficial owners': model.boByMonth[m.key] || 0,
  })), [range, model]);
  const trendTotal = trend.reduce((s, t) => s + t['New entities'] + t['New beneficial owners'], 0);

  const activity = useMemo(() => {
    if (!logs) return { days: [], feed: [], total: 0 };
    const days = lastDays(14).map((d) => ({ ...d, value: 0 }));
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    logs.forEach((l) => { const i = idx[String(l.createdAt || '').slice(0, 10)]; if (i != null) days[i].value += 1; });
    return { days, feed: logs.slice(0, 6), total: days.reduce((s, d) => s + d.value, 0) };
  }, [logs]);

  const donutData = [
    { name: 'Verified', value: model.status.verified, color: COLORS.success },
    { name: 'Pending', value: model.status.pending, color: COLORS.warn },
    { name: 'Rejected', value: model.status.rejected, color: COLORS.danger },
    { name: 'Other', value: model.status.other, color: COLORS.muted },
  ].filter((d) => d.value > 0);

  const insights = [];
  if (totalUbos) insights.push({ tone: coverage >= 80 ? 'ok' : 'warn', icon: CheckCircle2, text: `${coverage}% of beneficial owners verified` });
  if (model.status.pending) insights.push({ tone: 'info', icon: Clock, text: `${model.status.pending} awaiting checker approval` });
  if (model.attention.length) insights.push({ tone: 'warn', icon: AlertTriangle, text: `${model.attention.length} ${model.attention.length === 1 ? 'entity needs' : 'entities need'} attention` });

  return (
    <div className="dx">
      <style>{css}</style>

      <div className="dx-head">
        <h2>Portfolio analytics</h2>
        <span>{loadingList ? 'Loading…' : `Based on ${loaded.length} of ${legalPersons.length} entities`}</span>
      </div>

      {insights.length > 0 && (
        <div className="dx-insights" aria-label="Highlights">
          {insights.map((i) => <span key={i.text} className={`dx-insight dx-insight--${i.tone}`}><i.icon size={14} />{i.text}</span>)}
        </div>
      )}

      {/* Row 1 — growth + verification */}
      <div className="dx-grid">
        <Card
          className="dx-s8" title="Registrations over time" subtitle="New legal entities and beneficial owners per month"
          loading={loadingList} empty={trendTotal === 0} emptyText="No registrations in this period."
          action={(
            <div className="dx-seg" role="group" aria-label="Time range">
              {[6, 12].map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r}M</button>)}
            </div>
          )}
        >
          <div className="dx-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="dxg-ent" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.32} /><stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} /></linearGradient>
                  <linearGradient id="dxg-bo" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.28} /><stop offset="100%" stopColor={COLORS.teal} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="New entities" stroke={COLORS.primary} strokeWidth={2.5} fill="url(#dxg-ent)" />
                <Area type="monotone" dataKey="New beneficial owners" stroke={COLORS.teal} strokeWidth={2.5} fill="url(#dxg-bo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="dx-s4 dx-full-md" title="Verification coverage" subtitle="All beneficial owners" loading={loadingList || !treesReady} empty={totalUbos === 0} emptyText="No beneficial owners loaded yet.">
          <div className="dx-donut">
            <div className="dx-donut__chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76} paddingAngle={3} cornerRadius={5} stroke="none">
                    {donutData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dx-donut__center"><strong>{coverage}%</strong><span>verified</span></div>
            </div>
            <ul className="dx-legend">
              {donutData.map((d) => (
                <li key={d.name}><i style={{ background: d.color }} /><span className="n">{d.name}</span><strong>{d.value}</strong><span className="p">{Math.round((d.value / totalUbos) * 100)}%</span></li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Row 2 — distributions */}
      <div className="dx-grid">
        <Card className="dx-s4" title="Entity types" subtitle="Registered customers" loading={loadingList} empty={model.topTypes.length === 0}>
          <div className="dx-chart"><HBars data={model.topTypes} color={COLORS.primary} /></div>
        </Card>
        <Card className="dx-s4" title="Sectors" subtitle="Registered customers" loading={loadingList} empty={model.sectors.length === 0}>
          <div className="dx-chart"><HBars data={model.sectors} color={COLORS.teal} /></div>
        </Card>
        <Card className="dx-s4" title="Ownership concentration" subtitle="Beneficial owners by effective ownership" loading={loadingList || !treesReady} empty={totalUbos === 0} emptyText="No ownership data loaded yet.">
          <div className="dx-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.buckets} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(59,91,219,.06)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Beneficial owners" fill={COLORS.primary} radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3 — action + activity */}
      <div className="dx-grid">
        <Card
          className="dx-s6" title="Needs attention" subtitle="Select an entity to open it in the explorer below"
          loading={loadingList || !treesReady} empty={model.attention.length === 0} emptyText="Nothing needs attention — all loaded entities look healthy."
        >
          <ul className="dx-list">
            {model.attention.slice(0, 7).map((a) => (
              <li key={a.id}>
                <button type="button" className="dx-row" onClick={() => onSelectEntity?.(a.id)}>
                  <span className={`dx-row__icon dx-row__icon--${a.level}`}><AlertTriangle size={16} /></span>
                  <span className="dx-row__main">
                    <div className="dx-row__title">{a.name}</div>
                    <div className="dx-row__sub">{a.text}</div>
                  </span>
                  <ArrowUpRight size={16} className="dx-row__go" />
                </button>
              </li>
            ))}
          </ul>
          {model.attention.length > 7 && <div className="dx-more">+ {model.attention.length - 7} more entities</div>}
        </Card>

        <Card
          className="dx-s6" title="Recent activity" subtitle={`${activity.total} actions in the last 14 days`}
          loading={logs === null} empty={logsFailed || (logs && logs.length === 0)} emptyText={logsFailed ? 'Activity is not available for your role.' : 'No activity recorded yet.'}
        >
          <div style={{ height: 96 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity.days} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
                <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(59,91,219,.06)' }} contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Actions" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dx-feed">
            {activity.feed.map((l) => (
              <div key={l.id} className="dx-feed__item">
                <span className="dx-feed__dot" />
                <div className="dx-feed__text">
                  <strong>{humanize(l.action)}</strong>
                  <span>{[l.actorUsername, l.entityRef].filter(Boolean).join(' · ') || '—'}</span>
                </div>
                <span className="dx-feed__time">{relativeTime(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

