'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth, useTheme, Theme } from '@/components/AppShell'

const NAV = [
  { href: '/',            label: 'Dashboard',      icon: '🏠', desc: 'Signals & market overview' },
  { href: '/predictions', label: 'Where to Invest', icon: '🔮', desc: 'Where to invest next' },
  { href: '/analytics',   label: 'Pro Analysis',   icon: '⚙️', desc: 'Deep analysis for experienced investors' },
  { href: '/calendar',    label: 'Event Calendar',  icon: '📅', desc: 'RBI · Budget · Results dates' },
  { href: '/geo',         label: 'Geo Intelligence',icon: '🌍', desc: 'World events & sector impact' },
  { href: '/trends',      label: 'Mega Trends',     icon: '🚀', desc: '3-5 year structural bets' },
  { href: '/funds',       label: 'Wealth Builder',  icon: '💰', desc: 'SIP · Portfolio · Funds' },
  { href: '/track-record',label: 'Track Record',    icon: '📊', desc: 'Past signals & outcomes' },
]

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'dark',  label: 'Dark',  icon: '🌑' },
  
  { value: 'light', label: 'Light', icon: '☀️' },
]

export function Sidebar() {
  const path               = usePathname()
  const router             = useRouter()
  const { user, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [showTheme, setShowTheme] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className={`desktop-sidebar flex flex-col transition-all duration-300 shrink-0 min-h-screen
        ${collapsed ? 'w-16' : 'w-56'}`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Logo + collapse toggle */}
        <div className="p-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}>
          {!collapsed && (
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: 'var(--accent)' }}>LotteryAI</div>
              <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                India Intelligence
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = path === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                style={{
                  background:  active ? 'var(--accent-dim)' : 'transparent',
                  border:      active ? '1px solid var(--accent)30' : '1px solid transparent',
                  color:       active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}>
                <span className="text-lg shrink-0">{item.icon}</span>
                {!collapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-medium leading-tight truncate">{item.label}</div>
                    <div className="text-[9px] leading-tight truncate" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-2 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Theme switcher */}
          <div className="relative">
            <button onClick={() => setShowTheme(s => !s)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <span className="text-lg shrink-0">
                {THEME_OPTIONS.find(t => t.value === theme)?.icon || '🌑'}
              </span>
              {!collapsed && <span className="text-xs">Theme</span>}
            </button>
            {showTheme && !collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden z-50"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {THEME_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { toggleTheme(); setShowTheme(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                    style={{
                      background: theme === opt.value ? 'var(--accent-dim)' : 'transparent',
                      color:      theme === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                    {theme === opt.value && <span className="ml-auto text-[9px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User / auth */}
          {user ? (
            <div className="px-3 py-2">
              {!collapsed && (
                <>
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user.display_name}
                  </div>
                  <div className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                  <button onClick={handleLogout} className="text-[9px] mt-1"
                    style={{ color: 'var(--bear)' }}>Sign out</button>
                </>
              )}
            </div>
          ) : (
            <Link href="/login"
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ color: 'var(--text-muted)' }}>
              <span className="text-lg shrink-0">🔑</span>
              {!collapsed && <span className="text-xs">Sign in / Register</span>}
            </Link>
          )}

          {!collapsed && (
            <p className="text-[8px] px-3 pb-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              ⚠️ Not SEBI registered. Educational use only.
            </p>
          )}
        </div>
      </aside>

      {/* ── Mobile Bottom Nav ────────────────────────────────────── */}
      <nav className="mobile-nav">
        <div className="flex justify-around">
          {NAV.slice(0, 5).map(item => {
            const active = path === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center gap-0.5 px-2 py-1"
                style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                <span className="text-xl">{item.icon}</span>
                <span className="text-[8px] font-medium">{item.label.split(' ')[0]}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
