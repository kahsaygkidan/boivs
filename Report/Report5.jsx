import { useEffect, useMemo, useState } from 'react';
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
  hoverRow: '#f8fafc',
  radius: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
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
  shield: <svg {...ic}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  arrow: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

/* ==========================================================================
   Button
   ========================================================================== */
function Btn({ variant = 'primary', size = 'md', icon, children, style, ...props }) {
  const sizes = {
    sm: { height: 28, padding: '0 10px', fontSize: 11.5, gap: 4 },
    md: { height: 34, padding: '0 12px', fontSize: 12.5, gap: 5 },
    lg: { height: 38, padding: '0 16px', fontSize: 13, gap: 6 },
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
        transition: 'background .15s ease, border-color .15s ease, color .15s ease',
        opacity: props.disabled ? 0.55 : 1, whiteSpace: 'nowrap',
        ...sizes[size], ...variants[variant], ...style,
      }}
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
    neutral: { fg: T.primary, bg: T.primarySoft },
    success: { fg: T.success, bg: T.successSoft },
    warn: { fg: T.warn, bg: T.warnSoft },
    danger: { fg: T.danger, bg: T.dangerSoft },
  }[tone];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14, padding: 18, minHeight: 118, background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, fontFamily: T.font }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: tones.bg, color: tones.fg, flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: tones.fg, lineHeight: 1, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '—' : value ?? '—'}
      </div>
      {caption && <span style={{ fontSize: 11.5, color: T.textFaint }}>{caption}</span>}
    </div>
  );
}

/* ==========================================================================
   Cascading select
   ========================================================================== */
function CascadeSelect({ label, value, onChange, options, disabled, placeholder }) {
  const [focused, setFocused] = useState(false);
  const isActive = value !== '';
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font, minWidth: 210 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: 'none', WebkitAppearance: 'none',
            height: 38, width: '100%', padding: '0 32px 0 12px',
            fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
            color: disabled ? T.textFaint : isActive ? T.primary : value ? T.text : T.textMuted,
            background: disabled ? '#f8fafc' : isActive ? T.primarySoft : focused ? '#fff' : T.surface,
            border: `1px solid ${focused ? T.primary : isActive ? `${T.primary}55` : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
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
   Tree helpers
   ========================================================================== */
const splitChain = (chain) => String(chain || '').split(/\s*→\s*/).map((x) => x.trim()).filter(Boolean);

const STATUS_MATCHES = (holderStatus, filterStatus) => {
  if (!filterStatus) return true;
  if (filterStatus === 'VERIFIED') return holderStatus === 'VERIFIED' || holderStatus === 'APPROVED';
  return holderStatus === filterStatus;
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
    value: v.name,
    label: v.name,
    holderKeys: v.holderKeys,
  }));

  const persons = [
    ...ubos.map((h) => ({
      value: h.key,
      label: `${h.fullName}${h.effectivePercentage != null ? ` (${h.effectivePercentage}%)` : ''}`,
      kind: 'ubo',
      holder: h,
    })),
    ...controlOnly.map((h) => ({
      value: h.key,
      label: `${h.fullName} — control only`,
      kind: 'control',
      holder: h,
    })),
  ];

  return {
    intermediates,
    persons,
    fallback: tree.seniorManagingOfficial || null,
  };
}

/* ==========================================================================
   Per-entity aggregation
   ========================================================================== */
function aggregateEntities(legalPersons, trees) {
  return legalPersons.map((lp) => {
    const tree = trees[lp.id];
    const holders = tree?.holders || [];
    const ubos = holders.filter((h) => h.ubo);
    const verified = ubos.filter((h) => h.status === 'VERIFIED' || h.status === 'APPROVED' || h.registered).length;
    const pending = ubos.filter((h) => h.status === 'PENDING').length;
    const rejected = ubos.filter((h) => h.status === 'REJECTED').length;
    const ceased = ubos.filter((h) => h.status === 'CEASED').length;
    const fallback = tree?.seniorManagingOfficial || null;
    const hasWarnings = (tree?.warnings || []).length > 0;

    return {
      id: lp.id,
      name: lp.name,
      registrationNumber: lp.registrationNumber,
      entityType: lp.entityType,
      countryOfIncorporation: lp.countryOfIncorporation,
      uboCount: ubos.length,
      verified,
      pending,
      rejected,
      ceased,
      fallback,
      hasWarnings,
      tree,
      ubos,
      controlOnly: holders.filter((h) => !h.ubo && ((h.controlBasis || []).length > 0 || h.qualifiesByControl)),
    };
  });
}

/* ==========================================================================
   Entity row
   ========================================================================== */
function EntityRow({ entity, onSelect, selected }) {
  const [hover, setHover] = useState(false);
  const total = entity.uboCount || 0;
  const verifiedPct = total > 0 ? Math.round((entity.verified / total) * 100) : 0;

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
      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: T.text, verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: T.primarySoft, color: T.primary, flexShrink: 0 }}>{I.building}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entity.name}</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: T.mono, marginTop: 1 }}>{entity.registrationNumber || '—'}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 14px', fontSize: 12.5, color: T.textMuted, verticalAlign: 'middle' }}>{entity.entityType || '—'}</td>
      <td style={{ padding: '12px 14px', fontSize: 12.5, color: T.textMuted, verticalAlign: 'middle' }}>{entity.countryOfIncorporation || '—'}</td>
      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: T.text, verticalAlign: 'middle' }}>{total}</td>
      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: T.success, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{entity.verified}</td>
      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: T.warn, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{entity.pending}</td>
      <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: entity.rejected > 0 ? T.danger : T.textFaint, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' }}>{entity.rejected}</td>
      <td style={{ padding: '12px 14px', verticalAlign: 'middle', minWidth: 130 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#eef1f7', overflow: 'hidden', minWidth: 60 }}>
            <div style={{ width: `${verifiedPct}%`, height: '100%', background: verifiedPct === 100 ? T.success : verifiedPct >= 50 ? T.warn : T.danger }} />
          </div>
          <span style={{ fontSize: 11, color: T.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right' }}>{verifiedPct}%</span>
        </div>
      </td>
      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
        {entity.fallback
          ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: T.warnSoft, color: T.warn }}>Fallback</span>
          : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        }
      </td>
      <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
        {entity.hasWarnings
          ? <span style={{ display: 'inline-flex', color: T.warn }}>{I.alert}</span>
          : <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        }
      </td>
    </tr>
  );
}

/* ==========================================================================
   Structure detail (filtered by intermediate + person + status)
   ========================================================================== */
function StructureDetail({ entity, intermediateName, personKey, statusFilter, derived }) {
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

  const shownUbos = ubos.filter(filterByIntermediate).filter(filterByPerson).filter(filterByStatus);
  const shownControl = controlOnly.filter(filterByIntermediate).filter(filterByPerson).filter(filterByStatus);
  // Fallback has no approval status — only shown when no status filter, or explicitly selected
  const showFallback =
    fallback &&
    (!statusFilter || personKey === '__fallback__') &&
    (personKey === '' || personKey === '__fallback__');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Root */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: T.primarySoft, borderRadius: T.radiusSm, border: `1px solid ${T.primary}33` }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: '#fff', color: T.primary, flexShrink: 0 }}>{I.building}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{entity.name}</div>
          <div style={{ fontSize: 11.5, color: T.textMuted }}>
            {entity.registrationNumber ? `Registration ${entity.registrationNumber}` : 'Legal entity'}
            {intermediateName && <> <span style={{ margin: '0 6px', color: T.textFaint }}>→</span> <strong style={{ color: T.text }}>{intermediateName}</strong></>}
          </div>
        </div>
        {statusFilter && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: '#fff', color: T.primary, border: `1px solid ${T.primary}33` }}>
            Status: {statusFilter.toLowerCase()}
          </span>
        )}
      </div>

      {shownUbos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMuted, marginBottom: 8 }}>
            Natural persons ({shownUbos.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shownUbos.map((h) => (
              <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: '#eef1f7', color: T.textMuted, flexShrink: 0 }}>{I.person}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.fullName}</div>
                  <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.mono }}>{h.idNumber || '—'}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums', minWidth: 60, textAlign: 'right' }}>
                  {h.effectivePercentage != null ? `${h.effectivePercentage}%` : '—'}
                </div>
                <div style={{ minWidth: 82, flexShrink: 0 }}>
                  <StatusBadge status={h.status || 'ACTIVE'} />
                </div>
                {h.pep && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: T.warnSoft, color: T.warn }}>PEP</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {shownControl.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMuted, marginBottom: 8 }}>
            Control without ownership ({shownControl.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shownControl.map((h) => (
              <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: '#eef1f7', color: T.textMuted, flexShrink: 0 }}>{I.shield}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{h.fullName}</div>
                  <div style={{ fontSize: 11, color: T.textFaint }}>{(h.controlBasis || []).join(', ')}</div>
                </div>
                <div style={{ minWidth: 82, flexShrink: 0 }}>
                  <StatusBadge status={h.status || 'ACTIVE'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFallback && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: T.textMuted, marginBottom: 8 }}>
            Senior managing official (fallback)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.warnSoft, border: `1px solid ${T.warnBorder}`, borderRadius: T.radiusSm }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: '#fff', color: T.warn, flexShrink: 0 }}>{I.person}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fallback.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{fallback.position || 'Senior managing official'}</div>
            </div>
          </div>
        </div>
      )}

      {shownUbos.length === 0 && shownControl.length === 0 && !showFallback && (
        <div style={{ padding: '24px 20px', textAlign: 'center', color: T.textMuted, fontSize: 12.5, background: T.surfaceAlt, borderRadius: T.radiusSm, border: `1px dashed ${T.border}` }}>
          No holders match the current filters.
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Reports
   ========================================================================== */
export default function Reports({ onOpen }) {
  const [legalPersons, setLegalPersons] = useState([]);
  const [trees, setTrees] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Cascading filter state (4 levels) */
  const [entityId, setEntityId] = useState('');
  const [intermediateName, setIntermediateName] = useState('');
  const [personKey, setPersonKey] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* Row selection for detail panel */
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
  const derived = useMemo(
    () => deriveStructure(currentEntity?.tree, currentEntity),
    [currentEntity]
  );

  /* Reset downstream on parent changes */
  useEffect(() => { setIntermediateName(''); setPersonKey(''); }, [entityId]);
  useEffect(() => { setPersonKey(''); }, [intermediateName]);

  /* Person options depend on the intermediate filter */
  const personOptions = useMemo(() => {
    const list = derived.persons || [];
    if (!intermediateName) return list;
    const target = derived.intermediates.find((x) => x.value === intermediateName);
    if (!target) return list;
    return list.filter((p) => target.holderKeys.has(p.value));
  }, [derived, intermediateName]);

  /* Table filter — entity + status */
  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (entityId && e.id !== entityId) return false;
      if (statusFilter) {
        const hasMatch =
          (statusFilter === 'VERIFIED' && e.verified > 0) ||
          (statusFilter === 'PENDING' && e.pending > 0) ||
          (statusFilter === 'REJECTED' && e.rejected > 0) ||
          (statusFilter === 'CEASED' && e.ceased > 0);
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [entities, entityId, statusFilter]);

  const selected = entities.find((e) => e.id === (selectedId || entityId)) || filtered[0] || null;

  const totals = useMemo(() => {
    const totalEntities = filtered.length;
    const totalUbos = filtered.reduce((s, e) => s + e.uboCount, 0);
    const totalVerified = filtered.reduce((s, e) => s + e.verified, 0);
    const totalPending = filtered.reduce((s, e) => s + e.pending, 0);
    const withFallback = filtered.filter((e) => e.fallback).length;
    return { totalEntities, totalUbos, totalVerified, totalPending, withFallback };
  }, [filtered]);

  const filtersActive = entityId !== '' || intermediateName !== '' || personKey !== '' || statusFilter !== '';

  const clearAll = () => {
    setEntityId('');
    setIntermediateName('');
    setPersonKey('');
    setStatusFilter('');
  };

  const handleExportCsv = () => {
    const header = ['Entity', 'Registration', 'Type', 'Country', 'UBOs', 'Verified', 'Pending', 'Rejected', 'Fallback'];
    const lines = filtered.map((e) => [
      e.name, e.registrationNumber || '', e.entityType || '', e.countryOfIncorporation || '',
      e.uboCount, e.verified, e.pending, e.rejected, e.fallback ? 'Yes' : 'No',
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

  /* Status options */
  const statusOptions = [
    { value: 'VERIFIED', label: 'Verified / approved' },
    { value: 'PENDING', label: 'Pending verification' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CEASED', label: 'Ceased' },
  ];

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ==================== Header ==================== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.02em', color: T.text }}>Compliance report</h1>
            {filtersActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: 11, fontWeight: 600, color: T.primary, background: T.primarySoft, borderRadius: 12 }}>
                Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>Drill into ownership structure per legal entity</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn variant="secondary" icon={I.download} onClick={handleExportCsv}>Export CSV</Btn>
          <Btn variant="secondary" icon={I.print} onClick={() => window.print()}>Print</Btn>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.dangerBorder}`, borderRadius: T.radiusSm, fontSize: 13 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================== KPI grid ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Legal entities" value={totals.totalEntities} tone="neutral" icon={I.building} loading={loading} caption="In current selection" />
        <Kpi label="Total UBOs" value={totals.totalUbos} tone="neutral" icon={I.users} loading={loading} caption="Natural persons" />
        <Kpi label="Verified" value={totals.totalVerified} tone="success" icon={I.check} loading={loading} caption="Approved by checker" />
        <Kpi label="Pending" value={totals.totalPending} tone="warn" icon={I.clock} loading={loading} caption="Awaiting approval" />
      </div>

      {/* ==================== Cascading filters (4 levels) ==================== */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>Filter chain</span>
          <span style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
          <CascadeSelect
            label="1. Legal entity"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            options={entities.map((e) => ({
              value: e.id,
              label: `${e.name}${e.registrationNumber ? ` — ${e.registrationNumber}` : ''}`,
            }))}
            placeholder={loading ? 'Loading entities…' : 'All legal entities'}
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
            label="3. Natural person / fallback"
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

          {filtersActive && (
            <Btn variant="ghost" onClick={clearAll} style={{ marginBottom: 0 }}>Clear</Btn>
          )}

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap', paddingBottom: 10 }}>
            {loading ? 'Loading…' : <><strong style={{ color: T.text }}>{filtered.length}</strong> of {entities.length} entities</>}
          </span>
        </div>
      </div>

      {/* ==================== Entity compliance table ==================== */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
          <h3 style={{ fontSize: 13, fontWeight: 650, color: T.text, margin: 0 }}>Entity compliance</h3>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>Select a row to inspect its ownership structure below</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: T.surfaceAlt }}>
                {['Legal entity', 'Type', 'Country', 'UBOs', 'Verified', 'Pending', 'Rejected', 'Completion', 'Fallback', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px',
                    textAlign: i >= 3 && i <= 6 ? 'right' : 'left',
                    fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: T.textMuted, borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
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
                  <td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
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
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 650, color: T.text, margin: 0 }}>Ownership structure</h3>
              <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{selected.name}</div>
            </div>
            {onOpen && (
              <Btn variant="secondary" size="sm" onClick={() => onOpen(selected.id)}>Open entity</Btn>
            )}
          </div>
          <div style={{ padding: 18 }}>
            <StructureDetail
              entity={selected}
              intermediateName={intermediateName}
              personKey={personKey}
              statusFilter={statusFilter}
              derived={deriveStructure(selected.tree, selected)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
