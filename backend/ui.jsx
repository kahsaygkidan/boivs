/* ==========================================================================
   ui.jsx — shared design tokens and small UI primitives for the BO register
   (Records list + Record detail). Import what you need:
     import { T, Btn, Card, Banner, Avatar, Pill, Tabs, GlobalStyle, I, fmtWhen } from '../components/ui.jsx';
   ========================================================================== */

/* ---------- Design tokens ---------- */
export const T = {
  bg: '#f5f7fb',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e6e9f0',
  borderStrong: '#d3d8e4',
  text: '#0f172a',
  textSoft: '#334155',
  textMuted: '#64748b',
  textFaint: '#94a3b8',

  primary: '#283375',
  primaryHover: '#1f2859',
  primarySoft: 'rgba(40,51,117,.07)',
  primaryRing: 'rgba(40,51,117,.18)',

  success: '#047857',
  successBg: '#ecfdf5',
  successBorder: 'rgba(4,120,87,.22)',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  dangerBorder: 'rgba(185,28,28,.24)',
  warn: '#b45309',
  warnBg: '#fffbeb',
  warnBorder: 'rgba(180,83,9,.24)',
  info: '#1d4ed8',
  infoBg: '#eff6ff',
  infoBorder: 'rgba(29,78,216,.2)',

  radius: 14,
  radiusMd: 10,
  radiusSm: 8,
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.05)',
  shadowMd: '0 6px 18px rgba(15,23,42,.07), 0 2px 4px rgba(15,23,42,.04)',
  shadowLg: '0 24px 60px rgba(15,23,42,.28)',

  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* ---------- Formatting helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-31" -> "31 Oct 2026"; "2026-10-31T09:15:42" -> "31 Oct 2026 · 09:15". Empty -> null. */
export function fmtWhen(v) {
  if (!v) return null;
  const s = String(v);
  const [date, time] = s.split('T');
  const [y, m, d] = date.split('-');
  if (!y || !m || !d || !MONTHS[Number(m) - 1]) return s;
  const day = `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  return time ? `${day} · ${time.slice(0, 5)}` : day;
}

/** "FAYDA_ID" -> "Fayda ID", "DIRECT" -> "Direct" */
export function humanize(v) {
  if (!v) return '';
  return String(v)
    .toLowerCase()
    .split('_')
    .map((w) => (w === 'id' || w === 'tin' || w === 'pep' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

function hueOf(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/* ---------- Global CSS (hover / focus / animation) — render once per page ---------- */
export function GlobalStyle() {
  return (
    <style>{`
      @keyframes ui-spin { to { transform: rotate(360deg); } }
      @keyframes ui-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes ui-pop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
      @keyframes ui-slide { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes ui-shimmer { 0% { background-position: -200px 0 } 100% { background-position: calc(200px + 100%) 0 } }
      @keyframes ui-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(180,83,9,.35) } 50% { box-shadow: 0 0 0 6px rgba(180,83,9,0) } }
      .ui-btn { transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease, transform .05s ease; }
      .ui-btn:not(:disabled):hover { filter: brightness(.96); }
      .ui-btn:not(:disabled):active { transform: translateY(1px); }
      .ui-btn:focus-visible, .ui-tab:focus-visible, .ui-chip:focus-visible, .ui-stat:focus-visible {
        outline: 2px solid ${T.primary}; outline-offset: 2px;
      }
      .ui-row { cursor: pointer; transition: background .12s ease; }
      .ui-row:hover td { background: ${T.surfaceAlt}; }
      .ui-row:focus-visible { outline: 2px solid ${T.primary}; outline-offset: -2px; }
      .ui-tab { transition: color .15s ease, border-color .15s ease, background .15s ease; }
      .ui-tab:hover { color: ${T.text}; }
      .ui-chip { transition: background .15s ease, border-color .15s ease, color .15s ease; }
      .ui-chip:hover { border-color: ${T.borderStrong}; background: ${T.surfaceAlt}; }
      .ui-stat { transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
      .ui-stat:hover { border-color: ${T.borderStrong}; box-shadow: ${T.shadowMd}; transform: translateY(-1px); }
      .ui-skeleton { background: linear-gradient(90deg, #eef1f6 0%, #f8fafc 50%, #eef1f6 100%); background-size: 200px 100%; background-repeat: no-repeat; animation: ui-shimmer 1.2s infinite linear; border-radius: 6px; }
      @media (prefers-reduced-motion: reduce) { * { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
    `}</style>
  );
}

/* ---------- Icons ---------- */
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const I = {
  back: <svg {...base} width="14" height="14"><path d="M15 18l-6-6 6-6" /></svg>,
  plus: <svg {...base}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  search: <svg {...base}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  approve: <svg {...base}><polyline points="20 6 9 17 4 12" /></svg>,
  reject: <svg {...base}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  cease: <svg {...base}><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
  edit: <svg {...base}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  send: <svg {...base}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  trash: <svg {...base}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" /></svg>,
  download: <svg {...base}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  eye: <svg {...base}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  upload: <svg {...base}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  file: <svg {...base}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  building: <svg {...base}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></svg>,
  shield: <svg {...base}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  clock: <svg {...base}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  alert: <svg {...base}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  info: <svg {...base} width="13" height="13"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>,
  close: <svg {...base}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  quote: <svg {...base} width="14" height="14"><path d="M7 7h4v4H7a2 2 0 0 1-2-2V7M15 7h4v4h-4a2 2 0 0 1-2-2V7" /></svg>,
  refresh: <svg {...base}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>,
  chevronLeft: <svg {...base} width="14" height="14"><polyline points="15 18 9 12 15 6" /></svg>,
  chevronRight: <svg {...base} width="14" height="14"><polyline points="9 18 15 12 9 6" /></svg>,
  inbox: <svg {...base} width="36" height="36" strokeWidth="1.4"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>,
};

/* ---------- Button ---------- */
export function Btn({ variant = 'primary', size = 'md', icon, children, style, ...props }) {
  const sizes = {
    sm: { height: 30, padding: '0 11px', fontSize: 12, gap: 5 },
    md: { height: 36, padding: '0 14px', fontSize: 13, gap: 6 },
    lg: { height: 42, padding: '0 18px', fontSize: 14, gap: 7 },
  };
  const variants = {
    primary: { background: T.primary, color: '#fff', border: '1px solid transparent', boxShadow: '0 1px 2px rgba(40,51,117,.25)' },
    secondary: { background: '#fff', color: T.text, border: `1px solid ${T.border}`, boxShadow: T.shadow },
    success: { background: T.success, color: '#fff', border: '1px solid transparent' },
    danger: { background: T.danger, color: '#fff', border: '1px solid transparent' },
    dangerOutline: { background: '#fff', color: T.danger, border: `1px solid ${T.dangerBorder}` },
    ghost: { background: 'transparent', color: T.textMuted, border: `1px solid ${T.border}` },
  };
  return (
    <button
      type="button"
      className="ui-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', fontWeight: 600, borderRadius: T.radiusSm, whiteSpace: 'nowrap',
        cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.5 : 1,
        ...sizes[size], ...variants[variant], ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ title, subtitle, action, children, style, bodyStyle, flush }) {
  return (
    <section style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius,
      boxShadow: T.shadow, marginBottom: 16, overflow: 'hidden', ...style,
    }}>
      {(title || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '14px 20px', borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 650, color: T.text, letterSpacing: '-.005em' }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      <div style={flush ? { ...bodyStyle } : { padding: 20, ...bodyStyle }}>{children}</div>
    </section>
  );
}

/* ---------- Banner ---------- */
export function Banner({ tone = 'error', children, action, style }) {
  const map = {
    error: { bg: T.dangerBg, fg: T.danger, border: T.dangerBorder },
    warn: { bg: T.warnBg, fg: T.warn, border: T.warnBorder },
    success: { bg: T.successBg, fg: T.success, border: T.successBorder },
    info: { bg: T.infoBg, fg: T.info, border: T.infoBorder },
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', marginBottom: 14,
      background: map.bg, color: map.fg, border: `1px solid ${map.border}`, borderRadius: T.radiusMd,
      fontSize: 13, lineHeight: 1.5, fontFamily: T.font, ...style,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>{I.alert}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action}
    </div>
  );
}

/* ---------- Avatar (initials on a name-derived soft colour) ---------- */
export function Avatar({ name, size = 36 }) {
  const h = hueOf(name);
  return (
    <span aria-hidden="true" style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      width: size, height: size, borderRadius: size / 3,
      background: `hsl(${h} 70% 94%)`, color: `hsl(${h} 45% 30%)`,
      fontSize: Math.round(size * 0.36), fontWeight: 700, letterSpacing: '.02em',
    }}>
      {initialsOf(name)}
    </span>
  );
}

/* ---------- Pill ---------- */
export function Pill({ tone = 'neutral', icon, children, style }) {
  const map = {
    neutral: { bg: '#f1f5f9', fg: T.textSoft, border: T.border },
    primary: { bg: T.primarySoft, fg: T.primary, border: T.primaryRing },
    success: { bg: T.successBg, fg: T.success, border: T.successBorder },
    danger: { bg: T.dangerBg, fg: T.danger, border: T.dangerBorder },
    warn: { bg: T.warnBg, fg: T.warn, border: T.warnBorder },
    info: { bg: T.infoBg, fg: T.info, border: T.infoBorder },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px',
      borderRadius: 999, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
      background: map.bg, color: map.fg, border: `1px solid ${map.border}`, ...style,
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </span>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, active, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 16, ...style }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            className="ui-tab"
            onClick={() => onChange(t.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', marginBottom: -1,
              background: 'transparent', border: 'none', borderBottom: `2px solid ${on ? T.primary : 'transparent'}`,
              color: on ? T.primary : T.textMuted, fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 650 : 550, cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{
                minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: on ? T.primarySoft : '#eef1f6', color: on ? T.primary : T.textMuted,
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Skeleton block ---------- */
export function Skeleton({ width = '100%', height = 14, style }) {
  return <span className="ui-skeleton" style={{ display: 'block', width, height, ...style }} />;
}

/* ---------- Thin progress bar (ownership %) ---------- */
export function Bar({ value, tone = 'primary', width = 72 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color = tone === 'danger' ? T.danger : tone === 'success' ? T.success : T.primary;
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', width, height: 6, borderRadius: 999, background: '#e8ecf3', overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
    </span>
  );
}
