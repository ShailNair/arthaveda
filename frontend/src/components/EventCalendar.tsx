'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface CalEvent {
  date: string; date_display: string; title: string; type: string
  impact: string; impact_color: string; icon: string
  description: string; sectors: string[]
  days_until: number; is_today: boolean; is_past: boolean; is_imminent: boolean
  direction_hint: string
}

const TYPE_LABELS: Record<string, string> = {
  RBI_MPC:        'RBI',
  BUDGET:         'Budget',
  FNO_EXPIRY:     'F&O',
  RESULTS:        'Results',
  NIFTY_REBALANCE:'Index',
  MONSOON:        'Macro',
  COMPANY_RESULT: 'Company',
  US_FED:         'Global',
}

const IMPACT_ORDER: Record<string, number> = {
  VERY_HIGH: 0, HIGH: 1, MEDIUM: 2, VOLATILE: 3, LOW: 4
}

export function EventCalendar() {
  const [events,  setEvents]  = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<string>('ALL')
  const [selected, setSelected] = useState<CalEvent | null>(null)

  useEffect(() => {
    fetch(`${API}/api/context/calendar?days=45`)
      .then(r => r.json()).then(d => setEvents(d.events || []))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const types    = ['ALL', ...Array.from(new Set(events.map(e => e.type)))]
  const filtered = filter === 'ALL' ? events : events.filter(e => e.type === filter)
  const upcoming = filtered.filter(e => !e.is_past)
  const past     = filtered.filter(e => e.is_past).slice(0, 3)

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors"
            style={{
              background: filter === t ? 'var(--accent)' : 'var(--surface-2)',
              color:      filter === t ? '#000' : 'var(--text-secondary)',
            }}>
            {t === 'ALL' ? 'All events' : TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="space-y-2">
        {upcoming.map((ev, i) => (
          <EventRow key={i} ev={ev} selected={selected?.date === ev.date && selected?.title === ev.title}
            onClick={() => setSelected(s => s?.title === ev.title ? null : ev)} />
        ))}
      </div>

      {/* Event detail panel */}
      {selected && (
        <div className="card p-4 animate-fade-in space-y-3"
          style={{ borderLeftWidth: 3, borderLeftColor: selected.impact_color }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{selected.icon}</span>
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {selected.title}
                </span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {selected.date_display}
                {selected.days_until > 0 && ` · in ${selected.days_until} day${selected.days_until > 1 ? 's' : ''}`}
                {selected.is_today && ' · TODAY'}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>

          <div className="flex items-center gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Direction</div>
              <div className="text-xs font-bold mt-0.5" style={{
                color: selected.direction_hint === 'BULLISH' ? 'var(--bull)' :
                       selected.direction_hint === 'BEARISH' ? 'var(--bear)' :
                       selected.direction_hint === 'VOLATILE' ? 'var(--purple)' : 'var(--text-secondary)'
              }}>
                {selected.direction_hint === 'BULLISH' ? '▲ BULLISH' :
                 selected.direction_hint === 'BEARISH' ? '▼ BEARISH' :
                 selected.direction_hint === 'VOLATILE' ? '⚡ VOLATILE' : '— NEUTRAL'}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Impact</div>
              <div className="text-xs font-bold mt-0.5" style={{ color: selected.impact_color }}>
                {selected.impact}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Affected sectors
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selected.sectors.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Past events (last 3) */}
      {past.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-muted)' }}>Recent</div>
          {past.map((ev, i) => (
            <EventRow key={i} ev={ev} selected={false} onClick={() => {}} past />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRow({ ev, selected, onClick, past = false }: {
  ev: CalEvent; selected: boolean; onClick: () => void; past?: boolean
}) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl p-3 transition-all"
      style={{
        background: selected ? 'var(--surface-2)' : 'var(--card)',
        border: `1px solid ${selected ? ev.impact_color + '60' : 'var(--border)'}`,
        opacity: past ? 0.5 : 1,
      }}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center w-10 shrink-0">
          <div className="text-lg">{ev.icon}</div>
          {ev.is_today && (
            <div className="text-[8px] font-bold px-1 rounded" style={{ background: 'var(--accent)', color: '#000' }}>
              TODAY
            </div>
          )}
          {ev.is_imminent && !ev.is_today && (
            <div className="text-[8px]" style={{ color: 'var(--warn)' }}>{ev.days_until}d</div>
          )}
          {!ev.is_imminent && !ev.is_today && !past && (
            <div className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{ev.days_until}d</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {ev.title}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: ev.impact_color + '20', color: ev.impact_color }}>
              {ev.impact}
            </span>
          </div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {ev.date_display} · {ev.sectors.slice(0, 3).join(', ')}
          </div>
        </div>

        <div className="text-[10px] shrink-0" style={{
          color: ev.direction_hint === 'BULLISH' ? 'var(--bull)' :
                 ev.direction_hint === 'BEARISH' ? 'var(--bear)' :
                 ev.direction_hint === 'VOLATILE' ? 'var(--purple)' : 'var(--text-muted)'
        }}>
          {ev.direction_hint === 'BULLISH' ? '▲' : ev.direction_hint === 'BEARISH' ? '▼' :
           ev.direction_hint === 'VOLATILE' ? '⚡' : '—'}
        </div>
      </div>
    </button>
  )
}
