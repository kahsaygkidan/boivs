import { useEffect, useMemo, useRef, useState } from 'react';
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

/* Color palette for pie chart slices */
const SLICE_COLORS = [
  '#283375', '#3b82f6', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#65a30d', '#db2777', '#475569',
];

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
  pie: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 12A10 10 0 0 0 12 2v10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
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

  const displayValue = open
    ? query
    : selected
      ? `${selected.label}${selected.sub ? ` — ${selected.sub}` : ''}`
      : '';

  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, fontFamily: T.font, minWidth: 280, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>Legal entity</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: focused ? T.primary : T.textFaint, display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {I.search}
        </span>
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
                key={o.value}
                role="option"
                aria-selected={o.value === value}
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

/** Pick the most recent entity from a list, using createdAt / updatedAt if present. */
function pickLatest(entities) {
  if (!entities || entities.length === 0) return null;
  const withDate = entities
    .map((e) => ({ e, t: e.createdAt ? new Date(e.createdAt).getTime() : (e.updatedAt ? new Date(e.updatedAt).getTime() : NaN) }))
    .filter((x) => Number.isFinite(x.t));
  if (withDate.length > 0) {
    withDate.sort((a, b) => b.t - a.t);
    return withDate[0].e;
  }
  // Fallback: last item in the sorted list (assuming sort: 'name' — last alphabetically)
  return entities[entities.length - 1];
}

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
   PIE CHART — ownership distribution for the selected entity
   ========================================================================== */
function OwnershipPieChart({ entity }) {
  const tree = entity?.tree;
  if (!tree) return null;

  const holders = tree.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const controlOnly = holders.filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;

  // Build slice data — each UBO's effective %, then control-only "no ownership" (0%),
  // then fallback (0%) as informational-only slices.
  const slices = [];
  ubos.forEach((h) => {
    const pct = Number(h.effectivePercentage ?? 0);
    if (pct > 0) slices.push({ name: h.fullName, pct, kind: 'ubo', holder: h });
  });
  controlOnly.forEach((h) => {
    slices.push({ name: h.fullName, pct: 0, kind: 'control', holder: h });
  });
  if (fallback) {
    slices.push({ name: fallback.name, pct: 0, kind: 'fallback', fallback });
  }

  const totalPct = slices.reduce((s, x) => s + x.pct, 0);
  const hasOwnership = totalPct > 0;

  // SVG geometry
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 92;
  const STROKE = 22; // donut thickness — set to 0 for solid pie; here we use donut
  const r = R - STROKE / 2;

  // Build arcs
  const arcs = [];
  if (hasOwnership) {
    let angleStart = -Math.PI / 2; // start at 12 o'clock
    slices.forEach((s, i) => {
      if (s.pct <= 0) return;
      const angle = (s.pct / totalPct) * Math.PI * 2;
      const angleEnd = angleStart + angle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = CX + r * Math.cos(angleStart);
      const y1 = CY + r * Math.sin(angleStart);
      const x2 = CX + r * Math.cos(angleEnd);
      const y2 = CY + r * Math.sin(angleEnd);
      const path = [
        `M ${CX} ${CY}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      arcs.push({ ...s, path, color: SLICE_COLORS[i % SLICE_COLORS.length], displayPct: s.pct });
      angleStart = angleEnd;
    });
  }

  // Donut hole (for center label)
  const centerLabel = hasOwnership
    ? `${slices.length}`
    : '0';
  const centerSub = hasOwnership
    ? (slices.length === 1 ? 'holder' : 'holders')
    : 'holders';

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radius,
      boxShadow: T.shadow,
      padding: 18,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', color: T.primary }}>{I.pie}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
          Ownership distribution
        </span>
        {hasOwnership && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.textFaint, fontWeight: 500 }}>
            {totalPct}% total · {slices.length} holder{slices.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!hasOwnership ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>
          No beneficial owners with ownership percentage recorded for this entity.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          {/* Donut chart */}
          <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Ownership distribution chart">
              <defs>
                <filter id="pieShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0f172a" floodOpacity="0.12" />
                </filter>
              </defs>

              {/*
