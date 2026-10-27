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
  radius: 10,
  radiusSm: 6,
  shadow: '0 1px 2px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons
   ========================================================================== */
const ic = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const I = {
  building: <svg {...ic}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" /></svg>,
  chevron: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  download: <svg {...ic}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  print: <svg {...ic}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" /><path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>,
  calendar: <svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

/* ==========================================================================
   Small button
   ========================================================================== */
function Btn({ variant = 'primary', size = 'sm', icon, children, ...props }) {
  const sizes = {
    sm: { height: 30, padding: '0 12px', fontSize: 12, gap: 5 },
    md: { height: 36, padding: '0 14px', fontSize: 13, gap: 6 },
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
        opacity: props.disabled ? 0.55 : 1, whiteSpace: 'nowrap',
        transition: 'background .15s ease, border-color .15s ease',
        ...sizes[size], ...variants[variant],
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ==========================================================================
   Entity combobox (searchable)
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
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font, minWidth: 260, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted }}>Legal entity</span>
      <div style={{ position: 'relative' }} ref={ref}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: focused ? T.primary : T.textFaint, display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {I.search}
        </span>
        <input
          type="text" role="combobox" aria-expanded={open} disabled={loading}
          value={displayValue} placeholder={loading ? 'Loading…' : placeholder}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{
            appearance: 'none', height: 36, width: '100%', padding: '0 10px 0 32px',
            fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
            color: selected || open ? T.text : T.textMuted,
            background: focused ? '#fff' : T.surfaceAlt,
            border: `1px solid ${focused ? T.primary : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none', cursor: loading ? 'wait' : 'text',
            boxSizing: 'border-box',
          }}
        />
        {open && (
          <ul role="listbox" style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            boxShadow: '0 8px 24px rgba(15,23,42,.12)', margin: 0, padding: 4, listStyle: 'none',
            maxHeight: 260, overflowY: 'auto',
          }}>
            {filtered.length === 0 && (
              <li style={{ padding: '10px 12px', color: T.textMuted, fontSize: 12 }}>No entity found</li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o.value} role="option" aria-selected={o.value === value}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                style={{
                  padding: '8px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12.5,
                  background: i === hi ? T.primarySoft : 'transparent',
                  color: o.value === value ? T.primary : T.text,
                  fontWeight: o.value === value ? 600 : 500,
                }}
              >
                {o.label}
                {o.sub && <span style={{ marginLeft: 8, fontFamily: T.mono, fontSize: 10.5, color: T.textMuted }}>{o.sub}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

/* ==========================================================================
   Simple select
   ========================================================================== */
function Select({ label, value, onChange, options, disabled, placeholder }) {
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font, minWidth: 180, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          value={value} onChange={onChange} disabled={disabled}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            height: 36, width: '100%', padding: '0 30px 0 10px',
            fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
            color: disabled ? T.textFaint : value ? T.text : T.textMuted,
            background: disabled ? '#f8fafc' : value ? T.primarySoft : T.surfaceAlt,
            border: `1px solid ${value ? `${T.primary}66` : T.border}`,
            borderRadius: T.radiusSm, outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <option value="">{placeholder || 'All'}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.textFaint, pointerEvents: 'none', display: 'flex' }}>
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
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font, minWidth: 140, flex: 1 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: value ? T.primary : T.textFaint, display: 'flex', pointerEvents: 'none', zIndex: 1 }}>
          {I.calendar}
        </span>
        <input
          type="date" value={value} onChange={onChange} min={min} max={max}
          style={{
            appearance: 'none', height: 36, width: '100%', padding: '0 8px 0 30px',
            fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500,
            color: value ? T.text : T.textMuted,
            background: value ? T.primarySoft : T.surfaceAlt,
            border: `1px solid ${value ? `${T.primary}66` : T.border}`,
            borderRadius: T.radiusSm, outline: 'none',
            cursor: 'pointer', boxSizing: 'border-box',
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
    return {
      id: lp.id, name: lp.name, registrationNumber: lp.registrationNumber,
      entityType: lp.entityType, countryOfIncorporation: lp.countryOfIncorporation,
      uboCount: ubos.length, fallback, tree, ubos,
    };
  });
}

/* ==========================================================================
   Ownership chain summary — grouped bullets, exactly like the target format
   ========================================================================== */
function OwnershipSummary({ entity }) {
  const tree = entity?.tree;
  if (!tree) return null;

  const ubos = (tree.holders || []).filter((h) => h.ubo);
  const controlOnly = (tree.holders || []).filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl));
  const fallback = tree.seniorManagingOfficial;
  const rootName = entity?.name || 'Entity';

  /* Group outgoing edges by parent — so we produce "Entity → A% owned by X and B% owned by Y" */
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

  // 1) Grouped edges — one bullet per parent
  edgesByParent.forEach((children, parent) => {
    const list = children
      .map((c) => (c.pct != null ? `${c.pct}% owned by ${c.to}` : `…% owned by ${c.to}`))
      .join(' and ');
    bullets.push(`${parent} → ${list}`);
  });

  // 2) Per-UBO result
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

  // 3) Control-only
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
      background: T.infoSoft,
      border: `1px solid ${T.infoBorder}`,
      borderLeft: `3px solid ${T.info}`,
      borderRadius: T.radiusSm,
      padding: '14px 16px',
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.info, marginBottom: 8 }}>
        Ownership chain summary — {rootName}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: T.text }}>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ==========================================================================
   Detail cards (compact)
   ========================================================================== */
function Field({ k, v, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: T.textFaint }}>{k}</div>
      <div style={{ fontSize: 12.5, color: T.text, fontWeight: 500, marginTop: 1, fontFamily: mono ? T.mono : 'inherit', wordBreak: 'break-word' }}>{v}</div>
    </div>
  );
}

function EntityCard({ entity }) {
  return (
    <div style={{
      padding: 12, borderRadius: T.radiusSm,
      background: T.primarySoft,
      border: `1px solid ${T.primary}33`,
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 7, background: '#fff', color: T.primary, flexShrink: 0 }}>
        {I.building}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{entity.name}</div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>
          {[entity.registrationNumber, entity.entityType, entity.countryOfIncorporation].filter(Boolean).join(' · ') || 'Legal entity'}
        </div>
      </div>
    </div>
  );
}

function IntermediateCard({ name, count }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: T.radiusSm, background: '#fff', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: T.primarySoft, color: T.primary, flexShrink: 0 }}>
        {I.building}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{name}</span>
      <span style={{ fontSize: 10.5, color: T.textMuted }}>· Intermediate</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textMuted }}>{count} UBO{count === 1 ? '' : 's'}</span>
    </div>
  );
}

function PersonRow({ holder, kind = 'ubo' }) {
  const direct = isDirectHolder(holder);
  return (
    <div style={{ padding: '10px 12px', borderRadius: T.radiusSm, background: '#fff', border: `1px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: '#eef1f7', color: T.textMuted, flexShrink: 0 }}>{I.person}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{holder.fullName || '—'}</span>
        {kind === 'ubo' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: T.successSoft, color: T.success, letterSpacing: '.03em', textTransform: 'uppercase' }}>UBO</span>
        )}
        {kind === 'control' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: T.primarySoft, color: T.primary, letterSpacing: '.03em', textTransform: 'uppercase' }}>Control</span>
        )}
        {holder.pep && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: T.warnSoft, color: T.warn, letterSpacing: '.03em', textTransform: 'uppercase' }}>PEP</span>
        )}
        {holder.status && <StatusBadge status={holder.status} />}
        {holder.effectivePercentage != null && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{holder.effectivePercentage}%</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: direct ? T.success : T.info }}>{direct ? 'direct' : 'indirect'}</span>
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px 16px', marginTop: 6, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>
        <Field k="Gender" v={holder.gender ? (String(holder.gender).toUpperCase().startsWith('M') ? 'Male' : 'Female') : '—'} />
        <Field k="Nationality" v={holder.nationality || '—'} />
        <Field k="Place of birth" v={holder.placeOfBirth || '—'} />
        <Field k="Date of birth" v={formatDate(holder.dateOfBirth)} />
        <Field k="Fayda" v={holder.idNumber || '—'} mono />
        <Field k="Phone" v={holder.phoneNumber || '—'} mono />
        <Field k="Email" v={holder.emailAddress || '—'} />
        <Field k="Address" v={holder.residentialAddress || '—'} />
        <Field k="Occupation" v={holder.occupation || '—'} />
        <Field k="Date became BO" v={formatDate(holder.dateBecameBo)} />
      </div>
      {/* Chain trace */}
      {(holder.paths || []).map((p, i) => {
        const parts = splitChain(p.chain);
        if (parts.length === 0) return null;
        return (
          <div key={i} style={{ marginTop: 8, fontSize: 11.5, color: T.textMuted, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 600, color: T.info, marginRight: 4 }}>Chain:</span>
            {parts.join(' → ')}
          </div>
        );
      })}
    </div>
  );
}

function FallbackRow({ fallback }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: T.radiusSm, background: T.warnSoft, border: `1px solid ${T.warnBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: '#fff', color: T.warn, flexShrink: 0 }}>
        {I.person}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{fallback.name}</div>
        <div style={{ fontSize: 11.5, color: T.textMuted }}>{fallback.position || 'Senior managing official'}{fallback.justification ? ` — ${fallback.justification}` : ''}</div>
      </div>
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: '#fff', color: T.warn, border: `1px solid ${T.warnBorder}`, letterSpacing: '.03em', textTransform: 'uppercase' }}>Fallback</span>
    </div>
  );
}

/* ==========================================================================
   Structure display (compact list)
   ========================================================================== */
function Structure({ entity }) {
  const tree = entity.tree;
  if (!tree) {
    return <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>No structure loaded.</div>;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <EntityCard entity={entity} />

      {bucketEntries.map(([name, group]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <IntermediateCard name={name} count={group.ubos.length + group.control.length} />
          {group.ubos.map((h) => <PersonRow key={h.key} holder={h} kind="ubo" />)}
          {group.control.map((h) => <PersonRow key={h.key} holder={h} kind="control" />)}
        </div>
      ))}

      {direct.ubos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted, marginTop: 4 }}>
            Direct holders
          </div>
          {direct.ubos.map((h) => <PersonRow key={h.key} holder={h} kind="ubo" />)}
          {direct.control.map((h) => <PersonRow key={h.key} holder={h} kind="control" />)}
        </div>
      )}

      {fallback && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted, marginTop: 4 }}>
            Fallback
          </div>
          <FallbackRow fallback={fallback} />
        </div>
      )}

      {ubos.length === 0 && controlOnly.length === 0 && !fallback && (
        <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>No holders recorded.</div>
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
    .report-printable, .report-printable * { visibility: visible; }
    .report-printable { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
    .report-no-print { display: none !important; }
    .report-printable { font-size: 10.5px; line-height: 1.45; }
    .report-printable table { font-size: 10px; }
    .report-printable tr { page-break-inside: avoid; }
    .report-printable li { page-break-inside: avoid; }
    @page { margin: 12mm; size: A4; }
  }
`;

/* ==========================================================================
   Reports
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [entityId, setEntityId] = useState('');
  const [intermediateName, setIntermediateName] = useState('');
  const [personKey, setPersonKey] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState('');

  /* Load entities */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLegalPersons({ size: 500, sort: 'name' })
      .then((listRes) => {
        if (cancelled) return;
        setLegalPersons(listRes.content || []);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  /* Load trees */
  useEffect(() => {
    if (legalPersons.length === 0) return;
    let cancelled = false;
    Promise.all(
      legalPersons.map((lp) => getOwnershipTree(lp.id).then((t) => [lp.id, t]).catch(() => [lp.id, null]))
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

  useEffect(() => { setIntermediateName(''); setPersonKey(''); }, [entityId]);
  useEffect(() => { setPersonKey(''); }, [intermediateName]);

  const personOptions = useMemo(() => {
    const list = derived.persons || [];
    if (!intermediateName) return list;
    const target = derived.intermediates.find((x) => x.value === intermediateName);
    if (!target) return list;
    return list.filter((p) => target.holderKeys.has(p.value));
  }, [derived, intermediateName]);

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (entityId && e.id !== entityId) return false;
      if (statusFilter || dateFrom || dateTo) {
        const holders = e.ubos || [];
        const hasMatch = holders.some((h) => STATUS_MATCHES(h.status, statusFilter) && DATE_IN_RANGE(h.dateBecameBo, dateFrom, dateTo));
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [entities, entityId, statusFilter, dateFrom, dateTo]);

  const selected = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0] || null;
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
    { value: 'PENDING', label: 'Pending' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CEASED', label: 'Ceased' },
  ];

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      <style>{PRINT_CSS}</style>

      {/* Header */}
      <div className="report-no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>Compliance report</h1>
            {filtersActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: T.primary, background: T.primarySoft, borderRadius: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                {I.filter} Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3 }}>
            Beneficial ownership by legal entity
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="secondary" icon={I.download} onClick={handleExportCsv}>Export CSV</Btn>
          <Btn variant="primary" icon={I.print} onClick={() => window.print()}>Print</Btn>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', marginBottom: 12, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}`, borderRadius: T.radiusSm, fontSize: 12.5 }}>
          {I.alert}<span>{error}</span>
        </div>
      )}

      {/* Filter chain */}
      <div className="report-no-print" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: T.textMuted }}>
            {I.filter} Filters
          </span>
          <span style={{ flex: 1, height: 1, background: T.border }} />
          {filtersActive && <Btn variant="ghost" icon={I.x} onClick={clearAll}>Clear all</Btn>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <EntityCombobox
            options={entities.map((e) => ({ value: e.id, label: e.name, sub: e.registrationNumber }))}
            value={entityId} onChange={setEntityId} loading={loading}
          />
          <Select
            label="Intermediate" value={intermediateName} onChange={(e) => setIntermediateName(e.target.value)}
            disabled={!entityId || derived.intermediates.length === 0}
            options={derived.intermediates.map((x) => ({ value: x.value, label: x.label }))}
            placeholder={!entityId ? 'Select entity first' : derived.intermediates.length === 0 ? 'None' : 'All intermediates'}
          />
          <Select
            label="Person / fallback" value={personKey} onChange={(e) => setPersonKey(e.target.value)}
            disabled={!entityId || (personOptions.length === 0 && !derived.fallback)}
            options={[
              ...personOptions.map((p) => ({ value: p.value, label: p.label })),
              ...(derived.fallback ? [{ value: '__fallback__', label: `${derived.fallback.name} — fallback` }] : []),
            ]}
            placeholder={!entityId ? 'Select entity first' : 'All persons'}
          />
          <Select
            label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions} placeholder="All statuses"
          />
          <DateInput label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined} />
          <DateInput label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: T.textMuted }}>
          {loading ? 'Loading…' : `${filtered.length} of ${entities.length} entities`}
        </div>
      </div>

      {/* Table */}
      <div className="report-printable" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Entity compliance</span>
          <span style={{ marginLeft: 8, fontSize: 11, color: T.textMuted }}>— click to inspect</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: T.surfaceAlt }}>
                {['Legal entity', 'Type', 'Country', 'UBOs', 'Fallback'].map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 12px',
                    textAlign: i === 3 ? 'right' : i === 4 ? 'center' : 'left',
                    fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                    color: T.textMuted, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} style={{ padding: '30px 16px', textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>Loading…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '30px 16px', textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>No entities match the filters.</td>
                </tr>
              )}
              {!loading && filtered.map((e) => {
                const isSel = selected?.id === e.id;
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSel ? T.primarySoft : 'transparent',
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600, color: T.text }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span aria-hidden="true" style={{ display: 'inline-flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 5, background: T.primarySoft, color: T.primary, flexShrink: 0 }}>
                          {I.building}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                          {e.registrationNumber && (
                            <div style={{ fontSize: 10.5, color: T.textMuted, fontFamily: T.mono }}>{e.registrationNumber}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: T.textMuted }}>{e.entityType || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: T.textMuted }}>{e.countryOfIncorporation || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: T.primary, fontVariantNumeric: 'tabular-nums' }}>{e.uboCount}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {e.fallback
                        ? <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: T.warnSoft, color: T.warn, letterSpacing: '.03em', textTransform: 'uppercase' }}>Yes</span>
                        : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected entity detail — printable, includes summary and structure */}
      {selected && (
        <div className="report-printable" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Ownership structure</span>
              <span style={{ marginLeft: 8, fontSize: 11, color: T.textMuted }}>{selected.name}</span>
            </div>
            {onOpen && (
              <Btn variant="ghost" className="report-no-print" onClick={() => onOpen(selected.id)}>Open entity</Btn>
            )}
          </div>
          <div style={{ padding: 14 }}>
            {selected.tree ? (
              <>
                <OwnershipSummary entity={selected} />
                <Structure entity={selected} />
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>Loading structure…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
