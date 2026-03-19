'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface StockPick {
  symbol: string
  name: string
  price: number
  score: number
  why: string
  pchange_1d?: number
  pchange_365d?: number
}

interface Prediction {
  rule_id: string
  title: string
  confidence: number
  horizon: string
  thesis: string
  sectors: string[]
  entry_strategy: string
  exit_strategy: string
  opportunity_score: number
  sector_phases: Record<string, string>
  stocks: StockPick[]
  triggered_at: string
}

interface MacroState {
  regime: string
  vix: number
  fii_signal: string
  rate_signal: string
  usd_inr_signal: string
  crude_signal: string
  geo_risk: string
  breadth: string
}

interface SectorSummary {
  key: string
  label: string
  icon: string
  phase: string
  phase_color: string
  pchange_1d: number
  pchange_30d: number | null
  pchange_365d: number | null
  opportunity_score: number
}

interface PredictionResult {
  generated_at: string
  macro_state: MacroState
  triggered_predictions: Prediction[]
  sector_summary: SectorSummary[]
  total_rules_evaluated: number
  rules_triggered: number
}

/* ─── Color helpers ──────────────────────────────────────────────────────── */
const PHASE_COLORS: Record<string, string> = {
  'EARLY RECOVERY': '#f59e0b',
  'DEEP VALUE':     '#60a5fa',
  'RECOVERY':       '#4ade80',
  'CORRECTION':     '#f87171',
  'MOMENTUM':       '#a78bfa',
  'SIDEWAYS':       '#9ca3af',
  'TRENDING':       '#60a5fa',
  'UNKNOWN':        '#4b5563',
}
const CONF_COLOR = (c: number) =>
  c >= 75 ? '#4ade80' : c >= 55 ? '#f59e0b' : '#f87171'
const SCORE_COLOR = (s: number) =>
  s >= 70 ? '#4ade80' : s >= 50 ? '#f59e0b' : '#9ca3af'
const REGIME_COLOR: Record<string, string> = {
  BULL: '#4ade80', BEAR: '#f87171', SIDEWAYS: '#9ca3af', UNCERTAIN: '#f59e0b'
}
const FII_COLOR: Record<string, string> = {
  BUYING: '#4ade80', SELLING: '#f87171', NEUTRAL: '#9ca3af'
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function PredictionsPage() {
  const [data, setData]       = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<'predictions' | 'sectors' | 'macro'>('predictions')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.predictions.get()
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Where to Invest</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Sector opportunities — identified before prices start moving
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/40 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2">
          {loading ? <><span className="animate-spin">⟳</span> Analyzing...</> : '⟳ Refresh'}
        </button>
      </div>

      {/* Stats row */}
      {data && !loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Signals Active</div>
            <div className="text-2xl font-bold mt-1 text-purple-400">
              {data.rules_triggered}/{data.total_rules_evaluated}
            </div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Market Conditions</div>
            <div className="text-2xl font-bold mt-1"
              style={{ color: REGIME_COLOR[data.macro_state?.regime] || '#9ca3af' }}>
              {data.macro_state?.regime || '—'}
            </div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Foreign Investor Flow</div>
            <div className="text-2xl font-bold mt-1"
              style={{ color: FII_COLOR[data.macro_state?.fii_signal] || '#9ca3af' }}>
              {data.macro_state?.fii_signal || '—'}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(['predictions', 'sectors', 'macro'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors capitalize`}
            style={{
              background: tab === t ? 'var(--accent)' : 'var(--surface-2)',
              color: tab === t ? '#000' : 'var(--text-muted)',
            }}>
            {t === 'predictions' ? `🔮 Opportunities (${data?.rules_triggered ?? 0})`
              : t === 'sectors' ? `📊 Sectors (${data?.sector_summary?.length ?? 0})`
              : '🌡️ Market Overview'}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card p-6 text-center space-y-2">
          <div className="text-3xl">⚠️</div>
          <div className="text-red-400 font-bold">Failed to load predictions</div>
          <div className="text-xs text-gray-500">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
            Retry
          </button>
        </div>
      )}

      {/* ── PREDICTIONS TAB ─────────────────────────────────────────────── */}
      {!loading && !error && data && tab === 'predictions' && (
        <div className="space-y-4">
          {data.triggered_predictions.length === 0 ? (
            <div className="card p-10 text-center space-y-3">
              <div className="text-4xl">🔭</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>No strong opportunities right now</div>
              <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                The system scans 60+ market signals. None are strongly triggered right now —
                markets may be in a wait-and-watch phase or data is still loading.
              </p>
              <button onClick={load} className="px-6 py-2 bg-purple-600 text-white font-bold text-sm rounded-lg">
                Re-analyze
              </button>
            </div>
          ) : (
            data.triggered_predictions.map(pred => (
              <PredictionCard
                key={pred.rule_id}
                pred={pred}
                expanded={expanded === pred.rule_id}
                onToggle={() => setExpanded(expanded === pred.rule_id ? null : pred.rule_id)}
              />
            ))
          )}
        </div>
      )}

      {/* ── SECTORS TAB ─────────────────────────────────────────────────── */}
      {!loading && !error && data && tab === 'sectors' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Sectors ranked by opportunity. <span className="text-amber-400">EARLY RECOVERY</span> and <span className="text-blue-400">DEEP VALUE</span> phases often come before the biggest gains.
          </p>
          {(data.sector_summary || []).sort((a, b) => b.opportunity_score - a.opportunity_score).map(s => (
            <SectorRow key={s.key} sector={s} />
          ))}
        </div>
      )}

      {/* ── MACRO TAB ───────────────────────────────────────────────────── */}
      {!loading && !error && data && tab === 'macro' && (
        <MacroStatePanel macro={data.macro_state} />
      )}

      <div className="card p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        ⚠️ These are data-based estimates, not guarantees. Not SEBI-registered advice. Always do your own research before investing.
      </div>
    </div>
  )
}

/* ─── Prediction Card ───────────────────────────────────────────────────── */
function PredictionCard({ pred, expanded, onToggle }: {
  pred: Prediction
  expanded: boolean
  onToggle: () => void
}) {
  const confColor = CONF_COLOR(pred.confidence)
  const scoreColor = SCORE_COLOR(pred.opportunity_score)
  const topStock = pred.stocks?.[0]

  return (
    <div className="card p-4 space-y-3" style={{ borderLeftColor: confColor, borderLeftWidth: 3 }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{pred.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
              style={{ borderColor: confColor + '44', color: confColor, background: confColor + '11' }}>
              {pred.confidence}% confidence
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              ⏱ {pred.horizon}
            </span>
          </div>
          {/* Sectors */}
          <div className="flex flex-wrap gap-1 mb-1">
            {pred.sectors.map(sec => {
              const phase = pred.sector_phases?.[sec] || 'UNKNOWN'
              const phaseColor = PHASE_COLORS[phase] || '#9ca3af'
              return (
                <span key={sec} className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: phaseColor + '18', color: phaseColor }}>
                  {sec} · {phase}
                </span>
              )
            })}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-gray-500 uppercase">Opportunity</div>
          <div className="text-2xl font-bold" style={{ color: scoreColor }}>
            {pred.opportunity_score}
          </div>
        </div>
      </div>

      {/* Thesis */}
      <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--accent)' }}>Why This is an Opportunity</div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{pred.thesis}</p>
      </div>

      {/* Top stock pick teaser */}
      {topStock && (
        <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
          <div>
            <span className="text-xs text-amber-400 font-bold">{topStock.symbol}</span>
            <span className="text-[10px] text-gray-500 ml-2">{topStock.name}</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-white">₹{topStock.price?.toLocaleString('en-IN')}</div>
            {(topStock.pchange_1d ?? 0) !== 0 && (
              <div className={`text-[10px] ${(topStock.pchange_1d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(topStock.pchange_1d ?? 0) >= 0 ? '+' : ''}{(topStock.pchange_1d ?? 0).toFixed(2)}% today
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle */}
      <button onClick={onToggle}
        className="text-xs text-gray-400 hover:text-purple-400 transition-colors flex items-center gap-1 w-full justify-center py-1">
        {expanded ? '▲ Hide full analysis' : '▼ Show entry/exit strategy + all picks'}
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="space-y-3 pt-3 animate-fade-in" style={{ borderTop: '1px solid var(--border)' }}>

          {/* Entry + Exit strategy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--green)' }}>When to Enter</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{pred.entry_strategy}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--red)' }}>When to Exit</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{pred.exit_strategy}</p>
            </div>
          </div>

          {/* Stock picks */}
          {pred.stocks?.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                Best Stocks for This Opportunity
              </div>
              <div className="space-y-2">
                {pred.stocks.map((stock, i) => (
                  <div key={stock.symbol}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(167,139,250,0.2)' }}>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{stock.name || stock.symbol}</span>
                        <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{stock.symbol}</span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stock.why}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        ₹{stock.price?.toLocaleString('en-IN')}
                      </div>
                      {(stock.pchange_1d ?? 0) !== 0 && (
                        <div className={`text-[10px] ${(stock.pchange_1d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(stock.pchange_1d ?? 0) >= 0 ? '+' : ''}{(stock.pchange_1d ?? 0).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pred.stocks?.length === 0 && (
            <div className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
              Stock data loading — check back shortly
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Sector Row ────────────────────────────────────────────────────────── */
function SectorRow({ sector: s }: { sector: SectorSummary }) {
  const phaseColor = s.phase_color || PHASE_COLORS[s.phase] || '#9ca3af'
  const scoreColor = SCORE_COLOR(s.opportunity_score)
  const oppBarW = Math.min((s.opportunity_score / 100) * 100, 100)

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
              style={{ background: phaseColor + '18', color: phaseColor }}>
              {s.phase}
            </span>
          </div>
          {/* Returns row */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className={`${s.pchange_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              1d: {s.pchange_1d >= 0 ? '+' : ''}{s.pchange_1d.toFixed(2)}%
            </span>
            {s.pchange_30d !== null && (
              <span className={`${(s.pchange_30d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                30d: {(s.pchange_30d ?? 0) >= 0 ? '+' : ''}{(s.pchange_30d ?? 0).toFixed(1)}%
              </span>
            )}
            {s.pchange_365d !== null && (
              <span className={`${(s.pchange_365d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                1yr: {(s.pchange_365d ?? 0) >= 0 ? '+' : ''}{(s.pchange_365d ?? 0).toFixed(1)}%
              </span>
            )}
          </div>
          {/* Opportunity bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${oppBarW}%`, background: scoreColor }} />
            </div>
            <span className="text-[10px] font-bold shrink-0" style={{ color: scoreColor }}>
              {s.opportunity_score}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Macro State Panel ─────────────────────────────────────────────────── */
function MacroStatePanel({ macro }: { macro: MacroState }) {
  if (!macro) return null

  const items = [
    { label: 'Market Conditions',  value: macro.regime,        color: REGIME_COLOR[macro.regime] || '#9ca3af', icon: '📈' },
    { label: 'VIX (India Fear)',  value: `${macro.vix}`,      color: macro.vix > 20 ? '#f87171' : macro.vix > 15 ? '#f59e0b' : '#4ade80', icon: '😰' },
    { label: 'FII Flows',         value: macro.fii_signal,    color: FII_COLOR[macro.fii_signal] || '#9ca3af', icon: '💰' },
    { label: 'Rate Signals',      value: macro.rate_signal,   color: macro.rate_signal === 'FALLING' ? '#4ade80' : macro.rate_signal === 'RISING' ? '#f87171' : '#9ca3af', icon: '🏦' },
    { label: 'USD/INR',           value: macro.usd_inr_signal, color: macro.usd_inr_signal === 'WEAK_INR' ? '#f59e0b' : '#4ade80', icon: '💱' },
    { label: 'Crude Oil',         value: macro.crude_signal,  color: macro.crude_signal === 'RISING' ? '#f87171' : '#4ade80', icon: '🛢️' },
    { label: 'Geo Risk',          value: macro.geo_risk,      color: macro.geo_risk === 'HIGH' ? '#f87171' : macro.geo_risk === 'MEDIUM' ? '#f59e0b' : '#4ade80', icon: '🌍' },
    { label: 'Market Breadth',    value: macro.breadth,       color: macro.breadth === 'BROAD_ADVANCE' ? '#4ade80' : macro.breadth === 'NARROW' ? '#f59e0b' : '#f87171', icon: '📊' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Live market conditions that drive our analysis. Each signal helps identify opportunities before prices start moving.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {items.map(item => (
          <div key={item.label} className="card p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{item.icon}</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</span>
            </div>
            <div className="text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--accent)' }}>
          How This Works
        </div>
        <ul className="space-y-1.5">
          {[
            'Watches 60+ market signals in real-time',
            'Spots investment opportunities before stocks start reacting',
            'Sectors in early recovery often deliver the biggest gains',
            'Uses NSE data, foreign investor flows, interest rates, and global events',
            'Picks the best quality stocks in each promising sector',
          ].map((t, i) => (
            <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
