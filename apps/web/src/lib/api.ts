import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  // Sends the httpOnly refresh cookie to /auth/* (needed when the API is on another origin in local dev).
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* ─── Where to go back to after signing in again ─── */

const RETURN_KEY = 'schoolful-return-to'

export function rememberReturnTo(path = window.location.pathname + window.location.search) {
  if (['/', '/login', '/register'].includes(window.location.pathname)) return
  try {
    sessionStorage.setItem(RETURN_KEY, path)
  } catch {
    /* storage unavailable */
  }
}

/** The page to go back to after signing in, only if it's a path inside this app. */
export function peekReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}

export function clearReturnTo() {
  try {
    sessionStorage.removeItem(RETURN_KEY)
  } catch {
    /* storage unavailable */
  }
}

/* ─── Staying signed in ─── */

const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/schools/register']
let refreshing: Promise<string | null> | null = null

/** Gets a new access token using the refresh cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<string | null> {
  if (!refreshing) {
    refreshing = api
      .post('/auth/refresh')
      .then((res) => {
        const { user, accessToken } = res.data.data
        const store = useAuthStore.getState()
        store.setUser(user)
        store.setAccessToken(accessToken)
        return accessToken as string
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

/** Signs out on the server (revoking the refresh cookie) and locally. */
export async function signOut() {
  try {
    await api.post('/auth/logout')
  } catch {
    /* already signed out on the server, or offline: still sign out locally */
  }
  useAuthStore.getState().logout()
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const isAuthCall = AUTH_PATHS.some((p) => original?.url?.startsWith(p))

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      // The 15-minute access token expired: renew it quietly and repeat the request once.
      original._retried = true
      const token = await refreshSession()
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
      // The refresh cookie is gone or expired too: sign in again, then come back here.
      rememberReturnTo()
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)
