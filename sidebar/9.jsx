import { useEffect, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import '../styles/sidebar.css';

/* ==========================================================================
   Layout constants
   ========================================================================== */
const EXPANDED_W = 256;
const COLLAPSED_W = 76;
const STORAGE_KEY = 'bovs.sidebar.collapsed';

/* Footer build info */
const APP_VERSION = 'v1.0.0';
const APP_YEAR = new Date().getFullYear();

/* The design shows a floating rounded card. Set to false for an edge-to-edge sidebar. */
const FLOATING = true;
/* Set to true if dashenlogo.png already contains the "Dashen Bank" wordmark. */
const LOGO_HAS_TEXT = false;

/* ==========================================================================
   Navigation configuration — groups, labels and order follow the design
   ========================================================================== */
const NAV_ITEMS = [
  { group: 'Workspace', key: 'dashboard', label: 'Dashboard',         icon: 'dashboard', roleKeys: null },
  { group: 'Workspace', key: 'create',    label: 'New Legal Person',  icon: 'create',    roleKeys: ['isMaker'] },
  { group: 'Workspace', key: 'records',   label: 'Beneficial Owners', icon: 'records',   roleKeys: null },
  { group: 'Workflow',  key: 'queue',     label: 'Approval Queue',    icon: 'queue',     roleKeys: ['isChecker'] },
  { group: 'Insight',   key: 'reports',   label: 'Reports',           icon: 'reports',   roleKeys: null },
  { group: 'Insight',   key: 'audit',     label: 'Audit Trail',       icon: 'audit',     roleKeys: ['isAdmin', 'isChecker', 'isAuditor'] },
  { group: 'Insight',   key: 'manual',    label: 'User Guide',        icon: 'manual',    roleKeys: null },
];

/* The small pill next to "Audit Trail" shows which role grants access to it */
const tagFor = (roles) => (roles?.isAdmin ? 'Admin' : roles?.isAuditor ? 'Auditor' : roles?.isChecker ? 'Checker' : null);

/* ==========================================================================
   Icons (24px grid, 1.8 stroke, rounded caps)
   ========================================================================== */
const svg = (children, extra = {}) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>
    {children}
  </svg>
);

const ICONS = {
  dashboard: svg(<path d="M12 2.8 2.9 10.4a1 1 0 0 0-.4.8V20a1.2 1.2 0 0 0 1.2 1.2h4.6a.7.7 0 0 0 .7-.7v-5.1a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v5.1a.7.7 0 0 0 .7.7h4.6a1.2 1.2 0 0 0 1.2-1.2v-8.8a1 1 0 0 0-.4-.8L12 2.8Z" fill="currentColor" stroke="none" />),
  create: svg(<><circle cx="9" cy="8" r="3.6" /><path d="M2.6 20c0-3.6 2.8-6 6.4-6s6.4 2.4 6.4 6" /><path d="M19 8.2v6M16 11.2h6" /></>),
  records: svg(<><circle cx="9" cy="8" r="3.3" /><path d="M2.5 20c0-3.5 2.8-5.6 6.5-5.6s6.5 2.1 6.5 5.6" /><path d="M16.2 4.9a3.1 3.1 0 0 1 0 6.2M18 14.6c2.3.5 3.8 2.3 3.8 5.4" /></>),
  queue: svg(<><rect x="4.8" y="4.4" width="14.4" height="17" rx="2.6" /><path d="M9 4.4V3.6a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8v.8" /><path d="m8.8 13.2 2.3 2.3 4.2-4.4" /></>),
  reports: svg(<path d="M6 20.5V11M12 20.5V3.5M18 20.5v-6.5" strokeWidth="2.4" />),
  audit: svg(<path d="M12 2.8 4.6 5.9v5.6c0 4.6 3.1 8.5 7.4 9.9 4.3-1.4 7.4-5.3 7.4-9.9V5.9L12 2.8Z" />),
  manual: svg(<><path d="M12 6.6C10.4 5 8 4.4 3.4 4.4v13.2c4.6 0 7 .6 8.6 2.1 1.6-1.5 4-2.1 8.6-2.1V4.4C16 4.4 13.6 5 12 6.6Z" /><path d="M12 6.6v13.1" /></>),
};

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 5 7 7-7 7" />
  </svg>
);
const DoubleChevron = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'left' ? <path d="m12 6-6 6 6 6M19 6l-6 6 6 6" /> : <path d="m5 6 6 6-6 6M12 6l6 6-6 6" />}
  </svg>
);

/* ==========================================================================
   NavItem
   ========================================================================== */
function NavItem({ item, active, collapsed, badge, tag, onClick }) {
  const hasBadge = badge > 0;
  const stacked = collapsed && !!tag;
  return (
    <button
      type="button"
      className={`sb-item${active ? ' sb-item--active' : ''}${stacked ? ' sb-item--stacked' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? `${item.label}${hasBadge ? `, ${badge} pending` : ''}` : undefined}
      title={collapsed ? item.label : undefined}
    >
      <span className="sb-icon" aria-hidden="true">{ICONS[item.icon]}</span>

      {!collapsed && <span className="sb-label">{item.label}</span>}
      {!collapsed && hasBadge && <span className="sb-badge">{badge > 99 ? '99+' : badge}</span>}
      {!collapsed && tag && <span className="sb-tag">{tag}</span>}
      {!collapsed && active && <span className="sb-chev"><ChevronRight /></span>}

      {collapsed && hasBadge && <span className="sb-badge sb-badge--float">{badge > 99 ? '99+' : badge}</span>}
      {collapsed && tag && <span className="sb-tag sb-tag--stack">{tag}</span>}
    </button>
  );
}

/* ==========================================================================
   Sidebar
   `badges` is optional, e.g. { queue: 3 } to show the pending-approval count.
   ========================================================================== */
export default function Sidebar({ activeView, onNavigate, roles, badges = {} }) {
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
  const roleTag = tagFor(roles);

  return (
    <aside
      aria-label="Primary navigation"
      className={`sb-root${FLOATING ? ' sb-root--floating' : ''}${collapsed ? ' sb-root--collapsed' : ''}`}
      style={{ width, minWidth: width, position: 'relative' }}
    >
      {/* Collapse control — pinned to the top edge (inline so the stylesheet is untouched) */}
      <button
        type="button"
        className="sb-edge-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          padding: 0,
          border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 8,
          background: 'rgba(255,255,255,.08)',
          color: '#dfe7ff',
          cursor: 'pointer',
        }}
      >
        <DoubleChevron dir={collapsed ? 'right' : 'left'} />
      </button>

      {/* Brand — logo stays centered at its existing size in both states */}
      <div
        className="sb-brand"
        style={{
          justifyContent: 'center',
          paddingLeft: collapsed ? 0 : 22,
          paddingRight: collapsed ? 0 : 22,
        }}
      >
        <img className={`sb-logo${LOGO_HAS_TEXT ? ' sb-logo--wide' : ''}`} src={dashenlogo} alt="Dashen Bank" />
        {!collapsed && !LOGO_HAS_TEXT}
      </div>

      {/* Navigation */}
      <nav className="sb-nav">
        {grouped.map((item) => (
          <div key={item.key}>
            {item.startsGroup && <div className="sb-group" role="presentation"><span>{item.group}</span></div>}
            <NavItem
              item={item}
              active={activeView === item.key}
              collapsed={collapsed}
              badge={badges[item.key]}
              tag={item.tag ? roleTag : null}
              onClick={() => onNavigate(item.key)}
            />
          </div>
        ))}
      </nav>

      {/* Footer — version + year (collapse button now lives at the top edge) */}
      <div className="sb-foot">
        <div
          className="sb-version"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: 6,
            padding: collapsed ? 0 : '2px 4px',
            color: '#aab9ee',
            fontSize: 11.5,
            fontWeight: 550,
            letterSpacing: '.02em',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{APP_VERSION}</span>
          {!collapsed && <span aria-hidden="true">·</span>}
          <span>© {APP_YEAR}</span>
        </div>
      </div>
    </aside>
  );
}
