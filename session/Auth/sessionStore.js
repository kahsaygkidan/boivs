import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const AUTH_STORAGE_KEY = 'bovs.auth.session'

const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 })

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    return null
  }
}

// Every write notifies React, so state stays in sync no matter who changed the session.
export function writeSession(session) {
  if (session) sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('bovs:session-changed'))
}

// Single-flight: concurrent callers (interceptor, timer) share one request, which matters
// because Keycloak refresh-token rotation invalidates the old token after one use.
let inFlight = null
export function refreshSession() {
  if (!inFlight) {
    const { refreshToken } = readSession() || {}
    inFlight = refreshClient
      .post('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        writeSession(data)
        return data
      })
      .catch((err) => {
        // Only end the session when the server rejects the token, not on network blips.
        if ([400, 401].includes(err.response?.status)) {
          window.dispatchEvent(new CustomEvent('bovs:session-expired'))
          writeSession(null)
        }
        throw err
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}
