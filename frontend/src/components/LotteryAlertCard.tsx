'use client'
import { useState } from 'react'
import { LotteryAlert } from '@/lib/types'
import { ScoreGauge } from './ScoreGauge'

interface Props { alert: LotteryAlert }

const RISK_COLORS = { Low: '#4ade80', Medium: '#f59e0b', High: '#f87171' }
const CATEGORY_LABELS: Record<string, string> = {
  swing: '⚡ Swing Trade',
  event: '🎯 Event Play',
  trend: '📈 Trend Ride',
}

export function LotteryAlertCard({ alert }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [broker, setBroker] = useState<'zerodha' | 'groww'>('zerodha')
  const isLottery = alert.score >= 80
  const trustScore = alert.trust_score ?? 50
  const trustLabel = alert.trust_label ?? 'Moderate'
  const trustColor = alert.trust_color ?? '#60a5fa'
  const flags = alert.forensic_flags ?? []
  const hasFlags = flags.length > 0

  return (
    <div className={`card animate-fade-in ${isLottery ? 'card-glow' : ''} p-4 flex flex-col gap-3`}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ScoreGauge score={alert.score} size={72} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white">{alert.symbol}</span>
              {isLottery && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                  🎯 LOTTERY
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {CATEGORY_LABELS[alert.category] || alert.category}
              </span>
            </div>
            <div className="text-sm text-gray-400 mt-0.5">{alert.name}</div>
            <div className="text-xl font-bold text-white mt-1">
              ₹{alert.price.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-green-400 font-bold text-sm">
            +{alert.potential_gain_low}% – +{alert.potential_gain_high}%
          </div>
          <div className="text-red-400 text-xs mt-0.5">Stop: -{alert.stop_loss_pct}%</div>
          <div className="text-gray-500 text-xs mt-1">{alert.time_horizon}</div>
        </div>
      </div>

      {/* Plain reason */}
      <div className="bg-[#0f1929] rounded-lg p-3 border border-[#1e3a5f]">
        <p className="text-sm text-gray-200 leading-relaxed">{alert.plain_reason}</p>
      </div>

      {/* Trust Score + Quick Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {/* Trust Score — prominent */}
        <div className="col-span-1 bg-[#0f1929] rounded-lg py-2 px-1 border"
          style={{ borderColor: trustColor + '44' }}>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Trust</div>
          <TrustRing score={trustScore} color={trustColor} />
          <div className="text-[10px] font-bold mt-0.5" style={{ color: trustColor }}>{trustLabel}</div>
        </div>
        <Stat label="Risk"     value={alert.risk_level}              color={RISK_COLORS[alert.risk_level]} />
        <Stat label="Accuracy" value={`${alert.signal_accuracy_pct}%`} color="#60a5fa" />
        <Stat label="Horizon"  value={alert.time_horizon.split(' ')[0]} color="#a78bfa" />
      </div>

      {/* 1-year performance badge */}
      {(alert.pchange_365d ?? 0) !== 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">5yr Proxy:</span>
          <span className={`font-semibold ${(alert.pchange_365d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {(alert.pchange_365d ?? 0) >= 0 ? '+' : ''}{(alert.pchange_365d ?? 0).toFixed(1)}% past year
          </span>
          {(alert.pchange_30d ?? 0) !== 0 && (
            <>
              <span className="text-gray-600">|</span>
              <span className={`${(alert.pchange_30d ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(alert.pchange_30d ?? 0) >= 0 ? '+' : ''}{(alert.pchange_30d ?? 0).toFixed(1)}% last month
              </span>
            </>
          )}
        </div>
      )}

      {/* Forensic flags — warning strip */}
      {hasFlags && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-2.5 space-y-1">
          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wide flex items-center gap-1">
            ⚠️ Risk Flags — Read before investing
          </div>
          {flags.slice(0, 3).map((f, i) => (
            <div key={i} className="text-[11px] text-red-300 flex gap-1.5">
              <span className="shrink-0 text-red-500">!</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score breakdown bars */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Signal Breakdown</div>
        <ScoreBar label="Smart Money"  val={alert.score_breakdown?.smart_money ?? 0}  max={30} color="#f59e0b" />
        <ScoreBar label="Technical"    val={alert.score_breakdown?.technical ?? 0}     max={25} color="#3b82f6" />
        <ScoreBar label="Fundamental"  val={alert.score_breakdown?.fundamental ?? 0}   max={20} color="#8b5cf6" />
        <ScoreBar label="Geopolitical" val={alert.score_breakdown?.geopolitical ?? 0}  max={15} color="#10b981" />
        <ScoreBar label="Sentiment"    val={alert.score_breakdown?.sentiment_gap ?? 0} max={10} color="#ec4899" />
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-400 hover:text-amber-400 transition-colors flex items-center gap-1 w-full justify-center py-1"
      >
        {expanded ? '▲ Hide details' : '▼ Why this signal + How to buy'}
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="space-y-3 border-t border-[#1e2d42] pt-3 animate-fade-in">

          {/* Trust score reasons */}
          {(alert.trust_reasons ?? []).length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: trustColor }}>
                Trust Evidence
              </div>
              <ul className="space-y-1">
                {(alert.trust_reasons ?? []).map((r, i) => (
                  <li key={i} className="text-xs text-gray-300 flex gap-2">
                    <span style={{ color: trustColor }} className="shrink-0">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Why signals */}
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">
              Why This Signal?
            </div>
            <ul className="space-y-1.5">
              {alert.technical_reasons.slice(0, 4).map((r, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-amber-400 shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* How to buy */}
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
              How to Buy
            </div>
            <div className="flex gap-2 mb-2">
              {(['zerodha', 'groww'] as const).map(b => (
                <button key={b} onClick={() => setBroker(b)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${broker === b ? 'bg-amber-500 text-black' : 'bg-[#1e2d42] text-gray-400 hover:text-white'}`}>
                  {b}
                </button>
              ))}
            </div>
            <ol className="space-y-1.5">
              {(broker === 'zerodha' ? alert.how_to_buy_zerodha : alert.how_to_buy_groww).map((step, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="text-xs text-gray-600 border-t border-[#1e2d42] pt-2">
            Not SEBI-registered advice. Past signal accuracy doesn't guarantee future results. Only invest what you can afford to lose.
          </div>
        </div>
      )}
    </div>
  )
}

/** Circular ring showing trust score (0-100) */
function TrustRing({ score, color }: { score: number; color: string }) {
  const r = 14
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  return (
    <div className="flex justify-center my-0.5">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#1e2d42" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)" />
        <text x="18" y="22" textAnchor="middle" fontSize="9" fill={color} fontWeight="bold">
          {score}
        </text>
      </svg>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0f1929] rounded-lg py-2 px-1">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function ScoreBar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = Math.min((val / max) * 100, 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1e2d42] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{val}</span>
    </div>
  )
}
