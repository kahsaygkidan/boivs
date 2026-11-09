
import { API_BASE_URL, readSession, refreshSession } from '../auth/sessionStore.js'


import axios from 'axios'
import { AUTH_STORAGE_KEY } from '../auth/AuthContext.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']
const REFRESH_LEAD_MS = 30_000

const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 })
const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 })

// Tokens live in sessionStorage only: cleared when the tab closes, never shared across tabs.
const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    return null
  }
}

const writeSession = (session) =>
  session
    ? sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    : sessionStorage.removeItem(AUTH_STORAGE_KEY)

const isAuthCall = (url = '') => AUTH_PATHS.some((p) => url.includes(p))

function msUntilExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 - Date.now()
  } catch {
    return Infinity
  }
}

// Single-flight refresh: concurrent callers share one request, which matters
// because Keycloak refresh-token rotation invalidates the old token after use.
let refreshInFlight = null
function refreshSession() {
  if (!refreshInFlight) {
    const { refreshToken } = readSession() || {}
    refreshInFlight = refreshClient
      .post('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        writeSession(data)
        return data
      })
      .catch((err) => {
        // Only end the session when the server rejects the token, not on network blips.
        if ([400, 401].includes(err.response?.status)) {
          writeSession(null)
          window.dispatchEvent(new CustomEvent('bovs:session-expired'))
        }
        throw err
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

apiClient.interceptors.request.use(async (config) => {
  if (isAuthCall(config.url)) return config

  let session = readSession()
  // Proactive refresh just before expiry avoids a guaranteed 401 round trip.
  if (session?.refreshToken && msUntilExpiry(session.accessToken) < REFRESH_LEAD_MS) {
    try {
      session = await refreshSession()
    } catch {
      /* fall through; the 401 handler below decides what happens */
    }
  }
  if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const session = readSession()

    if (
      err.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthCall(original.url) &&
      session?.refreshToken
    ) {
      original._retried = true
      const data = await refreshSession() // rejects (and expires the session) on failure
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient.request(original)
    }

    const apiError = err.response?.data
    err.friendlyMessage =
      err.response?.status === 403
        ? 'You do not have permission to perform this action.'
        : apiError?.message || (err.code === 'ECONNABORTED' ? 'The request timed out.' : err.message) || 'Request failed'
    err.details = apiError?.details || []
    return Promise.reject(err)
  }
)

export default apiClient
