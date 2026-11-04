import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import '../styles/tbar.css';

/* ==========================================================================
   Constants
   ========================================================================== */

/* Matches the sidebar: true = floating rounded bar, false = edge-to-edge */
const FLOATING = true;

const ROLE_ORDER = ['MAKER', 'CHECKER', 'AUDITOR', 'ADMIN'];
const ROLE_LABEL = { MAKER: 'Maker', CHECKER: 'Checker', AUDITOR: 'Auditor', ADMIN: 'Admin' };

/* ==========================================================================
   Helpers
   ========================================================================== */

/** Up to two uppercase initials from "first.last", "first last", "first_last", "first-last". */
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

/** Recognised roles only, in a stable order. */
function knownRoles(roles = []) {
  return roles
    .filter((r) => ROLE_ORDER.includes(r))
    .sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

/* ==========================================================================
   Icons
   ========================================================================== */

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ==========================================================================
   User menu
   ========================================================================== */

function UserMenu({ displayName, initials, roles, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="tb-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tb-user"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="tb-avatar" aria-hidden="true">{initials}</span>
        <span className="tb-user__text">
          <span className="tb-user__name">{displayName}</span>
          {roles.length > 0 && (
            <span className="tb-user__role">{ROLE_LABEL[roles[0]]}{roles.length > 1 ? ` +${roles.length - 1}` : ''}</span>
          )}
        </span>
        <span className="tb-chevron"><ChevronIcon /></span>
      </button>

      {open && (
        <div className="tb-menu" role="menu">
          <div className="tb-menu__head">
            <span className="tb-avatar" aria-hidden="true">{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div className="tb-menu__name">{displayName}</div>
              <div className="tb-menu__roles">
                {roles.length > 0
                  ? roles.map((r) => <span key={r} className="tb-chip">{ROLE_LABEL[r]}</span>)
                  : <span className="tb-menu__none">No role assigned</span>}
              </div>
            </div>
          </div>
          <div className="tb-menu__sep" />
          <button
            type="button"
            role="menuitem"
            className="tb-menu__item tb-menu__item--danger"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Topbar
   ========================================================================== */

export default function Topbar({ title, roleFlags, onNavigate }) {
  const { username, roles, logout } = useAuth();

  const displayName = username || 'User';

  return (
    <header className={`tb-root${FLOATING ? ' tb-root--floating' : ''}`}>
      <div className="tb-lead">
        <span className="tb-crumb">UBO Registry</span>
        <span className="tb-sep" aria-hidden="true">/</span>
        <h1 className="tb-title">{title}</h1>
      </div>

      <div className="tb-right">
        <NotificationBell roles={roleFlags} username={username} onNavigate={onNavigate} />
        <span className="tb-divider" aria-hidden="true" />
        <UserMenu
          displayName={displayName}
          initials={getInitials(username)}
          roles={knownRoles(roles)}
          onLogout={logout}
        />
      </div>
    </header>
  );
}
