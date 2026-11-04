import { useEffect, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';

/* ==========================================================================
   Layout constants
   ========================================================================== */
const EXPANDED_W = 256;
const COLLAPSED_W = 76;
const STORAGE_KEY = 'bovs.sidebar.collapsed';

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
  { group: 'Insight',   key: 'audit',     label: 'Audit Trail',       icon: 'audit',     roleKeys: ['isAdmin', 'isChecker', 'isAuditor'], tag: true },
  { group: 'Insight',   key: 'manual',    label: 'User Manual',       icon: 'manual',    roleKeys: null },
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
const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2.8 4.6 5.9v5.6c0 4.6 3.1 8.5 7.4 9.9 4.3-1.4 7.4-5.3 7.4-9.9V5.9L12 2.8Z" />
    <path d="m8.8 12.2 2.3 2.3 4.2-4.4" />
  </svg>
);
const DoubleChevron = ({ dir }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'left' ? <path d="m12 6-6 6 6 6M19 6l-6 6 6 6" /> : <path d="m5 6 6 6-6 6M12 6l6 6-6 6" />}
  </svg>
);

/* ==========================================================================
   Styles — Dashen navy with a blue glow (scoped with the sb- prefix)
   ========================================================================== */
const css = `
.sb-root {
  --sb-blue: #3157dc; --sb-blue-2: #2a47b9; --sb-line: rgba(255, 255, 255, .10);
  position: sticky; top: 0; z-index: 30; flex-shrink: 0;
  display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
  height: 100vh; height: 100dvh;
  background: linear-gradient(180deg, #14216b 0%, #0f1b5a 45%, #0a1442 100%);
  color: #eef1ff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: width .22s cubic-bezier(.2, .8, .2, 1), min-width .22s cubic-bezier(.2, .8, .2, 1);
}
.sb-root--floating {
  top: 12px; margin: 12px 0 12px 12px; height: calc(100vh - 24px); height: calc(100dvh - 24px);
  border-radius: 26px; border: 1px solid rgba(255, 255, 255, .07);
  box-shadow: 0 20px 44px rgba(10, 20, 66, .30), 0 2px 8px rgba(10, 20, 66, .20);
}
.sb-root:not(.sb-root--floating) { border-right: 1px solid rgba(255, 255, 255, .08); }

/* Blue glow in the top-right corner */
.sb-root::before, .sb-root::after { content: ''; position: absolute; border-radius: 50%; pointer-events: none; }
.sb-root::before { top: -92px; right: -92px; width: 230px; height: 230px;
  background: radial-gradient(circle at 32% 68%, rgba(56, 98, 240, .85) 0%, rgba(56, 98, 240, .38) 42%, rgba(56, 98, 240, 0) 70%); }
.sb-root::after { top: -58px; right: -58px; width: 170px; height: 170px; border: 1px solid rgba(130, 168, 255, .22); }
.sb-root--collapsed::before { top: -70px; right: -70px; width: 160px; height: 160px; }
.sb-root--collapsed::after { display: none; }
.sb-root > * { position: relative; z-index: 1; }

/* Brand */
.sb-brand { display: flex; align-items: center; gap: 12px; padding: 22px 22px 18px; min-height: 76px; }
.sb-logo { display: block; flex-shrink: 0; height: 36px; width: auto; max-width: 150px; object-fit: contain; }
.sb-logo--wide { height: 44px; max-width: 172px; }
.sb-brand__text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.sb-brand__name { font-size: 17px; font-weight: 750; letter-spacing: -.015em; color: #fff; white-space: nowrap; }
.sb-brand__sub { margin-top: 2px; font-size: 10.5px; font-weight: 500; color: #9db0f0; white-space: nowrap; }
.sb-root--collapsed .sb-brand { justify-content: center; padding: 22px 0 18px; }
.sb-root--collapsed .sb-logo { width: 38px; height: 36px; object-fit: cover; object-position: left center; }

/* Navigation */
.sb-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 2px 12px 12px; scrollbar-width: none; }
.sb-nav::-webkit-scrollbar { display: none; }
.sb-group { display: flex; align-items: center; gap: 12px; padding: 14px 10px 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #7f93da; white-space: nowrap; user-select: none; }
.sb-group:first-child { padding-top: 6px; }
.sb-group::after { content: ''; flex: 1; height: 1px; background: var(--sb-line); }
.sb-root--collapsed .sb-group { height: 1px; margin: 12px 10px; padding: 0; background: var(--sb-line); font-size: 0; }
.sb-root--collapsed .sb-group::after { display: none; }
.sb-root--collapsed .sb-group:first-child { display: none; }

.sb-item {
  position: relative; display: flex; align-items: center; gap: 14px; width: 100%; box-sizing: border-box; min-height: 44px;
  margin-bottom: 4px; padding: 0 14px 0 18px; border: 0; border-radius: 13px;
  background: transparent; color: #e4e9ff; cursor: pointer; text-align: left;
  font: inherit; font-size: 13.5px; font-weight: 500; letter-spacing: -.005em;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.sb-item:hover { background: rgba(255, 255, 255, .07); color: #fff; }
.sb-item:focus-visible { outline: 2px solid #8fb0ff; outline-offset: 2px; }
.sb-item--active, .sb-item--active:hover {
  color: #fff; font-weight: 650;
  background: linear-gradient(90deg, var(--sb-blue) 0%, var(--sb-blue-2) 100%);
  box-shadow: 0 8px 20px rgba(42, 71, 185, .42), inset 0 0 0 1px rgba(255, 255, 255, .08);
}
.sb-item--active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; border-radius: 13px 0 0 13px; background: #fff; }
.sb-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 22px; height: 22px; }
.sb-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-chev { display: inline-flex; flex-shrink: 0; margin-right: -2px; opacity: .95; }

.sb-badge { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px;
  background: var(--sb-blue); color: #fff; font-size: 11.5px; font-weight: 750; font-variant-numeric: tabular-nums; box-shadow: 0 2px 6px rgba(49, 87, 220, .45); }
.sb-item--active .sb-badge { background: rgba(255, 255, 255, .22); box-shadow: none; }
.sb-tag { flex-shrink: 0; padding: 3px 10px; border-radius: 7px; background: rgba(122, 134, 230, .30); color: #dfe4ff; font-size: 11px; font-weight: 600; letter-spacing: .01em; }

/* Footer */
.sb-foot { display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 16px; background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015)); border-top: 1px solid rgba(255, 255, 255, .08); border-radius: 22px 22px 0 0; }
.sb-root--floating .sb-foot { border-radius: 22px 22px 26px 26px; }
.sb-reg { display: flex; align-items: center; gap: 12px; min-height: 54px; padding: 8px 14px; border-radius: 16px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .05); }
.sb-reg__icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; color: #fff;
  background: radial-gradient(circle at 35% 30%, #22358c, #121f63); box-shadow: inset 0 0 0 1.5px rgba(150, 175, 255, .35); }
.sb-reg__text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.sb-reg__label { font-size: 10.5px; font-weight: 500; color: #9db0f0; }
.sb-reg__value { font-size: 14px; font-weight: 750; letter-spacing: -.01em; color: #fff; white-space: nowrap; }

.sb-toggle { display: flex; align-items: center; justify-content: flex-start; gap: 14px; width: 100%; box-sizing: border-box; min-height: 46px; padding: 0 18px; border: 0; border-radius: 16px;
  background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .05); color: #fff; cursor: pointer;
  font: inherit; font-size: 13.5px; font-weight: 550; transition: background .15s ease; }
.sb-toggle svg { color: #8fb0ff; flex-shrink: 0; }
.sb-toggle:hover { background: rgba(255, 255, 255, .12); }
.sb-toggle:focus-visible { outline: 2px solid #8fb0ff; outline-offset: 2px; }

/* Collapsed state (76px) */
.sb-root--collapsed .sb-nav { padding: 2px 15px 12px; }
.sb-root--collapsed .sb-item { justify-content: center; width: 46px; min-height: 44px; margin: 0 auto 6px; padding: 0; border-radius: 14px; }
.sb-root--collapsed .sb-item--active::before { display: none; }
.sb-root--collapsed .sb-item--stacked { flex-direction: column; gap: 4px; height: auto; padding: 9px 0 6px; }
.sb-badge--float { position: absolute; top: -4px; right: -5px; min-width: 18px; height: 18px; padding: 0 5px; font-size: 10.5px; border: 2px solid #0f1b5a; box-sizing: content-box; }
.sb-tag--stack { padding: 1px 6px; border-radius: 6px; font-size: 9.5px; }
.sb-root--collapsed .sb-foot { align-items: center; padding: 14px 15px 16px; }
.sb-root--collapsed .sb-reg { justify-content: center; width: 46px; min-height: 46px; padding: 0; border-radius: 14px; }
.sb-root--collapsed .sb-toggle { justify-content: center; width: 46px; min-height: 46px; padding: 0; border-radius: 14px; }

@media print { .sb-root { display: none !important; } }
@media (prefers-reduced-motion: reduce) { .sb-root, .sb-item, .sb-toggle { transition: none; } }
`;

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
      style={{ width, minWidth: width }}
    >
      <style>{css}</style>

      {/* Brand */}
      <div className="sb-brand">
        <img className={`sb-logo${LOGO_HAS_TEXT ? ' sb-logo--wide' : ''}`} src={dashenlogo} alt="Dashen Bank" />
        {!collapsed && !LOGO_HAS_TEXT && (
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
          <DoubleChevron dir={collapsed ? 'right' : 'left'} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
