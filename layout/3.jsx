import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import { T } from './ui.jsx';

/* ==========================================================================
   Constants
   ========================================================================== */

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

const ChevronIcon = ({ open }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
    style={{ transition: 'transform .18s ease', transform: open ? 'rotate(180deg)' : 'none', color: T.textMuted }}
  >
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ==========================================================================
   Styles (scoped with the tb- prefix)
   ========================================================================== */

const css = `
.tb-root {
  position: sticky; top: 0; z-index: 40;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 64px; padding: 0 24px;
  background: color-mix(in srgb, ${T.surface} 82%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid ${T.border};
  font-family: ${T.font};
}
.tb-title {
  margin: 0; min-width: 0; font-size: 17px; font-weight: 700; letter-spacing: -.015em;
  color: ${T.text}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tb-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.tb-divider { width: 1px; height: 26px; background: ${T.border}; }

.tb-avatar {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 34px; height: 34px; border-radius: 50%;
  font-size: 12.5px; font-weight: 700; letter-spacing: .02em; color: #fff;
  background: linear-gradient(135deg, #4a5bd6 0%, #283375 100%);
  box-shadow: 0 0 0 2px ${T.surface}, 0 0 0 3px ${T.border};
}

.tb-user {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 4px 10px 4px 4px; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid transparent; color: ${T.text}; font-family: inherit;
  transition: background .15s ease, border-color .15s ease;
}
.tb-user:hover, .tb-user[aria-expanded="true"] { background: ${T.surfaceAlt}; border-color: ${T.border}; }
.tb-user:focus-visible { outline: 2px solid #4a5bd6; outline-offset: 2px; }
.tb-user__text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; min-width: 0; }
.tb-user__name { font-size: 13.5px; font-weight: 650; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb-user__role { font-size: 11.5px; color: ${T.textMuted}; }

.tb-menu-wrap { position: relative; }
.tb-menu {
  position: absolute; right: 0; top: calc(100% + 8px); min-width: 240px; padding: 6px;
  background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 14px;
  box-shadow: 0 12px 32px rgba(16, 24, 40, .14), 0 2px 6px rgba(16, 24, 40, .06);
  animation: tb-pop .14s ease-out; transform-origin: top right;
}
@keyframes tb-pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
.tb-menu__head { display: flex; align-items: center; gap: 12px; padding: 10px; }
.tb-menu__name { font-size: 14px; font-weight: 650; color: ${T.text}; word-break: break-all; }
.tb-menu__roles { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
.tb-chip {
  padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 650; letter-spacing: .02em;
  color: #283375; background: rgba(74, 91, 214, .12);
}
.tb-menu__sep { height: 1px; margin: 6px 0; background: ${T.border}; }
.tb-menu__item {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px;
  border: 0; border-radius: 10px; background: transparent; cursor: pointer;
  font: inherit; font-size: 13.5px; font-weight: 550; color: ${T.text}; text-align: left;
  transition: background .12s ease, color .12s ease;
}
.tb-menu__item:hover, .tb-menu__item:focus-visible { background: ${T.surfaceAlt}; outline: none; }
.tb-menu__item--danger { color: #c0362c; }
.tb-menu__item--danger:hover, .tb-menu__item--danger:focus-visible { background: rgba(192, 54, 44, .08); }

@media (max-width: 720px) {
  .tb-root { padding: 0 14px; min-height: 58px; }
  .tb-user__text, .tb-chevron { display: none; }
  .tb-user { padding: 3px; }
  .tb-divider { display: none; }
}
`;

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
          {roles.length > 0 && <span className="tb-user__role">{ROLE_LABEL[roles[0]]}{roles.length > 1 ? ` +${roles.length - 1}` : ''}</span>}
        </span>
        <span className="tb-chevron" style={{ display: 'inline-flex' }}><ChevronIcon open={open} /></span>
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
                  : <span style={{ fontSize: 12, color: T.textMuted }}>No role assigned</span>}
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
    <header className="tb-root">
      <style>{css}</style>

      <h1 className="tb-title">{title}</h1>

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
