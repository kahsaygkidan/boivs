import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { SearchIcon } from './Icons.jsx';
import NotificationBell from './NotificationBell.jsx';

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
      className="
        sticky top-0 z-10
        flex h-16 items-center gap-4 px-6
        bg-white border-b border-slate-200
        shadow-[0_1px_2px_rgba(15,23,42,0.04)]
        font-sans
      "
    >
      {/* ---------- Title ---------- */}
      <h1
        className="
          m-0 truncate text-[17px] font-semibold tracking-tight text-slate-900
          shrink-0
        "
      >
        {title}
      </h1>

      {/* ---------- Search ---------- */}
      <div className="flex min-w-0 flex-1 justify-end">
        <label
          className={`
            flex h-9 w-full max-w-[320px] cursor-text items-center gap-2 rounded-lg px-3
            transition-colors duration-150
            ${searchFocused
              ? 'bg-white border border-[#283375] ring-4 ring-[#283375]/10'
              : 'bg-slate-100 border border-slate-200'}
          `}
        >
          <span aria-hidden="true" className="flex shrink-0 text-slate-400">
            {SearchIcon}
          </span>
          <input
            type="search"
            placeholder="Search customers, owners…"
            aria-label="Search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="
              min-w-0 flex-1 border-none bg-transparent p-0 text-[13.5px] text-slate-900
              outline-none placeholder:text-slate-400
            "
          />
          <kbd
            aria-hidden="true"
            className="
              shrink-0 rounded border border-slate-200 bg-white px-1.5 py-px
              font-mono text-[10.5px] text-slate-400
            "
          >
            ⌘K
          </kbd>
        </label>
      </div>

      {/* ---------- Right cluster ---------- */}
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell
          roles={roleFlags}
          username={username}
          onNavigate={onNavigate}
        />

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />

        {/* ---------- User chip ---------- */}
        <div className="flex min-w-0 items-center gap-2.5 rounded-full bg-slate-100 py-1 pl-1 pr-2">
          <div
            aria-hidden="true"
            className="
              flex h-8 w-8 shrink-0 items-center justify-center rounded-full
              bg-[#283375] text-[12.5px] font-bold tracking-wide text-white
            "
          >
            {getInitials(username)}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span
              title={displayName}
              className="max-w-[140px] truncate text-[13px] font-semibold text-slate-900"
            >
              {displayName}
            </span>
            {roleLabel && (
              <span className="max-w-[140px] truncate text-[10.5px] font-medium uppercase tracking-wide text-slate-500">
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* ---------- Sign out ---------- */}
        <button
          type="button"
          onClick={logout}
          className="
            h-[34px] whitespace-nowrap rounded-lg border border-slate-200 bg-transparent
            px-3.5 text-[13px] font-semibold text-slate-500
            transition-colors duration-150
            hover:border-[#283375] hover:bg-white hover:text-[#283375]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#283375]/30
          "
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
