// /frontend/src/app/intelligence/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface GeoEvent {
  id: string
  title: string
  impact_level: string
  impacts: {
    description: string
    direction: 'positive' | 'negative' | 'neutral'
    stocks?: string[]
  }[]
  timeframe: string
  confidence: 'High' | 'Medium' | 'Low'
  affected_sector?: string
  affected_stocks?: string[]
}

interface CalendarEvent {
  id: string
  title: string
  days_away: number
  date?: string
  action_hints: string[]
  link_label?: string
  link_href?: string
  urgency: 'high' | 'medium' | 'low'
}

interface SectorForecast {
  sector: string
  direction: 'up' | 'down'
  conviction: 'High' | 'Medium' | 'Low'
  reason: string
  sector_slug?: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function impactBadge(level: string) {
  const key = String(level ?? '').toUpperCase()
  const map: Record<string, { cls: string; label: string }> = {
    HIGH:   { cls: 'badge badge-red',   label: 'HIGH IMPACT' },
    MEDIUM: { cls: 'badge badge-amber', label: 'MED IMPACT' },
    LOW:    { cls: 'badge badge-slate', label: 'LOW IMPACT' },
  }
  return map[key] ?? { cls: 'badge badge-slate', label: 'IMPACT' }
}

function daysLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function urgencyColor(urgency: 'high' | 'medium' | 'low'): string {
  if (urgency === 'high') return 'var(--red)'
  if (urgency === 'medium') return 'var(--amber)'
  return 'var(--text-muted)'
}

/* ─── Mock data ──────────────────────────────────────────────────────────── */
const MOCK_GEO: GeoEvent[] = [
  {
    id: '1',
    title: 'US–Iran Tensions Escalating',
    impact_level: 'HIGH',
    impacts: [
      { description: 'Oil prices ↑ → ONGC, Reliance benefit', direction: 'positive', stocks: ['ONGC', 'RELIANCE'] },
      { description: 'Aviation costs ↑ → IndiGo, SpiceJet risk', direction: 'negative', stocks: ['INDIGO', 'SPICEJET'] },
      { description: 'Defence spending ↑ → HAL, BEL, DRDO stocks', direction: 'positive', stocks: ['HAL', 'BEL'] },
    ],
    timeframe: 'Days–Weeks',
    confidence: 'High',
    affected_sector: 'Energy / Aviation',
    affected_stocks: ['ONGC', 'RELIANCE', 'HAL', 'BEL', 'INDIGO', 'SPICEJET'],
  },
  {
    id: '2',
    title: 'Fed Signals Rate Hold Through Q2',
    impact_level: 'MEDIUM',
    impacts: [
      { description: 'Dollar strengthens → FII flows to India may slow', direction: 'negative' },
      { description: 'IT sector valuations under pressure as growth premium compresses', direction: 'negative', stocks: ['TCS', 'INFY'] },
      { description: 'Gold & commodities remain elevated', direction: 'positive' },
    ],
    timeframe: 'Weeks–Months',
    confidence: 'High',
    affected_sector: 'IT / Banking',
    affected_stocks: ['TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
  },
  {
    id: '3',
    title: 'India–EU Trade Deal Negotiations Advancing',
    impact_level: 'MEDIUM',
    impacts: [
      { description: 'Textile and pharma exports could benefit', direction: 'positive', stocks: ['SUNPHARMA', 'DIVI'] },
      { description: 'Auto sector gains EU market access', direction: 'positive', stocks: ['TATAMOTORS'] },
    ],
    timeframe: 'Months',
    confidence: 'Medium',
    affected_sector: 'Pharma / Auto',
    affected_stocks: ['SUNPHARMA', 'DIVI', 'TATAMOTORS'],
  },
]

const MOCK_CALENDAR: CalendarEvent[] = [
  {
    id: '1', title: 'RBI Policy Decision', days_away: 3,
    action_hints: ['Bank stocks likely volatile around announcement', 'Wait before adding banking positions', 'Watch for rate cut / hold language on inflation'],
    link_label: 'View bank signals', link_href: '/signals?sector=banking',
    urgency: 'high',
  },
  {
    id: '2', title: 'Infosys Q4 Results', days_away: 8,
    action_hints: ['Options activity rising — IV elevated', 'Avoid new positions until guidance clarity', 'Earnings pre-announcement risk elevated'],
    link_label: 'View IT signals', link_href: '/signals?sector=it',
    urgency: 'medium',
  },
  {
    id: '3', title: 'CPI Inflation Data (March)', days_away: 12,
    action_hints: ['Consumer staples and FMCG sensitive to print', 'High print → RBI hawkish, rate-sensitives at risk', 'Bond yields may spike on surprise'],
    urgency: 'medium',
  },
  {
    id: '4', title: 'US Jobs Report', days_away: 18,
    action_hints: ['Weak data → positive for India via FII flows', 'Strong data → dollar rises, possible FII pullback'],
    urgency: 'low',
  },
]

const MOCK_FORECASTS: SectorForecast[] = [
  { sector: 'Defence', direction: 'up', conviction: 'High', reason: 'Budget allocation + geopolitical demand', sector_slug: 'defence' },
  { sector: 'Energy', direction: 'up', conviction: 'High', reason: 'Oil tailwind + FII buying', sector_slug: 'energy' },
  { sector: 'Infrastructure', direction: 'up', conviction: 'Medium', reason: 'Government capex supercycle — railways, roads, ports', sector_slug: 'infra' },
  { sector: 'IT', direction: 'down', conviction: 'High', reason: 'Global slowdown + valuation stretched', sector_slug: 'it' },
  { sector: 'Aviation', direction: 'down', conviction: 'Medium', reason: 'Rising fuel costs + capacity glut on key routes', sector_slug: 'aviation' },
]

/* ─── Score Key Legend ───────────────────────────────────────────────────── */
function ScoreKey() {
  return (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:8 }}>
      {[
        { color:'var(--green)', label:'Strong (70+)' },
        { color:'var(--amber)', label:'Moderate (40–69)' },
        { color:'var(--red)',   label:'Weaker (below 40)' },
      ].map(item => (
        <div key={item.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:item.color, flexShrink:0 }} />
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Section 1: Geo Events ─────────────────────────────────────────────── */
function GeoSection() {
  const [events, setEvents] = useState<GeoEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/geo/events`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.events ?? d.results ?? [])
        if (arr.length === 0) { setEvents(MOCK_GEO); setLoading(false); return }

        // Normalise real API response → GeoEvent shape
        const normalised: GeoEvent[] = arr.map((e: any) => {
          // Derive impact_level from severity (1-10 scale) or explicit field
          const sev: number = e.severity ?? 5
          const impact_level: string =
            e.impact_level ?? (sev >= 7 ? 'HIGH' : sev >= 4 ? 'MEDIUM' : 'LOW')

          // Build impacts array from plain_explanation + affected_stocks
          const sentiment = (e.sentiment ?? '').toUpperCase()
          const direction: 'positive' | 'negative' | 'neutral' =
            sentiment === 'POSITIVE' ? 'positive' :
            sentiment === 'NEGATIVE' ? 'negative' : 'neutral'

          const impacts: GeoEvent['impacts'] = []
          if (e.plain_explanation) {
            impacts.push({ description: e.plain_explanation, direction })
          }
          // Add affected-stocks impact line if present and different from plain_explanation
          if (Array.isArray(e.affected_stocks) && e.affected_stocks.length > 0) {
            const names = e.affected_stocks.slice(0, 4).map((s: any) => s.symbol ?? s.name).join(', ')
            const stockDirection: 'positive' | 'negative' | 'neutral' =
              direction === 'positive' ? 'positive' : direction === 'negative' ? 'negative' : 'neutral'
            impacts.push({
              description: `Affected: ${names}`,
              direction: stockDirection,
              stocks: e.affected_stocks.slice(0, 4).map((s: any) => s.symbol),
            })
          }
          if (impacts.length === 0 && Array.isArray(e.impacts)) {
            impacts.push(...e.impacts)
          }

          // Affected sector string
          const affected_sector: string | undefined =
            e.affected_sector ??
            (Array.isArray(e.affected_sectors) && e.affected_sectors.length > 0
              ? e.affected_sectors.slice(0, 2).join(' / ')
              : undefined)

          // Collect all unique stock symbols across all impact rows
          const allStocks: string[] = []
          impacts.forEach(imp => { if (imp.stocks) allStocks.push(...imp.stocks) })
          if (Array.isArray(e.affected_stocks)) {
            e.affected_stocks.slice(0, 6).forEach((s: any) => {
              const sym = s.symbol ?? s
              if (!allStocks.includes(sym)) allStocks.push(sym)
            })
          }

          return {
            id:               e.id ?? String(Math.random()),
            title:            e.headline ?? e.title ?? 'Market Event',
            impact_level,
            impacts,
            timeframe:        e.time_horizon ?? e.timeframe ?? '—',
            confidence:       (e.india_relevance ?? 3) >= 4 ? 'High' : (e.india_relevance ?? 3) >= 2 ? 'Medium' : 'Low',
            affected_sector,
            affected_stocks:  allStocks.length > 0 ? allStocks.slice(0, 6) : undefined,
          }
        })
        setEvents(normalised)
        setLoading(false)
      })
      .catch(() => { setEvents(MOCK_GEO); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 140 }} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map(event => {
        const badge = impactBadge(event.impact_level)
        return (
          <div key={event.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '16px 18px',
          }}>
            {/* Event header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: event.impact_level === 'HIGH' ? 'var(--red)' : 'var(--amber)', fontSize: 14 }}>⚠</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{event.title}</span>
              </div>
              <span className={badge.cls} style={{ flexShrink: 0 }}>{badge.label}</span>
            </div>

            {/* Impact on India */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Impact on India
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(event.impacts ?? []).map((imp, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                      color: imp.direction === 'positive' ? 'var(--green)' : imp.direction === 'negative' ? 'var(--red)' : 'var(--text-muted)',
                    }}>
                      {imp.direction === 'positive' ? '[+]' : imp.direction === 'negative' ? '[-]' : '[~]'}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{imp.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Affected stock chips */}
            {(event.affected_stocks ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {(event.affected_stocks ?? []).slice(0, 5).map(sym => (
                  <Link key={sym} href={`/analytics?symbol=${sym}`} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--accent)', textDecoration: 'none',
                    transition: 'all 0.12s',
                  }}>
                    {sym} →
                  </Link>
                ))}
                {event.affected_sector && (
                  <Link href={`/signals?sector=${event.affected_sector.split('/')[0].trim().toLowerCase()}`} style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: 'none', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', textDecoration: 'none',
                  }}>
                    All {event.affected_sector.split('/')[0].trim()} stocks
                  </Link>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Timeframe: <span style={{ color: 'var(--text-secondary)' }}>{event.timeframe}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Confidence: <span style={{ color: event.confidence === 'High' ? 'var(--green)' : 'var(--amber)' }}>{event.confidence}</span>
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Section 2: Calendar Timeline ─────────────────────────────────────────── */
function CalendarSection() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/context/calendar`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.events ?? d.results ?? [])
        if (arr.length === 0) { setEvents(MOCK_CALENDAR); setLoading(false); return }

        // Normalise real API response → CalendarEvent shape
        const normalised: CalendarEvent[] = arr
          .filter((e: any) => !(e.is_past))           // skip past events
          .map((e: any, i: number) => {
            const impactStr = String(e.impact ?? e.urgency ?? 'LOW').toUpperCase()
            const urgency: 'high' | 'medium' | 'low' =
              impactStr === 'HIGH' ? 'high' : impactStr === 'MEDIUM' ? 'medium' : 'low'

            // Build action hints from description + direction_hint
            const hints: string[] = []
            if (e.description) hints.push(e.description)
            if (e.direction_hint && e.direction_hint !== 'NEUTRAL') {
              hints.push(`Expected market direction: ${e.direction_hint}`)
            }
            if (Array.isArray(e.sectors) && e.sectors.length > 0 && e.sectors[0] !== 'All') {
              hints.push(`Sectors affected: ${e.sectors.slice(0, 3).join(', ')}`)
            }
            if (Array.isArray(e.action_hints)) hints.push(...e.action_hints)

            // Build a sector link for the first named sector
            const firstSector = Array.isArray(e.sectors) && e.sectors.length > 0 && e.sectors[0] !== 'All'
              ? e.sectors[0]
              : null

            return {
              id:         e.id ?? `${e.type ?? 'evt'}-${i}`,
              title:      e.title ?? 'Market Event',
              days_away:  e.days_until ?? e.days_away ?? 0,
              date:       e.date_display ?? e.date,
              action_hints: hints,
              urgency,
              link_label: firstSector ? `View ${firstSector} signals` : undefined,
              link_href:  firstSector ? `/signals?sector=${firstSector.toLowerCase()}` : undefined,
            }
          })
        setEvents(normalised.length > 0 ? normalised : MOCK_CALENDAR)
        setLoading(false)
      })
      .catch(() => { setEvents(MOCK_CALENDAR); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((event, idx) => (
        <div key={event.id} style={{ display: 'flex', gap: 0, position: 'relative' }}>
          {/* Timeline column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 52, flexShrink: 0 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: urgencyColor(event.urgency),
              marginTop: 18, flexShrink: 0, zIndex: 1,
              border: '2px solid var(--bg)',
            }} />
            {idx < events.length - 1 && (
              <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 20 }} />
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, paddingBottom: idx < events.length - 1 ? 20 : 0, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="num" style={{
                fontSize: 11, fontWeight: 700,
                color: urgencyColor(event.urgency),
                background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4,
                flexShrink: 0,
              }}>
                {daysLabel(event.days_away)}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{event.title}</span>
            </div>

            {(event.action_hints ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: event.link_label ? 8 : 0 }}>
                {(event.action_hints ?? []).map((hint, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--text-muted)', marginTop: 3, fontSize: 9, flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hint}</span>
                  </div>
                ))}
              </div>
            )}

            {event.link_label && event.link_href && (
              <Link href={event.link_href} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: 4 }}>
                {event.link_label} →
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Section 3: AI Sector Forecasts ────────────────────────────────────── */
function ForecastSection() {
  const [forecasts, setForecasts] = useState<SectorForecast[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/predictions/`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : (d.predictions ?? [])
        const mapped: SectorForecast[] = arr.map((p: any) => ({
          sector: p.sector,
          direction: p.direction,
          conviction: p.confidence ?? p.conviction ?? 'Medium',
          reason: p.why_now ?? p.reason ?? '',
          sector_slug: p.sector_slug ?? p.sector?.toLowerCase(),
        }))
        setForecasts(mapped.length > 0 ? mapped : MOCK_FORECASTS)
        setLoading(false)
      })
      .catch(() => { setForecasts(MOCK_FORECASTS); setLoading(false) })
  }, [])

  const strong = forecasts.filter(f => f.direction === 'up')
  const weak = forecasts.filter(f => f.direction === 'down')

  if (loading) {
    return <div className="skeleton" style={{ height: 200 }} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Conviction legend */}
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:12, lineHeight:1.5 }}>
        Conviction: High = strong data alignment | Medium = developing signal | Low = early indication
      </p>

      {/* Strong */}
      {strong.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Strong — High conviction
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {strong.map(f => (
              <div key={f.sector} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: '3px solid var(--green)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>↑</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{f.sector}</span>
                    <span className={`badge ${f.conviction === 'High' ? 'badge-green' : 'badge-amber'}`}>{f.conviction}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>"{f.reason}"</p>
                </div>
                <Link href={`/signals?sector=${f.sector_slug ?? f.sector.toLowerCase()}`} style={{
                  fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  Invest →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak */}
      {weak.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Weak — Avoid or wait
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {weak.map(f => (
              <div key={f.sector} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: '3px solid var(--red)',
                borderRadius: 'var(--radius)',
              }}>
                <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>↓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{f.sector}</span>
                    <span className={`badge ${f.conviction === 'High' ? 'badge-red' : 'badge-amber'}`}>{f.conviction}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>"{f.reason}"</p>
                </div>
                <Link href={`/signals?sector=${f.sector_slug ?? f.sector.toLowerCase()}`} style={{
                  fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function IntelligencePage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 44 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Market Intelligence</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>What's moving markets, what's coming next, and where to position.</p>
      </div>

      {/* Section 1: Geo Events */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          What's Moving Markets
        </h2>
        <ScoreKey />
        <div style={{ marginTop: 16 }}>
          <GeoSection />
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Section 2: Calendar */}
      <section>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
          Upcoming Catalysts
        </h2>
        <CalendarSection />
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Section 3: AI Forecasts */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            AI Sector Forecasts
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Where to invest — 2 to 4 week horizon</p>
        </div>
        <ForecastSection />
      </section>

    </div>
  )
}
