import { useEffect, useState } from 'react';
import { searchBoRecords, removeBoRecord } from '../api/bovsApi.js';
import StatusBadge from '../components/StatusBadge.jsx';

/* ==========================================================================
   Design tokens
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
  primarySoft: 'rgba(40,51,117,.08)',
  primaryHover: '#1f2859',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  hoverRow: '#f8fafc',
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(15,23,42,.06), 0 1px 2px rgba(15,23,42,.04)',
  shadowMd: '0 4px 12px rgba(15,23,42,.08)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ==========================================================================
   Icons
   ========================================================================== */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.2 9.2 12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="5" y="6" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 11h10M9 15h10M9 19h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5.2v3.4M8 10.8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ==========================================================================
   Sub-components
   ========================================================================== */
function EmptyState({ query }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '48px 20px',
        color: T.textMuted,
        textAlign: 'center',
      }}
    >
      <span style={{ color: T.textFaint, opacity: 0.6 }}>
        <EmptyIcon />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>No records found</div>
      <div style={{ fontSize: 12.5, color: T.textMuted }}>
        {query ? 'Try a different name or BO reference.' : 'Records will appear here once created.'}
      </div>
    </div>
  );
}

/* ==========================================================================
   Records
   ========================================================================== */
export default function Records({ onRegister, canRegister, canRemove, onOpen }) {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const removable = (r) => canRemove && (r.status === 'PENDING' || r.status === 'DRAFT');

  const handleRemove = async (e, r) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${r.boReference} (${r.fullName}) from the list?\n\nIt will be withdrawn from verification. You can register the person again later.`)) return;
    try {
      await removeBoRecord(r.id);
      setRecords((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to remove the record');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    searchBoRecords({ q: query || undefined, size: 50 })
      .then((res) => {
        if (cancelled) return;
        setRecords(res.content || []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.friendlyMessage || 'Failed to load records');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [query]);

  const recordCount = records.length;
  const showCount = !loading && !error;

  const handleRowClick = (id) => { if (onOpen) onOpen(id); };

  /* ------------------------------------------------------------------------
     Shared inline style blocks
     ------------------------------------------------------------------------ */
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
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-.02em',
              color: T.text,
            }}
          >
            BO Records
          </h1>
          <div style={{ fontSize: 13.5, color: T.textMuted }}>
            Full register of beneficial owner records
            {showCount && (
              <span style={{ color: T.textFaint }}>
                {' '}· {recordCount} record{recordCount === 1 ? '' : 's'}
              </span>
            )}
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
              transition: 'background .15s ease, box-shadow .15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Register beneficial owner
          </button>
        )}
      </div>

      {/* ---------- Search toolbar ---------- */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 14px',
            width: '100%',
            maxWidth: 480,
            background: searchFocused ? '#fff' : '#f1f5f9',
            border: `1px solid ${searchFocused ? T.primary : T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: searchFocused ? `0 0 0 3px ${T.primarySoft}` : 'none',
            transition: 'background .15s ease, border-color .15s ease, box-shadow .15s ease',
            cursor: 'text',
          }}
        >
          <span style={{ color: searchFocused ? T.primary : T.textFaint, flexShrink: 0, display: 'flex' }}>
            <SearchIcon />
          </span>
          <input
            placeholder="Search by name, BO reference, or phone number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Search records"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13.5,
              fontFamily: 'inherit',
              color: T.text,
              padding: 0,
            }}
          />
        </label>
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
          <span style={{ flexShrink: 0, marginTop: 1 }}><AlertIcon /></span>
          <span>{error}</span>
        </div>
      )}

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
                <th style={thStyle}>Phone number</th>
                <th style={thStyle}>ID status</th>
                <th style={thStyle}>Approval</th>
                {canRemove && <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMN_COUNT + (canRemove ? 1 : 0)} style={{ ...tdStyle, textAlign: 'center', padding: '40px 16px', color: T.textMuted }}>
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

              {!loading && recordCount === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT + (canRemove ? 1 : 0)} style={{ borderBottom: 'none' }}>
                    <EmptyState query={query} />
                  </td>
                </tr>
              )}

              {!loading && records.map((r) => {
                const hovered = hoveredId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r.id)}
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
                    <td style={{ ...tdStyle, fontWeight: 600, color: T.text }}>
                      {r.fullName}
                    </td>
                    <td style={tdStyle}>{r.legalPersonName}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {r.ownershipPercentage != null ? `${r.ownershipPercentage}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: T.textMuted }}>
                      {r.idDocumentType || '—'}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: T.mono, fontSize: 12.5, color: T.textMuted }}>
                      {r.phoneNumber || '—'}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.idExpired ? 'EXPIRED' : 'ACTIVE'} />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.status} />
                    </td>
                    {canRemove && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {removable(r) && (
                          <button
                            type="button"
                            onClick={(e) => handleRemove(e, r)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = T.dangerSoft;
                              e.currentTarget.style.borderColor = T.danger;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = `${T.danger}55`;
                            }}
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              fontFamily: 'inherit',
                              color: T.danger,
                              background: 'transparent',
                              border: `1px solid ${T.danger}55`,
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'background .15s ease, border-color .15s ease',
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ---------- Footer count ---------- */}
        {showCount && recordCount > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: `1px solid ${T.border}`,
              background: '#fafbfc',
              fontSize: 12,
              color: T.textMuted,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              Showing <strong style={{ color: T.text }}>{recordCount}</strong> record{recordCount === 1 ? '' : 's'}
            </span>
            {query && <span>Filtered by “{query}”</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const COLUMN_COUNT = 8;
