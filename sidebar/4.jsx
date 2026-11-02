import { useEffect, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';

/* ==========================================================================
   Layout constants
   ========================================================================== */
const EXPANDED_W = 256;
const COLLAPSED_W = 76;
const STORAGE_KEY = 'bovs.sidebar.collapsed';

/* ==========================================================================
   Navigation configuration
   ========================================================================== */
const NAV_ITEMS = [
  { group: 'Workspace',  key: 'dashboard', label: 'Dashboard',         icon: 'dashboard', roleKeys: null },
  { group: 'Workspace',  key: 'create',    label: 'New Legal Person',  icon: 'create',    roleKeys: ['isMaker'] },
  { group: 'Workspace',  key: 'records',   label: 'Beneficial Owners', icon: 'records',   roleKeys: null },
  { group: 'Workflow',   key: 'queue',     label: 'Approval Queue',    icon: 'queue',     roleKeys: ['isChecker'] },
  { group: 'Compliance', key: 'reports',   label: 'Reports',           icon: 'reports',   roleKeys: null },
  { group: 'Compliance', key: 'audit',     label: 'Audit Trail',       icon: 'audit',     roleKeys: ['isAdmin', 'isChecker', 'isAuditor'] },
  { group: 'Insight',    key: 'manual',    label: 'User Manual',       icon: 'manual',    roleKeys: null },
];

/* ==========================================================================
   Styles — built around Dashen brand #283375 (scoped with the sb- prefix)
   ========================================================================== */
const css = `
.sb-root {
  --sb-accent: #7ea6ff;
  position: sticky; top: 0; z-index: 30;
  display: flex; flex-direction: column; box-sizing: border-box;
  height: 100vh; height: 100dvh;
  background: linear-gradient(180deg, #2f3c8c 0%, #283375 38%, #212b66 100%);
  border-right: 1px solid rgba(255, 255, 255, .08);
  box-shadow: 4px 0 24px rgba(16, 24, 64, .12);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #eef1fb; overflow: hidden;
  transition: width .22s cubic-bezier(.2, .8, .2, 1), min-width .22s cubic-bezier(.2, .8, .2, 1);
}

/* Brand */
.sb-brand { display: flex; align-items: center; gap: 12px; padding: 18px 18px 16px; min-height: 68px; box-sizing: border-box; }
.sb-logo {
  display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 40px; height: 40px; border-radius: 12px;
  background: rgba(255, 255, 255, .10); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .14);
}
.sb-logo img { height: 24px; width: auto; max-width: 28px; object-fit: contain; }
.sb-brand__text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.sb-brand__name { font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; color: #fff; white-space: nowrap; }
.sb-brand__sub { font-size: 11px; font-weight: 500; letter-spacing: .03em; color: #a9b1d6; white-space: nowrap; }

/* Nav */
.sb-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 6px 12px 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
.sb-group { padding: 16px 12px 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: #8b94c4; white-space: nowrap; user-select: none; }
.sb-group:first-child { padding-top: 8px; }

.sb-item {
  position: relative; display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box;
  margin-bottom: 2px; padding: 10px 12px; border: 0; border-radius: 11px;
  background: transparent; color: #cdd3ee; cursor: pointer; text-align: left;
  font: inherit; font-size: 13.5px; font-weight: 500; letter-spacing: -.01em;
  transition: background .15s ease, color .15s ease;
}
.sb-item:hover { background: rgba(255, 255, 255, .07); color: #fff; }
.sb-item:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: -2px; }
.sb-item--active { background: rgba(255, 255, 255, .13); color: #fff; font-weight: 650; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06); }
.sb-item--active::before {
  content: ''; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 4px; border-radius: 0 4px 4px 0;
  background: var(--sb-accent); box-shadow: 0 0 14px var(--sb-accent);
}
.sb-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 20px; height: 20px; color: #a9b1d6; transition: color .15s ease; }
.sb-item:hover .sb-icon { color: #e3e8fb; }
.sb-item--active .sb-icon { color: var(--sb-accent); }
.sb-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Footer */
.sb-foot { padding: 12px; border-top: 1px solid rgba(255, 255, 255, .08); background: rgba(16, 22, 60, .28); display: flex; flex-direction: column; gap: 10px; }
.sb-reg { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 11px; background: rgba(255, 255, 255, .06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .07); }
.sb-reg__icon { display: inline-flex; flex-shrink: 0; color: var(--sb-accent); }
.sb-reg__text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.sb-reg__label { font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #8b94c4; }
.sb-reg__value { font-size: 12px; font-weight: 650; color: #fff; font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace; white-space: nowrap; }

.sb-toggle {
  display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 9px 12px; border: 0; border-radius: 11px;
  background: transparent; color: #a9b1d6; cursor: pointer; font: inherit; font-size: 12.5px; font-weight: 600;
  transition: background .15s ease, color .15s ease;
}
.sb-toggle:hover { background: rgba(255, 255, 255, .08); color: #fff; }
.sb-toggle:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: -2px; }
.sb-toggle svg { flex-shrink: 0; transition: transform .22s ease; }

/* Collapsed state */
.sb-root--collapsed .sb-brand { justify-content: center; padding-left: 0; padding-right: 0; }
.sb-root--collapsed .sb-item { justify-content: center; padding: 11px; }
.sb-root--collapsed .sb-item--active::before { left: -12px; }
.sb-root--collapsed .sb-group { height: 1px; padding: 0; margin: 12px 14px; background: rgba(255, 255, 255, .10); font-size: 0; }
.sb-root--collapsed .sb-group:first-child { display: none; }
.sb-root--collapsed .sb-reg { justify-content: center; padding: 10px 0; }
.sb-root--collapsed .sb-toggle { justify-content: center; padding: 10px 0; }
.sb-root--collapsed .sb-toggle svg { transform: rotate(180deg); }

@media print { .sb-root { display: none !important; } }
@media (prefers-reduced-motion: reduce) { .sb-root, .sb-item, .sb-icon, .sb-toggle svg { transition: none; } }
`;

/* ==========================================================================
   Icons
   ========================================================================== */
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ==========================================================================
   NavItem
   ========================================================================== */
function NavItem({ item, active, collapsed, onClick }) {
  return (
    <button
      type="button"
      className={`sb-item${active ? ' sb-item--active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
    >
      <span className="sb-icon" aria-hidden="true">{NavIcons[item.icon]}</span>
      {!collapsed && <span className="sb-label">{item.label}</span>}
    </button>
  );
}

/* ==========================================================================
   Sidebar
   ========================================================================== */
export default function Sidebar({ activeView, onNavigate, roles }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) return saved === '1';
    } catch { /* storage unavailable */ }
    return typeof window !== 'undefined' && window.innerWidth < 900;
  });

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.roleKeys || item.roleKeys.some((key) => roles?.[key]));

  let lastGroup = null;
  const grouped = visibleItems.map((item) => {
    const startsGroup = item.group !== lastGroup;
    lastGroup = item.group;
    return { ...item, startsGroup };
  });

  const width = collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <aside
      aria-label="Primary navigation"
      className={`sb-root${collapsed ? ' sb-root--collapsed' : ''}`}
      style={{ width, minWidth: width }}
    >
      <style>{css}</style>

      {/* Brand */}
      <div className="sb-brand">
        <span className="sb-logo"><img src={dashenlogo} alt="Dashen Bank" /></span>
        {!collapsed && (
          <div className="sb-brand__text">
            <span className="sb-brand__name">Dashen Bank</span>
            <span className="sb-brand__sub">UBO Registry</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {grouped.map((item) => (
          <div key={item.key}>
            {item.startsGroup && <div className="sb-group" role="presentation">{item.group}</div>}
            <NavItem item={item} active={activeView === item.key} collapsed={collapsed} onClick={() => onNavigate(item.key)} />
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sb-foot">
        <div className="sb-reg" title={collapsed ? 'Regulation No. 592/2026' : undefined}>
          <span className="sb-reg__icon"><ShieldIcon /></span>
          {!collapsed && (
            <span className="sb-reg__text">
              <span className="sb-reg__label">Regulation</span>
              <span className="sb-reg__value">No. 592/2026</span>
            </span>
          )}
        </div>
        <button
          type="button"
          className="sb-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <CollapseIcon />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
