'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function VerifyContent() {
  const params  = useSearchParams()
  const token   = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token provided.'); return }
    fetch(`${API}/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) { setStatus('success'); setMessage(data.message) }
        else { setStatus('error'); setMessage(data.detail || 'Verification failed') }
      })
      .catch(() => { setStatus('error'); setMessage('Network error. Please try again.') })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center animate-slide-up space-y-4">
        {status === 'loading' && (
          <><div className="text-4xl animate-pulse">⏳</div>
            <p style={{ color: 'var(--text-secondary)' }}>Verifying your email…</p></>
        )}
        {status === 'success' && (
          <><div className="text-5xl">✅</div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Email verified!</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
            <Link href="/login" className="btn-primary inline-block mt-2">Sign in now</Link></>
        )}
        {status === 'error' && (
          <><div className="text-5xl">❌</div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--bear)' }}>Verification failed</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
            <div className="flex gap-3 justify-center mt-2">
              <Link href="/register" className="btn-primary">Register again</Link>
              <Link href="/" className="btn-ghost">Go home</Link>
            </div></>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-pulse">⏳</div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
