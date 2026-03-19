// /frontend/src/app/register/page.tsx
'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AppShell'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PwdCheck { label: string; test: (pw: string) => boolean }
const PWD_CHECKS: PwdCheck[] = [
  { label: 'At least 8 characters',  test: pw => pw.length >= 8 },
  { label: 'One uppercase letter',    test: pw => /[A-Z]/.test(pw) },
  { label: 'One number',              test: pw => /[0-9]/.test(pw) },
  { label: 'One special character',   test: pw => /[^A-Za-z0-9]/.test(pw) },
]

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: passed ? 'rgba(52,211,153,0.15)' : 'var(--surface-3)',
        fontSize: 9, lineHeight: 1,
        color: passed ? 'var(--green)' : 'var(--text-muted)',
        transition: 'all 0.2s',
      }}>
        {passed ? '✓' : '·'}
      </span>
      <span style={{ fontSize: 12, color: passed ? 'var(--green)' : 'var(--text-muted)', transition: 'color 0.2s' }}>
        {label}
      </span>
    </div>
  )
}

export default function RegisterPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null)
  const [devMode, setDevMode] = useState(false)
  const [resent, setResent] = useState(false)

  const allPassed = PWD_CHECKS.every(c => c.test(password))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!allPassed) {
      setError('Please meet all password requirements.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ display_name: displayName, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail ?? data.message ?? 'Registration failed. This email may already be in use.')
        setLoading(false)
        return
      }

      // Dev mode — log verify URL if provided
      if (data.verify_url) {
        console.log('[DEV] Email verification URL:', data.verify_url)
        setVerifyUrl(data.verify_url)
      }
      if (data.dev_mode) setDevMode(true)
      if (data.resent) setResent(true)

      // If backend returns a token on register, log in immediately
      if (data.access_token) {
        const user = data.user ?? { id: data.id, email, display_name: displayName, theme: 'dark' }
        login(data.access_token, user)
        router.push('/')
        return
      }

      setSuccess(true)
      setLoading(false)
    } catch {
      setError('Unable to reach server. Is the backend running?')
      setLoading(false)
    }
  }

  /* ── Success state ── */
  if (success) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', padding: '20px',
      }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(52,211,153,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 22,
            color: 'var(--green)',
          }}>✓</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>
            {resent ? 'Verification link resent' : 'Account created!'}
          </div>

          {devMode ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 'var(--radius)', padding: '10px 14px',
                fontSize: 12, color: 'var(--amber)', lineHeight: 1.6,
              }}>
                Development mode — no email is sent. Click the button below to verify your account.
              </div>
              {verifyUrl && (
                <a href={verifyUrl} style={{
                  display: 'block', width: '100%', padding: '13px 0',
                  background: 'var(--green)', color: '#000',
                  textAlign: 'center', fontWeight: 700, fontSize: 15,
                  borderRadius: 'var(--radius)', textDecoration: 'none',
                }}>
                  Verify My Account →
                </a>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              We've sent a verification link to <strong>{email}</strong>.
              Click the link in the email to activate your account.
            </p>
          )}

          <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none', marginTop: 4 }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  /* ── Form ── */
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 0 }}>

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
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 22 }}>Create account</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Display name */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Display name
              </label>
              <input
                type="text" required autoComplete="name"
                value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Arjun Sharma"
                className="input"
              />
            </div>

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
                type="password" required autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                style={{ borderColor: password.length > 0 && !allPassed ? 'rgba(248,113,113,0.4)' : undefined }}
              />

              {/* Checklist */}
              {password.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {PWD_CHECKS.map(c => (
                    <CheckItem key={c.label} label={c.label} passed={c.test(password)} />
                  ))}
                </div>
              )}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !allPassed}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 4, padding: '11px 0', fontSize: 14 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

          </form>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, textAlign: 'center' }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
            Already have an account? Sign in
          </Link>
          <Link href="/" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
            Continue without signing in
          </Link>
        </div>

      </div>
    </div>
  )
}
