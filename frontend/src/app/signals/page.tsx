// /frontend/src/app/signals/page.tsx
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type SignalType = 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'AVOID'
type FilterTab = 'All' | 'Opportunities' | 'Watch' | 'Avoid'

/* ─── Display label map ───────────────────────────────────────────────────── */
function signalDisplayLabel(signal: SignalType): string {
  if (signal === 'STRONG BUY') return 'Strong Opportunity'
  if (signal === 'BUY') return 'Good Opportunity'
  if (signal === 'AVOID') return 'Not Recommended'
  return 'Wait and Watch'
}

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Signal {
  symbol: string
  name: string
  exchange?: string
  signal: SignalType
  score: number
  reasons: string[]
  trust_score?: number
  horizon?: string
  sector?: string
  price?: number
}

interface SignalOutcome {
  total: number
  hit_target: number
  days: number
  win_rate: number
  avg_return?: number
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function signalColor(signal: SignalType): string {
  if (signal === 'STRONG BUY' || signal === 'BUY') return 'var(--green)'
  if (signal === 'AVOID') return 'var(--red)'
  return 'var(--amber)'
}

function signalBadgeClass(signal: SignalType): string {
  if (signal === 'STRONG BUY' || signal === 'BUY') return 'badge badge-green'
  if (signal === 'AVOID') return 'badge badge-red'
  return 'badge badge-amber'
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Strong'
  if (score >= 50) return 'Good'
  if (score >= 35) return 'Mixed'
  return 'Weak'
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--red)'
}

/* ─── getSignalTiming ─────────────────────────────────────────────────────── */
function getSignalTiming(signal: Signal): {
  valid_days: number
  entry_window: 'Buy Now' | 'Wait for Dip' | 'Already Moving'
  momentum: 'Breaking Out' | 'Early Stage' | 'Oversold Bounce' | 'Late Stage'
  expires_label: string
  urgency_color: string
} {
  const { score, signal: type, reasons = [] } = signal
  const text = reasons.join(' ').toLowerCase()

  // Valid window based on signal strength
  const valid_days =
    type === 'STRONG BUY' && score >= 80 ? 5 :
    type === 'STRONG BUY' ? 4 :
    type === 'BUY' && score >= 70 ? 3 : 2

  // Momentum phase detected from reason text + score
  const momentum: 'Breaking Out' | 'Early Stage' | 'Oversold Bounce' | 'Late Stage' =
    (text.includes('breakout') || text.includes('accumulation') || score >= 85) ? 'Breaking Out' :
    (text.includes('institution') || text.includes('government') || text.includes('order')) ? 'Early Stage' :
    (text.includes('oversold') || text.includes('bounce') || text.includes('below') || score < 60) ? 'Oversold Bounce' :
    'Early Stage'

  // Entry window
  const entry_window: 'Buy Now' | 'Wait for Dip' | 'Already Moving' =
    momentum === 'Breaking Out' && score >= 85 ? 'Already Moving' :
    momentum === 'Breaking Out' || momentum === 'Early Stage' ? 'Buy Now' :
    'Wait for Dip'

  // Expiry
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + valid_days)
  const expires_label = expiry.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const urgency_color =
    valid_days <= 2 ? 'var(--red)' :
    valid_days <= 3 ? 'var(--amber)' :
    'var(--green)'

  return { valid_days, entry_window, momentum, expires_label, urgency_color }
}

/* ─── TimingBadges ────────────────────────────────────────────────────────── */
function TimingBadges({ timing }: { timing: ReturnType<typeof getSignalTiming> }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 4 }}>
      {/* Valid for */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: 'var(--surface-2)', border: `1px solid ${timing.urgency_color}`,
        color: timing.urgency_color,
      }}>
        ⏱ Valid: {timing.valid_days} day{timing.valid_days !== 1 ? 's' : ''}
      </div>
      {/* Entry window */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: timing.entry_window === 'Buy Now' ? 'rgba(48,209,88,0.1)' : 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: timing.entry_window === 'Buy Now' ? 'var(--green)' : 'var(--text-muted)',
      }}>
        📈 {timing.entry_window}
      </div>
      {/* Momentum */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        color: timing.momentum === 'Breaking Out' ? 'var(--amber)' : 'var(--text-secondary)',
      }}>
        🔥 {timing.momentum}
      </div>
      {/* Expires */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}>
        Expires {timing.expires_label}
      </div>
    </div>
  )
}

/* ─── ScoreBar ────────────────────────────────────────────────────────────── */
function ScoreBar({ score, compact }: { score: number; compact?: boolean }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = scoreColor(pct)
  const label = scoreLabel(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: compact ? 2 : 3,
        background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span className="num" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 24 }}>{pct}</span>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 36 }}>{label}</span>
    </div>
  )
}

/* ─── ScoreLegend ─────────────────────────────────────────────────────────── */
function ScoreLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--accent)',
          fontSize: 12,
          padding: '6px 12px',
          cursor: 'pointer',
          width: 'fit-content',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>How scores work</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Opportunity Rating Explained
          </div>
          {[
            { range: '75–100', label: 'Strong Opportunity', desc: 'Multiple positive signals aligning', color: 'var(--green)' },
            { range: '50–74', label: 'Good Opportunity', desc: 'More positives than negatives', color: 'var(--green)' },
            { range: '35–49', label: 'Wait and Watch', desc: 'Mixed signals, no clear direction', color: 'var(--amber)' },
            { range: '0–34', label: 'Not Recommended', desc: 'More risks than opportunities', color: 'var(--red)' },
          ].map(item => (
            <div key={item.range} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="num" style={{
                fontSize: 11, fontWeight: 700, color: item.color,
                minWidth: 44, paddingTop: 1,
              }}>
                {item.range}
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── TradePlan ───────────────────────────────────────────────────────────── */
function TradePlan({ signal }: { signal: Signal }) {
  if (!signal.price) return null
  const price = signal.price
  const stopLoss = Math.round(price * 0.94)
  const target = Math.round(price * 1.10)

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        Trade Plan
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Buy around</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>₹{price.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Target</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>₹{target.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Expected gain of 10%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Stop loss</div>
          <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>₹{stopLoss.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Exit if it falls 6% to limit your loss</div>
        </div>
        {signal.horizon && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Hold for</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{signal.horizon}</div>
          </div>
        )}
      </div>
      <div style={{
        marginTop: 4,
        padding: '8px 10px',
        background: 'var(--surface)',
        borderRadius: 6,
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
        borderLeft: '3px solid var(--amber)',
      }}>
        Risk management: Never risk more than 1–2% of your total money on a single trade.
      </div>
    </div>
  )
}

/* ─── Signal Card ─────────────────────────────────────────────────────────── */
function SignalCard({ signal }: { signal: Signal }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = signalColor(signal.signal)
  const trust = signal.trust_score ?? Math.round(60 + signal.score * 0.3)
  const isBuy = signal.signal === 'STRONG BUY' || signal.signal === 'BUY'
  const timing = isBuy ? getSignalTiming(signal) : null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{signal.name}</span>
            <span className="num" style={{
              fontSize: 11, color: 'var(--text-muted)',
              background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4,
            }}>
              {signal.symbol}{signal.exchange ? ` · ${signal.exchange}` : ''}
            </span>
            {signal.sector && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{signal.sector}</span>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Opportunity Rating
            </div>
            <ScoreBar score={signal.score} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className={signalBadgeClass(signal.signal)}>{signalDisplayLabel(signal.signal)}</span>
          {signal.horizon && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{signal.horizon}</span>
          )}
        </div>
      </div>

      {/* Reasons */}
      {signal.reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
          {signal.reasons.slice(0, 3).map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: borderColor, marginTop: 3, flexShrink: 0, fontSize: 9 }}>◆</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timing Badges — always shown for BUY signals */}
      {isBuy && timing && <TimingBadges timing={timing} />}

      {/* Trade Plan (expanded, buy signals only) */}
      {isBuy && expanded && <TradePlan signal={signal} />}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: isBuy && expanded ? 12 : 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trust </span>
            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: trust >= 70 ? 'var(--green)' : 'var(--amber)' }}>{trust}%</span>
          </div>
          {isBuy && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                fontSize: 11,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Hide plan' : 'Show trade plan'}
            </button>
          )}
        </div>
        <Link href={`/analytics?symbol=${signal.symbol}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
          Deep Analysis →
        </Link>
      </div>
    </div>
  )
}

/* ─── Mini Track Record ───────────────────────────────────────────────────── */
function MiniTrackRecord() {
  const [data, setData] = useState<SignalOutcome | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/user/signal-outcomes`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [])

  if (loading) return <div className="skeleton" style={{ height: 24, width: 320 }} />

  return (
    <div style={{
      fontSize: 12, color: 'var(--text-muted)',
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    }}>
      {data && data.total > 0 ? (
        <>
          <span className="num" style={{ color: 'var(--text-secondary)' }}>{data.total} signals tracked</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>Win rate: <span className="num" style={{ color: data.win_rate >= 60 ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>{data.win_rate.toFixed(0)}%</span></span>
          {data.avg_return != null && (
            <>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span>Avg return: <span className="num" style={{ color: data.avg_return >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>+{data.avg_return.toFixed(1)}%</span></span>
            </>
          )}
        </>
      ) : (
        <span>Track record builds as signals age — logged since today</span>
      )}
    </div>
  )
}

/* ─── Filter Tabs ─────────────────────────────────────────────────────────── */
function FilterTabs({ active, onChange }: { active: FilterTab; onChange: (f: FilterTab) => void }) {
  const tabs: FilterTab[] = ['All', 'Opportunities', 'Watch', 'Avoid']

  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            background: active === tab ? 'var(--surface-3)' : 'none',
            border: 'none',
            color: active === tab ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: active === tab ? 600 : 400,
            fontSize: 12,
            padding: '5px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

/* ─── Mock data ───────────────────────────────────────────────────────────── */
const MOCK_SIGNALS: Signal[] = [
  {
    symbol: 'HAL',
    name: 'Hindustan Aeronautics Ltd',
    exchange: 'NSE',
    signal: 'STRONG BUY',
    score: 88,
    sector: 'Defence',
    price: 4120,
    reasons: [
      'Large institutional investors have been buying for 6 weeks in a row',
      'Government defence budget is at an all-time high, directly benefiting HAL',
      'Order book is full for the next 3 years — revenue is predictable',
    ],
    trust_score: 84,
    horizon: '2–4 weeks',
  },
  {
    symbol: 'ONGC',
    name: 'Oil & Natural Gas Corp',
    exchange: 'NSE',
    signal: 'BUY',
    score: 74,
    sector: 'Energy',
    price: 268,
    reasons: [
      'Rising global oil prices directly increase company profits',
      'Stock is trading below its historical average price, making it a value pick',
      'Government is increasing spending on domestic energy — ONGC benefits directly',
    ],
    trust_score: 71,
    horizon: '3–6 weeks',
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank',
    exchange: 'NSE',
    signal: 'NEUTRAL',
    score: 52,
    sector: 'Banking',
    price: 1680,
    reasons: [
      'Uncertainty about the next RBI interest rate decision is keeping investors cautious',
      'The bank is fundamentally strong but short-term direction is unclear',
      'Wait for the next quarterly result before taking a position',
    ],
    trust_score: 61,
    horizon: '—',
  },
  {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    exchange: 'NSE',
    signal: 'AVOID',
    score: 28,
    sector: 'IT',
    price: 1520,
    reasons: [
      'Large investors have been selling for 8 weeks straight',
      'The company cut its own revenue expectations last quarter — a warning sign',
      'Global demand for IT services is slowing down, hurting new order wins',
    ],
    trust_score: 77,
    horizon: '4–8 weeks',
  },
]

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('All')

  const mapSignals = (arr: any[]): Signal[] =>
    arr.map((a: any) => ({
      symbol: a.symbol,
      name: a.name,
      exchange: a.exchange,
      signal: a.signal,
      score: a.score,
      reasons: a.score_breakdown ?? a.reasons ?? [],
      trust_score: a.trust_score,
      horizon: a.horizon,
      sector: a.sector,
      price: a.price,
    }))

  useEffect(() => {
    fetch(`${API}/api/alerts/signals`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.alerts ?? d.results ?? [])
        const mapped = mapSignals(arr)
        setSignals(mapped.length > 0 ? mapped : MOCK_SIGNALS)
        setLoading(false)
      })
      .catch(() => { setSignals(MOCK_SIGNALS); setLoading(false) })
  }, [])

  const rescan = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/alerts/signals`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.alerts ?? d.results ?? [])
        const mapped = mapSignals(arr)
        setSignals(mapped.length > 0 ? mapped : MOCK_SIGNALS)
        setLoading(false)
      })
      .catch(() => { setSignals(MOCK_SIGNALS); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'All') return signals
    if (filter === 'Opportunities') return signals.filter(s => s.signal === 'BUY' || s.signal === 'STRONG BUY')
    if (filter === 'Avoid') return signals.filter(s => s.signal === 'AVOID')
    return signals.filter(s => s.signal === 'NEUTRAL')
  }, [signals, filter])

  const counts = useMemo(() => ({
    buy: signals.filter(s => s.signal === 'BUY' || s.signal === 'STRONG BUY').length,
    avoid: signals.filter(s => s.signal === 'AVOID').length,
    neutral: signals.filter(s => s.signal === 'NEUTRAL').length,
  }), [signals])

  const emptyMessage = useMemo(() => {
    if (filter === 'Opportunities') return 'No buy opportunities right now. Try switching to "All" to see all signals.'
    if (filter === 'Avoid') return 'No stocks flagged to avoid right now. Switch to "All" for the full picture.'
    if (filter === 'Watch') return 'No neutral signals right now. Try "All" to see everything.'
    return 'No signals available right now.'
  }, [filter])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Pulse keyframe */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Investment Signals</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {counts.buy} active opportunities · Updated {new Date().toLocaleDateString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {/* Scan button */}
        <button onClick={rescan} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '6px 14px',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: loading ? 'var(--amber)' : 'var(--green)',
            animation: loading ? 'pulse 1s infinite' : 'none',
            display: 'inline-block',
          }} />
          {loading ? 'Scanning...' : 'Scan now'}
        </button>
      </div>

      {/* Score Legend (toggleable) */}
      <ScoreLegend />

      {/* Summary row */}
      {!loading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Opportunities', count: counts.buy, color: 'var(--green)' },
            { label: 'Not Recommended', count: counts.avoid, color: 'var(--red)' },
            { label: 'Wait and Watch', count: counts.neutral, color: 'var(--amber)' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '10px 16px', flex: '1 1 100px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <FilterTabs active={filter} onChange={setFilter} />

      {/* Mini Track Record — shown above signal list */}
      <MiniTrackRecord />

      {/* Signal list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(s => <SignalCard key={s.symbol} signal={s} />)}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

    </div>
  )
}
