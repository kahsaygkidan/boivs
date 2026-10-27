import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  listLegalPersons, getOwnershipTree,
} from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';

/* ==========================================================================
   Design tokens
   ========================================================================== */
const T = {
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  bg: '#f4f6fa',
  border: '#e5e8ef',
  borderStrong: '#d5d9e6',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primaryHover: '#1f2859',
  primarySoft: 'rgba(40,51,117,.08)',
  primaryRing: 'rgba(40,51,117,.16)',
  success: '#059669',
  successSoft: '#ecfdf5',
  successBorder: 'rgba(5,150,105,.25)',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  dangerBorder: 'rgba(220,38,38,.28)',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  warnBorder: 'rgba(217,119,6,.25)',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  infoBorder: 'rgba(37,99,235,.25)',
  hoverRow: '#f8fafc',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowMd: '0 4px 12px rgba(15,23,42,.06), 0 2px 4px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* Direct vs Indirect chart colors — distinct, on-brand */
const COLORS = {
  direct: '#059669',   // success green
  indirect: '#2563eb', // info blue
  other: '#cbd5e1',    // gray for unallocated
};

/* ==========================================================================
   Icons
   ========================================================================== */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const I = {
  building: <svg {...ic}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" /></svg>,
  users: <svg {...ic}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  check: <svg {...ic}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  clock: <svg {...ic}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" /><path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  link: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  equal: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="5" y1="9" x2="19" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="5" y1="15" x2="19" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  chart: <svg {...ic}><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  printer: <svg {...ic}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
};

/* ==========================================================================
   Button
   ========================================================================== */
function Btn({ variant = 'primary', size = 'md', icon, children, style, ...props }) {
  const sizes = {
    sm: { height: 30, padding: '0 12px', fontSize: 12, gap: 5 },
    md: { height: 36, padding: '0 14px', fontSize: 13, gap: 6 },
    lg: { height: 40, padding: '0 18px', fontSize: 13.5, gap: 6 },
  };
  const variants = {
    primary: { background: T.primary, color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}` },
  };
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', fontWeight: 600, borderRadius: T.radiusSm,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s ease, border-color .15s ease, color .15s ease, transform .05s ease',
        opacity: props.disabled ? 0.55 : 1, whiteSpace: 'nowrap',
        ...sizes[size], ...variants[variant], ...style,
      }}
      onMouseDown={(e) => { if (!props.disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ==========================================================================
   KPI tile
   ========================================================================== */
function Kpi({ label, value, tone = 'neutral', icon, caption, loading }) {
  const tones = {
    neutral: { fg: T.primary, bg: T.primarySoft, accent: T.primary },
    success: { fg: T.success, bg: T.successSoft, accent: T.success },
    warn: { fg: T.warn, bg: T.warnSoft, accent: T.warn },
    danger: { fg: T.danger, bg: T.dangerSoft, accent: T.danger },
  }[tone];
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        gap: 14, padding: 18, minHeight: 118,
        background: T.surface, border: `1px solid ${hover ? tones.accent + '55' : T.border}`,
        borderRadius: T.radius,
        boxShadow: hover ? T.shadowMd : T.shadow,
        transition: 'box-shadow .18s ease, border-color .18s ease, transform .18s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        fontFamily: T.font,
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tones.accent, opacity: hover ? 1 : 0.7, transition: 'opacity .18s ease' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: tones.bg, color: tones.fg, flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: tones.fg, lineHeight: 1, letterSpacing: '-.035em', fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '—' : value ?? '—'}
      </div>
      {caption && <span style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 500 }}>{caption}</span>}
    </div>
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

  const displayValue = open ? query : (selected ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}` : '');

  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, fontFamily: T.font, minWidth: 280, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>Legal entity</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused ? T.primary : T.textFaint, display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {I.search}
        </span>
        <input
          type="text" role="combobox" aria-expanded={open} disabled={loading}
          value={displayValue} placeholder={loading ? 'Loading entities…' : placeholder}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{
            appearance: 'none', height: 40, width: '100%', padding: '0 12px 0 36px',
            fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
            color: selected || open ? T.text : T.textMuted,
            background: focused ? '#fff' : T.surfaceAlt,
            border: `1px solid ${focused ? T.primary : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none', cursor: loading ? 'wait' : 'text',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
            boxSizing: 'border-box',
          }}
        />
        {open && (
          <ul role="listbox" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            boxShadow: '0 12px 32px rgba(15,23,42,.14)', margin: 0, padding: 4, listStyle: 'none',
            maxHeight: 260, overflowY: 'auto',
          }}>
            {filtered.length === 0 && (
              <li style={{ padding: '12px 14px', color: T.textMuted, fontSize: 12.5 }}>No entity found</li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o.value} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                style={{
                  padding: '10px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12.5,
                  display: 'flex', flexDirection: 'column', gap: 2,
                  background: i === hi ? T.primarySoft : 'transparent',
                  color: o.value === value ? T.primary : T.text,
                  fontWeight: o.value === value ? 600 : 500,
                }}
              >
                <span>{o.label}</span>
                {o.sub && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */
const splitChain = (chain) => String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

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

/** Is this holder's chain direct (2 nodes) or indirect (>2 nodes)? */
const isDirectHolder = (holder) => {
  const paths = holder.paths || [];
  if (paths.length === 0) return true;
  return paths.every((p) => splitChain(p.chain).length === 2);
};

/* ==========================================================================
   Field
   ========================================================================== */
function Field({ k, v, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textFaint }}>{k}</div>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 500, marginTop: 2, fontFamily: mono ? T.mono : 'inherit', wordBreak: 'break-word' }}>{v}</div>
    </div>
  );
}

/* ==========================================================================
   Ownership summary — bullet chain (matches your target format)
   ========================================================================== */
function OwnershipSummaryCard({ entity }) {
  const tree = entity?.tree;
  if (!tree) return null;

  const holders = tree.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const controlOnly = holders.filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;
  const rootName = entity?.name || 'Entity';

  /* --- Group direct children under each parent, with hop percentages --- */
  const edgesByParent = new Map(); // parent -> [{ to, pct }]
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
        // Without per-hop %, we can only show the top edge with the effective %
        // (or the path %) for the first hop, then continue by names.
        for (let i = 0; i < parts.length - 1; i++) {
          const from = parts[i];
          const to = parts[i + 1];
          if (!edgesByParent.has(from)) edgesByParent.set(from, []);
          const bucket = edgesByParent.get(from);
          if (!bucket.find((x) => x.to === to)) {
            bucket.push({ to, pct: null }); // unknown per-hop
          }
        }
      }
    });
  });

  /* --- Build the bullet lines --- */
  const bullets = [];

  // 1) "Entity → X% owned by A and Y% owned by B" — one bullet per parent
  edgesByParent.forEach((children, parent) => {
    const list = children
      .map((c) => {
        const pct = c.pct != null ? `${c.pct}%` : null;
        return pct ? `${pct} owned by ${c.to}` : `…% owned by ${c.to}`;
      })
      .join(' and ');
    bullets.push(`${parent} → ${list}`);
  });

  // 2) Per-UBO result line — direct vs indirect
  ubos.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      const eff = Number(h.effectivePercentage ?? p.percentage);
      const isDirect = parts.length === 2;
      const apiSteps = Array.isArray(p.steps) && p.steps.length ? p.steps : null;
      if (isDirect) {
        bullets.push(`${h.fullName}'s direct interest = ${eff}%`);
      } else {
        const left = apiSteps
          ? apiSteps.map((s) => `${s.pct}%`).join(' × ')
          : Array.from({ length: parts.length - 1 }).map((_, i) => `hop${i + 1}%`).join(' × ');
        bullets.push(`${h.fullName}'s indirect interest = ${left} = ${eff}%`);
      }
    });
  });

  // 3) Control-only holders
  controlOnly.forEach((h) => {
    const basis = (h.controlBasis || []).join(', ');
    bullets.push(`${h.fullName} — control via ${basis || 'other means'} (no ownership)`);
  });

  // 4) Fallback
  if (fallback) {
    bullets.push(`Senior managing official fallback: ${fallback.name}${fallback.position ? ` (${fallback.position})` : ''}`);
  }

  if (bullets.length === 0) return null;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.infoSoft}, #fff)`,
      border: `1px solid ${T.infoBorder}`,
      borderLeft: `4px solid ${T.info}`,
      borderRadius: T.radius, padding: 16, marginBottom: 16, boxShadow: T.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', color: T.info }}>{I.link}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.info }}>
          Ownership chain summary — {rootName}
        </span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.55, color: T.text, fontFamily: T.font }}>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Pie chart — direct vs indirect slices
   ========================================================================== */
function OwnershipPieChart({ entity }) {
  const tree = entity?.tree;
  const ubos = (tree?.holders || []).filter((h) => h.ubo);

  /* Aggregate UBO percentages into direct and indirect buckets */
  const chartData = useMemo(() => {
    let directTotal = 0;
    let indirectTotal = 0;
    const directHolders = [];
    const indirectHolders = [];

    ubos.forEach((h) => {
      const pct = Number(h.effectivePercentage) || 0;
      if (pct <= 0) return;
      if (isDirectHolder(h)) {
        directTotal += pct;
        directHolders.push({ name: h.fullName, pct });
      } else {
        indirectTotal += pct;
        indirectHolders.push({ name: h.fullName, pct });
      }
    });

    const slices = [];
    if (directTotal > 0) {
      slices.push({
        name: `Direct (${directHolders.length} UBO${directHolders.length === 1 ? '' : 's'})`,
        value: directTotal,
        kind: 'direct',
        holders: directHolders,
      });
    }
    if (indirectTotal > 0) {
      slices.push({
        name: `Indirect (${indirectHolders.length} UBO${indirectHolders.length === 1 ? '' : 's'})`,
        value: indirectTotal,
        kind: 'indirect',
        holders: indirectHolders,
      });
    }
    const total = directTotal + indirectTotal;
    if (total > 0 && total < 100) {
      slices.push({ name: 'Other / unallocated', value: 100 - total, kind: 'other' });
    }
    return slices;
  }, [ubos]);

  const total = chartData.reduce((s, r) => s + r.value, 0);
  const directSlice = chartData.find((r) => r.kind === 'direct');
  const indirectSlice = chartData.find((r) => r.kind === 'indirect');

  if (!tree) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13, background: T.surfaceAlt, borderRadius: T.radiusSm, border: `1px dashed ${T.border}` }}>
        No ownership data loaded yet.
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13, background: T.surfaceAlt, borderRadius: T.radiusSm, border: `1px dashed ${T.border}` }}>
        No UBO ownership recorded for this entity.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
    return (
      <div style={{
        background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
        padding: '10px 12px', boxShadow: T.shadowMd, fontFamily: T.font, fontSize: 12, minWidth: 160,
      }}>
        <div style={{ fontWeight: 700, color: T.text, marginBottom: 4 }}>{item.name}</div>
        <div style={{ color: T.textMuted, marginBottom: 6 }}>
          <strong style={{ color: item.payload.kind === 'direct' ? COLORS.direct : item.payload.kind === 'indirect' ? COLORS.indirect : T.textMuted }}>
            {item.value}%
          </strong> · {pct}% of total
        </div>
        {item.payload.holders && item.payload.holders.length > 0 && (
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {item.payload.holders.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: T.textMuted }}>{h.name}</span>
                <strong style={{ color: T.text }}>{h.pct}%</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: T.font }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, auto)', gap: 20, alignItems: 'center' }}>
        {/* Donut */}
        <div style={{ width: '100%', height: 300, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={2}
                stroke="#fff"
                strokeWidth={2}
                isAnimationActive
                animationDuration={600}
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
                {chartData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[entry.kind] || COLORS.other} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textFaint }}>Allocated</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: T.primary, letterSpacing: '-.03em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{total}%</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{ubos.length} UBO{ubos.length === 1 ? '' : 's'}</div>
          </div>
        </div>

        {/* Legend panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {directSlice && (
            <div style={{ border: `1px solid ${COLORS.direct}33`, background: `${COLORS.direct}0d`, borderRadius: T.radiusSm, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.direct, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COLORS.direct }}>Direct</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{directSlice.value}%</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{directSlice.holders.map((h) => h.name).join(', ')}</div>
            </div>
          )}
          {indirectSlice && (
            <div style={{ border: `1px solid ${COLORS.indirect}33`, background: `${COLORS.indirect}0d`, borderRadius: T.radiusSm, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.indirect, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: COLORS.indirect }}>Indirect</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{indirectSlice.value}%</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{indirectSlice.holders.map((h) => h.name).join(', ')}</div>
            </div>
          )}
          {chartData.find((r) => r.kind === 'other') && (
            <div style={{ border: `1px solid ${T.border}`, background: T.surfaceAlt, borderRadius: T.radiusSm, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.other, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.textMuted }}>Other</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {chartData.find((r) => r.kind === 'other').value}%
              </div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Unallocated</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Chain trace per person
   ========================================================================== */
function ChainTraceBlock({ holder }) {
  const traceRows = (holder.paths || []).map((p) => {
    const steps = splitChain(p.chain);
    const effective = Number(holder.effectivePercentage ?? p.percentage);
    return { chain: steps, effective };
  });
  if (traceRows.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: 12, background: T.infoSoft, border: `1px solid ${T.infoBorder}`, borderRadius: T.radiusSm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: T.info }}>{I.link}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.info }}>
          Ownership chain trace
        </span>
      </div>
      {traceRows.map((row, rowIdx) => {
        const { chain, effective } = row;
        const isDirect = chain.length === 2;
        const hops = chain.length - 1;
        return (
          <div key={rowIdx} style={{ marginTop: rowIdx > 0 ? 12 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chain.slice(0, -1).map((from, i) => {
                const to = chain[i + 1];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12.5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 4, background: i === 0 ? T.info : i === chain.length - 2 ? T.success : T.primary, color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ color: T.text, fontWeight: 500 }}>{from}</span>
                    <span style={{ display: 'inline-flex', color: T.textFaint }}>{I.arrow}</span>
                    <span style={{ color: T.text, fontWeight: 600 }}>{to}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, fontWeight: 500, color: T.textMuted }}>
                      {isDirect ? 'direct' : `hop ${i + 1}/${hops}`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isDirect ? T.successSoft : T.primarySoft, border: `1px solid ${isDirect ? T.successBorder : `${T.primary}44`}`, borderRadius: T.radiusSm, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', color: isDirect ? T.success : T.primary }}>{I.equal}</span>
              <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>{isDirect ? 'Direct interest' : 'Effective indirect interest'}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: isDirect ? T.success : T.primary, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{effective}%</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: isDirect ? T.success : T.primary, textTransform: 'uppercase', letterSpacing: '.05em' }}>{isDirect ? 'direct' : 'indirect'}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Detail cards
   ========================================================================== */
function EntityDetailCard({ entity }) {
  return (
    <div style={{ padding: 16, borderRadius: T.radius, background: `linear-gradient(135deg, ${T.primarySoft}, #fff)`, border: `1px solid ${T.primary}33`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: '#fff', color: T.primary, flexShrink: 0, boxShadow: '0 1px 3px rgba(40,51,117,.15)' }}>{I.building}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>{entity.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fff', color: T.primary, border: `1px solid ${T.primary}33`, letterSpacing: '.04em', textTransform: 'uppercase' }}>Legal entity</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 18px', marginTop: 10 }}>
          <Field k="Registration" v={entity.registrationNumber || '—'} mono />
          <Field k="Entity type" v={entity.entityType || '—'} />
          <Field k="Country" v={entity.countryOfIncorporation || '—'} />
        </div>
      </div>
    </div>
  );
}

function IntermediateDetailCard({ name, holderKeys }) {
  return (
    <div style={{ padding: 14, borderRadius: T.radiusSm, background: '#fff', border: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: T.shadow }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: T.primarySoft, color: T.primary, flexShrink: 0 }}>{I.building}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: T.textMuted, letterSpacing: '.04em', textTransform: 'uppercase' }}>Intermediate</span>
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 4 }}>
          {holderKeys.size} beneficial owner{holderKeys.size === 1 ? '' : 's'} downstream
        </div>
      </div>
    </div>
  );
}

function PersonDetailCard({ holder, kind = 'ubo' }) {
  return (
    <div style={{ padding: 14, borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow, transition: 'border-color .15s ease, box-shadow .15s ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.primary + '55'; e.currentTarget.style.boxShadow = T.shadowMd; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.shadow; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#eef1f7', color: T.textMuted, flexShrink: 0 }}>{I.person}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{holder.fullName || '—'}</span>
        {kind === 'ubo' && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.successSoft, color: T.success, letterSpacing: '.04em', textTransform: 'uppercase' }}>UBO</span>}
        {kind === 'control' && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.primarySoft, color: T.primary, letterSpacing: '.04em', textTransform: 'uppercase' }}>Control</span>}
        {holder.pep && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: T.warnSoft, color: T.warn, letterSpacing: '.04em', textTransform: 'uppercase' }}>PEP</span>}
        {holder.status && <StatusBadge status={holder.status} />}
        {holder.effectivePercentage != null && (
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
            {holder.effectivePercentage}%
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: isDirectHolder(holder) ? T.success : T.info }}>
              {isDirectHolder(holder) ? 'direct' : 'indirect'}
            </span>
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px 20px', marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
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
        {holder.controlBasis?.length > 0 && <Field k="Control basis" v={holder.controlBasis.join(', ')} />}
      </div>
      <ChainTraceBlock holder={holder} />
    </div>
  );
}

function FallbackDetailCard({ fallback }) {
  return (
    <div style={{ padding: 14, borderRadius: T.radiusSm, background: `linear-gradient(135deg, ${T.warnSoft}, #fff)`, border: `1px solid ${T.warnBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#fff', color: T.warn, flexShrink: 0 }}>{I.person}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{fallback.name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fff', color: T.warn, border: `1px solid ${T.warnBorder}`, letterSpacing: '.04em', textTransform: 'uppercase' }}>Fallback</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px 20px', marginTop: 10 }}>
        <Field k="Position" v={fallback.position || '—'} />
        <Field k="Justification" v={fallback.justification || '—'} />
      </div>
    </div>
  );
}

/* ==========================================================================
   Ownership structure block
   ========================================================================== */
function OwnershipStructure({ entity }) {
  const tree = entity.tree;
  if (!tree) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13, background: T.surfaceAlt, borderRadius: T.radiusSm, border: `1px dashed ${T.border}` }}>
        No ownership structure loaded for this entity.
      </div>
    );
  }

  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;

  const parentOf = (h) => {
    for (const p of (h.paths || [])) {
      const parts = splitChain(p.chain);
      if (parts.length > 2) return parts[parts.length - 2];
    }
    return null;
  };

  const intermediateSet = new Map();
  tree.holders.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) {
        const name = parts[i];
        if (!name) continue;
        if (!intermediateSet.has(name)) intermediateSet.set(name, { name, holderKeys: new Set() });
        intermediateSet.get(name).holderKeys.add(h.key);
      }
    });
  });

  const buckets = new Map();
  const direct = { ubos: [], control: [] };

  ubos.forEach((h) => {
    const parent = parentOf(h);
    if (parent) {
      if (!buckets.has(parent)) buckets.set(parent, { ubos: [], control: [] });
      buckets.get(parent).ubos.push(h);
    } else {
      direct.ubos.push(h);
    }
  });
  controlOnly.forEach((h) => {
    const parent = parentOf(h);
    if (parent) {
      if (!buckets.has(parent)) buckets.set(parent, { ubos: [], control: [] });
      buckets.get(parent).control.push(h);
    } else {
      direct.control.push(h);
    }
  });

  const bucketEntries = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <EntityDetailCard entity={entity} />

      {bucketEntries.map(([name, group]) => {
        const target = intermediateSet.get(name);
        return (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <IntermediateDetailCard name={name} holderKeys={target?.holderKeys || new Set()} />
            {group.ubos.map((h) => <PersonDetailCard key={h.key} holder={h} kind="ubo" />)}
            {group.control.map((h) => <PersonDetailCard key={h.key} holder={h} kind="control" />)}
          </div>
        );
      })}

      {direct.ubos.length > 0 && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 10 }}>
            Direct holders ({direct.ubos.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {direct.ubos.map((h) => <PersonDetailCard key={h.key} holder={h} kind="ubo" />)}
            {direct.control.map((h) => <PersonDetailCard key={h.key} holder={h} kind="control" />)}
          </div>
        </div>
      )}

      {fallback && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 10 }}>
            Senior managing official (fallback)
          </div>
          <FallbackDetailCard fallback={fallback} />
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Print CSS
   ========================================================================== */
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden; }
    .dashboard-printable, .dashboard-printable * { visibility: visible; }
    .dashboard-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
    .dashboard-no-print { display: none !important; }
    .dashboard-printable { font-size: 11px; }
    .dashboard-printable tr { page-break-inside: avoid; }
    .dashboard-printable h1 { font-size: 18px !important; }
    @page { margin: 12mm; size: A4; }
  }
`;

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

  /* Load legal persons — sort newest first, auto-select latest */
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
    if (!entityId) return;
    if (trees[entityId]) return;
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
      const holders = tree?.holders || [];
      const ubos = holders.filter((h) => h.ubo);
      return {
        id: lp.id,
        name: lp.name,
        registrationNumber: lp.registrationNumber,
        entityType: lp.entityType,
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
      (s, e) => s + (e.tree?.holders || []).filter((h) => h.ubo && (h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered)).length,
      0,
    );
    const pending = loaded.reduce(
      (s, e) => s + (e.tree?.holders || []).filter((h) => h.ubo && h.status === 'PENDING').length,
      0,
    );
    return { totalUbos, verified, pending };
  }, [entities]);

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <style>{PRINT_CSS}</style>

      {/* Header */}
      <div className="dashboard-no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-.025em', color: T.text }}>Overview</h1>
            {entityId && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 10.5, fontWeight: 700, color: T.primary, background: T.primarySoft, borderRadius: 12, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {I.filter} Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>Beneficial ownership by legal entity — full chain trace</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {entityId && (
            <Btn variant="secondary" icon={I.printer} onClick={() => window.print()}>Print</Btn>
          )}
          {canRegister && (
            <button
              type="button" onClick={onRegister}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.primaryHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.primary; }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: T.primary,
                border: 'none', borderRadius: T.radiusSm, cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(40,51,117,.20)', transition: 'background .15s ease', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>
              New record
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}`, borderRadius: T.radiusSm, fontSize: 13 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* KPI row */}
      <div className="dashboard-printable" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Legal entities" value={entities.length} tone="neutral" icon={I.building} loading={loadingList} caption="Registered customers" />
        <Kpi label="Total UBOs" value={totals.totalUbos} tone="neutral" icon={I.users} loading={loadingTree && !selectedEntity} caption={selectedEntity ? 'In selected entity' : 'Across loaded entities'} />
        <Kpi label="Verified" value={totals.verified} tone="success" icon={I.check} loading={loadingTree && !selectedEntity} caption="Approved by checker" />
        <Kpi label="Pending" value={totals.pending} tone="warn" icon={I.clock} loading={loadingTree && !selectedEntity} caption="Awaiting approval" />
      </div>

      {/* Filter */}
      <div className="dashboard-no-print" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>
            {I.filter} Filter by legal entity
          </span>
          <span style={{ flex: 1, height: 1, background: T.border }} />
          {entityId && <Btn variant="ghost" size="sm" icon={I.x} onClick={() => setEntityId('')}>Clear</Btn>}
        </div>

        <EntityCombobox
          options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))}
          value={entityId} onChange={setEntityId} loading={loadingList}
          placeholder="Search by legal name or registration number…"
        />

        {selectedEntity && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.textMuted, flexWrap: 'wrap' }}>
            <span>Showing structure for</span>
            <strong style={{ color: T.text }}>{selectedEntity.name}</strong>
            {selectedEntity.registrationNumber && (
              <span style={{ fontFamily: T.mono, fontSize: 11 }}>· {selectedEntity.registrationNumber}</span>
            )}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.success }} />
              <span style={{ fontWeight: 600, color: T.success }}>{selectedEntity.uboCount} UBO{selectedEntity.uboCount === 1 ? '' : 's'}</span>
            </span>
          </div>
        )}
      </div>

      {!entityId && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, padding: '60px 20px', textAlign: 'center' }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, background: T.primarySoft, color: T.primary, marginBottom: 14 }}>
            {I.building}
          </span>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Select a legal entity</div>
          <div style={{ fontSize: 12.5, color: T.textMuted }}>
            Choose an entity above to view its ownership chart, chain, intermediates, UBOs, and any fallback.
          </div>
        </div>
      )}

      {entityId && (
        <div className="dashboard-printable">
          {/* Pie chart — direct vs indirect */}
          {selectedEntity?.tree && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, padding: 18, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ display: 'inline-flex', color: T.primary }}>{I.chart}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
                  Ownership distribution — {selectedEntity.name}
                </span>
              </div>
              <OwnershipPieChart entity={selectedEntity} />
            </div>
          )}

          {/* Summary bullets */}
          {selectedEntity?.tree && <OwnershipSummaryCard entity={selectedEntity} />}

          {/* Full structure */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>Ownership structure</h3>
              <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                Full chain trace with effective ownership calculation
              </div>
            </div>
            <div style={{ padding: 18 }}>
              {loadingTree && !selectedEntity?.tree ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${T.border}`, borderTopColor: T.primary, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                    Loading ownership structure…
                  </span>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : selectedEntity ? (
                <OwnershipStructure entity={selectedEntity} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
