import { useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';

/* ==========================================================================
   Design tokens
   ========================================================================== */
const T = {
  sidebarBg: '#0b1220',
  sidebarBorder: '#1e293b',
  textPrimary: '#e2e8f0',
  textMuted: '#64748b',
  textFaint: '#475569',
  brandAccent: '#3b82f6',
  brandAccentSoft: 'rgba(59,130,246,.12)',
  activeBg: 'rgba(59,130,246,.14)',
  activeText: '#ffffff',
  hoverBg: 'rgba(148,163,184,.08)',
  radius: 10,
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

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
function NavItem({ item, active, onClick }) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '9px 12px',
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
        color: active ? T.activeText : hover ? T.textPrimary : '#cbd5e1',
        position: 'relative',
        transition: 'background .15s ease, color .15s ease',
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
          color: active ? T.brandAccent : hover ? '#94a3b8' : '#64748b',
          transition: 'color .15s ease',
        }}
      >
        {NavIcons[item.icon]}
      </span>

      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.label}
      </span>
    </button>
  );
}

/* ==========================================================================
   Sidebar
   ========================================================================== */
export default function Sidebar({ activeView, onNavigate, roles }) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roleKeys || item.roleKeys.some((key) => roles?.[key])
  );

  // Pre-compute which items start a new group so rendering stays declarative.
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
        width: 248,
        height: '100vh',
        background: T.sidebarBg,
        borderRight: `1px solid ${T.sidebarBorder}`,
        fontFamily: T.font,
        color: T.textPrimary,
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* ---------- Brand ---------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px 20px 18px',
          borderBottom: `1px solid ${T.sidebarBorder}`,
        }}
      >
        <img
          src={dashenlogo}
          alt="Dashen Bank"
          style={{
            height: 34,
            width: 'auto',
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            opacity: 0.95,
          }}
        />
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
      </div>

      {/* ---------- Navigation ---------- */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
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
                }}
              >
                {item.group}
              </div>
            )}

            <NavItem
              item={item}
              active={activeView === item.key}
              onClick={() => onNavigate(item.key)}
            />
          </div>
        ))}
      </nav>

      {/* ---------- Footer ---------- */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: `1px solid ${T.sidebarBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11.5,
        }}
      >
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
      </div>
    </aside>
  );
}
