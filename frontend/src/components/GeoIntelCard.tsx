'use client'
import { useState } from 'react'
import { GeoEvent } from '@/lib/types'

const EVENT_ICONS: Record<string, string> = {
  conflict: '⚔️', trade: '🤝', energy: '⛽', climate: '🌍',
  policy: '📋', sanctions: '🚫', technology: '💻', pharma_health: '💊', defence_india: '🛡️'
}
const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#4ade80', NEGATIVE: '#f87171', NEUTRAL: '#9ca3af'
}

interface Props { event: GeoEvent }

export function GeoIntelCard({ event }: Props) {
  const [expanded, setExpanded] = useState(false)
  const isHighImpact = event.india_relevance >= 7 && event.severity >= 6

  return (
    <div className={`card p-4 space-y-3 ${isHighImpact ? 'border-amber-500/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{EVENT_ICONS[event.event_type] || '🌐'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isHighImpact && <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 font-bold">HIGH IMPACT</span>}
            <span className="text-xs px-2 py-0.5 bg-[#1e2d42] text-gray-400 rounded capitalize">{event.event_type.replace('_', ' ')}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: SENTIMENT_COLORS[event.sentiment] + '22', color: SENTIMENT_COLORS[event.sentiment] }}>
              {event.sentiment}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{event.headline}</h3>
          <div className="text-xs text-gray-500 mt-1">{event.source} · {event.time_horizon}</div>
        </div>
      </div>

      {/* Impact scores */}
      <div className="flex gap-3">
        <div className="flex-1 bg-[#0f1929] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">India Impact</div>
          <div className="text-lg font-bold text-amber-400">{event.india_relevance}/10</div>
        </div>
        <div className="flex-1 bg-[#0f1929] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Severity</div>
          <div className="text-lg font-bold text-blue-400">{event.severity}/10</div>
        </div>
        <div className="flex-1 bg-[#0f1929] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Stocks</div>
          <div className="text-lg font-bold text-green-400">{event.affected_stocks.length}</div>
        </div>
      </div>

      {/* Plain explanation */}
      <div className="bg-[#0f1929] rounded-lg p-3 border-l-2 border-amber-500">
        <p className="text-xs text-gray-300 leading-relaxed">{event.plain_explanation}</p>
      </div>

      {/* Affected stocks preview */}
      {event.affected_stocks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {event.affected_stocks.slice(0, 4).map(s => (
            <span key={s.symbol} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
              {s.symbol}
            </span>
          ))}
          {event.affected_stocks.length > 4 && (
            <span className="text-xs px-2 py-0.5 text-gray-500">+{event.affected_stocks.length - 4} more</span>
          )}
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)}
        className="text-xs text-gray-500 hover:text-amber-400 transition-colors w-full text-center">
        {expanded ? '▲ Less' : '▼ See all affected stocks & sectors'}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-[#1e2d42] pt-3 animate-fade-in">
          <div className="text-xs text-gray-500 font-medium uppercase">Affected Stocks</div>
          <div className="grid grid-cols-2 gap-2">
            {event.affected_stocks.map(s => (
              <div key={s.symbol} className="bg-[#0f1929] rounded p-2 text-xs">
                <div className="font-bold text-white">{s.symbol}</div>
                <div className="text-gray-400">{s.name}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-medium uppercase mt-2">Opportunity Window</div>
          <div className="text-xs text-gray-300">{event.time_horizon}</div>
        </div>
      )}
    </div>
  )
}
