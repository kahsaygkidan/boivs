import { useEffect, useMemo, useState } from 'react';
import { getDashboardStats, searchBoRecords } from '../api/bovsApi.js';
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
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  hoverRow: '#f8fafc',
  radius: 10,
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
  person: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
  users: <svg {...ic}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  check: <svg {...ic}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  clock: <svg {...ic}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  x: <svg {...ic}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
};

/* ==========================================================================
   KPI tile
   ========================================================================== */
function Kpi({ label, value, tone, icon, caption, loading }) {
  const tones = {
    neutral: { fg: T.primary, bg: T.primarySoft },
    success: { fg: T.success, bg: T.successSoft },
    warn: { fg: T.warn, bg: T.warnSoft },
    danger: { fg: T.danger, bg: T.dangerSoft },
  }[tone];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 14,
        padding: 18,
        minHeight: 120,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        boxShadow: T.shadow,
        fontFamily: T.font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
          {label}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 7, background: tones.bg, color: tones.fg, flexShrink: 0 }}>
          {icon}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: tones.fg, lineHeight: 1, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
          {loading ? '—' : value ?? '—'}
        </span>
      </div>
      {caption && <span style={{ fontSize: 11.5, color: T.textFaint }}>{caption}</span>}
    </div>
  );
}

/* ==========================================================================
   Grouping: flat record list -> entities -> owners
   ========================================================================== */
function groupByEntity(records) {
  const map = new Map();
  records.forEach((r) => {
    const key = r.legalPersonId || r.legalPersonName || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        key,
        legalPersonName: r.legalPersonName || 'Unknown entity',
        legalPersonId: r.legalPersonId,
        owners: [],
      });
    }
    map.get(key).owners.push(r);
  });
  return Array.from(map.values()).sort((a, b) =>
    a.legalPersonName.localeCompare(b.legalPersonName)
  );
}

/* ==========================================================================
   TreeNode row (legal entity header)
   ========================================================================== */
function EntityRow({ entity, expanded, onToggle, ownersCount }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: hover ? T.hoverRow : T.surface,
        transition: 'background .12s ease',
        fontFamily: T.font,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Chevron */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          color: T.textMuted,
          transition: 'transform .15s ease',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}
      >
        {I.chevron}
      </span>

      {/* Entity icon */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 8,
          background: T.primarySoft,
          color: T.primary,
          flexShrink: 0,
        }}
      >
        {I.building}
      </span>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entity.legalPersonName}
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>
          Legal entity {entity.legalPersonId ? `· ID ${entity.legalPersonId}` : ''}
        </div>
      </div>

      {/* UBO count badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          fontSize: 11.5,
          fontWeight: 600,
          color: T.primary,
          background: T.primarySoft,
          borderRadius: 20,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'inline-flex', color: T.primary }}>{I.users}</span>
        {ownersCount} {ownersCount === 1 ? 'owner' : 'owners'}
      </span>
    </button>
  );
}

/* ==========================================================================
   TreeNode row (UBO / natural person)
   ========================================================================== */
function OwnerRow({ owner, onOpen, isLast }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={() => onOpen?.(owner.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px 12px 62px',
        borderBottom: `1px solid ${T.border}`,
        background: hover && onOpen ? T.hoverRow : T.surfaceAlt,
        cursor: onOpen ? 'pointer' : 'default',
        transition: 'background .12s ease',
        position: 'relative',
        fontFamily: T.font,
      }}
    >
      {/* Connector line + elbow */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 26,
          top: 0,
          bottom: isLast ? '50%' : 0,
          width: 1,
          background: T.border,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 26,
          top: '50%',
          width: 16,
          height: 1,
          background: T.border,
        }}
      />

      {/* Person icon */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: '#eef1f7',
          color: T.textMuted,
          flexShrink: 0,
        }}
      >
        {I.person}
      </span>

      {/* Name + reference */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {owner.fullName}
        </div>
        <div style={{ fontSize: 11, color: T.textFaint, fontFamily: T.mono, marginTop: 1 }}>
          {owner.boReference}
        </div>
      </div>

      {/* Ownership */}
      <div style={{ textAlign: 'right', minWidth: 70, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
          {owner.ownershipPercentage != null ? `${owner.ownershipPercentage}%` : '—'}
        </div>
        <div style={{ fontSize: 10.5, color: T.textFaint, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          ownership
        </div>
      </div>

      {/* ID status */}
      <div style={{ flexShrink: 0, minWidth: 90 }}>
        <StatusBadge status={owner.idExpired ? 'EXPIRED' : 'ACTIVE'} />
      </div>

      {/* Approval status */}
      <div style={{ flexShrink: 0, minWidth: 100 }}>
        <StatusBadge status={owner.status} />
      </div>

      {/* PEP */}
      <div style={{ flexShrink: 0, minWidth: 46, textAlign: 'right' }}>
        {owner.pep ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.warnSoft, color: T.warn }}>
            PEP
          </span>
        ) : (
          <span style={{ fontSize: 11, color: T.textFaint }}>—</span>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   PEP filter (compact)
   ========================================================================== */
function PepFilter({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const isActive = value !== '';
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
        PEP status
      </span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            height: 34,
            minWidth: 160,
            padding: '0 30px 0 12px',
            fontSize: 13,
            fontFamily: 'inherit',
            fontWeight: 500,
            color: isActive ? T.primary : T.text,
            background: isActive ? T.primarySoft : focused ? '#fff' : T.surfaceAlt,
            border: `1px solid ${focused ? T.primary : isActive ? `${T.primary}55` : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: focused ? `0 0 0 3px ${T.primaryRing}` : 'none',
            outline: 'none',
            cursor: 'pointer',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
          }}
        >
          <option value="">All</option>
          <option value="true">PEP only</option>
          <option value="false">Non-PEP only</option>
        </select>
        <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.textFaint, pointerEvents: 'none', display: 'flex' }}>
          {I.chevron}
        </span>
      </div>
    </label>
  );
}

/* ==========================================================================
   Dashboard
   ========================================================================== */
export default function Dashboard({ onRegister, canRegister, onOpen }) {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [pep, setPep] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState({}); // entityKey -> bool
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDashboardStats(),
      searchBoRecords({ pep: pep === '' ? undefined : pep === 'true', size: 200 }),
    ])
      .then(([statsRes, recordsRes]) => {
        if (cancelled) return;
        setStats(statsRes);
        setRecords(recordsRes.content || []);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.friendlyMessage || 'Failed to load dashboard'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [pep]);

  /* ---------- Derived ---------- */
  const total = stats?.total || 0;
  const verified = stats?.verified || 0;
  const pending = stats?.pending || 0;
  const rejected = stats?.rejected || 0;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? records.filter((r) =>
          `${r.fullName} ${r.boReference} ${r.legalPersonName}`.toLowerCase().includes(q)
        )
      : records;
    return groupByEntity(filtered);
  }, [records, query]);

  const entityCount = grouped.length;
  const uboCount = grouped.reduce((sum, e) => sum + e.owners.length, 0);

  const toggle = (key) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const expandAll = () =>
    setCollapsed(Object.fromEntries(grouped.map((e) => [e.key, false])));

  const collapseAll = () =>
    setCollapsed(Object.fromEntries(grouped.map((e) => [e.key, true])));

  const filtersActive = pep !== '';

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ==================== Command bar ==================== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.02em', color: T.text }}>
              Overview
            </h1>
            {filtersActive && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: T.primary, background: T.primarySoft, borderRadius: 12 }}>
                Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Beneficial ownership by legal entity
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 12px',
              minWidth: 240,
              background: searchFocused ? '#fff' : T.surface,
              border: `1px solid ${searchFocused ? T.primary : T.border}`,
              borderRadius: T.radiusSm,
              boxShadow: searchFocused ? `0 0 0 3px ${T.primaryRing}` : 'none',
              transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
              cursor: 'text',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: searchFocused ? T.primary : T.textFaint, flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" />
              <path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entity or owner…"
              aria-label="Search"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontFamily: 'inherit', color: T.text, padding: 0 }}
            />
          </label>

          {canRegister && (
            <button
              type="button"
              onClick={onRegister}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.primaryHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.primary; }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px',
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

      {/* ==================== Error ==================== */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: T.dangerSoft, color: T.danger, border: `1px solid ${T.danger}33`, borderRadius: T.radiusSm, fontSize: 13 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================== KPI grid ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Kpi label="Legal entities" value={entityCount} tone="neutral" icon={I.building} loading={loading} caption="Registered customers" />
        <Kpi label="Total UBOs" value={uboCount} tone="neutral" icon={I.users} loading={loading} caption="Natural persons across all entities" />
        <Kpi label="Verified" value={verified} tone="success" icon={I.check} loading={loading} caption="Approved by checker" />
        <Kpi label="Pending" value={pending} tone="warn" icon={I.clock} loading={loading} caption="Awaiting approval" />
      </div>

      {/* ==================== Tree card ==================== */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow, overflow: 'hidden' }}>
        {/* Filter strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <PepFilter value={pep} onChange={(e) => setPep(e.target.value)} />

          {filtersActive && (
            <button
              type="button"
              onClick={() => setPep('')}
              style={{
                height: 34, padding: '0 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                color: T.textMuted, background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm, cursor: 'pointer', transition: 'color .15s ease, border-color .15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderStrong; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >
              Clear
            </button>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={expandAll}
              style={{ height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', color: T.textMuted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderStrong; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              style={{ height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', color: T.textMuted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderStrong; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >
              Collapse all
            </button>
          </div>

          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
            {loading ? 'Loading…' : (
              <>
                <strong style={{ color: T.text }}>{entityCount}</strong> entit{entityCount === 1 ? 'y' : 'ies'} · <strong style={{ color: T.text }}>{uboCount}</strong> UBO{uboCount === 1 ? '' : 's'}
              </>
            )}
          </span>
        </div>

        {/* Tree body */}
        {loading && (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${T.border}`, borderTopColor: T.primary, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
              Loading entities…
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && grouped.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>No entities found</div>
            <div style={{ fontSize: 12.5, color: T.textMuted }}>
              {filtersActive || query ? 'Try clearing the filters or search.' : 'Entities will appear here once records are created.'}
            </div>
          </div>
        )}

        {!loading && grouped.map((entity) => {
          const isCollapsed = !!collapsed[entity.key];
          const owners = entity.owners;
          return (
            <div key={entity.key}>
              <EntityRow
                entity={entity}
                expanded={!isCollapsed}
                onToggle={() => toggle(entity.key)}
                ownersCount={owners.length}
              />
              {!isCollapsed && owners.map((owner, i) => (
                <OwnerRow
                  key={owner.id}
                  owner={owner}
                  onOpen={onOpen}
                  isLast={i === owners.length - 1}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
