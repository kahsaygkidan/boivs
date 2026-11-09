import axios from 'axios'
import { API_BASE_URL, readSession, refreshSession } from '../auth/sessionStore.js'

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout']
const REFRESH_LEAD_MS = 30_000

const apiClient = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 })

const isAuthCall = (url = '') => AUTH_PATHS.some((p) => url.includes(p))

/** Milliseconds until the JWT's `exp`; Infinity if the token can't be decoded. */
function msUntilExpiry(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return payload.exp * 1000 - Date.now()
  } catch {
    return Infinity
  }
}

// Attach the access token to every request. If it is about to expire, refresh first
// (single-flight, shared with AuthContext) so most requests never hit a 401.
apiClient.interceptors.request.use(async (config) => {
  if (isAuthCall(config.url)) return config

  let session = readSession()
  if (session?.refreshToken && msUntilExpiry(session.accessToken) < REFRESH_LEAD_MS) {
    try {
      session = await refreshSession()
    } catch {
      // Fall through: if the token is truly dead, the 401 handler below deals with it.
    }
  }

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  return config
})

// On a 401, try exactly one silent refresh, then retry the original request.
// If the refresh is rejected, sessionStore ends the session and fires
// 'bovs:session-expired', and AuthContext sends the user back to login.
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
      const data = await refreshSession()
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient.request(original)
    }

    // Normalise the error for the UI without losing the Axios error object.
    const apiError = err.response?.data
    err.friendlyMessage =
      err.response?.status === 403
        ? 'You do not have permission to perform this action.'
        : apiError?.message ||
          (err.code === 'ECONNABORTED' ? 'The request timed out.' : err.message) ||
          'Request failed'
    err.details = apiError?.details || []
    return Promise.reject(err)
  }
)

export default apiClient
