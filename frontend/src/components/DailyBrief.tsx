'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface TodayContext {
  date_display: string
  day_note: string
  today_events: Event[]
  imminent_events: Event[]
  next_major_event: Event | null
  watch_points: string[]
}

interface Event {
  title: string; type: string; date: string; date_display: string
  impact: string; impact_color: string; icon: string
  description: string; sectors: string[]; days_until: number
  is_imminent: boolean; direction_hint: string
}

export function DailyBrief() {
  const [ctx,     setCtx]     = useState<TodayContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    fetch(`${API}/api/context/today`)
      .then(r => r.json()).then(setCtx).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-14 rounded-xl" />
  if (!ctx)    return null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="card animate-fade-in overflow-hidden">
      {/* Collapsed strip */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-2)] transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-lg">☀️</span>
          <div className="text-left">
            <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {greeting} — {ctx.date_display}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {ctx.watch_points[0]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ctx.today_events.length > 0 && (
            <span className="badge-warn text-[9px]">{ctx.today_events.length} event today</span>
          )}
          {ctx.next_major_event && !ctx.today_events.length && (
            <span className="badge-info text-[9px]">
              {ctx.next_major_event.icon} {ctx.next_major_event.days_until}d
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t animate-fade-in" style={{ borderColor: 'var(--border)' }}>
          {/* Watch points */}
          <div className="p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Watch today
            </div>
            {ctx.watch_points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>→</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{pt}</span>
              </div>
            ))}
          </div>

          {/* Today's events */}
          {ctx.today_events.length > 0 && (
            <div className="px-3 pb-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Happening today
              </div>
              {ctx.today_events.map((ev, i) => (
                <div key={i} className="rounded-lg p-2.5"
                  style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${ev.impact_color}` }}>
                  <div className="flex items-center gap-1.5">
                    <span>{ev.icon}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{ev.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: ev.impact_color + '22', color: ev.impact_color }}>
                      {ev.impact}
                    </span>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{ev.description}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {ev.sectors.slice(0, 3).map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Imminent events */}
          {ctx.imminent_events.length > 0 && (
            <div className="px-3 pb-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Coming up
              </div>
              {ctx.imminent_events.map((ev, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{ev.icon}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ev.title}</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: ev.impact_color }}>
                    {ev.days_until}d
                  </span>
                </div>
              ))}
            </div>
          )}

          {ctx.day_note && (
            <div className="px-3 pb-3">
              <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>{ctx.day_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
