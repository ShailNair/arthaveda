// /frontend/src/app/wealth/page.tsx
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
import Link from 'next/link'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '@/components/AppShell'
import { api } from '@/lib/api'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Goal = 'Wealth Creation' | 'Retirement' | "Child's Education" | 'Emergency Fund'
type Horizon = 5 | 10 | 15 | 20 | 25
type RiskProfile = 'Conservative' | 'Balanced' | 'Aggressive'

interface MarketSignal {
  sector: string
  direction: 'up' | 'down'
  conviction: 'High' | 'Medium' | 'Low'
  reason: string
}

interface ProjectionPoint {
  year: number
  bear: number
  base: number
  bull: number
  invested: number
}

interface Fund {
  name: string
  category: string
  cagr_5y: number
  max_drawdown: number
  consistency: string
  expense_ratio: number
  why: string
  dynamicNote?: string
}

interface Allocation {
  label: string
  pct: number
  risk: string
  detail: string
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const GOALS: Goal[] = ['Wealth Creation', 'Retirement', "Child's Education", 'Emergency Fund']
const HORIZONS: Horizon[] = [5, 10, 15, 20, 25]
const RISK_PROFILES: { value: RiskProfile; desc: string }[] = [
  { value: 'Conservative', desc: 'Steady growth, minimal volatility — debt-heavy' },
  { value: 'Balanced', desc: 'Growth with guardrails — 60/40 equity / debt' },
  { value: 'Aggressive', desc: 'Maximum growth potential — mostly equity' },
]

const BASE_RATES: Record<RiskProfile, number> = {
  Conservative: 0.09,
  Balanced: 0.12,
  Aggressive: 0.15,
}

const BEAR_OFFSET = -0.03
const BULL_OFFSET = 0.04

const BASE_ALLOCATIONS: Record<RiskProfile, Allocation[]> = {
  Conservative: [
    { label: 'Debt / Liquid Funds', pct: 50, risk: 'Very low risk', detail: 'Capital preservation, predictable returns' },
    { label: 'Large Cap Index', pct: 30, risk: 'Low–Medium risk', detail: 'Stable equity exposure, market returns' },
    { label: 'Gold ETF', pct: 20, risk: 'Low risk', detail: 'Inflation hedge, portfolio anchor' },
  ],
  Balanced: [
    { label: 'Large Cap Index', pct: 60, risk: 'Low–Medium risk', detail: 'Low cost, market returns, high liquidity' },
    { label: 'Mid Cap Growth', pct: 25, risk: 'Medium risk', detail: 'Higher potential, more volatility' },
    { label: 'International Fund', pct: 15, risk: 'Medium risk', detail: 'Currency diversification, global exposure' },
  ],
  Aggressive: [
    { label: 'Mid Cap Growth', pct: 40, risk: 'Medium–High risk', detail: 'High return potential over 10+ years' },
    { label: 'Large Cap Index', pct: 35, risk: 'Low–Medium risk', detail: 'Core holding, benchmark return' },
    { label: 'Small Cap / Thematic', pct: 25, risk: 'High risk', detail: 'High return potential, long time horizon needed' },
  ],
}

const BASE_FUND_PICKS: Record<RiskProfile, Fund[]> = {
  Conservative: [
    { name: 'HDFC Short Duration Fund', category: 'Debt — Short Duration', cagr_5y: 7.2, max_drawdown: -2.1, consistency: '8/10', expense_ratio: 0.28, why: 'Consistent accrual income with minimal interest rate risk' },
    { name: 'Parag Parikh Flexi Cap', category: 'Equity — Flexi Cap', cagr_5y: 18.4, max_drawdown: -28.0, consistency: '9/10', expense_ratio: 0.68, why: 'International exposure + value discipline keeps downside limited' },
  ],
  Balanced: [
    { name: 'Nifty 50 Index Fund (UTI)', category: 'Equity — Large Cap Index', cagr_5y: 14.8, max_drawdown: -30.2, consistency: '10/10', expense_ratio: 0.10, why: 'Lowest cost large-cap exposure — beats most active large-cap funds over time' },
    { name: 'Axis Midcap Fund', category: 'Equity — Mid Cap', cagr_5y: 21.3, max_drawdown: -38.5, consistency: '7/10', expense_ratio: 0.52, why: 'Consistent quality bias — avoids value traps that hurt peers' },
    { name: 'Mirae Asset Global Innovation', category: 'International — Tech', cagr_5y: 12.1, max_drawdown: -42.0, consistency: '6/10', expense_ratio: 0.55, why: 'Global tech exposure at reasonable cost — true diversification away from India-only risk' },
  ],
  Aggressive: [
    { name: 'Nippon India Small Cap', category: 'Equity — Small Cap', cagr_5y: 28.9, max_drawdown: -52.1, consistency: '7/10', expense_ratio: 0.82, why: 'Largest small-cap fund in India (by fund size) — diversification reduces individual stock risk' },
    { name: 'Quant Mid Cap Fund', category: 'Equity — Mid Cap', cagr_5y: 31.2, max_drawdown: -44.8, consistency: '8/10', expense_ratio: 0.67, why: 'Data-driven approach spots sector opportunities early — strong track record' },
    { name: 'Nifty 50 Index Fund (UTI)', category: 'Equity — Large Cap Index', cagr_5y: 14.8, max_drawdown: -30.2, consistency: '10/10', expense_ratio: 0.10, why: 'Anchor position — guarantees market return in the core of the portfolio' },
  ],
}

/* ─── Derive dynamic allocations from market signals ────────────────────── */
function getDynamicAllocations(risk: RiskProfile, signals: MarketSignal[]): Allocation[] {
  const base = BASE_ALLOCATIONS[risk].map(a => ({ ...a }))
  const highUpSectors = signals.filter(s => s.direction === 'up' && s.conviction === 'High').map(s => s.sector.toLowerCase())
  const highDownSectors = signals.filter(s => s.direction === 'down' && s.conviction === 'High').map(s => s.sector.toLowerCase())

  const defenceOrEnergy = highUpSectors.some(s => s.includes('defence') || s.includes('energy') || s.includes('psu'))
  const itDown = highDownSectors.some(s => s.includes('it') || s.includes('tech'))

  if (defenceOrEnergy && risk !== 'Conservative') {
    // Slightly boost large cap (defence/energy are large caps in Nifty)
    const lc = base.find(a => a.label === 'Large Cap Index')
    const int = base.find(a => a.label === 'International Fund')
    if (lc && int && int.pct >= 5) {
      lc.pct += 5
      int.pct -= 5
      lc.detail += ' — boosted: defence & energy components strong'
    }
  }

  if (itDown && risk === 'Aggressive') {
    // Trim mid cap slightly if IT is under pressure
    const mc = base.find(a => a.label === 'Mid Cap Growth')
    const sc = base.find(a => a.label === 'Small Cap / Thematic')
    if (mc && sc && mc.pct > 5) {
      mc.pct -= 5
      sc.pct += 5
      mc.detail += ' — trimmed: IT/tech headwinds'
    }
  }

  return base
}

/* ─── Derive dynamic fund notes ─────────────────────────────────────────── */
function getDynamicFunds(risk: RiskProfile, signals: MarketSignal[]): Fund[] {
  const funds = BASE_FUND_PICKS[risk].map(f => ({ ...f }))
  const highUpSectors = signals.filter(s => s.direction === 'up' && s.conviction === 'High').map(s => s.sector)

  funds.forEach(fund => {
    if (!highUpSectors.length) return
    const sectorNote = highUpSectors.join(', ')
    if (fund.category.includes('Large Cap') || fund.name.includes('Nifty 50')) {
      fund.dynamicNote = `${sectorNote} (major Nifty 50 components) showing strong momentum currently.`
    } else if (fund.category.includes('Mid Cap') && highUpSectors.some(s => s.toLowerCase().includes('midcap') || s.toLowerCase().includes('manufacturing'))) {
      fund.dynamicNote = `Mid-cap segment benefits from ${sectorNote} tailwind.`
    }
  })

  return funds
}

/* ─── Generate dynamic regime advice ────────────────────────────────────── */
function getDynamicAdvice(risk: RiskProfile, signals: MarketSignal[]): { headline: string; lines: string[] } {
  const highUp = signals.filter(s => s.direction === 'up' && s.conviction === 'High')
  const highDown = signals.filter(s => s.direction === 'down' && s.conviction === 'High')

  if (highUp.length >= 2) {
    return {
      headline: 'Market Conditions: Broadly Bullish',
      lines: [
        `Strong momentum in ${highUp.map(s => s.sector).join(', ')} — market conditions favour equity-heavy allocation for your profile.`,
        'Stay fully invested. Do not try to time the market.',
        risk === 'Aggressive' ? 'Consider increasing SIP by 10–15% if income has grown.' : 'Maintain SIP discipline — compounding works best uninterrupted.',
      ],
    }
  }

  if (highDown.length >= 2) {
    return {
      headline: 'Market Conditions: Broad Pressure',
      lines: [
        `Caution: ${highDown.map(s => s.sector).join(', ')} showing weakness with high conviction.`,
        'Maintain your current allocation — mixed signals suggest caution.',
        'Avoid fresh lump-sum investments. Continue SIP as market dips can benefit long-term SIP investors.',
      ],
    }
  }

  // Mixed or no signals
  const staticAdvice: Record<RiskProfile, { headline: string; lines: string[] }> = {
    Conservative: {
      headline: 'Market Conditions: Sideways',
      lines: [
        'Debt allocation provides stability in choppy markets.',
        'Maintain SIP discipline. Do not pause during dips.',
      ],
    },
    Balanced: {
      headline: 'Market Conditions: Neutral',
      lines: [
        'Mixed signals — stay the course with your balanced allocation.',
        'Nifty PE near long-term average — prefer index over active funds.',
      ],
    },
    Aggressive: {
      headline: 'Market Conditions: Neutral',
      lines: [
        'No dominant trend detected — full equity allocation remains appropriate for long horizons.',
        'Review small-cap allocation if it has grown above 30% due to recent run-up.',
      ],
    },
  }

  return staticAdvice[risk]
}

/* ─── SIP Future Value Formula ───────────────────────────────────────────── */
function calcSIPFV(monthly: number, annualRate: number, years: number): number {
  const r = annualRate / 12
  const n = years * 12
  if (r === 0) return monthly * n
  return monthly * (((Math.pow(1 + r, n) - 1) / r) * (1 + r))
}

function calcProjection(monthly: number, risk: RiskProfile, years: number, stepUp: boolean): ProjectionPoint[] {
  const base = BASE_RATES[risk]
  const bear = base + BEAR_OFFSET
  const bull = base + BULL_OFFSET
  const points: ProjectionPoint[] = []

  for (let y = 0; y <= years; y++) {
    const m = stepUp
      ? monthly * Math.pow(1.10, y)
      : monthly
    points.push({
      year: y,
      bear:     y === 0 ? 0 : Math.round(calcSIPFV(m, bear, y) / 100000),
      base:     y === 0 ? 0 : Math.round(calcSIPFV(m, base, y) / 100000),
      bull:     y === 0 ? 0 : Math.round(calcSIPFV(m, bull, y) / 100000),
      invested: y === 0 ? 0 : Math.round((m * y * 12) / 100000),
    })
  }
  return points
}

function formatCrore(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(1)} Cr`
  return `₹${lakhs}L`
}

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

/* ─── Allocation Bar ─────────────────────────────────────────────────────── */
function AllocationBar({ allocs, risk }: { allocs: Allocation[]; risk: RiskProfile }) {
  const barColor =
    risk === 'Conservative' ? 'var(--blue)'
    : risk === 'Aggressive' ? 'var(--amber)'
    : 'var(--green)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {allocs.map(a => {
        const filledCols = Math.round(a.pct / 5)
        return (
          <div key={a.label} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 130, flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.risk}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 8, borderRadius: 2,
                    background: i < filledCols ? barColor : 'var(--surface-3)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 34, textAlign: 'right' }}>{a.pct}%</span>
            </div>
            <div style={{ width: 180, flexShrink: 0, display: 'none' }} className="hide-on-small">
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.detail}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Fund Card ─────────────────────────────────────────────────────────── */
function FundCard({ fund }: { fund: Fund }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{fund.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fund.category}</div>
        </div>
        <div className="num" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
          Annual fee: {fund.expense_ratio}%
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: '5Y Annual Growth', value: `${fund.cagr_5y}%`, color: 'var(--green)', note: '' },
          { label: 'Biggest Fall', value: `${fund.max_drawdown}%`, color: 'var(--red)', note: 'worst temporary loss this fund experienced' },
          { label: 'Consistency', value: fund.consistency + ' yrs beat index', color: 'var(--text-primary)', note: '' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '8px 12px', flex: '1 1 80px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
            <div className="num" style={{ fontSize: 14, fontWeight: 700, color: m.color, marginTop: 2 }}>{m.value}</div>
            {m.note && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{m.note}</div>}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Why: </span>{fund.why}
      </p>

      {/* Dynamic market note */}
      {fund.dynamicNote && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius)',
          borderLeft: '2px solid var(--accent)',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Now: </span>{fund.dynamicNote}
        </div>
      )}
    </div>
  )
}

/* ─── Market Signals Section ─────────────────────────────────────────────── */
function MarketSignalsSection({ signals, loading }: { signals: MarketSignal[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 16, width: 160 }} />
        <div className="skeleton" style={{ height: 60 }} />
      </div>
    )
  }

  if (!signals.length) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--blue)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
        Based on today's market conditions
      </div>
      {signals.map(s => (
        <div key={s.sector} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{ color: s.direction === 'up' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            {s.direction === 'up' ? '↑' : '↓'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong>{s.sector}</strong>: {s.reason}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Goal Setup (Step 1) ────────────────────────────────────────────────── */
function GoalSetup({ onComplete }: { onComplete: (p: { goal: Goal; monthly: number; years: Horizon; risk: RiskProfile }) => void }) {
  const [goal, setGoal] = useState<Goal>('Wealth Creation')
  const [monthly, setMonthly] = useState(25000)
  const [years, setYears] = useState<Horizon>(15)
  const [risk, setRisk] = useState<RiskProfile>('Balanced')
  const [tooltip, setTooltip] = useState<RiskProfile | null>(null)

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Goal */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
          What's your goal?
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GOALS.map(g => (
            <label key={g} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 'var(--radius)',
              border: `1px solid ${goal === g ? 'var(--accent)' : 'var(--border)'}`,
              background: goal === g ? 'var(--accent-dim)' : 'var(--surface)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>
              <input
                type="radio" name="goal" value={g}
                checked={goal === g}
                onChange={() => setGoal(g)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: goal === g ? 600 : 400, color: goal === g ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Monthly investment */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Monthly investment
          </label>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            {formatINR(monthly)}/month
          </span>
        </div>
        <input
          type="range" min={1000} max={100000} step={1000}
          value={monthly}
          onChange={e => setMonthly(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>₹1,000</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>₹1,00,000</span>
        </div>
      </div>

      {/* Time horizon */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
          How long?
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HORIZONS.map(h => (
            <button
              key={h}
              onClick={() => setYears(h)}
              style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: `1px solid ${years === h ? 'var(--accent)' : 'var(--border)'}`,
                background: years === h ? 'var(--accent)' : 'var(--surface)',
                color: years === h ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {h}Y
            </button>
          ))}
        </div>
      </div>

      {/* Risk profile */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
          Risk comfort
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RISK_PROFILES.map(rp => (
            <div key={rp.value} style={{ position: 'relative' }}>
              <button
                onClick={() => setRisk(rp.value)}
                onMouseEnter={() => setTooltip(rp.value)}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${risk === rp.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: risk === rp.value ? 'var(--accent)' : 'var(--surface)',
                  color: risk === rp.value ? '#000' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {rp.value}
              </button>
              {tooltip === rp.value && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginBottom: 6, background: 'var(--surface-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 11,
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap', zIndex: 10,
                  boxShadow: 'var(--shadow)',
                }}>
                  {rp.desc}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Visual risk scale */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginTop: 8 }}>
          {[
            { height: 12, color: 'var(--green)',  label: 'Low risk',                           active: risk === 'Conservative' },
            { height: 20, color: 'var(--amber)',  label: 'Medium',                              active: risk === 'Balanced' },
            { height: 28, color: 'var(--red)',    label: 'Higher potential return (higher risk)', active: risk === 'Aggressive' },
          ].map(bar => (
            <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
              <div style={{ width: '100%', height: bar.height, background: bar.active ? bar.color : 'var(--surface-3)', borderRadius: 3, transition: 'all 0.2s' }} />
              <span style={{ fontSize: 9, color: bar.active ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onComplete({ goal, monthly, years, risk })}
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', padding: '11px 28px', fontSize: 14 }}
      >
        Build My Plan →
      </button>
    </div>
  )
}

/* ─── Wealth Plan (Step 2) ───────────────────────────────────────────────── */
function WealthPlan({
  goal, monthly: initMonthly, years, risk,
  onReset,
}: {
  goal: Goal; monthly: number; years: Horizon; risk: RiskProfile; onReset: () => void
}) {
  const [monthly, setMonthly] = useState(initMonthly)
  const [stepUp, setStepUp] = useState(false)
  const [marketSignals, setMarketSignals] = useState<MarketSignal[]>([])
  const [signalsLoading, setSignalsLoading] = useState(true)

  // Fetch market signals on mount
  useEffect(() => {
    setSignalsLoading(true)
    api.predictions.get()
      .then((data: any) => {
        // Parse predictions API response into MarketSignal shape
        const raw = Array.isArray(data) ? data : (data?.predictions ?? data?.signals ?? [])
        const parsed: MarketSignal[] = raw
          .slice(0, 6)
          .map((item: any) => ({
            sector: item?.sector ?? item?.name ?? item?.symbol ?? 'Market',
            direction: (item?.signal === 'BUY' || item?.signal === 'BULLISH' || item?.direction === 'up' || (item?.probability ?? item?.score ?? 0) > 0.6) ? 'up' : 'down',
            conviction: (item?.confidence ?? item?.conviction ?? 'Medium') as 'High' | 'Medium' | 'Low',
            reason: item?.reason ?? item?.detail ?? item?.summary ?? (
              (item?.signal === 'BUY' || item?.signal === 'BULLISH') ? 'Positive momentum detected' : 'Caution — signals mixed'
            ),
          }))
          .filter((s: MarketSignal) => s.sector !== 'Market' || raw.length <= 1)

        setMarketSignals(parsed.slice(0, 3))
      })
      .catch(() => {
        // On error, leave signals empty — UI degrades gracefully
        setMarketSignals([])
      })
      .finally(() => setSignalsLoading(false))
  }, [])

  const projection = useMemo(() => calcProjection(monthly, risk, years, stepUp), [monthly, risk, years, stepUp])
  const final = projection[projection.length - 1]

  const baseRate = BASE_RATES[risk]
  const bearRate = baseRate + BEAR_OFFSET
  const bullRate = baseRate + BULL_OFFSET

  const allocs = useMemo(() => getDynamicAllocations(risk, marketSignals), [risk, marketSignals])
  const funds  = useMemo(() => getDynamicFunds(risk, marketSignals), [risk, marketSignals])
  const advice = useMemo(() => getDynamicAdvice(risk, marketSignals), [risk, marketSignals])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>

      {/* Big number */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '22px 24px',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {formatINR(monthly)}/month · {years} years · {risk}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected wealth</div>
            <div className="num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)', letterSpacing: '-0.02em' }}>
              {formatCrore(final.base)}
            </div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 18 }}>·</div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Range (bear → bull)</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {formatCrore(final.bear)} – {formatCrore(final.bull)}
            </div>
          </div>
        </div>
        <button onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, marginTop: 8, padding: 0 }}>
          ← Change plan
        </button>
      </div>

      {/* Projection Chart */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
          Wealth projection (₹ Lakhs)
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={projection} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
              tickFormatter={v => v === 0 ? 'Now' : `${v}Y`} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={v => `Year ${v}`}
              formatter={(val: number) => [`₹${val}L`, '']}
            />
            <Area type="monotone" dataKey="bull" stroke="var(--amber)" strokeWidth={1} strokeDasharray="4 3" fill="none" name="Bull case" />
            <Area type="monotone" dataKey="base" stroke="var(--green)" strokeWidth={2} fill="url(#baseGrad)" name="Base case" />
            <Area type="monotone" dataKey="bear" stroke="var(--red)" strokeWidth={1} strokeDasharray="4 3" fill="none" name="Bear case" />
            <Area type="monotone" dataKey="invested" stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="2 4" fill="none" name="Amount invested" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {[
            { color: 'var(--green)', label: 'Base case', dashed: false },
            { color: 'var(--amber)', label: 'Bull case', dashed: true },
            { color: 'var(--red)', label: 'Bear case', dashed: true },
            { color: 'var(--text-muted)', label: 'Amount invested', dashed: true },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, background: l.color, borderRadius: 1, opacity: l.dashed ? 0.7 : 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Market signals */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          What the market says right now
        </div>
        <MarketSignalsSection signals={marketSignals} loading={signalsLoading} />
      </div>

      {/* Allocation */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Recommended Allocation
        </div>
        <AllocationBar allocs={allocs} risk={risk} />
      </div>

      {/* Fund picks */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Fund Picks
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {funds.map(f => <FundCard key={f.name} fund={f} />)}
        </div>
      </div>

      {/* Dynamic regime advice */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderLeft: '3px solid var(--amber)',
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
          SIP advice for current market conditions
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
          {advice.headline}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {advice.lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--amber)', marginTop: 3, fontSize: 9, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simulator */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          What if I change something?
        </div>

        {/* Adjust monthly */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Monthly investment</span>
            <span className="num" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{formatINR(monthly)}</span>
          </div>
          <input
            type="range" min={1000} max={100000} step={1000}
            value={monthly}
            onChange={e => setMonthly(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Step-up toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div
            onClick={() => setStepUp(s => !s)}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: stepUp ? 'var(--green)' : 'var(--surface-3)',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: stepUp ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
          <div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>+10% step-up annually</span>
            {stepUp && (
              <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 8 }}>
                → Expected: {formatCrore(final.base)} (+{Math.round((calcSIPFV(monthly * 1.1, baseRate, years) - calcSIPFV(monthly, baseRate, years)) / 100000)}L extra)
              </span>
            )}
          </div>
        </label>

        {/* Live projection update */}
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>With current settings, after {years} years:</div>
          <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{formatCrore(final.base)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Range: {formatCrore(final.bear)} – {formatCrore(final.bull)}
          </div>
        </div>
      </div>

    </div>
  )
}

/* ─── Demo preview for logged-out users ──────────────────────────────────── */
function DemoPreview() {
  const demoProjection = useMemo(() => calcProjection(25000, 'Balanced', 15, false), [])
  const final = demoProjection[demoProjection.length - 1]

  return (
    <div style={{ opacity: 0.5, pointerEvents: 'none', userSelect: 'none', marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Preview — Sample plan (₹25,000/mo · 15Y · Balanced)
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 22px', marginBottom: 16 }}>
        <div className="num" style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)' }}>{formatCrore(final.base)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Expected wealth after 15 years</div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={demoProjection} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--green)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}Y`} />
          <YAxis hide />
          <Area type="monotone" dataKey="base" stroke="var(--green)" strokeWidth={2} fill="url(#demoGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function WealthPage() {
  const { user, token, loading: authLoading } = useAuth()
  const [step, setStep] = useState<'setup' | 'plan'>('setup')
  const [planParams, setPlanParams] = useState<{ goal: Goal; monthly: number; years: Horizon; risk: RiskProfile } | null>(null)

  // If user has onboarding data, jump to plan
  useEffect(() => {
    if (user && user.onboarding_done && user.monthly_amount && user.time_horizon_years && user.risk_profile) {
      const risk = (user.risk_profile.charAt(0).toUpperCase() + user.risk_profile.slice(1).toLowerCase()) as RiskProfile
      const validRisk: RiskProfile = ['Conservative', 'Balanced', 'Aggressive'].includes(risk) ? risk : 'Balanced'
      const validYears: Horizon = ([5, 10, 15, 20, 25] as Horizon[]).includes(user.time_horizon_years as Horizon)
        ? user.time_horizon_years as Horizon
        : 15
      setPlanParams({
        goal: (user.investment_goal as Goal) ?? 'Wealth Creation',
        monthly: user.monthly_amount,
        years: validYears,
        risk: validRisk,
      })
      setStep('plan')
    }
  }, [user])

  if (authLoading) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px' }}>
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Wealth Builder</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Your personal investment plan</p>
      </div>

      {/* Not logged in */}
      {!user ? (
        <>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '24px 26px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Build your personalized wealth plan</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Sign in to create a plan tuned to your goal, timeline, and risk comfort.
              We'll pick funds, show projections, and update advice as markets change.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>Sign in</Link>
              <Link href="/register" className="btn btn-ghost" style={{ textDecoration: 'none' }}>Create account</Link>
            </div>
          </div>
          <DemoPreview />
        </>
      ) : step === 'setup' ? (
        /* Step 1 */
        <GoalSetup
          onComplete={async params => {
            setPlanParams(params)
            setStep('plan')
            if (token) {
              try {
                await fetch(`${API}/api/auth/profile`, {
                  method: 'PATCH',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ investment_goal: params.goal, monthly_amount: params.monthly, time_horizon_years: params.years, risk_profile: params.risk.toLowerCase(), onboarding_done: 1 }),
                })
              } catch {}
            }
          }}
        />
      ) : planParams ? (
        /* Step 2 */
        <WealthPlan
          {...planParams}
          onReset={() => {
            setPlanParams(null)
            setStep('setup')
          }}
        />
      ) : null}

    </div>
  )
}
