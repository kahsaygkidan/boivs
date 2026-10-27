import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { SearchIcon } from './Icons.jsx';
import NotificationBell from './NotificationBell.jsx';

/* ==========================================================================
   Design tokens (aligned with Sidebar palette)
   ========================================================================== */
const T = {
  surface: '#ffffff',
  border: '#e5e8ef',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primarySoft: 'rgba(40,51,117,.08)',
  hoverBg: '#f4f6fb',
  radius: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/* ==========================================================================
   Constants & helpers (unchanged)
   ========================================================================== */
const ROLE_ORDER = ['MAKER', 'CHECKER', 'AUDITOR', 'ADMIN'];
const ROLE_SEPARATOR = ' · ';

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatRoles(roles = []) {
  return roles
    .filter((role) => ROLE_ORDER.includes(role))
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
    .join(ROLE_SEPARATOR);
}

/* ==========================================================================
   Topbar
   ========================================================================== */
export default function Topbar({ title, roleFlags, onNavigate }) {
  const { username, roles, logout } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

  const displayName = username || 'User';
  const roleLabel = formatRoles(roles);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 64,
        padding: '0 24px',
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        fontFamily: T.font,
        boxShadow: T.shadow,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxSizing: 'border-box',
      }}
    >
      {/* ---------- Title ---------- */}
      <h1
        style={{
          fontSize: 17,
          fontWeight: 650,
          color: T.text,
          letterSpacing: '-.01em',
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
        }}
      >
        {title}
      </h1>

      {/* ---------- Search (desktop affordance) ---------- */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            height: 36,
            width: '100%',
            maxWidth: 320,
            background: searchFocused ? '#fff' : T.hoverBg,
            border: `1px solid ${searchFocused ? T.primary : T.border}`,
            borderRadius: T.radiusSm,
            transition: 'border-color .15s ease, background .15s ease, box-shadow .15s ease',
            boxShadow: searchFocused ? `0 0 0 3px ${T.primarySoft}` : 'none',
            cursor: 'text',
          }}
        >
          <span
            aria-hidden="true"
            style={{ display: 'inline-flex', color: T.textFaint, flexShrink: 0 }}
          >
            {SearchIcon}
          </span>
          <input
            type="search"
            placeholder="Search customers, owners…"
            aria-label="Search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
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
          <kbd
            aria-hidden="true"
            style={{
              fontSize: 10.5,
              fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              color: T.textFaint,
              background: '#fff',
              border: `1px solid ${T.border}`,
              borderRadius: 4,
              padding: '1px 5px',
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        </label>
      </div>

      {/* ---------- Right cluster ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Notifications */}
        <NotificationBell
          roles={roleFlags}
          username={username}
          onNavigate={onNavigate}
        />

        {/* Divider */}
        <span
          aria-hidden="true"
          style={{ width: 1, height: 24, background: T.border, margin: '0 4px' }}
        />

        {/* User chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 8px 4px 4px',
            borderRadius: 999,
            background: T.hoverBg,
            minWidth: 0,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: T.primary,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '.02em',
              flexShrink: 0,
            }}
          >
            {getInitials(username)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 140,
              }}
              title={displayName}
            >
              {displayName}
            </span>
            {roleLabel && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  color: T.textMuted,
                  letterSpacing: '.03em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 140,
                }}
              >
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={logout}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.borderColor = T.primary;
            e.currentTarget.style.color = T.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.textMuted;
          }}
          style={{
            height: 34,
            padding: '0 14px',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            color: T.textMuted,
            background: 'transparent',
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            cursor: 'pointer',
            transition: 'background .15s ease, border-color .15s ease, color .15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
