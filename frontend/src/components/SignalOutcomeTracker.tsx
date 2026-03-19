'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Outcome {
  id: string; symbol: string; signal_label: string; probability: number
  price_at_signal: number; signal_date: string
  target_price: number; stop_price: number; current_price: number | null
  return_2w: number | null; return_4w: number | null
  outcome_status: 'OPEN' | 'TARGET_HIT' | 'STOPPED_OUT' | 'CLOSED'
  resolved_at: string | null
}

interface Stats {
  total_signals: number; closed_signals: number; open_signals: number
  target_hit: number; win_rate: number | null; avg_return_4w: number | null
}

const STATUS_CONFIG = {
  TARGET_HIT:   { label: 'Target Hit', color: 'var(--bull)',    bg: '#34d39918', icon: '✅' },
  STOPPED_OUT:  { label: 'Stopped Out',color: 'var(--bear)',    bg: '#f8717118', icon: '🛑' },
  CLOSED:       { label: 'Closed',     color: 'var(--text-secondary)', bg: '#94a3b818', icon: '📋' },
  OPEN:         { label: 'Open',       color: 'var(--info)',    bg: '#60a5fa18', icon: '⏳' },
}

export function SignalOutcomeTracker() {
  const [data,    setData]    = useState<{ stats: Stats; outcomes: Outcome[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/user/signal-outcomes?limit=20`)
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="skeleton h-20 rounded-xl"/>)}</div>
  )

  if (!data || !data.outcomes.length) {
    return (
      <div className="card p-8 text-center space-y-2">
        <div className="text-3xl">📊</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No signal history yet</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Signal outcomes appear here as the system generates and tracks recommendations
        </p>
      </div>
    )
  }

  const { stats, outcomes } = data

  return (
    <div className="space-y-3">
      {/* Stats header */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total Signals',  value: stats.total_signals,  color: 'var(--text-primary)' },
          { label: 'Win Rate',       value: stats.win_rate != null ? `${(stats.win_rate*100).toFixed(0)}%` : '—', color: (stats.win_rate||0) > 0.5 ? 'var(--bull)' : 'var(--bear)' },
          { label: 'Avg Return (4w)',value: stats.avg_return_4w != null ? `${stats.avg_return_4w >= 0 ? '+' : ''}${(stats.avg_return_4w*100).toFixed(1)}%` : '—', color: (stats.avg_return_4w||0) >= 0 ? 'var(--bull)' : 'var(--bear)' },
          { label: 'Open Signals',   value: stats.open_signals,   color: 'var(--info)' },
        ].map(item => (
          <div key={item.label} className="card p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            <div className="text-base font-bold font-mono mt-0.5" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg p-2.5 text-[10px]" style={{ background: '#fbbf2410', color: 'var(--warn)', border: '1px solid #fbbf2430' }}>
        ⚠️ Past signal performance does not guarantee future results. This is educational — not financial advice.
      </div>

      {/* Outcomes list */}
      <div className="space-y-2">
        {outcomes.map(oc => {
          const cfg = STATUS_CONFIG[oc.outcome_status]
          const ret4w = oc.return_4w
          return (
            <div key={oc.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cfg.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{oc.symbol}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {oc.signal_label}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      ₹{oc.price_at_signal.toFixed(0)} · {new Date(oc.signal_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {ret4w != null ? (
                    <div className="text-sm font-bold font-mono" style={{ color: ret4w >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                      {ret4w >= 0 ? '+' : ''}{(ret4w * 100).toFixed(1)}%
                    </div>
                  ) : (
                    <div className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
                  )}
                  {oc.probability && (
                    <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      model: {(oc.probability * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar for open positions */}
              {oc.outcome_status === 'OPEN' && oc.current_price && (
                <div className="mt-2">
                  <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Stop ₹{oc.stop_price?.toFixed(0)}</span>
                    <span>Now ₹{oc.current_price.toFixed(0)}</span>
                    <span>Target ₹{oc.target_price?.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                    {oc.stop_price && oc.target_price && (
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, ((oc.current_price - oc.stop_price) / (oc.target_price - oc.stop_price)) * 100))}%`,
                          background: 'var(--bull)',
                        }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
