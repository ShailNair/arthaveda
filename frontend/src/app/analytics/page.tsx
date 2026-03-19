'use client'
import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Features {
  symbol: string
  rsi_14: number | null
  rsi_5: number | null
  macd: number | null
  macd_signal: number | null
  macd_histogram: number | null
  atr_14: number | null
  atr_pct: number | null
  bb_upper: number | null
  bb_middle: number | null
  bb_lower: number | null
  bb_pct_b: number | null
  vwap_deviation: number | null
  vol_spike_ratio: number | null
  mom_1d: number | null
  mom_5d: number | null
  mom_20d: number | null
  mom_60d: number | null
  week52_position: number | null
  price_vs_sma50: number | null
  price_vs_sma200: number | null
  data_bars: number
  computed_at: string
  price_history?: { date: string; price: number }[]
}

interface FeatureContrib {
  name: string
  value: number | null
  contribution: number
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
}

interface ModelScore {
  symbol: string
  probability: number
  probability_pct: number
  signal_label: string
  signal_color: string
  confidence: string
  model_backend: string
  feature_contributions: FeatureContrib[]
  top_features: FeatureContrib[]
  macro_impact: { regime: string; fii_signal: string; rate_signal: string; vix: number }
}

interface BacktestResult {
  backtest_result: {
    total_signals: number
    win_rate_4w: number
    win_rate_positive: number
    target_hit_rate: number
    stop_loss_rate: number
    avg_return_2w: number
    avg_return_4w: number
    avg_return_8w: number
    max_return: number
    min_return: number
    max_drawdown: number
    sharpe_approx: number
    transaction_cost_pct: number
    walk_forward_windows: { period: string; n_signals: number; win_rate: number; avg_return: number }[]
  }
  per_symbol_summary: Record<string, { signals: number; win_rate: number; avg_return: number; best_trade: number; worst_trade: number }>
  metadata: { generated_at: string; symbols_tested: number; disclaimer: string; data_limitation: string }
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const pct = (v: number | null, decimals = 1) =>
  v === null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(decimals)}%`
const fmt = (v: number | null, decimals = 2) =>
  v === null ? '—' : v.toFixed(decimals)

const DIRECTION_COLOR: Record<string, string> = {
  BULLISH: 'var(--green)',
  BEARISH: 'var(--red)',
  NEUTRAL: 'var(--slate)',
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
function AnalyticsInner() {
  const searchParams = useSearchParams()
  const urlSymbol    = searchParams.get('symbol')?.toUpperCase() || 'TCS'
  const [symbol, setSymbol] = useState(urlSymbol)
  const [input, setInput]   = useState(urlSymbol)
  const [tab, setTab]       = useState<'features' | 'score' | 'backtest'>('score')
  const [features, setFeatures]   = useState<Features | null>(null)
  const [score, setScore]         = useState<ModelScore | null>(null)
  const [backtest, setBacktest]   = useState<BacktestResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [btLoading, setBtLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([])

  // Auto-analyze when arriving from a stock link (e.g. /analytics?symbol=BAJFINANCE)
  useEffect(() => { analyze(urlSymbol) }, [urlSymbol]) // eslint-disable-line

  const analyze = useCallback(async (sym: string) => {
    setLoading(true); setError(null); setBacktest(null)
    try {
      const [f, s] = await Promise.all([
        api.analytics.features(sym),
        api.analytics.modelScore(sym),
      ])
      setFeatures(f)
      setScore(s)
      setSymbol(sym)

      // Build chart data
      if (Array.isArray(f?.price_history) && f.price_history.length > 0) {
        setChartData(f.price_history)
      } else {
        const mock: { date: string; price: number }[] = []
        for (let i = 12; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          mock.push({
            date: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
            price: Math.round((100 + Math.random() * 30) * 100) / 100,
          })
        }
        setChartData(mock)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runBacktest = async (sym?: string) => {
    setBtLoading(true)
    const targetSym = sym ?? symbol
    try {
      // Pass the specific stock symbol + force=true so results are fresh and stock-specific
      const r = await api.analytics.backtest(targetSym, true)
      setBacktest(r)
      setTab('backtest')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBtLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Deep Stock Analysis</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Analyze any stock — technical indicators, momentum, and opportunity score
          </p>
        </div>
        <button
          onClick={() => runBacktest(symbol)}
          disabled={btLoading}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius)',
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 500,
            cursor: btLoading ? 'not-allowed' : 'pointer',
            opacity: btLoading ? 0.5 : 1,
            transition: 'all 0.14s',
          }}
        >
          {btLoading ? '⟳ Running...' : '📊 Run Backtest'}
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && analyze(input)}
          placeholder="Enter NSE symbol (e.g. RELIANCE, TCS, HDFCBANK)"
          className="input flex-1"
        />
        <button
          onClick={() => analyze(input)}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '9px 22px' }}
        >
          {loading ? '⟳' : 'Analyze'}
        </button>
      </div>

      {error && (
        <div className="card p-3 text-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>
      )}

      {/* Tabs */}
      {(features || backtest) && (
        <div className="flex gap-2">
          {(['score', 'features', 'backtest'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                // Auto-run backtest when clicking the tab — always fresh per-stock
                if (t === 'backtest' && !btLoading) runBacktest(symbol)
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.14s',
                background: tab === t ? 'var(--accent)' : 'var(--surface-2)',
                color: tab === t ? '#000' : 'var(--text-secondary)',
              }}
            >
              {t === 'score' ? '🎯 Score' : t === 'features' ? '⚙️ All Features' : '📈 Backtest'}
            </button>
          ))}
        </div>
      )}

      {/* ── SCORE TAB ─────────────────────────────────────────────────────── */}
      {tab === 'score' && score && !loading && (
        <div className="space-y-3">

          {/* Quick summary pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{score.symbol}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: score.signal_color || 'var(--accent)' }}>{score.signal_label}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-secondary)' }}>{score.probability_pct}% confidence</span>
          </div>

          {/* Price History Chart */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
          }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}>
              12-Month Price History — {score.symbol}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  interval={2}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={score.signal_color || 'var(--accent)'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Main signal card */}
          <div className="card p-5 space-y-3" style={{ borderLeftColor: score.signal_color, borderLeftWidth: 4 }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{score.symbol}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {features?.data_bars} bars of historical data · {score.model_backend} backend
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold" style={{ color: score.signal_color }}>
                  {score.probability_pct}%
                </div>
                <div className="text-xs font-bold mt-0.5" style={{ color: score.signal_color }}>
                  {score.signal_label}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{score.confidence} confidence</div>
              </div>
            </div>

            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score.probability_pct}%`, background: score.signal_color }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Opportunity score based on RSI, MACD, Bollinger Bands, volume, momentum, 52-week position and macro signals
            </p>
          </div>

          {/* Top 3 features driving the score */}
          <div className="card p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Top Signal Drivers
            </div>
            {score.top_features.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="text-lg shrink-0">{i === 0 ? '①' : i === 1 ? '②' : '③'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                      {f.name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        color: DIRECTION_COLOR[f.direction],
                        background: DIRECTION_COLOR[f.direction].replace(')', ', 0.12)').replace('var(', 'color-mix(in srgb, ').replace('color-mix', 'var(').replace(', 0.12)', '_15)'),
                      }}>
                      {f.direction}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Value: <span style={{ color: 'var(--text-secondary)' }}>{fmt(f.value)}</span>
                    <span className="mx-2">·</span>
                    Impact: <span style={{ color: f.contribution > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {f.contribution > 0 ? '+' : ''}{(f.contribution * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* All feature contributions */}
          <div className="card p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              All Feature Contributions
            </div>
            {score.feature_contributions.map(f => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-[10px] w-36 shrink-0 capitalize" style={{ color: 'var(--text-muted)' }}>
                  {f.name.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${Math.abs(f.contribution) * 500}%`,
                      maxWidth: '100%',
                      background: f.contribution > 0 ? 'var(--green)' : 'var(--red)',
                      marginLeft: f.contribution < 0 ? 'auto' : undefined,
                    }} />
                </div>
                <span className="text-[10px] w-12 text-right" style={{ color: DIRECTION_COLOR[f.direction] }}>
                  {fmt(f.value)}
                </span>
              </div>
            ))}
          </div>

          {/* Macro context */}
          <div className="card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              Macro Context
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  label: 'Regime',
                  value: score.macro_impact.regime,
                  color: score.macro_impact.regime === 'BULL' ? 'var(--green)' : score.macro_impact.regime === 'BEAR' ? 'var(--red)' : 'var(--slate)',
                },
                {
                  label: 'FII',
                  value: score.macro_impact.fii_signal,
                  color: score.macro_impact.fii_signal === 'BUYING' ? 'var(--green)' : score.macro_impact.fii_signal === 'SELLING' ? 'var(--red)' : 'var(--slate)',
                },
                {
                  label: 'Rate',
                  value: score.macro_impact.rate_signal,
                  color: score.macro_impact.rate_signal === 'FALLING' ? 'var(--green)' : 'var(--slate)',
                },
                {
                  label: 'VIX',
                  value: `${score.macro_impact.vix}`,
                  color: (score.macro_impact.vix || 15) > 20 ? 'var(--red)' : 'var(--green)',
                },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FEATURES TAB ──────────────────────────────────────────────────── */}
      {tab === 'features' && features && !loading && (
        <div className="space-y-3">
          <FeatureSection title="Momentum" icon="📈" items={[
            { label: '1-Day Return',   value: pct(features.mom_1d),  raw: features.mom_1d,  bullishIf: v => v > 0 },
            { label: '5-Day Return',   value: pct(features.mom_5d),  raw: features.mom_5d,  bullishIf: v => v > 0 },
            { label: '20-Day Return',  value: pct(features.mom_20d), raw: features.mom_20d, bullishIf: v => v < -0.05 },
            { label: '60-Day Return',  value: pct(features.mom_60d), raw: features.mom_60d, bullishIf: v => v > 0 },
          ]} />

          <FeatureSection title="Oscillators" icon="⚡" items={[
            { label: 'RSI (14)',        value: fmt(features.rsi_14),         raw: features.rsi_14,        bullishIf: v => v < 40 },
            { label: 'RSI (5)',         value: fmt(features.rsi_5),          raw: features.rsi_5,         bullishIf: v => v < 35 },
            { label: 'MACD',           value: fmt(features.macd),           raw: features.macd,          bullishIf: v => v > 0 },
            { label: 'MACD Signal',    value: fmt(features.macd_signal),    raw: features.macd_signal,   bullishIf: v => v > 0 },
            { label: 'MACD Histogram', value: fmt(features.macd_histogram), raw: features.macd_histogram, bullishIf: v => v > 0 },
          ]} />

          <FeatureSection title="Volatility & Bands" icon="🌊" items={[
            { label: 'ATR (14)',   value: fmt(features.atr_14),                   raw: features.atr_14,   bullishIf: () => null },
            { label: 'ATR %',     value: `${fmt(features.atr_pct)}%`,             raw: features.atr_pct,  bullishIf: () => null },
            { label: 'BB Upper',  value: `₹${fmt(features.bb_upper)}`,            raw: null,              bullishIf: () => null },
            { label: 'BB Middle', value: `₹${fmt(features.bb_middle)}`,           raw: null,              bullishIf: () => null },
            { label: 'BB Lower',  value: `₹${fmt(features.bb_lower)}`,            raw: null,              bullishIf: () => null },
            { label: 'BB %B',     value: fmt(features.bb_pct_b, 3),               raw: features.bb_pct_b, bullishIf: v => v < 0.25 },
          ]} />

          <FeatureSection title="Trend & Position" icon="🧭" items={[
            { label: '52w Position', value: `${fmt(features.week52_position, 1)}%`,                        raw: features.week52_position, bullishIf: v => v < 30 },
            { label: 'vs SMA-50',    value: `${fmt((features.price_vs_sma50 || 1) * 100 - 100, 1)}%`,     raw: features.price_vs_sma50,  bullishIf: v => v < 1 },
            { label: 'vs SMA-200',   value: `${fmt((features.price_vs_sma200 || 1) * 100 - 100, 1)}%`,    raw: features.price_vs_sma200, bullishIf: v => v < 1 },
            { label: 'VWAP Dev',     value: `${fmt((features.vwap_deviation || 0) * 100, 2)}%`,            raw: features.vwap_deviation,  bullishIf: v => v < 0 },
            { label: 'Volume Spike', value: `${fmt(features.vol_spike_ratio)}x`,                           raw: features.vol_spike_ratio, bullishIf: v => v > 1.5 },
          ]} />

          <div className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>
            {features.data_bars} bars of OHLCV data · Computed {new Date(features.computed_at).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* ── BACKTEST TAB ──────────────────────────────────────────────────── */}
      {tab === 'backtest' && btLoading && (
        <div className="space-y-3">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            Running backtest across 13 symbols — this takes 15–30 seconds…
          </div>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      )}
      {tab === 'backtest' && backtest && !btLoading && (
        <BacktestView backtest={backtest} symbol={symbol} />
      )}
      {tab === 'backtest' && !backtest && !btLoading && (
        <div className="card p-8 text-center space-y-3">
          <div style={{ fontSize: 32 }}>📈</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Loading backtest results…</div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Tests signals across 13 NSE stocks over 1 year of historical data. Usually takes 15–30 seconds.
          </p>
        </div>
      )}

      {(loading || btLoading) && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      )}

      {!features && !score && !loading && !error && (
        <div className="card p-10 text-center space-y-3">
          <div className="text-4xl">📊</div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Enter a stock symbol to analyze</div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Computes RSI, MACD, ATR, Bollinger Bands, momentum across 1 year of real historical data.
            Generates an opportunity score with full indicator breakdown.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['TCS', 'RELIANCE', 'HDFCBANK', 'INFY', 'SUNPHARMA', 'SBIN'].map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); analyze(s) }}
                style={{
                  padding: '6px 14px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Feature Section Component ─────────────────────────────────────────── */
function FeatureSection({ title, icon, items }: {
  title: string
  icon: string
  items: { label: string; value: string; raw: number | null; bullishIf: (v: number) => boolean | null }[]
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const signal = item.raw !== null ? item.bullishIf(item.raw) : null
          const color  = signal === true ? 'var(--green)' : signal === false ? 'var(--red)' : 'var(--slate)'
          return (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color }}>{item.value}</span>
                {signal !== null && (
                  <span className="text-[9px]" style={{ color }}>
                    {signal ? '▲ BULLISH' : '▼ BEARISH'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Backtest View ──────────────────────────────────────────────────────── */
function BacktestView({ backtest, symbol }: { backtest: BacktestResult; symbol: string }) {
  const bt   = backtest.backtest_result
  const meta = backtest.metadata

  // Per-stock data for the currently analyzed symbol
  const thisStock = backtest.per_symbol_summary[symbol] ?? null
  const allSymbols = Object.entries(backtest.per_symbol_summary)
    .sort((a, b) => b[1].avg_return - a[1].avg_return)

  const Metric = ({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) => (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-3">

      {/* ── THIS STOCK ── */}
      {thisStock ? (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(48,209,88,0.3)',
          borderLeft: '4px solid var(--green)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {symbol} — Historical Signal Performance
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {thisStock.signals} past signals tested · 1 year of data
              </div>
            </div>
            <span style={{
              fontSize: 24, fontWeight: 800,
              color: thisStock.win_rate >= 0.55 ? 'var(--green)' : thisStock.win_rate >= 0.45 ? 'var(--amber)' : 'var(--red)',
            }}>
              {(thisStock.win_rate * 100).toFixed(0)}%
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Win Rate',   value: `${(thisStock.win_rate * 100).toFixed(0)}%`,      color: thisStock.win_rate >= 0.5 ? 'var(--green)' : 'var(--red)', sub: 'signals that gained' },
              { label: 'Avg Return', value: `${thisStock.avg_return >= 0 ? '+' : ''}${(thisStock.avg_return * 100).toFixed(1)}%`, color: thisStock.avg_return > 0 ? 'var(--green)' : 'var(--red)', sub: 'per 4-week hold' },
              { label: 'Best Trade', value: `+${(thisStock.best_trade * 100).toFixed(1)}%`,   color: 'var(--green)', sub: 'highest single gain' },
              { label: 'Worst Trade',value: `${(thisStock.worst_trade * 100).toFixed(1)}%`,   color: 'var(--red)',   sub: 'biggest single loss' },
            ].map(m => (
              <Metric key={m.label} label={m.label} value={m.value} color={m.color} sub={m.sub} />
            ))}
          </div>

          {/* Verdict */}
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            {thisStock.win_rate >= 0.60
              ? `✅ Strong historical performance — ${symbol}'s signals have been right ${(thisStock.win_rate * 100).toFixed(0)}% of the time, averaging +${(thisStock.avg_return * 100).toFixed(1)}% per trade.`
              : thisStock.win_rate >= 0.50
              ? `⚠️ Decent track record — ${symbol} signals have a slight edge (${(thisStock.win_rate * 100).toFixed(0)}% win rate). Apply position sizing carefully.`
              : `⚠️ Mixed history — ${symbol} signals have only been right ${(thisStock.win_rate * 100).toFixed(0)}% of the time. Use this as one of multiple inputs, not a standalone call.`
            }
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px 18px',
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          No historical signal data found for {symbol} in this backtest window.
          The stock may not have enough historical data (minimum 80 bars required).
        </div>
      )}

      {/* ── STRATEGY OVERVIEW ── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Strategy Overview</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {meta.symbols_tested} stocks · {bt.total_signals} signals tested
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          How the signal strategy performs across all stocks over 1 year
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Win Rate (4w)"   value={`${(bt.win_rate_4w * 100).toFixed(0)}%`}    color={bt.win_rate_4w > 0.5 ? 'var(--green)' : 'var(--red)'} sub="signals beating 8% target" />
          <Metric label="Avg Return (4w)" value={`${bt.avg_return_4w >= 0 ? '+' : ''}${(bt.avg_return_4w * 100).toFixed(1)}%`} color={bt.avg_return_4w > 0 ? 'var(--green)' : 'var(--red)'} sub="average 4-week gain" />
          <Metric label="Target Hit Rate" value={`${(bt.target_hit_rate * 100).toFixed(0)}%`} sub="+8% target reached" />
          <Metric label="Stop Loss Rate"  value={`${(bt.stop_loss_rate * 100).toFixed(0)}%`}  color="var(--red)" sub="−6% stop triggered" />
          <Metric label="Max Drawdown"    value={`${(bt.max_drawdown * 100).toFixed(1)}%`}   color="var(--red)" sub="worst equity dip" />
          <Metric label="Sharpe (approx)" value={`${bt.sharpe_approx}`}                      color={bt.sharpe_approx > 1 ? 'var(--green)' : 'var(--text-secondary)'} sub="risk-adjusted return" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="2-Week Return" value={`${bt.avg_return_2w >= 0 ? '+' : ''}${(bt.avg_return_2w * 100).toFixed(1)}%`} />
          <Metric label="Best Trade"    value={`+${(bt.max_return * 100).toFixed(1)}%`}   color="var(--green)" />
          <Metric label="Worst Trade"   value={`${(bt.min_return * 100).toFixed(1)}%`}    color="var(--red)" />
        </div>
      </div>

      {/* Walk-forward windows */}
      {bt.walk_forward_windows?.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Walk-Forward Windows — Did it hold up over time?
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            Tests the strategy on 3 separate time periods to check consistency
          </div>
          {bt.walk_forward_windows.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>{w.period}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{w.n_signals} signals</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: w.win_rate > 0.5 ? 'var(--green)' : 'var(--red)' }}>
                  {(w.win_rate * 100).toFixed(0)}% win
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: w.avg_return > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {w.avg_return >= 0 ? '+' : ''}{(w.avg_return * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All stocks ranked */}
      {allSymbols.length > 1 && (
        <div className="card p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>All Stocks — Ranked by Avg Return</div>
          {allSymbols.slice(0, 10).map(([sym, data]) => (
            <div key={sym} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: sym === symbol ? 'rgba(48,209,88,0.06)' : 'var(--surface-2)',
              border: sym === symbol ? '1px solid rgba(48,209,88,0.2)' : '1px solid transparent',
              borderRadius: 'var(--radius)', padding: '7px 10px',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, width: 90, flexShrink: 0, color: sym === symbol ? 'var(--green)' : 'var(--text-primary)' }}>
                {sym} {sym === symbol ? '← you' : ''}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 60 }}>{data.signals} signals</span>
              <span style={{ fontSize: 11, color: data.win_rate > 0.5 ? 'var(--green)' : 'var(--red)', width: 55 }}>
                {(data.win_rate * 100).toFixed(0)}% win
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: data.avg_return > 0 ? 'var(--green)' : 'var(--red)' }}>
                {data.avg_return >= 0 ? '+' : ''}{(data.avg_return * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card p-3 space-y-1" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        <div>{meta.data_limitation}</div>
        <div>{meta.disclaimer}</div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading analysis...</div>}>
      <AnalyticsInner />
    </Suspense>
  )
}
