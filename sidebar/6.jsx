
import { useEffect, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';
import './sbar.css';

/* =========================================================
   DASHEN BANK — SIDEBAR CONFIGURATION
   ========================================================= */

const EXPANDED_W = 256;
const COLLAPSED_W = 76;
const STORAGE_KEY = 'bovs.sidebar.collapsed';

const NAV_ITEMS = [
  {
    group: 'Workspace',
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
  },
  {
    group: 'Workspace',
    key: 'create',
    label: 'New Legal Person',
    icon: 'create',
  },
  {
    group: 'Workspace',
    key: 'records',
    label: 'Beneficial Owners',
    icon: 'records',
  },
  {
    group: 'Workflow',
    key: 'queue',
    label: 'Approval Queue',
    icon: 'queue',
    badge: '3',
  },
  {
    group: 'Insight',
    key: 'reports',
    label: 'Reports',
    icon: 'reports',
  },
  {
    group: 'Insight',
    key: 'audit',
    label: 'Audit Trail',
    icon: 'audit',
    badgeText: 'Admin',
  },
  {
    group: 'Insight',
    key: 'manual',
    label: 'User Manual',
    icon: 'manual',
  },
];

/* =========================================================
   SVG ICONS
   ========================================================= */

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 4.4 2.9 8.3 7 9.5 4.1-1.2 7-5.1 7-9.5V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {collapsed ? (
        <path
          d="m8 5 7 7-7 7m5-14 7 7-7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="m16 5-7 7 7 7M11 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/* =========================================================
   NAVIGATION GROUPS
   ========================================================= */

function NavItem({ item, active, collapsed, onClick }) {
  const icon = NavIcons[item.icon];

  return (
    <button
      type="button"
      className={`sb-item ${active ? 'sb-item--active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
    >
      <span className="sb-icon" aria-hidden="true">
        {icon}
      </span>

      {!collapsed && (
        <span className="sb-label">{item.label}</span>
      )}

      {item.badge && (
        <span
          className={`sb-badge ${collapsed ? 'sb-badge--collapsed' : ''}`}
          aria-label={`${item.badge} pending`}
        >
          {item.badge}
        </span>
      )}

      {item.badgeText && (
        <span
          className={`sb-badge sb-badge--text ${
            collapsed ? 'sb-badge--collapsed-text' : ''
          }`}
        >
          {item.badgeText}
        </span>
      )}

      {!collapsed && active && (
        <span className="sb-active-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="m9 5 7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

/* =========================================================
   SIDEBAR COMPONENT
   ========================================================= */

export default function Sidebar({ activeView, onNavigate }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved !== null) {
        return saved === '1';
      }
    } catch {
      // Local storage may be unavailable.
    }

    return typeof window !== 'undefined' && window.innerWidth < 900;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        collapsed ? '1' : '0'
      );
    } catch {
      // Ignore storage errors.
    }
  }, [collapsed]);

  const toggleSidebar = () => {
    setCollapsed((previous) => !previous);
  };

  const navigate = (key) => {
    if (typeof onNavigate === 'function') {
      onNavigate(key);
    }
  };

  let previousGroup = '';

  const groupedItems = NAV_ITEMS.map((item) => {
    const startsGroup = item.group !== previousGroup;
    previousGroup = item.group;

    return { ...item, startsGroup };
  });

  const width = collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    <aside
      className={`sb-root ${
        collapsed ? 'sb-root--collapsed' : ''
      }`}
      style={{
        width,
        minWidth: width,
      }}
      aria-label="Primary navigation"
    >
      {/* BRAND */}

      <div className="sb-brand">
        <div className="sb-logo">
          <img src={dashenlogo} alt="Dashen Bank" />
        </div>

        {!collapsed && (
          <div className="sb-brand__text">
            <span className="sb-brand__name">
              Dashen Bank
            </span>
            <span className="sb-brand__sub">
              Banking for a Brighter Future
            </span>
          </div>
        )}
      </div>

      {/* NAVIGATION */}

      <nav className="sb-nav" aria-label="Main menu">
        {groupedItems.map((item) => (
          <div key={item.key}>
            {item.startsGroup && (
              <div
                className="sb-group"
                role="presentation"
              >
                {!collapsed && (
                  <>
                    <span>{item.group}</span>
                    <span className="sb-group__line" />
                  </>
                )}
              </div>
            )}

            <NavItem
              item={item}
              active={activeView === item.key}
              collapsed={collapsed}
              onClick={() => navigate(item.key)}
            />
          </div>
        ))}
      </nav>

      {/* FOOTER */}

      <div className="sb-foot">
        <div
          className="sb-reg"
          title={
            collapsed
              ? 'Regulation No. 592/2026'
              : undefined
          }
        >
          <span className="sb-reg__icon">
            <ShieldIcon />
          </span>

          {!collapsed && (
            <span className="sb-reg__text">
              <span className="sb-reg__label">
                Regulation
              </span>
              <span className="sb-reg__value">
                No. 592/2026
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          className="sb-toggle"
          onClick={toggleSidebar}
          aria-label={
            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
          }
          aria-expanded={!collapsed}
          title={
            collapsed ? 'Expand sidebar' : 'Collapse sidebar'
          }
        >
          <span className="sb-toggle__icon">
            <CollapseIcon collapsed={collapsed} />
          </span>

          {!collapsed && (
            <span className="sb-toggle__label">
              Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
