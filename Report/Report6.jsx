import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getDashboardStats, listLegalPersons, getOwnershipTree,
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
  hoverRow: '#f8fafc',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowMd: '0 4px 12px rgba(15,23,42,.06), 0 2px 4px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
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
  download: <svg {...ic}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  print: <svg {...ic}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" /><path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>,
  calendar: <svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  spark: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>,
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
    soft: { background: T.primarySoft, color: T.primary, border: `1px solid transparent` },
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
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>1. Legal entity</span>
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
   Cascading select
   ========================================================================== */
function CascadeSelect({ label, value, onChange, options, disabled, placeholder }) {
  const [focused, setFocused] = useState(false);
  const isActive = value !== '';
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, fontFamily: T.font, minWidth: 210, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            height: 40, width: '100%', padding: '0 34px 0 12px',
            fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
            color: disabled ? T.textFaint : isActive ? T.primary : value ? T.text : T.textMuted,
            background: disabled ? '#f8fafc' : isActive ? T.primarySoft : focused ? '#fff' : T.surfaceAlt,
            border: `1px solid ${focused ? T.primary : isActive ? `${T.primary}66` : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
          }}
        >
          <option value="">{placeholder || 'All'}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.textFaint, pointerEvents: 'none', display: 'flex' }}>
          {I.chevron}
        </span>
      </div>
    </label>
  );
}

/* ==========================================================================
   Date input
   ========================================================================== */
function DateInput({ label, value, onChange, min, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, fontFamily: T.font, minWidth: 160, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: focused ? T.primary : value ? T.primary : T.textFaint, display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {I.calendar}
        </span>
        <input
          type="date"
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: 'none',
            height: 40, width: '100%', padding: '0 10px 0 34px',
            fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500,
            color: value ? T.text : T.textMuted,
            background: focused ? '#fff' : value ? T.primarySoft : T.surfaceAlt,
            border: `1px solid ${focused ? T.primary : value ? `${T.primary}66` : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none', cursor: 'pointer',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </label>
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */
const splitChain = (chain) => String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

const STATUS_MATCHES = (holderStatus, filterStatus) => {
  if (!filterStatus) return true;
  if (filterStatus === 'VERIFIED') return holderStatus === 'VERIFIED' || holderStatus === 'APPROVED';
  return holderStatus === filterStatus;
};

const DATE_IN_RANGE = (date, from, to) => {
  if (!from && !to) return true;
  if (!date) return false;
  const d = String(date).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

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

function deriveStructure(tree, legalPerson) {
  if (!tree) return { intermediates: [], persons: [], fallback: null };

  const rootName = (legalPerson?.name || '').trim();
  const holders = tree.holders || [];
  const ubos = holders.filter((h) => h.ubo);
  const controlOnly = holders.filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));

  const intermediateMap = new Map();
  holders.forEach((h) => {
    (h.paths || []).forEach((p) => {
      const parts = splitChain(p.chain);
      for (let i = 1; i < parts.length - 1; i++) {
        const name = parts[i];
        if (!name || name === rootName) continue;
        if (!intermediateMap.has(name)) intermediateMap.set(name, { name, holderKeys: new Set() });
        intermediateMap.get(name).holderKeys.add(h.key);
      }
    });
  });

  const intermediates = Array.from(intermediateMap.values()).map((v) => ({
    value: v.name, label: v.name, holderKeys: v.holderKeys,
  }));

  const persons = [
    ...ubos.map((h) => ({
      value: h.key,
      label: `${h.fullName}${h.effectivePercentage != null ? ` (${h.effectivePercentage}%)` : ''}`,
      kind: 'ubo', holder: h,
    })),
    ...controlOnly.map((h) => ({
      value: h.key, label: `${h.fullName} — control only`, kind: 'control', holder: h,
    })),
  ];

  return { intermediates, persons, fallback: tree.seniorManagingOfficial || null };
}

function aggregateEntities(legalPersons, trees) {
  return legalPersons.map((lp) => {
    const tree = trees[lp.id];
    const holders = tree?.holders || [];
    const ubos = holders.filter((h) => h.ubo);
    const fallback = tree?.seniorManagingOfficial || null;
    const hasWarnings = (tree?.warnings || []).length > 0;

    return {
      id: lp.id, name: lp.name, registrationNumber: lp.registrationNumber,
      entityType: lp.entityType, countryOfIncorporation: lp.countryOfIncorporation,
      tin: lp.tin, uboCount: ubos.length, fallback, hasWarnings, tree, ubos,
    };
  });
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
   Detail cards
   ========================================================================== */
function EntityDetailCard({ entity }) {
  return (
    <div style={{
      padding: 16, borderRadius: T.radius, background: `linear-gradient(135deg, ${T.primarySoft}, #fff)`,
      border: `1px solid ${T.primary}33`, display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span aria-hidden="true" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, borderRadius: 10, background: '#fff', color: T.primary, flexShrink: 0,
        boxShadow: '0 1px 3px rgba(40,51,117,.15)',
      }}>{I.building}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-.01em' }}>{entity.name}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#fff', color: T.primary, border: `1px solid ${T.primary}33`, letterSpacing: '.04em', textTransform: 'uppercase' }}>Legal entity</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 18px', marginTop: 10 }}>
          <Field k="Registration" v={entity.registrationNumber || '—'} mono />
          <Field k="Entity type" v={entity.entityType || '—'} />
          <Field k="Country" v={entity.countryOfIncorporation || '—'} />
          <Field k="TIN" v={entity.tin || '—'} mono />
        </div>
      </div>
    </div>
  );
}

function IntermediateDetailCard({ name, holderKeys }) {
  return (
    <div style={{
      padding: 14, borderRadius: T.radiusSm, background: '#fff',
      border: `1px solid ${T.border}`, display: 'flex', gap: 12, alignItems: 'flex-start',
      boxShadow: T.shadow,
    }}>
      <span aria-hidden="true" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8, background: T.primarySoft, color: T.primary, flexShrink: 0,
      }}>{I.building}</span>
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
    <div style={{
      padding: 14, borderRadius: T.radiusSm, background: T.surface,
      border: `1px solid ${T.border}`, boxShadow: T.shadow,
      transition: 'border-color .15s ease, box-shadow .15s ease',
    }}
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
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{holder.effectivePercentage}%</span>
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
   Structure detail
   ========================================================================== */
function StructureDetail({ entity, intermediateName, personKey, statusFilter, dateFrom, dateTo, derived }) {
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

  const filterByIntermediate = (h) => {
    if (!intermediateName) return true;
    const target = derived.intermediates.find((x) => x.value === intermediateName);
    return target ? target.holderKeys.has(h.key) : false;
  };
  const filterByPerson = (h) => (!personKey ? true : personKey === '__fallback__' ? false : h.key === personKey);
  const filterByStatus = (h) => STATUS_MATCHES(h.status, statusFilter);
  const filterByDate = (h) => DATE_IN_RANGE(h.dateBecameBo, dateFrom, dateTo);

  const shownUbos = ubos.filter(filterByIntermediate).filter(filterByPerson).filter(filterByStatus).filter(filterByDate);
  const shownControl = controlOnly.filter(filterByIntermediate).filter(filterByPerson).filter(filterByStatus).filter(filterByDate);
  const showFallback =
    fallback &&
    (!statusFilter || personKey === '__fallback__') &&
    (!dateFrom && !dateTo) &&
    (personKey === '' || personKey === '__fallback__');

  const parentOf = (h) => {
    for (const p of (h.paths || [])) {
      const parts = splitChain(p.chain);
      if (parts.length > 2) return parts[parts.length - 2];
    }
    return null;
  };

  const buckets = new Map();
  const direct = { ubos: [], control: [] };

  shownUbos.forEach((h) => {
    const parent = parentOf(h);
    if (parent && (!intermediateName || parent === intermediateName)) {
      if (!buckets.has(parent)) buckets.set(parent, { ubos: [], control: [] });
      buckets.get(parent).ubos.push(h);
    } else {
      direct.ubos.push(h);
    }
  });
  shownControl.forEach((h) => {
    const parent = parentOf(h);
    if (parent && (!intermediateName || parent === intermediateName)) {
      if (!buckets.has(parent)) buckets.set(parent, { ubos: [], control: [] });
      buckets.get(parent).control.push(h);
    } else {
      direct.control.push(h);
    }
  });

  const bucketEntries = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const totalShown = shownUbos.length + shownControl.length + (showFallback ? 1 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <EntityDetailCard entity={entity} />

      {bucketEntries.map(([name, group]) => {
        const target = derived.intermediates.find((x) => x.value === name);
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

      {showFallback && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted, marginBottom: 10 }}>
            Senior managing official (fallback)
          </div>
          <FallbackDetailCard fallback={fallback} />
        </div>
      )}

      {totalShown === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 12.5, background: T.surfaceAlt, borderRadius: T.radiusSm, border: `1px dashed ${T.border}` }}>
          No holders match the current filters.
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Entity row
   ========================================================================== */
function EntityRow({ entity, onSelect, selected }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      onClick={() => onSelect?.(entity.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        background: selected ? T.primarySoft : hover ? T.hoverRow : T.surface,
        transition: 'background .12s ease',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: T.text, verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: T.primarySoft, color: T.primary, flexShrink: 0 }}>{I.building}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entity.name}</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.mono, marginTop: 1 }}>{entity.registrationNumber || '—'}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 16px', fontSize: 12.5, color: T.textMuted, verticalAlign: 'middle' }}>{entity.entityType || '—'}</td>
      <td style={{ padding: '14px 16px', fontSize: 12.5, color: T.textMuted, verticalAlign: 'middle' }}>{entity.countryOfIncorporation || '—'}</td>
      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: T.primary, verticalAlign: 'middle' }}>{entity.uboCount}</td>
      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
        {entity.fallback
          ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: T.warnSoft, color: T.warn, letterSpacing: '.04em', textTransform: 'uppercase' }}>Fallback</span>
          : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        }
      </td>
      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
        {entity.hasWarnings
          ? <span style={{ display: 'inline-flex', color: T.warn }} title="Ownership tracing warnings">{I.alert}</span>
          : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        }
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
        {selected
          ? <span style={{ fontSize: 11, color: T.primary, fontWeight: 700 }}>Selected</span>
          : <span style={{ fontSize: 12, color: T.textFaint }}>{I.chevron}</span>
        }
      </td>
    </tr>
  );
}

/* ==========================================================================
   Print styles
   ========================================================================== */
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden; }
    .report-printable, .report-printable * { visibility: visible; }
    .report-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
    .report-no-print { display: none !important; }
    .report-printable { font-size: 11px; }
    .report-printable table { font-size: 10px; }
    .report-printable tr { page-break-inside: avoid; }
    .report-printable h1 { font-size: 18px !important; }
    @page { margin: 12mm; size: A4; }
  }
`;

/* ==========================================================================
   Reports
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Cascading filter state */
  const [entityId, setEntityId] = useState('');
  const [intermediateName, setIntermediateName] = useState('');
  const [personKey, setPersonKey] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedId, setSelectedId] = useState('');

  /* Load data */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listLegalPersons({ size: 500, sort: 'name' }), getDashboardStats()])
      .then(([listRes, statsRes]) => {
        if (cancelled) return;
        setLegalPersons(listRes.content || []);
        setStats(statsRes);
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
        getOwnershipTree(lp.id)
          .then((t) => [lp.id, t])
          .catch(() => [lp.id, null])
      )
    ).then((pairs) => {
      if (cancelled) return;
      const map = {};
      pairs.forEach(([id, t]) => { map[id] = t; });
      setTrees(map);
    });
    return () => { cancelled = true; };
  }, [legalPersons]);

  const entities = useMemo(() => aggregateEntities(legalPersons, trees), [legalPersons, trees]);
  const currentEntity = entities.find((e) => e.id === entityId) || null;
  const derived = useMemo(() => deriveStructure(currentEntity?.tree, currentEntity), [currentEntity]);

  /* Reset downstream */
  useEffect(() => { setIntermediateName(''); setPersonKey(''); }, [entityId]);
  useEffect(() => { setPersonKey(''); }, [intermediateName]);

  const personOptions = useMemo(() => {
    const list = derived.persons || [];
    if (!intermediateName) return list;
    const target = derived.intermediates.find((x) => x.value === intermediateName);
    if (!target) return list;
    return list.filter((p) => target.holderKeys.has(p.value));
  }, [derived, intermediateName]);

  /* Table filter — entity + status + date */
  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (entityId && e.id !== entityId) return false;
      if (statusFilter || dateFrom || dateTo) {
        const holders = e.ubos || [];
        const hasMatch = holders.some((h) =>
          STATUS_MATCHES(h.status, statusFilter) &&
          DATE_IN_RANGE(h.dateBecameBo, dateFrom, dateTo)
        );
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [entities, entityId, statusFilter, dateFrom, dateTo]);

  const selected = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0] || null;

  const totals = useMemo(() => {
    const totalEntities = filtered.length;
    const totalUbos = filtered.reduce((s, e) => s + e.uboCount, 0);
    const withFallback = filtered.filter((e) => e.fallback).length;
    return { totalEntities, totalUbos, withFallback };
  }, [filtered]);

  const filtersActive = entityId || intermediateName || personKey || statusFilter || dateFrom || dateTo;

  const clearAll = () => {
    setEntityId(''); setIntermediateName(''); setPersonKey('');
    setStatusFilter(''); setDateFrom(''); setDateTo('');
  };

  const handleExportCsv = () => {
    const header = ['Entity', 'Registration', 'Type', 'Country', 'UBOs', 'Fallback'];
    const lines = filtered.map((e) => [
      e.name, e.registrationNumber || '', e.entityType || '', e.countryOfIncorporation || '',
      e.uboCount, e.fallback ? 'Yes' : 'No',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ubo-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusOptions = [
    { value: 'VERIFIED', label: 'Verified / approved' },
    { value: 'PENDING', label: 'Pending verification' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CEASED', label: 'Ceased' },
  ];

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <style>{PRINT_CSS}</style>

      {/* ==================== Header ==================== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-.025em', color: T.text }}>Compliance report</h1>
            {filtersActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 10.5, fontWeight: 700, color: T.primary, background: T.primarySoft, borderRadius: 12, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {I.filter} Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>Beneficial ownership across legal entities, intermediates, and natural persons</div>
        </div>

        <div className="report-no-print" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn variant="secondary" icon={I.download} onClick={handleExportCsv}>Export CSV</Btn>
          <Btn variant="primary" icon={I.print} onClick={() => window.print()}>Print</Btn>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}`, borderRadius: T.radiusSm, fontSize: 13 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================== KPI grid ==================== */}
      <div className="report-printable" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Legal entities" value={totals.totalEntities} tone="neutral" icon={I.building} loading={loading} caption="In current selection" />
        <Kpi label="Total UBOs" value={totals.totalUbos} tone="neutral" icon={I.users} loading={loading} caption="Natural persons" />
        <Kpi label="With fallback" value={totals.withFallback} tone="warn" icon={I.clock} loading={loading} caption="Senior managing official" />
        <Kpi label="Filter steps" value={[entityId, intermediateName, personKey, statusFilter, dateFrom || dateTo].filter(Boolean).length} tone="success" icon={I.spark} loading={false} caption="Active in chain" />
      </div>

      {/* ==================== Filter chain ==================== */}
      <div className="report-no-print" style={{
        background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
        boxShadow: T.shadow, padding: 18, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: T.textMuted }}>
            {I.filter} Filter chain
          </span>
          <span style={{ flex: 1, height: 1, background: T.border }} />
          {filtersActive && (
            <Btn variant="ghost" size="sm" icon={I.x} onClick={clearAll}>Clear all</Btn>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <EntityCombobox
            options={entities.map((e) => ({
              value: e.id,
              label: e.name,
              sub: e.registrationNumber,
            }))}
            value={entityId}
            onChange={setEntityId}
            loading={loading}
          />

          <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textFaint, paddingBottom: 10, flexShrink: 0 }}>{I.arrow}</span>

          <CascadeSelect
            label="2. Intermediate"
            value={intermediateName}
            onChange={(e) => setIntermediateName(e.target.value)}
            disabled={!entityId || derived.intermediates.length === 0}
            options={derived.intermediates.map((x) => ({ value: x.value, label: x.label }))}
            placeholder={!entityId ? 'Select entity first' : derived.intermediates.length === 0 ? 'No intermediates' : 'All intermediates'}
          />

          <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textFaint, paddingBottom: 10, flexShrink: 0 }}>{I.arrow}</span>

          <CascadeSelect
            label="3. Person / fallback"
            value={personKey}
            onChange={(e) => setPersonKey(e.target.value)}
            disabled={!entityId || (personOptions.length === 0 && !derived.fallback)}
            options={[
              ...personOptions.map((p) => ({ value: p.value, label: p.label })),
              ...(derived.fallback ? [{ value: '__fallback__', label: `${derived.fallback.name} — fallback` }] : []),
            ]}
            placeholder={!entityId ? 'Select entity first' : personOptions.length === 0 && !derived.fallback ? 'No persons' : 'All persons'}
          />

          <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textFaint, paddingBottom: 10, flexShrink: 0 }}>{I.arrow}</span>

          <CascadeSelect
            label="4. Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            placeholder="All statuses"
          />

          <span aria-hidden="true" style={{ display: 'inline-flex', color: T.textFaint, paddingBottom: 10, flexShrink: 0 }}>{I.arrow}</span>

          <DateInput label="5. Start date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          <DateInput label="End date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap', paddingBottom: 10 }}>
            {loading ? 'Loading…' : <><strong style={{ color: T.text }}>{filtered.length}</strong> of {entities.length} entities</>}
          </span>
        </div>
      </div>

      {/* ==================== Entity compliance table ==================== */}
      <div className="report-printable" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>Entity compliance</h3>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>Select a row to inspect its ownership structure below</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: T.surfaceAlt }}>
                {['Legal entity', 'Type', 'Country', 'UBOs', 'Fallback', 'Warnings', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 16px',
                    textAlign: i === 3 ? 'right' : i >= 4 ? 'center' : 'left',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: T.textMuted, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${T.border}`, borderTopColor: T.primary, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                      Loading entities…
                    </span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                    No entities match the current filters.
                  </td>
                </tr>
              )}
              {!loading && filtered.map((e) => (
                <EntityRow key={e.id} entity={e} selected={selected?.id === e.id} onSelect={setSelectedId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== Selected entity structure ==================== */}
      {selected && (
        <div className="report-printable" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>Ownership structure</h3>
              <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{selected.name}</div>
            </div>
            {onOpen && (
              <Btn variant="secondary" size="sm" className="report-no-print" onClick={() => onOpen(selected.id)}>
                Open entity
              </Btn>
            )}
          </div>
          <div style={{ padding: 18 }}>
            <StructureDetail
              entity={selected}
              intermediateName={intermediateName}
              personKey={personKey}
              statusFilter={statusFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              derived={deriveStructure(selected.tree, selected)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
