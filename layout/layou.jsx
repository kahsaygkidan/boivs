import { useAuth } from '../auth/AuthContext.jsx';
import { SearchIcon } from './Icons.jsx';
import NotificationBell from './NotificationBell.jsx';

/* ==========================================================================
   Constants
   ========================================================================== */

const ROLE_ORDER = ['MAKER', 'CHECKER', 'AUDITOR', 'ADMIN'];
const ROLE_SEPARATOR = ' · ';

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Derive up to two uppercase initials from a user's display name.
 * Handles separators like ".", whitespace, "_", "-".
 */
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

/**
 * Produce a human-readable role label from a list of role strings,
 * keeping only the roles we recognise and preserving a stable order.
 */
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

  const displayName = username || 'User';
  const roleLabel = formatRoles(roles);

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>

      <div className="topbar-right">


        {/* ---------- Notifications ---------- */}
        <NotificationBell
          roles={roleFlags}
          username={username}
          onNavigate={onNavigate}
        />

        {/* ---------- User chip ---------- */}
        <div className="user-chip">
          <div className="avatar" aria-hidden="true">
            {getInitials(username)}
          </div>
          <div className="user-chip-text">
            <span className="user-chip-name">{displayName}</span>
{/*             <span className="role">{roleLabel || 'No role assigned'}</span> */}
          </div>
        </div>

        {/* ---------- Sign out ---------- */}
        <button
          type="button"
          className="btn btn-blue btn-compact"
          onClick={logout}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
