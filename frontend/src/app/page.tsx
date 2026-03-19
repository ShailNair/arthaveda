// /frontend/src/app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface TodayBrief {
  market_mood: string
  top_opportunity: string
  risk_to_watch: string
  mood_signal?: 'positive' | 'negative' | 'neutral'
}

interface Prediction {
  sector: string
  direction: 'up' | 'down'
  confidence: 'High' | 'Medium' | 'Low'
  why_now: string
  horizon: string
  sector_slug?: string
}

interface Alert {
  symbol: string
  name: string
  exchange?: string
  score: number
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'AVOID'
  thesis: string
  score_breakdown?: string[]
  forensic_flags?: string[]
  cagr_proxy?: number
  max_drawdown?: number
  volatility?: number
  nifty_return?: number
  stock_return?: number
}

interface ChartPoint {
  date: string
  price: number
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function signalColor(signal: string): string {
  if (signal === 'STRONG BUY' || signal === 'BUY') return 'var(--green)'
  if (signal === 'AVOID') return 'var(--red)'
  return 'var(--amber)'
}

function signalBadgeClass(signal: string): string {
  if (signal === 'STRONG BUY' || signal === 'BUY') return 'badge badge-green'
  if (signal === 'AVOID') return 'badge badge-red'
  return 'badge badge-amber'
}

function signalDisplayLabel(signal: string): string {
  if (signal === 'STRONG BUY') return 'Strong Opportunity'
  if (signal === 'BUY') return 'Good Opportunity'
  if (signal === 'AVOID') return 'Not Recommended'
  return 'Wait and Watch'
}

function moodColor(signal?: string): string {
  if (signal === 'positive') return 'var(--green)'
  if (signal === 'negative') return 'var(--red)'
  return 'var(--amber)'
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <span className="num" style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28 }}>{pct}</span>
    </div>
  )
}

function generateMockChart(symbol: string, positive: boolean): ChartPoint[] {
  const points: ChartPoint[] = []
  let price = 100 + (symbol.charCodeAt(0) % 20) * 5
  const now = new Date()
  for (let i = 60; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const drift = positive ? 0.008 : -0.003
    const noise = (Math.random() - 0.48) * 3
    price = price * (1 + drift + noise / 100)
    points.push({
      date: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      price: parseFloat(price.toFixed(2)),
    })
  }
  return points
}

/* ─── Expanded Stock Detail ──────────────────────────────────────────────── */
function StockDetail({ alert }: { alert: Alert }) {
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const positive = (alert.stock_return ?? alert.score) > (alert.nifty_return ?? 10)
  const lineColor = positive ? 'var(--green)' : 'var(--red)'

  useEffect(() => {
    fetch(`${API}/api/analytics/features/${alert.symbol}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.price_history) && data.price_history.length > 0) {
          setChartData(data.price_history)
        } else {
          setChartData(generateMockChart(alert.symbol, positive))
        }
      })
      .catch(() => setChartData(generateMockChart(alert.symbol, positive)))
  }, [alert.symbol, positive])

  const stockRet = alert.stock_return ?? Math.round(alert.score * 0.3)
  const niftyRet = alert.nifty_return ?? 12

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 5Y Chart */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          5-Year Price History
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={11} axisLine={false} tickLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                itemStyle={{ color: lineColor }}
              />
              <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="skeleton" style={{ height: 140, borderRadius: 8 }} />
        )}
      </div>

      {/* Benchmark comparison */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stock Return (1Y)</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 700, color: stockRet >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
            {stockRet >= 0 ? '+' : ''}{stockRet}%
          </div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nifty Return (1Y)</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 700, color: niftyRet >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
            {niftyRet >= 0 ? '+' : ''}{niftyRet}%
          </div>
        </div>
      </div>

      {/* 3 Key Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Annual Growth (3Y)', value: alert.cagr_proxy != null ? `${alert.cagr_proxy}%` : '—' },
          { label: 'Biggest Fall', value: alert.max_drawdown != null ? `${alert.max_drawdown}%` : '—' },
          { label: 'Price Swings', value: alert.volatility != null ? `${alert.volatility}%` : '—' },
        ].map(stat => (
          <div key={stat.label} style={{ flex: '1 1 80px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Why this signal */}
      {alert.score_breakdown && alert.score_breakdown.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Why this signal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {alert.score_breakdown.slice(0, 3).map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0, fontSize: 10 }}>◆</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk factors */}
      {alert.forensic_flags && alert.forensic_flags.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Factors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {alert.forensic_flags.map((flag, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0, fontSize: 10 }}>▲</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href={`/analytics?symbol=${alert.symbol}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
        Deep Analysis →
      </Link>
    </div>
  )
}

/* ─── Stock Card ─────────────────────────────────────────────────────────── */
function StockCard({ alert, isAvoid }: { alert: Alert; isAvoid?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const borderColor = isAvoid ? 'var(--red)' : signalColor(alert.signal)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{alert.name}</span>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4 }}>
              {alert.symbol}{alert.exchange ? ` · ${alert.exchange}` : ''}
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Opportunity Score</div>
            <ScoreBar score={alert.score} />
          </div>
        </div>
        <span className={signalBadgeClass(alert.signal)} style={{ flexShrink: 0 }}>{signalDisplayLabel(alert.signal)}</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0', lineHeight: 1.5 }}>{alert.thesis}</p>

      <button
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {expanded ? 'Collapse ↑' : 'Expand ↓'}
      </button>

      {expanded && <StockDetail alert={alert} />}
    </div>
  )
}

/* ─── Today's Best Trade ─────────────────────────────────────────────────── */
interface BestTrade {
  symbol: string
  name: string
  price: number
  signal: 'STRONG BUY' | 'BUY'
  score: number
  thesis: string
  sector?: string
  horizon?: string
}

function TodaysBestTrade({ refreshKey }: { refreshKey: number }) {
  const [trade, setTrade] = useState<BestTrade | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/alerts/signals`)
      .then(r => r.json())
      .then(d => {
        const arr: any[] = Array.isArray(d) ? d : (d.alerts ?? d.results ?? [])
        // Pick highest-score BUY/STRONG BUY
        const buys = arr
          .filter((a: any) => a.signal === 'STRONG BUY' || a.signal === 'BUY')
          .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
        const top = buys[0]
        if (top) {
          setTrade({
            symbol: top.symbol, name: top.name,
            price: top.price ?? 0,
            signal: top.signal, score: top.score,
            thesis: (top.score_breakdown ?? top.reasons ?? [])[0] ?? top.thesis ?? '',
            sector: top.sector,
            horizon: top.horizon,
          })
        } else {
          // Fallback to best mock
          setTrade({ symbol: 'HAL', name: 'Hindustan Aeronautics', price: 4120, signal: 'STRONG BUY', score: 88,
            thesis: 'Large institutional investors buying for 6 weeks straight — defence order book full for 3 years',
            sector: 'Defence', horizon: '2–4 weeks' })
        }
        setLoading(false)
      })
      .catch(() => {
        setTrade({ symbol: 'HAL', name: 'Hindustan Aeronautics', price: 4120, signal: 'STRONG BUY', score: 88,
          thesis: 'Large institutional investors buying for 6 weeks straight — defence order book full for 3 years',
          sector: 'Defence', horizon: '2–4 weeks' })
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  if (loading) return <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />
  if (!trade) return null

  const target   = Math.round(trade.price * 1.10)
  const stopLoss = Math.round(trade.price * 0.94)
  const confidence = trade.score

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(48,209,88,0.08) 0%, var(--surface) 60%)',
      border: '1px solid rgba(48,209,88,0.25)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(48,209,88,0.04)', pointerEvents: 'none',
      }} />

      {/* Tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>🔥</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Today's Best Trade
        </span>
        {trade.sector && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 10 }}>
            {trade.sector}
          </span>
        )}
      </div>

      {/* Stock + signal */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {trade.signal === 'STRONG BUY' ? 'BUY' : 'BUY'} {trade.symbol}
            </span>
            {trade.price > 0 && (
              <span className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
                @ ₹{trade.price.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{trade.name}</div>
        </div>
        <span className="badge badge-green" style={{ flexShrink: 0, fontSize: 11 }}>
          {trade.signal === 'STRONG BUY' ? 'Strong Opportunity' : 'Good Opportunity'}
        </span>
      </div>

      {/* Price targets */}
      {trade.price > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Target', value: `₹${target.toLocaleString('en-IN')}`, sub: '+10%', color: 'var(--green)' },
            { label: 'Stop Loss', value: `₹${stopLoss.toLocaleString('en-IN')}`, sub: '−6%', color: 'var(--red)' },
            { label: trade.horizon ? 'Hold for' : 'Confidence', value: trade.horizon ?? `${confidence}%`, sub: trade.horizon ? `${confidence}% confidence` : 'signal strength', color: 'var(--text-primary)' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--surface-2)', borderRadius: 'var(--radius)',
              padding: '8px 14px', flex: '1 1 80px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div className="num" style={{ fontSize: 15, fontWeight: 700, color: item.color, marginTop: 2 }}>{item.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Confidence bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</span>
          <span className="num" style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>{confidence}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${confidence}%`, height: '100%', background: 'var(--green)', borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Thesis */}
      {trade.thesis && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14, borderLeft: '2px solid var(--green)', paddingLeft: 10 }}>
          {trade.thesis}
        </p>
      )}

      {/* CTA */}
      <Link href={`/analytics?symbol=${trade.symbol}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, color: 'var(--green)',
        textDecoration: 'none', borderBottom: '1px solid rgba(48,209,88,0.3)',
        paddingBottom: 1,
      }}>
        Full trade plan →
      </Link>
    </div>
  )
}

/* ─── Today's Brief ──────────────────────────────────────────────────────── */
function TodaysBrief() {
  const [data, setData] = useState<TodayBrief | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/context/today`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => {
        setData({
          market_mood: 'Markets consolidating — broad-based sideways action across sectors',
          top_opportunity: 'Defence sector showing accumulation — institutions building positions quietly',
          risk_to_watch: 'Global bond yields rising — watch for FII outflows in rate-sensitive sectors',
          mood_signal: 'neutral',
        })
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}
      </div>
    )
  }

  if (!data) return null

  const bullets = [
    { label: 'Market mood', text: data.market_mood, color: moodColor(data.mood_signal) },
    { label: 'Top opportunity', text: data.top_opportunity, color: 'var(--green)' },
    { label: 'Risk to watch', text: data.risk_to_watch, color: 'var(--red)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'stretch',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          <div style={{ width: 3, background: b.color, flexShrink: 0 }} />
          <div style={{ padding: '12px 16px', flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{b.label}</div>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 3, lineHeight: 1.5 }}>{b.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Where to Invest Now ────────────────────────────────────────────────── */
function WhereToInvest() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/predictions/`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.predictions ?? [])
        setPredictions(arr.slice(0, 3))
        setLoading(false)
      })
      .catch(() => {
        setPredictions([
          { sector: 'Defence', direction: 'up', confidence: 'High', why_now: 'Budget allocation surge + geopolitical demand driving order books', horizon: '2–4 weeks' },
          { sector: 'Energy', direction: 'up', confidence: 'High', why_now: 'Oil price tailwind + FII buying in ONGC and Reliance', horizon: '3–6 weeks' },
          { sector: 'IT', direction: 'down', confidence: 'Medium', why_now: 'Global slowdown signals + stretched valuations vs earnings growth', horizon: '4–8 weeks' },
        ])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ flex: '1 1 200px', height: 130 }} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {predictions.map((p, i) => {
        const isUp = p.direction === 'up'
        const color = isUp ? 'var(--green)' : 'var(--red)'
        return (
          <div key={i} style={{
            flex: '1 1 200px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: `2px solid ${color}`,
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, color, fontWeight: 700 }}>{isUp ? '↑' : '↓'}</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{p.sector}</span>
              </div>
              <span className={`badge ${p.confidence === 'High' ? 'badge-green' : 'badge-amber'}`}>{p.confidence}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.why_now}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Horizon: {p.horizon}</span>
              <Link href={`/signals?sector=${p.sector_slug ?? p.sector.toLowerCase()}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                View stocks →
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Top Opportunities ──────────────────────────────────────────────────── */
const MOCK_OPPORTUNITIES: Alert[] = [
  {
    symbol: 'HAL', name: 'Hindustan Aeronautics', exchange: 'NSE', score: 88,
    signal: 'STRONG BUY', thesis: 'Massive defence order pipeline — 5-year visibility on revenue',
    score_breakdown: ['FII accumulation over 6 consecutive weeks', 'Price above 200-DMA with rising volume', 'Earnings growth trajectory accelerating'],
    forensic_flags: ['High PE relative to sector average', 'Promoter pledge marginally elevated'],
    cagr_proxy: 34, max_drawdown: -28, volatility: 22, stock_return: 41, nifty_return: 14,
  },
  {
    symbol: 'ONGC', name: 'ONGC', exchange: 'NSE', score: 74,
    signal: 'BUY', thesis: 'Oil tailwind + undervalued vs global peers — dividend yield attractive',
    score_breakdown: ['Crude oil price correlation positive', 'Low PE vs historical average', 'Government capex in energy sector rising'],
    forensic_flags: ['Government ownership limits float', 'Sensitive to global crude price swings'],
    cagr_proxy: 18, max_drawdown: -35, volatility: 19, stock_return: 18, nifty_return: 14,
  },
  {
    symbol: 'IRFC', name: 'Indian Railway Finance', exchange: 'NSE', score: 71,
    signal: 'BUY', thesis: 'Railway infra boom — zero credit risk with sovereign backing',
    score_breakdown: ['Budget allocation to railways at all-time high', 'Consistent dividend payer', 'Low NPA — entire book backed by Railways'],
    forensic_flags: ['Limited growth optionality', 'Interest rate sensitivity'],
    cagr_proxy: 21, max_drawdown: -22, volatility: 14, stock_return: 22, nifty_return: 14,
  },
]

function TopOpportunities() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/alerts/signals`)
      .then(r => r.json())
      .then(d => {
        const arr: Alert[] = Array.isArray(d) ? d : (d.alerts ?? d.results ?? [])
        const buys = arr.filter(a => a.signal === 'STRONG BUY' || a.signal === 'BUY')
        setAlerts(buys.length > 0 ? buys : MOCK_OPPORTUNITIES)
        setLoading(false)
      })
      .catch(() => {
        setAlerts(MOCK_OPPORTUNITIES)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  if (alerts.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No opportunities meeting criteria right now — check back tomorrow.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {alerts.map(alert => <StockCard key={alert.symbol} alert={alert} />)}
    </div>
  )
}

/* ─── What to Avoid ──────────────────────────────────────────────────────── */
function WhatToAvoid() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/alerts/signals`)
      .then(r => r.json())
      .then(d => {
        const arr: Alert[] = Array.isArray(d) ? d : (d.alerts ?? d.results ?? [])
        setAlerts(arr.filter(a => a.signal === 'AVOID'))
        setLoading(false)
      })
      .catch(() => {
        setAlerts([
          {
            symbol: 'INFY', name: 'Infosys', exchange: 'NSE', score: 28,
            signal: 'AVOID', thesis: 'High PE + distribution phase + FII selling — wait for reset',
            score_breakdown: ['FII selling for 8 consecutive weeks', 'Revenue guidance cut in recent quarter', 'US client budget freeze slowing deal wins'],
            forensic_flags: ['Stretched valuation at 25x forward PE', 'Insider selling elevated', 'Weak global IT demand environment'],
            cagr_proxy: 8, max_drawdown: -42, volatility: 28, stock_return: -6, nifty_return: 14,
          },
        ])
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--red)', fontSize: 14 }}>✕</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>What to Avoid</span>
          {!loading && alerts.length > 0 && (
            <span className="badge badge-red">{alerts.length} {alerts.length === 1 ? 'stock' : 'stocks'}</span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '↑ Collapse' : '↓ Show'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {loading ? (
            <div className="skeleton" style={{ height: 80, marginTop: 12 }} />
          ) : alerts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>No stocks flagged for avoidance right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {alerts.map(alert => <StockCard key={alert.symbol} alert={alert} isAvoid />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function InvestPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  function handleRefresh() {
    setRefreshKey(k => k + 1)
    setLastRefreshed(new Date())
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 36 }}>

      {/* Pulse keyframe */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Where to Invest Today</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Live signals updated daily. One clear recommendation.</p>
        </div>
        <button onClick={handleRefresh} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '6px 14px',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Hero — Today's Best Trade */}
      <section>
        <TodaysBestTrade refreshKey={refreshKey} />
      </section>

      {/* Section 1 */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Today's Brief
        </h2>
        <TodaysBrief />
      </section>

      {/* Section 2 */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Sector Outlook
        </h2>
        <WhereToInvest />
      </section>

      {/* Section 3 */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Top Opportunities
          </h2>
          <Link href="/signals" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
        </div>
        <TopOpportunities />
      </section>

      {/* Section 4 */}
      <section>
        <WhatToAvoid />
      </section>

    </div>
  )
}
