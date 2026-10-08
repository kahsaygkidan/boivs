import axios from 'axios'
import { AUTH_STORAGE_KEY, AUTH_STORAGE_MODE_KEY } from '../auth/AuthContext.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082/api'

const apiClient = axios.create({ baseURL: API_BASE_URL })

function activeStorage() {
  const mode = localStorage.getItem(AUTH_STORAGE_MODE_KEY) || 'session'
  return mode === 'local' ? window.localStorage : window.sessionStorage
}

function readSession() {
  try {
    const raw = activeStorage().getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSession(session) {
  const storage = activeStorage()
  if (session) storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  else storage.removeItem(AUTH_STORAGE_KEY)
}

// Attach the access token issued by our backend's /api/auth/login to every request.
apiClient.interceptors.request.use((config) => {
  const session = readSession()
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  return config
})

let refreshInFlight = null

// On a 401, try exactly one silent refresh (via our backend, which talks to Keycloak) before
// giving up and forcing the user back to the login screen.
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    const session = readSession()

    if (err.response?.status === 401 && session?.refreshToken && !original._retried) {
      original._retried = true
      try {
        refreshInFlight = refreshInFlight || axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: session.refreshToken,
        })
        const { data } = await refreshInFlight
        writeSession(data)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return apiClient.request(original)
      } catch (refreshErr) {
        writeSession(null)
        window.dispatchEvent(new CustomEvent('bovs:session-expired'))
        return Promise.reject(refreshErr)
      } finally {
        refreshInFlight = null
      }
    }

    const apiError = err.response?.data
    const message = apiError?.message || err.message || 'Request failed'
    return Promise.reject({ ...err, friendlyMessage: message, details: apiError?.details || [] })
  }
)

export default apiClient
