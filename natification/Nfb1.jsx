import { useCallback, useEffect, useRef, useState } from 'react';
import { getQueue, searchBoRecords } from '../api/bovsApi.js';
import { BellIcon } from './Icons.jsx';

/* ==========================================================================
   Design tokens
   ========================================================================== */
const T = {
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  border: '#e5e8ef',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  primary: '#283375',
  primarySoft: 'rgba(40,51,117,.08)',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  radius: 12,
  radiusSm: 8,
  shadowLg: '0 12px 32px rgba(15,23,42,.14), 0 4px 8px rgba(15,23,42,.06)',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/* ==========================================================================
   Constants & persistence
   ========================================================================== */
const POLL_MS = 45_000;

const seenKey = (username) => `bovs.notifications.makerSeen.${username || 'anon'}`;

function readSeen(username) {
  try {
    const raw = window.localStorage.getItem(seenKey(username));
    if (!raw) return { approved: 0, rejected: 0 };
    // Legacy numeric format
    const n = Number(raw);
    if (Number.isFinite(n)) return { approved: n, rejected: 0 };
    // Object format
    const obj = JSON.parse(raw);
    return {
      approved: Number(obj?.approved) || 0,
      rejected: Number(obj?.rejected) || 0,
    };
  } catch {
    return { approved: 0, rejected: 0 };
  }
}

function writeSeen(username, seen) {
  try {
    window.localStorage.setItem(seenKey(username), JSON.stringify(seen));
  } catch {
    // Storage unavailable — badge won't persist across reloads.
  }
}

/* ==========================================================================
   NotificationBell
   ========================================================================== */
export default function NotificationBell({ roles, username, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [rejectedTotal, setRejectedTotal] = useState(0);
  const [seen, setSeen] = useState(() => readSeen(username));
  const [hover, setHover] = useState(false);

  /* Snapshot of items cleared on open — used for the brief highlight row */
  const [justCleared, setJustCleared] = useState(null); // { approved: n, rejected: n } | null

  const rootRef = useRef(null);
  const clearTimerRef = useRef(null);

  const isChecker = !!roles?.isChecker;
  const isMaker = !!roles?.isMaker;

  const refresh = useCallback(() => {
    if (isChecker) {
      getQueue({ size: 1 })
        .then((res) => setPendingCount(res.totalElements ?? (res.content || []).length))
        .catch(() => {});
    }
    if (isMaker && username) {
      Promise.all([
        searchBoRecords({ createdBy: username, status: 'VERIFIED', size: 1 }),
        searchBoRecords({ createdBy: username, status: 'REJECTED', size: 1 }),
      ])
        .then(([verified, rejected]) => {
          setApprovedTotal(verified.totalElements ?? (verified.content || []).length);
          setRejectedTotal(rejected.totalElements ?? (rejected.content || []).length);
        })
        .catch(() => {});
    }
  }, [isChecker, isMaker, username]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    setSeen(readSeen(username));
  }, [username]);

  /* Auto-mark-as-seen when the panel opens */
  useEffect(() => {
    if (!open) return;
    if (!isMaker) return;

    const approvedUnseen = Math.max(0, approvedTotal - seen.approved);
    const rejectedUnseen = Math.max(0, rejectedTotal - seen.rejected);
    if (approvedUnseen === 0 && rejectedUnseen === 0) return;

    // Show a brief "just cleared" summary row
    setJustCleared({ approved: approvedUnseen, rejected: rejectedUnseen });

    // Persist the new seen counts
    const next = { approved: approvedTotal, rejected: rejectedTotal };
    setSeen(next);
    writeSeen(username, next);

    // Auto-hide the summary after 5s
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setJustCleared(null);
    }, 5000);

    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, approvedTotal, rejectedTotal, isMaker]);

  /* Outside click */
  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  /* Escape key to close + clear the highlight */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const approvedUnseen = Math.max(0, approvedTotal - seen.approved);
  const rejectedUnseen = Math.max(0, rejectedTotal - seen.rejected);
  const decidedUnseen = approvedUnseen + rejectedUnseen;
  const totalBadge = (isChecker ? pendingCount : 0) + decidedUnseen;
  const hasAnyRole = isChecker || isMaker;

  const goToQueue = () => {
    setOpen(false);
    onNavigate('queue');
  };

  const goToRecords = () => {
    setOpen(false);
    onNavigate('records');
  };

  const closePanel = () => {
    setOpen(false);
    setJustCleared(null);
  };

  return (
    <div style={{ position: 'relative', fontFamily: T.font }} ref={rootRef}>
      {/* ---------- Bell button ---------- */}
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : setOpen(true))}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: T.radiusSm,
          border: `1px solid ${open ? T.primary + '55' : 'transparent'}`,
          background: open ? T.primarySoft : hover ? T.surfaceAlt : 'transparent',
          color: open ? T.primary : hover ? T.text : T.textMuted,
          cursor: 'pointer',
          transition: 'background .15s ease, color .15s ease, border-color .15s ease',
        }}
      >
        <BellIcon />

        {totalBadge > 0 && (
          <span
            aria-label={`${totalBadge} unread notification${totalBadge === 1 ? '' : 's'}`}
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: T.danger,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: '16px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px #fff',
              animation: 'pulseBadge 2s ease-in-out infinite',
            }}
          >
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
        <style>{`
          @keyframes pulseBadge {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
        `}</style>
      </button>

      {/* ---------- Dropdown panel ---------- */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 360,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            boxShadow: T.shadowLg,
            zIndex: 50,
            overflow: 'hidden',
            animation: 'panelIn .15s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '-.005em' }}>
              Notifications
            </span>
            {justCleared && (justCleared.approved + justCleared.rejected) > 0 ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: T.successSoft,
                  color: T.success,
                  letterSpacing: '.03em',
                  animation: 'fadeTick .3s ease',
                }}
              >
                ✓ Cleared
              </span>
            ) : (
              totalBadge > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: T.danger,
                    color: '#fff',
                    letterSpacing: '.03em',
                  }}
                >
                  {totalBadge > 99 ? '99+' : totalBadge} new
                </span>
              )
            )}
          </div>

          {/* Body */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {!hasAnyRole && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: T.textMuted, fontSize: 12.5 }}>
                Nothing to show for your role.
              </div>
            )}

            {/* ---------- Just-cleared summary (auto-dismiss) ---------- */}
            {justCleared && (justCleared.approved + justCleared.rejected) > 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  background: T.successSoft,
                  borderBottom: `1px solid ${T.border}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  animation: 'slideIn .2s ease',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: '#fff',
                    color: T.success,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.55, flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Marked as seen</div>
                  <div style={{ color: T.textMuted }}>
                    {justCleared.approved > 0 && (
                      <span>
                        {justCleared.approved} approved
                      </span>
                    )}
                    {justCleared.approved > 0 && justCleared.rejected > 0 && ' · '}
                    {justCleared.rejected > 0 && (
                      <span>{justCleared.rejected} rejected</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Checker: pending queue ---------- */}
            {isChecker && (
              pendingCount > 0 ? (
                <NotifItem
                  tone="primary"
                  onClick={goToQueue}
                  icon="pending"
                  title={<><strong>{pendingCount}</strong> record{pendingCount === 1 ? '' : 's'} awaiting your verification</>}
                  cta="Open approval queue"
                />
              ) : (
                <NotifEmpty tone="primary" text="No records pending verification" />
              )
            )}

            {/* ---------- Maker: approved ---------- */}
            {isMaker && (
              approvedUnseen > 0 ? (
                <NotifItem
                  tone="success"
                  onClick={goToRecords}
                  icon="approved"
                  title={
                    <>
                      <strong>{approvedUnseen}</strong> record{approvedUnseen === 1 ? '' : 's'} of yours{' '}
                      {approvedUnseen === 1 ? 'was' : 'were'}{' '}
                      <BadgeText tone="success">approved</BadgeText>
                    </>
                  }
                  cta="View approved records"
                />
              ) : (
                <NotifEmpty tone="success" text="No new approved records" />
              )
            )}

            {/* ---------- Maker: rejected ---------- */}
            {isMaker && (
              rejectedUnseen > 0 ? (
                <NotifItem
                  tone="danger"
                  onClick={goToRecords}
                  icon="rejected"
                  title={
                    <>
                      <strong>{rejectedUnseen}</strong> record{rejectedUnseen === 1 ? '' : 's'} of yours{' '}
                      {rejectedUnseen === 1 ? 'was' : 'were'}{' '}
                      <BadgeText tone="danger">rejected</BadgeText>
                    </>
                  }
                  cta="View rejected records"
                />
              ) : (
                <NotifEmpty tone="danger" text="No new rejected records" />
              )
            )}
          </div>

          <style>{`
            @keyframes panelIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeTick {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Inline status badge text
   ========================================================================== */
function BadgeText({ tone = 'success', children }) {
  const tones = {
    success: { bg: T.successSoft, fg: T.success },
    danger: { bg: T.dangerSoft, fg: T.danger },
  }[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 6px',
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 700,
        background: tones.bg,
        color: tones.fg,
        letterSpacing: '.02em',
        lineHeight: '18px',
        textTransform: 'lowercase',
      }}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   Notification item
   ========================================================================== */
function NotifItem({ tone = 'primary', onClick, icon, title, cta }) {
  const [hover, setHover] = useState(false);
  const tones = {
    primary: { bg: T.primarySoft, fg: T.primary },
    success: { bg: T.successSoft, fg: T.success },
    danger: { bg: T.dangerSoft, fg: T.danger },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: hover ? T.surfaceAlt : 'transparent',
        transition: 'background .12s ease',
        boxSizing: 'border-box',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 8,
          background: tones.bg,
          color: tones.fg,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon === 'approved' && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {icon === 'rejected' && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
        {icon === 'pending' && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 14" />
          </svg>
        )}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{title}</div>
        <div
          style={{
            fontSize: 11.5,
            color: hover ? T.primary : T.textFaint,
            marginTop: 4,
            fontWeight: 600,
            transition: 'color .12s ease',
          }}
        >
          {cta} →
        </div>
      </div>
    </button>
  );
}

/* ==========================================================================
   Empty notification row
   ========================================================================== */
function NotifEmpty({ tone = 'primary', text }) {
  const tones = {
    primary: { bg: T.primarySoft, fg: T.primary },
    success: { bg: T.successSoft, fg: T.success },
    danger: { bg: T.dangerSoft, fg: T.danger },
  }[tone];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
        opacity: 0.65,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 8,
          background: tones.bg,
          color: tones.fg,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tones.fg, opacity: 0.6 }} />
      </span>
      <span style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}
