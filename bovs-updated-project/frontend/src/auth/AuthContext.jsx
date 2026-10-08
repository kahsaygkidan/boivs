import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082/api'
const STORAGE_KEY = 'bovs.auth.session'
// Tracks *where* the session lives (localStorage survives browser restarts, sessionStorage
// is cleared when the tab closes) so client.js can read from the right place too.
const STORAGE_MODE_KEY = 'bovs.auth.persist'
// Fallbacks only — the real values come from GET /api/config/session (bovs.session.* on
// the backend) so the UI's timers always match what the backend/Keycloak actually enforce.
const DEFAULT_IDLE_TIMEOUT_MINUTES = 5
const DEFAULT_REFRESH_LEAD_SECONDS = 30
// Activity that counts as "the user is still here" for idle-logout purposes.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll']

function storageFor(mode) {
  return mode === 'local' ? window.localStorage : window.sessionStorage
}

function currentMode() {
  return localStorage.getItem(STORAGE_MODE_KEY) || 'session'
}

function loadSession() {
  try {
    const raw = storageFor(currentMode()).getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session, mode) {
  const resolvedMode = mode || currentMode()
  localStorage.setItem(STORAGE_MODE_KEY, resolvedMode)
  // Always clear both, then write to the chosen one, so switching "keep me signed in"
  // between logins never leaves a stale copy behind in the other storage.
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  if (session) {
    storageFor(resolvedMode).setItem(STORAGE_KEY, JSON.stringify(session))
  }
}

/** Reads the `exp` claim (seconds since epoch) out of a JWT, in milliseconds. Returns
 *  null if the token isn't a decodable JWT or has no exp claim. */
function decodeJwtExpiryMs(token) {
  try {
    const payload = token.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(decodeURIComponent(escape(window.atob(base64))))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Authentication is fully backend-mediated: the SPA posts credentials once to
 * POST /api/auth/login, and our Spring Boot backend exchanges them with Keycloak's token
 * endpoint using a confidential client. The browser never redirects to Keycloak's own
 * hosted login page — <LoginScreen/> IS the login page.
 */
export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(loadSession)
  const [sessionConfig, setSessionConfig] = useState({
    idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
    refreshLeadSeconds: DEFAULT_REFRESH_LEAD_SECONDS,
  })

  const setSession = useCallback((next, mode) => {
    saveSession(next, mode)
    setSessionState(next)
  }, [])

  // Read the idle-timeout / refresh-lead values actually configured on the backend
  // (bovs.session.*) once on mount, instead of hardcoding them here. If the request
  // fails, the defaults above still keep the timers working.
  useEffect(() => {
    let cancelled = false
    axios.get(`${API_BASE_URL}/config/session`)
      .then(({ data }) => {
        if (cancelled || !data) return
        setSessionConfig({
          idleTimeoutMinutes: data.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES,
          refreshLeadSeconds: data.refreshLeadSeconds ?? DEFAULT_REFRESH_LEAD_SECONDS,
        })
      })
      .catch(() => {
        // Endpoint unreachable — keep the defaults rather than blocking the app.
      })
    return () => { cancelled = true }
  }, [])

  // Keep tabs in sync if the session is cleared/updated elsewhere.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setSessionState(loadSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // client.js clears storage directly (outside React) when a 401's silent refresh
  // fails, then dispatches this event. The 'storage' event above only fires in
  // *other* tabs — the tab that made the change never receives its own storage
  // event — so without this listener, this tab's React state never learns the
  // session is gone and isAuthenticated stays stale as true.
  useEffect(() => {
    const onSessionExpired = () => setSessionState(null)
    window.addEventListener('bovs:session-expired', onSessionExpired)
    return () => window.removeEventListener('bovs:session-expired', onSessionExpired)
  }, [])

  const login = useCallback(async (username, password, keepSignedIn = true) => {
    const res = await axios.post(`${API_BASE_URL}/auth/login`, { username, password })
    setSession(res.data, keepSignedIn ? 'local' : 'session')
    return res.data
  }, [setSession])

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken
    setSession(null)
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken })
      } catch {
        // Best-effort server-side revocation; the client-side session is already cleared.
      }
    }
  }, [session, setSession])

  const refresh = useCallback(async () => {
    if (!session?.refreshToken) throw new Error('No active session')
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: session.refreshToken })
    setSession(res.data)
    return res.data
  }, [session, setSession])

  // --- Automatic logout on token/session expiry -------------------------
  // Schedules a proactive refresh shortly before the access token's `exp` claim.
  // If that refresh ever fails (the refresh token itself is expired, revoked, or
  // the backend/Keycloak session is gone), the user is logged out automatically
  // instead of being left in a half-authenticated state until some random API
  // call happens to 401.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    if (!session?.accessToken) return undefined

    const expiryMs = decodeJwtExpiryMs(session.accessToken)
    if (!expiryMs) return undefined // opaque/undecodable token — nothing to schedule

    let cancelled = false

    const attemptRefreshOrLogout = async () => {
      if (cancelled) return
      try {
        await refresh()
      } catch {
        if (!cancelled) await logout()
      }
    }

    const refreshLeadMs = sessionConfig.refreshLeadSeconds * 1_000
    const delay = Math.max(expiryMs - Date.now() - refreshLeadMs, 0)
    const timer = window.setTimeout(attemptRefreshOrLogout, delay)

    // Timers can stall while a tab is backgrounded/throttled — catch up as soon
    // as the tab is visible again if we're already past the refresh point.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() >= expiryMs - refreshLeadMs) {
        attemptRefreshOrLogout()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // Only re-run when the access token itself, or the fetched refresh-lead, changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, sessionConfig.refreshLeadSeconds])

  // --- Automatic logout on inactivity -------------------------------------
  // The effect above keeps silently refreshing the access token forever, regardless of
  // whether anyone is actually at the keyboard — so on its own it would never log an idle
  // user out. This tracks real user activity (mouse/keyboard/touch/scroll) and logs the
  // user out after bovs.session.idle-timeout-minutes of none of it, mirroring the boundary
  // Keycloak's realm-level "SSO Session Idle" enforces server-side.
  useEffect(() => {
    if (!session?.accessToken) return undefined

    const idleMs = sessionConfig.idleTimeoutMinutes * 60_000
    let idleTimer = null

    const handleIdleTimeout = () => {
      logout()
    }

    const resetIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(handleIdleTimeout, idleMs)
    }

    resetIdleTimer()
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetIdleTimer, { passive: true, capture: true })
    )

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer)
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetIdleTimer, { capture: true })
      )
    }
    // Re-run when the token changes (fresh session) or the configured idle timeout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, sessionConfig.idleTimeoutMinutes])

  const value = useMemo(() => ({
    session,
    isAuthenticated: !!session?.accessToken,
    username: session?.username,
    roles: session?.roles || [],
    login,
    logout,
    refresh,
  }), [session, login, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function hasAnyRole(roles, ...wanted) {
  return wanted.some((r) => roles.includes(r))
}

export { STORAGE_KEY as AUTH_STORAGE_KEY, STORAGE_MODE_KEY as AUTH_STORAGE_MODE_KEY };
