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
  info: '#2563eb',
  infoSoft: '#eff6ff',
  hoverRow: '#f8fafc',
  radius: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)',
  shadowMd: '0 4px 12px rgba(15,23,42,.06), 0 2px 4px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons — 18px stroke icons
   ========================================================================== */
const ic = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const I = {
  users: <svg {...ic}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  check: <svg {...ic}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  clock: <svg {...ic}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  x: <svg {...ic}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>,
  arrowUp: <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  arrowDown: <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  chevronRight: <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

/* ==========================================================================
   KPI tile
   ========================================================================== */
function Kpi({ label, value, tone, icon, delta, caption, loading, onClick }) {
  const tones = {
    neutral: { fg: T.primary, bg: T.primarySoft },
    success: { fg: T.success, bg: T.successSoft },
    warn: { fg: T.warn, bg: T.warnSoft },
    danger: { fg: T.danger, bg: T.dangerSoft },
  }[tone];
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 14,
        padding: 18,
        minHeight: 128,
        background: T.surface,
        border: `1px solid ${hover && onClick ? T.borderStrong : T.border}`,
        borderRadius: T.radius,
        boxShadow: hover && onClick ? T.shadowMd : T.shadow,
        transition: 'border-color .15s ease, box-shadow .15s ease',
        fontFamily: T.font,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: T.textMuted,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 7,
            background: tones.bg,
            color: tones.fg,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: tones.fg,
            lineHeight: 1,
            letterSpacing: '-.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '—' : value ?? '—'}
        </span>
        {delta != null && !loading && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 11.5,
              fontWeight: 600,
              color: delta >= 0 ? T.success : T.danger,
              padding: '2px 6px',
              borderRadius: 4,
              background: delta >= 0 ? T.successSoft : T.dangerSoft,
            }}
          >
            {delta >= 0 ? I.arrowUp : I.arrowDown}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {caption && (
        <span style={{ fontSize: 11.5, color: T.textFaint }}>{caption}</span>
      )}
    </button>
  );
}

/* ==========================================================================
   Distribution bar
   ========================================================================== */
function DistributionBar({ stats }) {
  const total = stats?.total || 0;
  if (!total) return null;
  const verified = stats?.verified || 0;
  const pending = stats?.pending || 0;
  const rejected = stats?.rejected || 0;
  const other = Math.max(0, total - verified - pending - rejected);

  const segments = [
    { key: 'verified', label: 'Verified', count: verified, color: T.success },
    { key: 'pending', label: 'Pending', count: pending, color: T.warn },
    { key: 'rejected', label: 'Rejected', count: rejected, color: T.danger },
    { key: 'other', label: 'Other', count: other, color: T.textFaint },
  ].filter((s) => s.count > 0);

  return (
    <div style={{ fontFamily: T.font }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#f1f5f9', marginBottom: 12 }}>
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color, transition: 'width .3s ease' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {segments.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: T.textMuted }}>{s.label}</span>
            <span style={{ color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
            <span style={{ color: T.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round((s.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Filter dropdown (compact)
   ========================================================================== */
function Filter({ label, value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  const isActive = value !== '';
  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontFamily: T.font }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: T.textMuted }}>
        {label}
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
            minWidth: 172,
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
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%) rotate(90deg)',
            color: T.textFaint,
            pointerEvents: 'none',
            display: 'flex',
          }}
        >
          {I.chevronRight}
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
  const [status, setStatus] = useState('');
  const [pep, setPep] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDashboardStats(),
      searchBoRecords({ status: status || undefined, pep: pep === '' ? undefined : pep === 'true', size: 20 }),
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
  }, [status, pep]);

  /* ---------- Derived ---------- */
  const total = stats?.total || 0;
  const verified = stats?.verified || 0;
  const pending = stats?.pending || 0;
  const rejected = stats?.rejected || 0;

  const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;

  /* ---------- Shared styles ---------- */
  const th = {
    padding: '10px 14px',
    textAlign: 'left',
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: T.textMuted,
    background: T.surfaceAlt,
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  };
  const td = {
    padding: '12px 14px',
    fontSize: 13,
    color: T.text,
    borderBottom: `1px solid ${T.border}`,
    verticalAlign: 'middle',
  };

  const COLUMN_COUNT = 8;
  const filtersActive = status || pep;

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ==================== Command bar ==================== */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.02em', color: T.text }}>
              Overview
            </h1>
            {filtersActive && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.primary,
                  background: T.primarySoft,
                  borderRadius: 12,
                }}
              >
                Filtered
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Beneficial ownership register — all legal persons
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Search */}
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
              placeholder="Search records…"
              aria-label="Search records"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                fontFamily: 'inherit',
                color: T.text,
                padding: 0,
              }}
            />
          </label>

          {canRegister && (
            <button
              type="button"
              onClick={onRegister}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.primaryHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.primary; }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#fff',
                background: T.primary,
                border: 'none',
                borderRadius: T.radiusSm,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(40,51,117,.20)',
                transition: 'background .15s ease',
                whiteSpace: 'nowrap',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 16px',
            marginBottom: 16,
            background: T.dangerSoft,
            color: T.danger,
            border: `1px solid ${T.danger}33`,
            borderRadius: T.radiusSm,
            fontSize: 13,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>{I.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ==================== KPI grid ==================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <Kpi label="Total records" value={total} tone="neutral" icon={I.users} loading={loading}
          caption={total > 0 ? `${verifiedPct}% verified` : 'No records yet'} />
        <Kpi label="Verified" value={verified} tone="success" icon={I.check} loading={loading}
          caption="Approved by checker" />
        <Kpi label="Pending verification" value={pending} tone="warn" icon={I.clock} loading={loading}
          caption={pending > 0 ? `${pendingPct}% of total` : 'Nothing in queue'} />
        <Kpi label="Rejected" value={rejected} tone="danger" icon={I.x} loading={loading}
          caption="Returned to maker" />
      </div>

      {/* ==================== Distribution card ==================== */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Verification distribution</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {loading ? 'Loading…' : `${total} record${total === 1 ? '' : 's'} total`}
            </div>
          </div>
        </div>
        {!loading && total > 0 ? (
          <DistributionBar stats={stats} />
        ) : (
          <div style={{ fontSize: 12.5, color: T.textFaint, padding: '8px 0' }}>
            {loading ? '…' : 'No distribution data available.'}
          </div>
        )}
      </div>

      {/* ==================== Filters + Table ==================== */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          overflow: 'hidden',
        }}
      >
        {/* Filter strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
            padding: '14px 16px',
            borderBottom: `1px solid ${T.border}`,
            background: T.surface,
          }}
        >
          <Filter
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'VERIFIED', label: 'Verified' },
              { value: 'PENDING', label: 'Pending verification' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'CEASED', label: 'Ceased' },
            ]}
          />
          <Filter
            label="PEP"
            value={pep}
            onChange={(e) => setPep(e.target.value)}
            options={[
              { value: '', label: 'All' },
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={() => { setStatus(''); setPep(''); }}
              style={{
                height: 34,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: T.textMuted,
                background: 'transparent',
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
                cursor: 'pointer',
                transition: 'color .15s ease, border-color .15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderStrong; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >
              Clear
            </button>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: 'nowrap' }}>
            {loading ? 'Loading…' : (
              <>
                Showing <strong style={{ color: T.text }}>{records.length}</strong> of {total}
              </>
            )}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
            <thead>
              <tr>
                <th style={th}>BO Reference</th>
                <th style={th}>Full name</th>
                <th style={th}>Legal entity</th>
                <th style={{ ...th, textAlign: 'right' }}>Ownership</th>
                <th style={th}>ID document</th>
                <th style={th}>ID status</th>
                <th style={th}>Approval</th>
                <th style={th}>PEP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMN_COUNT} style={{ ...td, textAlign: 'center', padding: '40px 16px', color: T.textMuted }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          width: 14,
                          height: 14,
                          border: `2px solid ${T.border}`,
                          borderTopColor: T.primary,
                          borderRadius: '50%',
                          animation: 'spin .7s linear infinite',
                        }}
                      />
                      Loading records…
                    </span>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </td>
                </tr>
              )}

              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} style={{ borderBottom: 'none' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: '48px 20px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>No records found</div>
                      <div style={{ fontSize: 12.5, color: T.textMuted }}>
                        {filtersActive ? 'Try clearing the filters.' : 'Records will appear here once created.'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && records.map((r) => {
                const hovered = hoveredId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => onOpen?.(r.id)}
                    onMouseEnter={() => setHoveredId(r.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      cursor: onOpen ? 'pointer' : 'default',
                      background: hovered && onOpen ? T.hoverRow : T.surface,
                      transition: 'background .12s ease',
                    }}
                  >
                    <td style={{ ...td, fontFamily: T.mono, fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
                      {r.boReference}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.fullName}</td>
                    <td style={{ ...td, color: T.textMuted }}>{r.legalPersonName}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : '—'}
                    </td>
                    <td style={{ ...td, color: T.textMuted }}>{r.idDocumentType || '—'}</td>
                    <td style={td}>
                      <StatusBadge status={r.idExpired ? 'EXPIRED' : 'ACTIVE'} />
                    </td>
                    <td style={td}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={td}>
                      {r.pep ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: T.warnSoft, color: T.warn }}>
                          Yes
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#f1f5f9', color: T.textMuted }}>
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
