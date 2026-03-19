'use client'
import { useState } from 'react'
import { MegaTrend } from '@/lib/types'

const CAT_COLORS: Record<string, string> = {
  Manufacturing: '#3b82f6', Defence: '#ef4444', Energy: '#f59e0b',
  Pharma: '#8b5cf6', Infrastructure: '#10b981'
}

interface Props { trend: MegaTrend }

export function MegaTrendCard({ trend }: Props) {
  const [expanded, setExpanded] = useState(false)
  const color = CAT_COLORS[trend.category] || '#6b7280'

  return (
    <div className="card p-4 space-y-3" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: color + '22', color }}>
              {trend.category}
            </span>
            <span className="text-xs text-gray-500">🕐 {trend.time_horizon_years}</span>
          </div>
          <h3 className="text-base font-bold text-white">{trend.title}</h3>
          <p className="text-xs text-gray-400 mt-1">{trend.description}</p>
        </div>
        {/* Confidence meter */}
        <div className="shrink-0 flex flex-col items-center">
          <svg width={52} height={52}>
            <circle cx={26} cy={26} r={20} fill="none" stroke="#1e2d42" strokeWidth={5} />
            <circle cx={26} cy={26} r={20} fill="none" stroke={color} strokeWidth={5}
              strokeDasharray={`${trend.confidence * 1.257} 125.7`}
              strokeLinecap="round" transform="rotate(-90 26 26)" />
            <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={color} fontSize="11" fontWeight="700">
              {trend.confidence}%
            </text>
          </svg>
          <span className="text-[9px] text-gray-500 mt-0.5">confidence</span>
        </div>
      </div>

      {/* Plain explanation */}
      <div className="bg-[#0f1929] rounded-lg p-3 border-l-2" style={{ borderLeftColor: color }}>
        <p className="text-xs text-gray-200 leading-relaxed">{trend.plain_explanation}</p>
      </div>

      {/* Triggers */}
      <div className="flex flex-wrap gap-1">
        {trend.trigger_events.map((e, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 bg-[#1e2d42] text-gray-400 rounded">{e}</span>
        ))}
      </div>

      {/* Top stocks */}
      <div>
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Top Stocks to Watch</div>
        <div className="space-y-1.5">
          {trend.top_stocks.map(s => (
            <div key={s.symbol} className="flex gap-2 bg-[#0f1929] rounded-lg p-2">
              <span className="font-bold text-white text-xs w-20 shrink-0">{s.symbol.replace('.NS', '')}</span>
              <span className="text-xs text-gray-300 flex-1">{s.why}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 hover:text-white transition-colors w-full text-center">
        {expanded ? '▲ Less' : '▼ View funds + investment approach'}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[#1e2d42] pt-3 animate-fade-in">
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Mutual Funds</div>
            <div className="space-y-1.5">
              {trend.top_funds.map((f, i) => (
                <div key={i} className="bg-[#0f1929] rounded p-2">
                  <div className="text-xs font-medium text-white">{f.name}</div>
                  <div className="text-[10px] text-gray-500">{f.category}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase mb-1">Suggested Approach</div>
            <p className="text-xs text-gray-300 bg-[#0f1929] rounded p-2 leading-relaxed">{trend.suggested_approach}</p>
          </div>
        </div>
      )}
    </div>
  )
}
