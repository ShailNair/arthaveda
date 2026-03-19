'use client'
/**
 * Auth + Theme Context
 * - JWT access token stored in memory only (never localStorage — XSS safe)
 * - Refresh token in HttpOnly cookie (set by backend — JS cannot read)
 * - Theme (dark/dim/light) stored in localStorage + applied to <html>
 * - Auto-refresh access token 1 minute before expiry
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode
} from 'react'

export type Theme = 'dark' | 'dim' | 'light'
export type RiskProfile = 'conservative' | 'balanced' | 'aggressive'
export type InvestmentGoal = 'wealth_creation' | 'retirement' | 'short_term' | 'safety'

export interface User {
  id:                 string
  email:              string
  display_name:       string
  theme:              Theme
  risk_profile:       RiskProfile
  investment_goal:    InvestmentGoal
  monthly_amount:     number
  time_horizon_years: number
  onboarding_done:    number
}

interface AuthState {
  user:        User | null
  token:       string | null
  loading:     boolean
  theme:       Theme
  // actions
  login:       (email: string, password: string) => Promise<void>
  register:    (email: string, password: string, displayName: string) => Promise<void>
  logout:      () => Promise<void>
  setTheme:    (t: Theme) => void
  updateProfile: (data: Partial<User>) => Promise<void>
  authFetch:   (url: string, init?: RequestInit) => Promise<Response>
}

const AuthCtx = createContext<AuthState | null>(null)

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Theme helpers ──────────────────────────────────────────────────────────

const THEME_CLASSES: Record<Theme, string> = {
  dark:  'theme-dark',
  dim:   'theme-dim',
  light: 'theme-light',
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove('theme-dark', 'theme-dim', 'theme-light')
  html.classList.add(THEME_CLASSES[theme])
  localStorage.setItem('theme', theme)
}

function getSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem('theme') as Theme) || 'dark'
}

// ── JWT decode (no library) ────────────────────────────────────────────────

function decodeJWT(token: string): { exp: number; sub: string } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload
  } catch {
    return null
  }
}

function tokenExpiresIn(token: string): number {
  // Returns seconds until expiry (negative if expired)
  const payload = decodeJWT(token)
  if (!payload?.exp) return -1
  return payload.exp - Math.floor(Date.now() / 1000)
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme,   setThemeState] = useState<Theme>('dark')
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Apply token and schedule refresh
  const applyToken = useCallback((newToken: string) => {
    setToken(newToken)
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const expiresIn = tokenExpiresIn(newToken)
    const refreshIn = Math.max((expiresIn - 60) * 1000, 5000) // 1 min before expiry
    refreshTimer.current = setTimeout(doRefresh, refreshIn)
  }, [])

  const doRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST', credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        applyToken(data.access_token)
      } else {
        // Refresh failed — user must log in again
        setUser(null); setToken(null)
      }
    } catch {
      setUser(null); setToken(null)
    }
  }, [applyToken])

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    const savedTheme = getSavedTheme()
    setThemeState(savedTheme)
    applyTheme(savedTheme)

    doRefresh().finally(() => {
      // If refresh succeeded, fetch user profile
      setLoading(false)
    })

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])

  // After token is set, fetch user profile
  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser(data)
          // Sync theme from user profile
          const userTheme = (data.theme as Theme) || 'dark'
          setThemeState(userTheme)
          applyTheme(userTheme)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  // ── Auth actions ─────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Login failed')
    applyToken(data.access_token)
    setUser(data.user)
    const userTheme = (data.user.theme as Theme) || 'dark'
    setThemeState(userTheme)
    applyTheme(userTheme)
  }, [applyToken])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch(`${API}/api/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, display_name: displayName }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Registration failed')
  }, [])

  const logout = useCallback(async () => {
    await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    setUser(null); setToken(null)
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    if (token) {
      fetch(`${API}/api/auth/profile`, {
        method:  'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ theme: t }),
      }).catch(() => {})
    }
  }, [token])

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!token) return
    const res = await fetch(`${API}/api/auth/profile`, {
      method:  'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Update failed')
    }
    setUser(prev => prev ? { ...prev, ...data } : null)
  }, [token])

  /** Authenticated fetch — automatically adds Bearer token. */
  const authFetch = useCallback(async (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    return fetch(url.startsWith('http') ? url : `${API}${url}`, {
      ...init, headers, credentials: 'include'
    })
  }, [token])

  return (
    <AuthCtx.Provider value={{
      user, token, loading, theme,
      login, register, logout, setTheme, updateProfile, authFetch,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
