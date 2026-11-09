import axios from 'axios'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import IdleWarningModal from './IdleWarningModal.jsx'
import { API_BASE_URL, AUTH_STORAGE_KEY, readSession, refreshSession, writeSession } from './sessionStore.js'

// Fallbacks only. Real values come from GET /api/config/session (bovs.session.*).
const DEFAULT_IDLE_TIMEOUT_MINUTES = 15
const DEFAULT_REFRESH_LEAD_SECONDS = 60
const WARNING_MS = 60_000
const REFRESH_RETRY_MS = 10_000
const REFRESH_MIN_DELAY_MS = 5_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll']

/** Reads the `exp` claim of a JWT in milliseconds, or null if it can't be decoded. */
function decodeJwtExpiryMs(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(decodeURIComponent(escape(window.atob(base64))))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

/**
 * Authentication is backend-mediated: credentials go to POST /api/auth/login and the
 * backend exchanges them with Keycloak. Tokens live in sessionStorage only.
 */
export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(readSession)
  const [logoutReason, setLogoutReason] = useState(null) // null | 'idle' | 'expired'
  const [warningSecondsLeft, setWarningSecondsLeft] = useState(null)
  const [sessionConfig, setSessionConfig] = useState({
    idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
    refreshLeadSeconds: DEFAULT_REFRESH_LEAD_SECONDS,
  })

  const lastActivity = useRef(Date.now())
  const warningActive = useRef(false)

  // Session config from the backend, fetched once.
  useEffect(() => {
    let cancelled = false
    axios
      .get(`${API_BASE_URL}/config/session`)
      .then(({ data }) => {
        if (cancelled || !data) return
        setSessionConfig({
          idleTimeoutMinutes: data.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES,
          refreshLeadSeconds: data.refreshLeadSeconds ?? DEFAULT_REFRESH_LEAD_SECONDS,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Single source of truth: any write to the session (login, refresh, logout, forced
  // expiry from client.js) fires this event, so React state can never go stale.
  useEffect(() => {
    const onChanged = () => setSessionState(readSession())
    const onExpired = () => setLogoutReason('expired')
    window.addEventListener('bovs:session-changed', onChanged)
    window.addEventListener('bovs:session-expired', onExpired)
    return () => {
      window.removeEventListener('bovs:session-changed', onChanged)
      window.removeEventListener('bovs:session-expired', onExpired)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, { username, password })
    setLogoutReason(null)
    writeSession(res.data)
    return res.data
  }, [])

  const logout = useCallback(async (reason = 'user') => {
    const refreshToken = readSession()?.refreshToken
    setLogoutReason(reason === 'user' ? null : reason)
    writeSession(null) // clear locally first so the UI reacts immediately
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken })
      } catch {
        // Best-effort server-side revocation.
      }
    }
  }, [])

  const refresh = useCallback(() => refreshSession(), [])

  // --- Proactive token refresh -------------------------------------------
  useEffect(() => {
    if (!session?.accessToken) return undefined
    const expiryMs = decodeJwtExpiryMs(session.accessToken)
    if (!expiryMs) return undefined

    const leadMs = sessionConfig.refreshLeadSeconds * 1_000
    let cancelled = false
    let timer = null

    const run = async () => {
      if (cancelled) return
      try {
        await refreshSession() // success stores a new token, which re-runs this effect
      } catch {
        if (cancelled || !readSession()) return // store already ended the session
        if (Date.now() >= expiryMs) logout('expired')
        else timer = window.setTimeout(run, REFRESH_RETRY_MS) // transient error: retry
      }
    }

    // Cap the lead at half the remaining life so a short-lived token can never
    // produce a refresh loop.
    const remaining = expiryMs - Date.now()
    const lead = Math.min(leadMs, remaining * 0.5)
    timer = window.setTimeout(run, Math.max(remaining - lead, REFRESH_MIN_DELAY_MS))

    // Background tabs throttle timers; catch up when the tab is visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= expiryMs - lead) {
        window.clearTimeout(timer)
        run()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session?.accessToken, sessionConfig.refreshLeadSeconds, logout])

  // --- Idle logout with warning ------------------------------------------
  // Proactive refreshes keep the Keycloak SSO session alive, so this client-side timer is
  // what actually enforces inactivity. It compares timestamps once per second instead of
  // using one long setTimeout, so laptop sleep or tab throttling can't delay the logout.
  useEffect(() => {
    if (!session?.accessToken) {
      warningActive.current = false
      setWarningSecondsLeft(null)
      return undefined
    }

    const idleMs = sessionConfig.idleTimeoutMinutes * 60_000
    const warnMs = Math.min(WARNING_MS, idleMs / 3)
    lastActivity.current = Date.now()
    warningActive.current = false

    // While the warning is showing, passive activity must NOT dismiss it: the user has to
    // click "Stay signed in" explicitly.
    const onActivity = () => {
      if (!warningActive.current) lastActivity.current = Date.now()
    }

    const tick = () => {
      const remaining = idleMs - (Date.now() - lastActivity.current)
      if (remaining <= 0) {
        warningActive.current = false
        setWarningSecondsLeft(null)
        logout('idle')
      } else if (remaining <= warnMs) {
        warningActive.current = true
        setWarningSecondsLeft(Math.ceil(remaining / 1000))
      }
    }

    const interval = window.setInterval(tick, 1_000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true, capture: true })
    )

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity, { capture: true }))
    }
  }, [session?.accessToken, sessionConfig.idleTimeoutMinutes, logout])

  const stayActive = useCallback(() => {
    lastActivity.current = Date.now()
    warningActive.current = false
    setWarningSecondsLeft(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      isAuthenticated: !!session?.accessToken,
      username: session?.username,
      roles: session?.roles || [],
      logoutReason, // 'idle' | 'expired' | null, so <LoginScreen/> can explain why
      clearLogoutReason: () => setLogoutReason(null),
      login,
      logout,
      refresh,
    }),
    [session, logoutReason, login, logout, refresh]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {warningSecondsLeft !== null && (
        <IdleWarningModal secondsLeft={warningSecondsLeft} onStay={stayActive} onSignOut={() => logout('user')} />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function hasAnyRole(roles, ...wanted) {
  return wanted.some((r) => roles.includes(r))
}

export { AUTH_STORAGE_KEY }
