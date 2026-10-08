import { useCallback, useEffect, useRef, useState } from 'react'
import { getQueue, searchBoRecords } from '../api/bovsApi.js'
import { BellIcon } from './Icons.jsx'

const POLL_MS = 45_000

// A maker's "approved/rejected" notification has no server-side read/unread state,
// so we track how many of the maker's own decided records they've already seen in
// localStorage, per user, and only badge the ones decided since then. Opening the
// Records page from the bell marks the current total as seen.
const seenKey = (username) => `bovs.notifications.makerSeen.${username || 'anon'}`

function readSeenCount(username) {
  try {
    const raw = window.localStorage.getItem(seenKey(username))
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeSeenCount(username, count) {
  try {
    window.localStorage.setItem(seenKey(username), String(count))
  } catch {
    // Storage unavailable (private mode/quota) — badge just won't persist across reloads.
  }
}

export default function NotificationBell({ roles, username, onNavigate }) {
  const [open, setOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [decidedTotal, setDecidedTotal] = useState(0)
  const [decidedSeen, setDecidedSeen] = useState(() => readSeenCount(username))
  const rootRef = useRef(null)

  const isChecker = !!roles?.isChecker
  const isMaker = !!roles?.isMaker

  const refresh = useCallback(() => {
    if (isChecker) {
      getQueue({ size: 1 })
        .then((res) => setPendingCount(res.totalElements ?? (res.content || []).length))
        .catch(() => {})
    }
    if (isMaker && username) {
      Promise.all([
        searchBoRecords({ createdBy: username, status: 'VERIFIED', size: 1 }),
        searchBoRecords({ createdBy: username, status: 'REJECTED', size: 1 }),
      ])
        .then(([verified, rejected]) => {
          const total =
            (verified.totalElements ?? (verified.content || []).length) +
            (rejected.totalElements ?? (rejected.content || []).length)
          setDecidedTotal(total)
        })
        .catch(() => {})
    }
  }, [isChecker, isMaker, username])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    setDecidedSeen(readSeenCount(username))
  }, [username])

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return undefined
    const onClickAway = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const decidedUnseen = Math.max(0, decidedTotal - decidedSeen)
  const totalBadge = (isChecker ? pendingCount : 0) + (isMaker ? decidedUnseen : 0)
  const hasAnyRole = isChecker || isMaker

  const goToQueue = () => {
    setOpen(false)
    onNavigate('queue')
  }

  const goToRecords = () => {
    setOpen(false)
    onNavigate('records')
    // Mark the current decided total as seen so the badge clears until new decisions land.
    setDecidedSeen(decidedTotal)
    writeSeenCount(username, decidedTotal)
  }

  return (
    <div className="notification-bell" ref={rootRef}>
      <button className="icon-btn" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <BellIcon />
        {totalBadge > 0 && <span className="notification-badge">{totalBadge > 99 ? '99+' : totalBadge}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-title">Notifications</div>

          {!hasAnyRole && <div className="notification-empty">Nothing to show for your role.</div>}

          {isChecker && (
            pendingCount > 0 ? (
              <button className="notification-item" onClick={goToQueue}>
                <span className="notification-dot notification-dot--pending"></span>
                <span>
                  <strong>{pendingCount}</strong> record{pendingCount === 1 ? '' : 's'} awaiting your verification
                </span>
              </button>
            ) : (
              <div className="notification-item notification-item--muted">
                <span className="notification-dot notification-dot--pending"></span>
                <span>No records pending verification</span>
              </div>
            )
          )}

          {isMaker && (
            decidedUnseen > 0 ? (
              <button className="notification-item" onClick={goToRecords}>
                <span className="notification-dot notification-dot--decided"></span>
                <span>
                  <strong>{decidedUnseen}</strong> of your record{decidedUnseen === 1 ? '' : 's'}{' '}
                  {decidedUnseen === 1 ? 'was' : 'were'} approved or rejected
                </span>
              </button>
            ) : (
              <div className="notification-item notification-item--muted">
                <span className="notification-dot notification-dot--decided"></span>
                <span>No new decisions on your records</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}