import { useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';

/* ==========================================================================
   Design tokens — built around Dashen brand #283375
   ========================================================================== */
const T = {
  sidebarBg: '#283375',
  sidebarBgDeep: '#1f2859',
  sidebarBorder: 'rgba(255,255,255,.10)',
  textPrimary: '#eef1fb',
  textMuted: '#a9b1d6',
  textFaint: '#7b84b3',
  brandAccent: '#7ea6ff',
  activeBg: 'rgba(255,255,255,.12)',
  activeText: '#ffffff',
  hoverBg: 'rgba(255,255,255,.07)',
  radius: 10,
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const EXPANDED_W = 248;
const COLLAPSED_W = 72;

/* ==========================================================================
   Navigation configuration
   ========================================================================== */
const NAV_ITEMS = [
  { group: 'Workspace',  key: 'dashboard', label: 'Dashboard',           icon: 'dashboard', roleKeys: null },
  { group: 'Workspace',  key: 'create',    label: 'New Legal Person',    icon: 'create',    roleKeys: ['isMaker'] },
  { group: 'Workspace',  key: 'records',   label: 'Beneficial Owners',   icon: 'records',   roleKeys: null },
  { group: 'Workflow',   key: 'queue',     label: 'Approval Queue',      icon: 'queue',     roleKeys: ['isChecker'] },
  { group: 'Compliance', key: 'reports',   label: 'Reports',             icon: 'reports',   roleKeys: null },
  { group: 'Compliance', key: 'audit',     label: 'Audit Trail',         icon: 'audit',     roleKeys: ['isAdmin', 'isChecker', 'isAuditor'] },
  { group: 'Insight',    key: 'manual',    label: 'User Manual',         icon: 'manual',    roleKeys: null },
];

/* ==========================================================================
   NavItem
   ========================================================================== */
function NavItem({ item, active, collapsed, onClick }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 12,
        width: '100%',
        padding: collapsed ? '10px' : '9px 12px',
        marginBottom: 2,
        border: 'none',
        borderRadius: T.radius,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: '-.01em',
        textAlign: 'left',
        background: active ? T.activeBg : hover ? T.hoverBg : 'transparent',
        color: active ? T.activeText : hover ? T.textPrimary : '#cdd3ee',
        position: 'relative',
        transition: 'background .15s ease, color .15s ease',
        overflow: 'hidden',
      }}
    >
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 3,
            background: T.brandAccent,
            boxShadow: `0 0 12px ${T.brandAccent}`,
          }}
        />
      )}

      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          flexShrink: 0,
          color: active ? T.brandAccent : hover ? '#d9def7' : T.textMuted,
          transition: 'color .15s ease',
        }}
      >
        {NavIcons[item.icon]}
      </span>

      {!collapsed && (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

/* ==========================================================================
   Sidebar
   ========================================================================== */
export default function Sidebar({ activeView, onNavigate, roles }) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roleKeys || item.roleKeys.some((key) => roles?.[key])
  );

  let lastGroup = null;
  const groupedItems = visibleItems.map((item) => {
    const startsGroup = item.group !== lastGroup;
    lastGroup = item.group;
    return { ...item, startsGroup };
  });

  return (
    <aside
      aria-label="Primary navigation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: collapsed ? COLLAPSED_W : EXPANDED_W,
        minWidth: collapsed ? COLLAPSED_W : EXPANDED_W,
        height: '100vh',
        background: T.sidebarBg,
        borderRight: `1px solid ${T.sidebarBorder}`,
        fontFamily: T.font,
        color: T.textPrimary,
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        transition: 'width .2s ease, min-width .2s ease',
        overflow: 'hidden',
      }}
    >
      {/* ---------- Brand ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12,
          padding: collapsed ? '20px 0 18px' : '20px 20px 18px',
          borderBottom: `1px solid ${T.sidebarBorder}`,
          background: T.sidebarBgDeep,
          position: 'relative',
        }}
      >
        <img
          src={dashenlogo}
          alt="Dashen Bank"
          style={{
            height: 34,
            width: 'auto',
            objectFit: 'contain',
            opacity: 0.95,
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.15,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: '#fff' }}>
              Dashen Bank
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: T.textMuted, letterSpacing: '.02em' }}>
              UBO Registry
            </span>
          </div>
        )}
      </div>

      {/* ---------- Collapse toggle (straddles the edge) ---------- */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        style={{
          position: 'absolute',
          top: 78,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `1px solid ${T.sidebarBorder}`,
          background: T.sidebarBgDeep,
          color: T.textPrimary,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          transition: 'background .15s ease, transform .2s ease',
          zIndex: 2,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = T.activeBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = T.sidebarBgDeep; }}
      >
        {/* Chevron — points right when expanded (click to collapse), left when collapsed */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'transform .2s ease', transform: collapsed ? 'rotate(180deg)' : 'none' }}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* ---------- Navigation ---------- */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 10px 16px',
          scrollbarWidth: 'thin',
        }}
      >
        {groupedItems.map((item) => (
          <div key={item.key}>
            {item.startsGroup && (
              <div
                role="presentation"
                style={{
                  padding: '14px 12px 6px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: T.textFaint,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  opacity: collapsed ? 0 : 1,
                  height: collapsed ? 10 : 'auto',
                  transition: 'opacity .15s ease',
                }}
              >
                {collapsed ? '' : item.group}
              </div>
            )}

            <NavItem
              item={item}
              active={activeView === item.key}
              collapsed={collapsed}
              onClick={() => onNavigate(item.key)}
            />
          </div>
        ))}
      </nav>

      {/* ---------- Footer ---------- */}
      <div
        style={{
          padding: collapsed ? '14px 0' : '14px 20px',
          borderTop: `1px solid ${T.sidebarBorder}`,
          background: T.sidebarBgDeep,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          fontSize: 11.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {collapsed ? (
          <span
            title="Regulation No. 592/2026"
            style={{
              color: T.textPrimary,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              fontSize: 11,
            }}
          >
            §
          </span>
        ) : (
          <>
            <span style={{ color: T.textMuted, fontWeight: 500 }}>Regulation</span>
            <span
              style={{
                color: T.textPrimary,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                fontSize: 11,
              }}
            >
              No. 592/2026
            </span>
          </>
        )}
      </div>
    </aside>
  );
}
