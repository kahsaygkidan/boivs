import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area,
} from 'recharts';
import { listLegalPersons, getOwnershipTree, listAuditLogs } from '../api/bovsApi.js';

/* ---------- Domain rules (same as Reports.jsx; move to a shared util) ---------- */
const HIGH_RISK = new Set(['MINING', 'REAL_ESTATE', 'MOTOR_DEALERSHIP', 'IMPORT_EXPORT']);
const getThreshold = (type, sector) => {
  switch (type) {
    case 'SHARE_COMPANY': return HIGH_RISK.has(sector) ? 5 : 10;
    case 'PRIVATE_LIMITED_COMPANY': return 5;
    case 'FINANCIAL_INSTITUTION': return 2;
    case 'GENERAL_PARTNERSHIP': case 'LIMITED_PARTNERSHIP':
    case 'LIMITED_LIABILITY_PARTNERSHIP': case 'PPP': return 25;
    default: return null;
  }
};
const splitChain = (c) => String(c || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);
const isVerified = (h) => h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered;
const pretty = (s) => String(s || 'Other').toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const C = { navy: '#1b2559', blue: '#283375', sky: '#5b78d6', mist: '#c9d3f2', ok: '#1f8a5b', warn: '#d98e04', bad: '#c0392b', ink: '#1a1f36', muted: '#6b7390' };

/* ---------- Per-entity analysis ---------- */
function analyse(lp, tree) {
  const all = tree?.holders || [];
  const ubos = all.filter((h) => h.ubo);
  const th = getThreshold(lp.entityType, lp.sector);
  const issues = [];
  const add = (sev, text) => issues.push({ sev, text });
  if (!tree) add('bad', 'Ownership structure could not be loaded');
  else if (ubos.length === 0 && !tree.seniorManagingOfficial) add('bad', 'No UBO and no senior-official fallback');
  const now = new Date(); const in90 = new Date(Date.now() + 90 * 864e5);
  all.forEach((h) => {
    if (!h.idNumber) add('warn', `${h.fullName}: missing ID number`);
    if (h.dateOfExpiry) {
      const d = new Date(h.dateOfExpiry);
      if (d < now) add('bad', `${h.fullName}: ID expired`);
      else if (d < in90) add('warn', `${h.fullName}: ID expires within 90 days`);
    }
    if (h.qualifiesByControl && !(h.controlBasis || []).length) add('warn', `${h.fullName}: control basis missing`);
  });
  const total = ubos.reduce((s, h) => s + Number(h.effectivePercentage || 0), 0);
  if (total > 100.01) add('bad', `Ownership totals ${total.toFixed(1)}%`);
  if (th != null) ubos.forEach((h) => { if (Number(h.effectivePercentage) < th) add('warn', `${h.fullName}: ${h.effectivePercentage}% is below ${th}%`); });
  const hops = ubos.flatMap((h) => (h.paths || []).map((p) => splitChain(p.chain).length - 1));
  const layers = Math.max(0, ...hops) - 1;
  return {
    id: lp.id, name: lp.name, reg: lp.registrationNumber, type: lp.entityType, sector: lp.sector,
    ubos, all, layers: Math.max(layers, 0), issues, loaded: !!tree,
    score: issues.reduce((s, i) => s + (i.sev === 'bad' ? 3 : 1), 0),
    fallback: !!tree?.seniorManagingOfficial,
  };
}

/* ---------- UI bits ---------- */
function Card({ title, note, children, span = 1 }) {
  return (
    <section className="bi-card" style={{ gridColumn: `span ${span}` }}>
      <header><h3>{title}</h3>{note && <p>{note}</p>}</header>
      {children}
    </section>
  );
}
function Kpi({ label, value, hint, tone }) {
  return (
    <div className={`bi-kpi${tone ? ` bi-kpi--${tone}` : ''}`}>
      <span>{label}</span><b>{value}</b><em>{hint}</em>
    </div>
  );
}
const Empty = ({ children }) => <div className="bi-empty">{children}</div>;
const tip = { contentStyle: { border: `1px solid ${C.mist}`, borderRadius: 6, fontSize: 12 } };

/* ---------- Dashboard ---------- */
export default function InsightsDashboard({ onOpen }) {
  const [lps, setLps] = useState([]);
  const [trees, setTrees] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [type, setType] = useState('');
  const [sector, setSector] = useState('');

  useEffect(() => {
    let off = false;
    listLegalPersons({ size: 500, sort: 'name' })
      .then(async (res) => {
        const list = res.content || [];
        if (off) return;
        setLps(list);
        const pairs = await Promise.all(list.map((lp) => getOwnershipTree(lp.id).then((t) => [lp.id, t]).catch(() => [lp.id, null])));
        if (!off) setTrees(Object.fromEntries(pairs));
      })
      .catch((e) => !off && setError(e.friendlyMessage || 'Could not load dashboard data'))
      .finally(() => !off && setLoading(false));
    listAuditLogs({ size: 8 }).then((r) => !off && setLogs(r.content || [])).catch(() => {});
    return () => { off = true; };
  }, []);

  const all = useMemo(() => lps.map((lp) => analyse(lp, trees[lp.id])), [lps, trees]);
  const rows = useMemo(() => all.filter((e) => (!type || e.type === type) && (!sector || e.sector === sector)), [all, type, sector]);

  const d = useMemo(() => {
    const holders = rows.flatMap((e) => e.ubos);
    const verified = holders.filter(isVerified).length;
    const pending = holders.filter((h) => h.status === 'PENDING').length;
    const count = (arr, f) => Object.entries(arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {}));
    const buckets = [['< 5%', 0, 5], ['5–10%', 5, 10], ['10–25%', 10, 25], ['25–50%', 25, 50], ['50%+', 50, 101]]
      .map(([name, lo, hi]) => ({ name, value: holders.filter((h) => Number(h.effectivePercentage) >= lo && Number(h.effectivePercentage) < hi).length }));
    const months = {};
    holders.forEach((h) => { const m = String(h.dateBecameBo || '').slice(0, 7); if (m) months[m] = (months[m] || 0) + 1; });
    let run = 0;
    const growth = Object.keys(months).sort().map((m) => ({ month: m, added: months[m], total: (run += months[m]) }));
    const issues = rows.flatMap((e) => e.issues.map((i) => ({ ...i, entity: e })));
    return {
      holders, verified, pending, growth, buckets, issues,
      rate: holders.length ? Math.round((verified / holders.length) * 100) : 0,
      types: count(rows, (e) => pretty(e.type)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      sectors: count(rows, (e) => pretty(e.sector)).map(([name, value]) => ({ name, value })),
      depth: [0, 1, 2, 3].map((n) => ({ name: n === 3 ? '3+ layers' : n === 0 ? 'Direct' : `${n} layer${n > 1 ? 's' : ''}`, value: rows.filter((e) => (n === 3 ? e.layers >= 3 : e.layers === n)).length })),
      status: [{ name: 'Verified', value: verified, c: C.ok }, { name: 'Pending', value: pending, c: C.warn }, { name: 'Other', value: holders.length - verified - pending, c: C.mist }].filter((s) => s.value > 0),
      risky: [...rows].filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 8),
      pep: holders.filter((h) => h.pep).length,
      foreign: rows.filter((e) => e.type === 'FOREIGN_LEGAL_PERSON').length,
    };
  }, [rows]);

  const exportCsv = () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = d.issues.map((i) => [i.sev, i.entity.name, i.text].map(q).join(','));
    const blob = new Blob(['\uFEFFSeverity,Entity,Finding\n' + lines.join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `bo-findings-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const types = [...new Set(all.map((e) => e.type).filter(Boolean))];
  const sectors = [...new Set(all.map((e) => e.sector).filter(Boolean))];
  const crit = d.issues.filter((i) => i.sev === 'bad').length;

  return (
    <div className="bi">
      <style>{CSS}</style>
      <header className="bi-head">
        <div>
          <h1>Beneficial ownership insights</h1>
          <p>Portfolio health, concentration, data quality and recent activity across all legal entities.</p>
        </div>
        <div className="bi-tools">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Entity type">
            <option value="">All entity types</option>{types.map((t) => <option key={t} value={t}>{pretty(t)}</option>)}
          </select>
          <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Sector">
            <option value="">All sectors</option>{sectors.map((t) => <option key={t} value={t}>{pretty(t)}</option>)}
          </select>
          <button type="button" onClick={exportCsv} disabled={!d.issues.length}>Export findings</button>
        </div>
      </header>

      {error && <div className="bi-error" role="alert">{error}</div>}

      <div className="bi-kpis">
        <Kpi label="Legal entities" value={loading ? '…' : rows.length} hint={`${rows.filter((e) => e.fallback).length} on fallback`} />
        <Kpi label="Beneficial owners" value={d.holders.length} hint={`${d.pep} PEP · ${d.foreign} foreign entities`} />
        <Kpi label="Verified" value={`${d.rate}%`} hint={`${d.verified} approved by checker`} tone="ok" />
        <Kpi label="Pending approval" value={d.pending} hint="Waiting in checker queue" tone="warn" />
        <Kpi label="Critical findings" value={crit} hint={`${d.issues.length - crit} warnings`} tone={crit ? 'bad' : 'ok'} />
      </div>

      <div className="bi-grid">
        <Card title="Verification status" note="Share of beneficial owners by approval state">
          {d.status.length ? (
            <div style={{ height: 220 }}><ResponsiveContainer><PieChart>
              <Pie data={d.status} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {d.status.map((s) => <Cell key={s.name} fill={s.c} />)}
              </Pie><Tooltip {...tip} />
            </PieChart></ResponsiveContainer></div>
          ) : <Empty>No owners recorded yet.</Empty>}
          <ul className="bi-legend">{d.status.map((s) => <li key={s.name}><i style={{ background: s.c }} />{s.name} <b>{s.value}</b></li>)}</ul>
        </Card>

        <Card title="Ownership concentration" note="Effective interest held by each owner" span={2}>
          <div style={{ height: 240 }}><ResponsiveContainer><BarChart data={d.buckets}>
            <CartesianGrid vertical={false} stroke="#e6eaf6" /><XAxis dataKey="name" tickLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} /><Tooltip {...tip} />
            <Bar dataKey="value" name="Owners" fill={C.blue} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Card>

        <Card title="Entities by type" span={2}>
          {d.types.length ? (
            <div style={{ height: Math.max(200, d.types.length * 34) }}><ResponsiveContainer><BarChart data={d.types} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" allowDecimals={false} hide /><YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip {...tip} /><Bar dataKey="value" name="Entities" fill={C.sky} radius={[0, 4, 4, 0]} />
            </BarChart></ResponsiveContainer></div>
          ) : <Empty>No entities match the filters.</Empty>}
        </Card>

        <Card title="Structure depth" note="Intermediate layers between entity and owner">
          <div style={{ height: 220 }}><ResponsiveContainer><BarChart data={d.depth}>
            <XAxis dataKey="name" tickLine={false} fontSize={11} /><YAxis hide allowDecimals={false} /><Tooltip {...tip} />
            <Bar dataKey="value" name="Entities" fill={C.navy} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </Card>

        <Card title="Owner growth" note="Owners by date they became beneficial owner" span={2}>
          {d.growth.length > 1 ? (
            <div style={{ height: 230 }}><ResponsiveContainer><AreaChart data={d.growth}>
              <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.sky} stopOpacity=".45" /><stop offset="1" stopColor={C.sky} stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e6eaf6" /><XAxis dataKey="month" tickLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} /><Tooltip {...tip} />
              <Area dataKey="total" name="Cumulative owners" stroke={C.blue} fill="url(#bg)" strokeWidth={2} />
            </AreaChart></ResponsiveContainer></div>
          ) : <Empty>Not enough dated records to show a trend.</Empty>}
        </Card>

        <Card title="Needs attention" note="Entities ranked by severity of findings" span={2}>
          {d.risky.length ? (
            <table className="bi-table"><tbody>
              {d.risky.map((e) => (
                <tr key={e.id} onClick={() => onOpen?.(e.id)} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && onOpen?.(e.id)}>
                  <td><b>{e.name}</b><small>{e.reg || '—'}</small></td>
                  <td>{e.issues.slice(0, 2).map((i, k) => <div key={k} className={`bi-dot bi-dot--${i.sev}`}>{i.text}</div>)}{e.issues.length > 2 && <small>+{e.issues.length - 2} more</small>}</td>
                  <td className="bi-num">{e.score}</td>
                </tr>
              ))}
            </tbody></table>
          ) : <Empty>{loading ? 'Analysing entities…' : 'No findings. All checks passed.'}</Empty>}
        </Card>

        <Card title="Recent activity" note="Latest audit entries" span={2}>
          {logs.length ? (
            <ul className="bi-feed">{logs.map((l) => (
              <li key={l.id}><b>{l.action}</b><span>{l.actorUsername || 'system'}</span><time>{String(l.createdAt || '').replace('T', ' ').slice(0, 16)}</time></li>
            ))}</ul>
          ) : <Empty>No audit entries yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}

const CSS = `
.bi{--ink:${C.ink};--muted:${C.muted};font-family:'IBM Plex Sans','Segoe UI',system-ui,sans-serif;color:var(--ink);padding:24px;max-width:1280px;margin:0 auto}
.bi h1{font-size:24px;margin:0 0 4px;color:${C.navy}} .bi-head p{margin:0;color:var(--muted);font-size:14px;max-width:60ch}
.bi-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.bi-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}
.bi-tools select,.bi-tools button{height:36px;padding:0 12px;border:1px solid ${C.mist};border-radius:6px;background:#fff;font:inherit;font-size:13px}
.bi-tools button{background:${C.blue};color:#fff;border-color:${C.blue};cursor:pointer} .bi-tools button:disabled{opacity:.5;cursor:default}
.bi :focus-visible{outline:2px solid ${C.sky};outline-offset:2px}
.bi-error{background:#fdecea;color:${C.bad};padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:14px}
.bi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px}
.bi-kpi{background:${C.navy};color:#fff;border-radius:10px;padding:16px 18px;display:flex;flex-direction:column;gap:2px}
.bi-kpi span{font-size:13px;opacity:.8} .bi-kpi b{font-size:32px;font-weight:600;line-height:1.15} .bi-kpi em{font-style:normal;font-size:12px;opacity:.7}
.bi-kpi--ok b{color:#7fe0b0} .bi-kpi--warn b{color:#ffcf70} .bi-kpi--bad b{color:#ff9d92}
.bi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.bi-card{background:#fff;border:1px solid #dde3f5;border-radius:10px;padding:18px;min-width:0}
.bi-card header{margin-bottom:12px} .bi-card h3{margin:0;font-size:15px;color:${C.navy}} .bi-card header p{margin:2px 0 0;font-size:12px;color:var(--muted)}
.bi-legend{list-style:none;padding:0;margin:8px 0 0;display:flex;gap:14px;flex-wrap:wrap;font-size:12px}
.bi-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
.bi-empty{padding:28px 8px;text-align:center;color:var(--muted);font-size:13px}
.bi-table{width:100%;border-collapse:collapse;font-size:13px} .bi-table td{padding:9px 6px;border-top:1px solid #edf0fa;vertical-align:top}
.bi-table tr{cursor:pointer} .bi-table tr:hover{background:#f4f6fd} .bi-table small{display:block;color:var(--muted);font-size:11px}
.bi-num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.bi-dot{padding-left:12px;position:relative;margin-bottom:2px} .bi-dot:before{content:'';position:absolute;left:0;top:6px;width:6px;height:6px;border-radius:50%}
.bi-dot--bad:before{background:${C.bad}} .bi-dot--warn:before{background:${C.warn}}
.bi-feed{list-style:none;margin:0;padding:0;font-size:13px} .bi-feed li{display:grid;grid-template-columns:1fr auto auto;gap:12px;padding:8px 0;border-top:1px solid #edf0fa}
.bi-feed span,.bi-feed time{color:var(--muted);font-size:12px}
@media(max-width:1000px){.bi-grid{grid-template-columns:repeat(2,1fr)} .bi-card{grid-column:span 2!important}}
@media(max-width:600px){.bi{padding:14px} .bi-grid{grid-template-columns:1fr} .bi-card{grid-column:span 1!important}}
`;
