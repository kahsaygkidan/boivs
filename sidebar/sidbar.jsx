import dashenlogo from '../assets/dashenlogo.png';
import { NavIcons } from './Icons.jsx';

/* ==========================================================================
   Navigation configuration
   ========================================================================== */

const NAV_ITEMS = [
  { group: 'Workspace', key: 'dashboard', label: 'Dashboard',          icon: 'dashboard', roleKeys: null },
  { group: 'Workspace', key: 'create',    label: 'New Legal Person',       icon: 'create',    roleKeys: ['isMaker'] },
  { group: 'Workspace', key: 'records',   label: 'Beneficial Owners',         icon: 'records',   roleKeys: null },
  { group: 'Workflow', key: 'queue',     label: 'Approval Queue', icon: 'queue',     roleKeys: ['isChecker'] },
  { group: 'Compliance',   key: 'reports',   label: 'Reports',            icon: 'reports',   roleKeys: null },
  { group: 'Compliance',   key: 'audit',     label: 'Audit Trail',        icon: 'audit',     roleKeys: ['isAdmin', 'isChecker', 'isAuditor'] },
    { group: 'Insight', key: 'manual', label: 'User Manual', icon: 'manual', roleKeys: null },
];

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
    <aside className="sidebar" aria-label="Primary navigation">
      {/* ---------- Brand ---------- */}
      <div className="sidebar-brand">
        <img className="sidebar-brand-logo" src={dashenlogo} alt="Dashen Bank" />
        <div className="sidebar-brand-text">


        </div>
      </div>

      {/* ---------- Navigation ---------- */}
      <nav className="sidebar-nav">
        {groupedItems.map((item) => (
          <div key={item.key} className="sidebar-nav-block">
            {item.startsGroup && (
              <div className="nav-group-label" role="presentation">
                {item.group}
              </div>
            )}

            <button
              type="button"
              className={`nav-item${activeView === item.key ? ' active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={activeView === item.key ? 'page' : undefined}
            >
              <span className="nav-item-icon" aria-hidden="true">
                {NavIcons[item.icon]}
              </span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* ---------- Footer ---------- */}
      <div className="sidebar-footer">
        <span className="sidebar-footer-label">Regulation</span>
        <span className="sidebar-footer-value">No. 592/2026</span>
      </div>
    </aside>
  );
}
