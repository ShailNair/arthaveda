// /frontend/src/app/login/page.tsx
'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AppShell'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyNudge, setVerifyNudge] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.detail ?? data.message ?? ''
        if (msg.toLowerCase().includes('verify')) {
          setVerifyNudge(true)
          setError(null)
        } else {
          setError(msg || 'Login failed. Check your email and password.')
        }
        setLoading(false)
        return
      }

      const token = data.access_token ?? data.token
      const user  = data.user ?? { id: data.id, email, display_name: data.display_name ?? email.split('@')[0], theme: 'dark' }

      login(token, user)
      router.push('/')
    } catch {
      setError('Unable to reach server. Is the backend running?')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Arthaveda</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>Market Intelligence</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px',
        }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 22 }}>Sign in</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 'var(--radius)', padding: '10px 14px',
                fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            {/* Email not verified nudge */}
            {verifyNudge && (
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 'var(--radius)', padding: '12px 14px',
                fontSize: 13, color: 'var(--amber)', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ fontWeight: 600 }}>Email not verified</div>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  Your account exists but email verification is pending.
                  Please check your email for the verification link — or go to registration to get a new link.
                </p>
                <a href="/register" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  Go to registration to resend verification →
                </a>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 4, padding: '11px 0', fontSize: 14 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>
        </div>

        {/* Footer links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, textAlign: 'center' }}>
          <Link href="/register" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Create account
          </Link>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Continue without signing in
          </Link>
        </div>

      </div>
    </div>
  )
}
