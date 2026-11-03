import { useEffect, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';
import './sbar.css';

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
  { group: 'Workspace', key: 'dashboard', label: 'Dashboard',         icon: 'dashboard', roleKeys: null },
  { group: 'Workspace', key: 'create',    label: 'New Legal Person',  icon: 'create',    roleKeys: null },
  { group: 'Workspace', key: 'records',   label: 'Beneficial Owners', icon: 'records',   roleKeys: null },
  { group: 'Workflow',  key: 'queue',     label: 'Approval Queue',    icon: 'queue',     roleKeys: null, badge: '3' },
  { group: 'Insight',   key: 'reports',   label: 'Reports',           icon: 'reports',   roleKeys: null },
  { group: 'Insight',   key: 'audit',     label: 'Audit Trail',       icon: 'audit',     roleKeys: null, badgeText: 'Admin' },
  { group: 'Insight',   key: 'manual',    label: 'User Manual',       icon: 'manual',    roleKeys: null },
];

/* ==========================================================================
   Icons
   ========================================================================== */
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CollapseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
      {!collapsed && (
        <>
          <span className="sb-label">{item.label}</span>
          {item.badge && <span className="sb-badge">{item.badge}</span>}
          {item.badgeText && <span className="sb-badge sb-badge--text">{item.badgeText}</span>}
        </>
      )}
    </button>
  );
}

/* ==========================================================================
   Sidebar
   ========================================================================== */
export default function Sidebar({ activeView, onNavigate }) {
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

  let lastGroup = null;
  const grouped = NAV_ITEMS.map((item) => {
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
      {/* Brand */}
      <div className="sb-brand">
        <span className="sb-logo"><img src={dashenlogo} alt="Dashen Bank" /></span>
        {!collapsed && (
          <div className="sb-brand__text">
            <span className="sb-brand__name">Dashen Bank</span>
            <span className="sb-brand__sub">Banking for a Brighter Future</span>
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
