'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/* ─── Theme Context ──────────────────────────────────────────────────────── */
export type Theme = 'dark' | 'light'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

/* ─── Auth Context ───────────────────────────────────────────────────────── */
export interface AuthUser { id: string; email: string; display_name: string; theme: Theme; risk_profile?: string; investment_goal?: string; monthly_amount?: number; time_horizon_years?: number; onboarding_done?: number }
interface AuthCtx { user: AuthUser | null; token: string | null; login: (token: string, user: AuthUser) => void; logout: () => void; loading: boolean }
const AuthContext = createContext<AuthCtx>({ user: null, token: null, login: () => {}, logout: () => {}, loading: true })
export const useAuth = () => useContext(AuthContext)

/* ─── Nav Structure ──────────────────────────────────────────────────────── */
const NAV = [
  {
    section: 'INVEST',
    items: [
      { href: '/',             icon: '◉', label: 'Invest',       sub: 'Top opportunities now' },
      { href: '/signals',      icon: '⚡', label: 'Signals',      sub: 'Live buy & avoid list' },
    ],
  },
  {
    section: 'BUILD WEALTH',
    items: [
      { href: '/wealth',       icon: '◎', label: 'Wealth Builder', sub: 'SIP · Funds · Allocation' },
    ],
  },
  {
    section: 'INTELLIGENCE',
    items: [
      { href: '/intelligence', icon: '◈', label: 'Market Intel',  sub: 'Geo · Macro · Calendar' },
      { href: '/trends',       icon: '◇', label: 'Mega Trends',   sub: 'Long-term themes' },
    ],
  },
  {
    section: 'PRO',
    items: [
      { href: '/analytics',   icon: '⊞', label: 'Quant Pro',     sub: 'Features · Backtest' },
    ],
  },
]

/* ─── Sidebar Component ──────────────────────────────────────────────────── */
function Sidebar({ user, logout, theme, toggleTheme }: { user: AuthUser | null; logout: () => void; theme: Theme; toggleTheme: () => void }) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? 56 : 220,
      minWidth: collapsed ? 56 : 220,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 8px',
      transition: 'width 0.2s',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }} className="hide-mobile">
      {/* Logo */}
      <div style={{ padding: '4px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Arthaveda</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</div>
          </div>
        )}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section}>
            {!collapsed && <div className="nav-section">{group.section}</div>}
            {group.items.map(item => {
              const active = path === item.href || (item.href !== '/' && path.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}
                  style={{ marginBottom: 2, justifyContent: collapsed ? 'center' : undefined }}
                  title={collapsed ? item.label : undefined}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Theme toggle */}
        <button onClick={toggleTheme} className="nav-item" style={{ width: '100%', justifyContent: collapsed ? 'center' : undefined }}>
          <span style={{ fontSize: 14 }}>{theme === 'dark' ? '☀' : '☽'}</span>
          {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {/* Auth */}
        {user ? (
          <>
            {!collapsed && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{user.display_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
            )}
            <button onClick={logout} className="nav-item" style={{ width: '100%', justifyContent: collapsed ? 'center' : undefined }}>
              <span style={{ fontSize: 14 }}>⎋</span>
              {!collapsed && <span>Sign out</span>}
            </button>
          </>
        ) : (
          <Link href="/login" className="nav-item" style={{ justifyContent: collapsed ? 'center' : undefined }}>
            <span style={{ fontSize: 14 }}>→</span>
            {!collapsed && <span>Sign in</span>}
          </Link>
        )}
      </div>
    </aside>
  )
}

/* ─── Bottom Nav (Mobile) ────────────────────────────────────────────────── */
function BottomNav() {
  const path = usePathname()
  const mobileItems = [
    { href: '/',             icon: '◉', label: 'Invest' },
    { href: '/signals',      icon: '⚡', label: 'Signals' },
    { href: '/wealth',       icon: '◎', label: 'Wealth' },
    { href: '/intelligence', icon: '◈', label: 'Intel' },
    { href: '/analytics',   icon: '⊞', label: 'Pro' },
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }} className="hide-desktop">
      {mobileItems.map(item => {
        const active = path === item.href || (item.href !== '/' && path.startsWith(item.href))
        return (
          <Link key={item.href} href={item.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 4px 8px', gap: 3,
            color: active ? 'var(--accent)' : 'var(--text-muted)',
            textDecoration: 'none', fontSize: 11, fontWeight: 500,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/* ─── Regime Strip ───────────────────────────────────────────────────────── */
function RegimeStrip() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws')
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'MARKET_OVERVIEW' || msg.type === 'CONNECTED') {
        const d = msg.data || msg.market
        if (d) setData(d)
      }
    }
    return () => ws.close()
  }, [])

  const regime = data?.market_regime || 'LOADING'
  const regimeColor = regime.includes('BULL') ? 'var(--green)' : regime.includes('BEAR') ? 'var(--red)' : 'var(--amber)'

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      fontSize: 12,
      overflowX: 'auto',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: regimeColor, display: 'inline-block' }} />
        <span style={{ color: regimeColor, fontWeight: 600 }}>{regime}</span>
      </div>
      {data && (
        <>
          <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>|</div>
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Nifty <span className="num" style={{ color: data.nifty50_change >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{data.nifty50_change >= 0 ? '+' : ''}{data.nifty50_change?.toFixed(2)}%</span></span>
            <span style={{ color: 'var(--text-secondary)' }}>Bank <span className="num" style={{ color: data.nifty_bank_change >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{data.nifty_bank_change >= 0 ? '+' : ''}{data.nifty_bank_change?.toFixed(2)}%</span></span>
          </div>
          {data.vix && (
            <>
              <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>|</div>
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>VIX <span style={{ color: data.vix > 20 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{data.vix?.toFixed(1)}</span></span>
            </>
          )}
        </>
      )}
      <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>
        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

/* ─── AppShell ───────────────────────────────────────────────────────────── */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Persist theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme || 'dark'
    setTheme(saved)
    document.documentElement.className = saved
    setLoading(false)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      document.documentElement.className = next
      return next
    })
  }, [])

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token')
    const savedUser  = localStorage.getItem('user')
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {}
    }
  }, [])

  const login = useCallback((t: string, u: AuthUser) => {
    setToken(t); setUser(u)
    localStorage.setItem('access_token', t)
    localStorage.setItem('user', JSON.stringify(u))
    if (u.theme) {
      setTheme(u.theme)
      document.documentElement.className = u.theme
    }
  }, [])

  const logout = useCallback(async () => {
    try { await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }) } catch {}
    setToken(null); setUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  }, [])

  return (
    <ThemeCtx.Provider value={{ theme, toggle: toggleTheme }}>
      <AuthContext.Provider value={{ user, token, login, logout, loading }}>
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
          <Sidebar user={user} logout={logout} theme={theme} toggleTheme={toggleTheme} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
            <RegimeStrip />
            <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
      </AuthContext.Provider>
    </ThemeCtx.Provider>
  )
}
