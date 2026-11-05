import React from 'react';

/* ==========================================================================
   Shared UI system
   Keep this file as the single source of truth for reusable BOIVS UI elements.
   Existing exports and component APIs are preserved.
   ========================================================================== */

/* ---------- Design tokens ---------- */
export const T = {
  bg: '#f4f7fc',
  surface: '#ffffff',
  surfaceAlt: '#f8faff',
  border: '#e5eaf2',
  borderStrong: '#cfd8e6',
  text: '#14213d',
  textSoft: '#34445f',
  textMuted: '#66758d',
  textFaint: '#8997aa',

  primary: '#263b8f',
  primaryHover: '#1d2e73',
  primaryActive: '#17265f',
  primarySoft: '#eef2ff',
  primaryRing: 'rgba(38,59,143,.18)',
  accent: '#3b63e6',
  accentSoft: '#edf3ff',

  success: '#087a55',
  successBg: '#eaf8f1',
  successBorder: 'rgba(8,122,85,.20)',
  danger: '#b42332',
  dangerBg: '#fff0f1',
  dangerBorder: 'rgba(180,35,50,.20)',
  warn: '#a45b08',
  warnBg: '#fff7e8',
  warnBorder: 'rgba(164,91,8,.22)',
  info: '#2457bd',
  infoBg: '#eef5ff',
  infoBorder: 'rgba(36,87,189,.20)',

  radius: 14,
  radiusMd: 10,
  radiusSm: 8,
  radiusLg: 18,
  shadow: '0 1px 2px rgba(16,32,64,.04), 0 2px 6px rgba(16,32,64,.035)',
  shadowMd: '0 8px 22px rgba(20,39,78,.075), 0 2px 5px rgba(20,39,78,.035)',
  shadowLg: '0 22px 55px rgba(15,31,67,.18)',

  font: "'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
};

/* ---------- Formatting helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACRONYMS = new Set(['id', 'tin', 'pep', 'ubo', 'boivs', 'api', 'kyc', 'aml']);

export function fmtWhen(value) {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return raw;

  const [, year, month, day, hour, minute] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || Number(day) < 1 || Number(day) > 31) return raw;

  const dateLabel = `${Number(day)} ${monthName} ${year}`;
  return hour !== undefined ? `${dateLabel} · ${hour}:${minute}` : dateLabel;
}

export function humanize(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return `${parts[0].charAt(0)}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''}`.toUpperCase();
}

function hueOf(name) {
  let hash = 0;
  const value = String(name || 'User');
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 360;
  return hash;
}

const toneMap = {
  neutral: { bg: '#f2f5f9', fg: '#475569', border: '#e2e8f0' },
  primary: { bg: T.primarySoft, fg: T.primary, border: T.primaryRing },
  success: { bg: T.successBg, fg: T.success, border: T.successBorder },
  danger: { bg: T.dangerBg, fg: T.danger, border: T.dangerBorder },
  warn: { bg: T.warnBg, fg: T.warn, border: T.warnBorder },
  info: { bg: T.infoBg, fg: T.info, border: T.infoBorder },
};

/* ---------- Global CSS: render once near the application root ---------- */
export function GlobalStyle() {
  return (
    <style>{`
      :root {
        color-scheme: light;
        --ui-primary: ${T.primary};
        --ui-border: ${T.border};
        --ui-text: ${T.text};
        --ui-muted: ${T.textMuted};
      }
      @keyframes ui-spin { to { transform: rotate(360deg); } }
      @keyframes ui-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ui-pop { from { opacity: 0; transform: scale(.975); } to { opacity: 1; transform: scale(1); } }
      @keyframes ui-slide { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ui-shimmer { 0% { background-position: -240px 0; } 100% { background-position: calc(240px + 100%) 0; } }
      @keyframes ui-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(164,91,8,.25); } 50% { box-shadow: 0 0 0 5px rgba(164,91,8,0); } }

      .ui-btn {
        transition: background .16s ease, border-color .16s ease, color .16s ease,
          box-shadow .16s ease, transform .12s ease, filter .16s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .ui-btn:not(:disabled):hover { filter: brightness(.97); }
      .ui-btn:not(:disabled):active { transform: translateY(1px); }
      .ui-btn:focus-visible, .ui-tab:focus-visible, .ui-chip:focus-visible,
      .ui-stat:focus-visible, .ui-icon-btn:focus-visible {
        outline: 3px solid ${T.primaryRing};
        outline-offset: 2px;
      }
      .ui-btn:disabled { cursor: not-allowed !important; opacity: .52; box-shadow: none !important; }
      .ui-row { cursor: pointer; transition: background .14s ease; }
      .ui-row:hover td { background: ${T.surfaceAlt}; }
      .ui-row:focus-visible { outline: 2px solid ${T.primary}; outline-offset: -2px; }
      .ui-tab { transition: color .16s ease, border-color .16s ease, background .16s ease; }
      .ui-tab:hover { color: ${T.text}; }
      .ui-chip { transition: background .16s ease, border-color .16s ease, color .16s ease; }
      .ui-chip:hover { border-color: ${T.borderStrong}; background: ${T.surfaceAlt}; }
      .ui-stat { transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease; }
      .ui-stat:hover { border-color: ${T.borderStrong}; box-shadow: ${T.shadowMd}; transform: translateY(-2px); }
      .ui-skeleton {
        background: linear-gradient(90deg, #edf1f7 0%, #f8faff 50%, #edf1f7 100%);
        background-size: 240px 100%; background-repeat: no-repeat;
        animation: ui-shimmer 1.35s infinite linear; border-radius: 7px;
      }
      .ui-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
      .ui-scrollbar::-webkit-scrollbar { width: 7px; height: 7px; }
      .ui-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
      }
    `}</style>
  );
}

/* ---------- Icons ---------- */
const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round',
  strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
};

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
export function Btn({
  variant = 'primary', size = 'md', icon, children, style,
  type = 'button', className = '', ...props
}) {
  const sizes = {
    xs: { minHeight: 28, padding: '0 9px', fontSize: 11.5, gap: 5 },
    sm: { minHeight: 32, padding: '0 11px', fontSize: 12, gap: 6 },
    md: { minHeight: 38, padding: '0 15px', fontSize: 13, gap: 7 },
    lg: { minHeight: 44, padding: '0 19px', fontSize: 14, gap: 8 },
  };
  const variants = {
    primary: { background: T.primary, color: '#fff', border: '1px solid transparent', boxShadow: '0 2px 5px rgba(38,59,143,.20)' },
    secondary: { background: '#fff', color: T.textSoft, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadow },
    success: { background: T.success, color: '#fff', border: '1px solid transparent' },
    danger: { background: T.danger, color: '#fff', border: '1px solid transparent' },
    dangerOutline: { background: '#fff', color: T.danger, border: `1px solid ${T.dangerBorder}` },
    ghost: { background: 'transparent', color: T.textMuted, border: `1px solid transparent` },
    subtle: { background: T.primarySoft, color: T.primary, border: `1px solid transparent` },
  };
  const sizeStyle = sizes[size] || sizes.md;
  const variantStyle = variants[variant] || variants.primary;

  return (
    <button
      {...props}
      type={type}
      className={`ui-btn ${className}`.trim()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, fontFamily: T.font, fontWeight: 650, lineHeight: 1.2,
        borderRadius: T.radiusSm, whiteSpace: 'nowrap', cursor: 'pointer',
        verticalAlign: 'middle', ...sizeStyle, ...variantStyle, ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ title, subtitle, action, children, style, bodyStyle, flush = false, className = '', ...sectionProps }) {
  return (
    <section
      {...sectionProps}
      className={className}
      style={{
        minWidth: 0, background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.radius, boxShadow: T.shadow, marginBottom: 16,
        overflow: 'hidden', ...style,
      }}
    >
      {(title || subtitle || action) && (
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, padding: '15px 20px',
          borderBottom: `1px solid ${T.border}`, background: '#fff',
        }}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 style={{ margin: 0, fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: T.text, letterSpacing: '-.015em' }}>{title}</h3>}
            {subtitle && <div style={{ fontSize: 12, lineHeight: 1.5, color: T.textMuted, marginTop: 3 }}>{subtitle}</div>}
          </div>
          {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{action}</div>}
        </header>
      )}
      <div style={{ minWidth: 0, ...(flush ? {} : { padding: 20 }), ...bodyStyle }}>{children}</div>
    </section>
  );
}

/* ---------- Banner ---------- */
export function Banner({ tone = 'error', children, action, style, icon, title, className = '' }) {
  const map = toneMap[tone] || toneMap.danger;
  const defaultIcon = tone === 'success' ? I.approve : tone === 'info' ? I.info : I.alert;
  return (
    <div
      role={tone === 'error' || tone === 'danger' ? 'alert' : 'status'}
      className={className}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 15px',
        marginBottom: 14, background: map.bg, color: map.fg,
        border: `1px solid ${map.border}`, borderRadius: T.radiusMd,
        fontSize: 13, lineHeight: 1.55, fontFamily: T.font, ...style,
      }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, display: 'inline-flex' }}>{icon || defaultIcon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {title && <strong style={{ display: 'block', marginBottom: 2, fontWeight: 700 }}>{title}</strong>}
        {children}
      </span>
      {action && <span style={{ flexShrink: 0 }}>{action}</span>}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 38, src, alt, style, className = '' }) {
  const hue = hueOf(name);
  const dimension = Math.max(24, Number(size) || 38);
  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'User avatar'}
        className={className}
        style={{
          display: 'inline-block', width: dimension, height: dimension,
          borderRadius: Math.round(dimension / 3), objectFit: 'cover',
          flexShrink: 0, border: `1px solid ${T.border}`, ...style,
        }}
      />
    );
  }
  return (
    <span
      aria-label={name ? `Avatar for ${name}` : 'User avatar'}
      role="img"
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, width: dimension, height: dimension,
        borderRadius: Math.round(dimension / 3),
        background: `hsl(${hue} 72% 94%)`, color: `hsl(${hue} 48% 29%)`,
        border: `1px solid hsl(${hue} 45% 87%)`,
        fontSize: Math.round(dimension * .35), fontWeight: 750,
        letterSpacing: '.015em', ...style,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------- Pill ---------- */
export function Pill({ tone = 'neutral', icon, children, style, className = '', title }) {
  const map = toneMap[tone] || toneMap.neutral;
  return (
    <span
      className={className}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 5, minHeight: 23, padding: '2px 9px',
        borderRadius: 999, fontSize: 11.5, lineHeight: 1.25,
        fontWeight: 650, letterSpacing: '.005em', whiteSpace: 'nowrap',
        background: map.bg, color: map.fg, border: `1px solid ${map.border}`,
        ...style,
      }}
    >
      {icon && <span aria-hidden="true" style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {children}
    </span>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs = [], active, onChange, style, ariaLabel = 'Sections' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex', alignItems: 'stretch', gap: 5,
        borderBottom: `1px solid ${T.border}`, marginBottom: 16,
        overflowX: 'auto', scrollbarWidth: 'none', ...style,
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={tab.panelId}
            id={tab.id}
            tabIndex={selected ? 0 : -1}
            className="ui-tab"
            onClick={() => onChange?.(tab.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '11px 14px', marginBottom: -1,
              background: selected ? T.primarySoft : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${selected ? T.primary : 'transparent'}`,
              borderRadius: '8px 8px 0 0',
              color: selected ? T.primary : T.textMuted,
              fontFamily: T.font, fontSize: 13, fontWeight: selected ? 700 : 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.count !== null && tab.count !== undefined && (
              <span style={{
                minWidth: 21, height: 20, padding: '0 6px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 999, fontSize: 10.5, fontWeight: 750,
                background: selected ? '#dfe7ff' : '#eef1f6',
                color: selected ? T.primary : T.textMuted,
              }}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Skeleton block ---------- */
export function Skeleton({ width = '100%', height = 14, style, radius = 7, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`ui-skeleton ${className}`.trim()}
      style={{ display: 'block', width, height, borderRadius: radius, ...style }}
    />
  );
}

/* ---------- Thin progress bar (ownership %) ---------- */
export function Bar({ value, tone = 'primary', width = 72, height = 6, showValue = false, className = '' }) {
  const percentage = Math.max(0, Math.min(100, Number(value) || 0));
  const color = tone === 'danger' ? T.danger : tone === 'success' ? T.success : tone === 'warn' ? '#c27a13' : T.primary;
  return (
    <span
      className={className}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-label={`Ownership ${percentage}%`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        verticalAlign: 'middle', whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        display: 'inline-block', width, height, borderRadius: 999,
        background: '#e8edf5', overflow: 'hidden', flexShrink: 0,
      }}>
        <span style={{
          display: 'block', width: `${percentage}%`, height: '100%',
          background: color, borderRadius: 999, transition: 'width .25s ease',
        }} />
      </span>
      {showValue && <span style={{ color: T.textSoft, fontSize: 11, fontWeight: 700 }}>{percentage}%</span>}
    </span>
  );
}
