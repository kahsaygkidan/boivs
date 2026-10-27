import { useEffect, useState } from 'react';
import { getDashboardStats, searchBoRecords } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';

/* ==========================================================================
   Design tokens (shared with Sidebar / Topbar / Records / RecordDetail)
   ========================================================================== */
const T = {
  surface: '#ffffff',
  bg: '#f6f8fb',
  border: '#e5e8ef',
  borderStrong: '#d5d9e6',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primaryHover: '#1f2859',
  primarySoft: 'rgba(40,51,117,.08)',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  hoverRow: '#f8fafc',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons
   ========================================================================== */
const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const Icons = {
  total: (
    <svg {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  verified: (
    <svg {...iconProps}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  pending: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  rejected: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

/* ==========================================================================
   StatCard
   ========================================================================== */
function StatCard({ label, value, tone = 'neutral', icon, loading }) {
  const tones = {
    neutral: { fg: T.primary, bg: T.primarySoft, iconFg: T.primary },
    success: { fg: T.success, bg: T.successSoft, iconFg: T.success },
    warn: { fg: T.warn, bg: T.warnSoft, iconFg: T.warn },
    danger: { fg: T.danger, bg: T.dangerSoft, iconFg: T.danger },
  };
  const t = tones[tone];

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: 20,
        boxShadow: T.shadow,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        fontFamily: T.font,
        transition: 'box-shadow .15s ease, transform .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,.08)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = T.shadow;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: T.textMuted,
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: t.fg,
            letterSpacing: '-.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '—' : value ?? '—'}
        </div>
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: T.radiusSm,
          background: t.bg,
          color: t.iconFg,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
    </div>
  );
}

/* ==========================================================================
   Filter select
   ========================================================================== */
function FilterSelect({ value, onChange, options, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <label
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: T.font,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: T.textMuted }}>
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 36,
          minWidth: 170,
          padding: '0 12px',
          fontSize: 13,
          fontFamily: 'inherit',
          fontWeight: 500,
          color: T.text,
          background: focused ? '#fff' : '#f1f5f9',
          border: `1px solid ${focused ? T.primary : T.border}`,
          borderRadius: T.radiusSm,
          boxShadow: focused ? `0 0 0 3px ${T.primarySoft}` : 'none',
          outline: 'none',
          cursor: 'pointer',
          transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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

  /* ---------- Shared table styles ---------- */
  const thStyle = {
    padding: '11px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: T.textMuted,
    background: '#fafbfc',
    borderBottom: `1px solid ${T.border}`,
    whiteSpace: 'nowrap',
  };
  const tdStyle = {
    padding: '13px 16px',
    fontSize: 13.5,
    color: T.text,
    borderBottom: `1px solid ${T.border}`,
    verticalAlign: 'middle',
  };

  const COLUMN_COUNT = 8;

  return (
    <div style={{ fontFamily: T.font, color: T.text }}>
      {/* ---------- Page header ---------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-.02em', color: T.text }}>
            Overview
          </h1>
          <div style={{ fontSize: 13.5, color: T.textMuted }}>
            Beneficial ownership records across all registered legal persons
          </div>
        </div>

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
              height: 38,
              padding: '0 18px',
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: '#fff',
              background: T.primary,
              border: 'none',
              borderRadius: T.radiusSm,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(40,51,117,.15)',
              transition: 'background .15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Add beneficial owner
          </button>
        )}
      </div>

      {/* ---------- Error banner ---------- */}
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
          <span style={{ flexShrink: 0, marginTop: 1 }}>{Icons.alert}</span>
          <span>{error}</span>
        </div>
      )}

      {/* ---------- Stat row ---------- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total BO records" value={stats?.total} tone="neutral" icon={Icons.total} loading={loading} />
        <StatCard label="Verified" value={stats?.verified} tone="success" icon={Icons.verified} loading={loading} />
        <StatCard label="Pending verification" value={stats?.pending} tone="warn" icon={Icons.pending} loading={loading} />
        <StatCard label="Rejected" value={stats?.rejected} tone="danger" icon={Icons.rejected} loading={loading} />
      </div>

      {/* ---------- Filters ---------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          gap: 12,
          marginBottom: 16,
          padding: 14,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
        }}
      >
        <FilterSelect
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
        <FilterSelect
          label="PEP"
          value={pep}
          onChange={(e) => setPep(e.target.value)}
          options={[
            { value: '', label: 'All' },
            { value: 'true', label: 'PEP: Yes' },
            { value: 'false', label: 'PEP: No' },
          ]}
        />
        {(status || pep) && (
          <button
            type="button"
            onClick={() => { setStatus(''); setPep(''); }}
            style={{
              height: 36,
              padding: '0 14px',
              fontSize: 12.5,
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
            Clear filters
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {loading ? 'Loading…' : `${records.length} record${records.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ---------- Records table ---------- */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: T.radius,
          boxShadow: T.shadow,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={thStyle}>BO Reference</th>
                <th style={thStyle}>Full name</th>
                <th style={thStyle}>Legal entity</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Ownership %</th>
                <th style={thStyle}>ID document</th>
                <th style={thStyle}>ID status</th>
                <th style={thStyle}>Approval</th>
                <th style={thStyle}>PEP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMN_COUNT} style={{ ...tdStyle, textAlign: 'center', padding: '40px 16px', color: T.textMuted }}>
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
                        color: T.textMuted,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>No records found</div>
                      <div style={{ fontSize: 12.5 }}>
                        {(status || pep) ? 'Try clearing the filters.' : 'Records will appear here once created.'}
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
                    <td style={{ ...tdStyle, fontFamily: T.mono, fontSize: 12.5, color: T.textMuted, fontWeight: 500 }}>
                      {r.boReference}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.text }}>{r.fullName}</td>
                    <td style={tdStyle}>{r.legalPersonName}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: T.textMuted }}>{r.idDocumentType || '—'}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.idExpired ? 'EXPIRED' : 'ACTIVE'} />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={tdStyle}>
                      {r.pep ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 10px',
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: T.warnSoft,
                            color: T.warn,
                          }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 10px',
                            borderRadius: 20,
                            fontSize: 11.5,
                            fontWeight: 500,
                            background: '#f1f5f9',
                            color: T.textMuted,
                          }}
                        >
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
