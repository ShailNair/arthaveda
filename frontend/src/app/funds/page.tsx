'use client'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Fund {
  scheme_code: string
  name: string
  fund_house: string
  category: string
  cagr_5y: number
  max_drawdown: number
  expense_ratio: number
  consistency: string
  star_pick: boolean
  nav?: number
  nav_date?: string
  why: string
  recommendation: 'STRONG BUY' | 'BUY' | 'HOLD'
}

interface CategoryMeta {
  id: string
  label: string
  riskLevel: 1 | 2 | 3 | 4 | 5
  riskLabel: string
  returnRange: string
  description: string
  color: string
  who: string
}

/* ─── Category Metadata ──────────────────────────────────────────────────── */
const CATEGORIES: CategoryMeta[] = [
  {
    id: 'All',
    label: 'All Funds',
    riskLevel: 3,
    riskLabel: 'Varies',
    returnRange: '7–22% p.a.',
    description: 'Curated picks across all fund types',
    color: 'var(--accent)',
    who: 'Browse all recommended funds',
  },
  {
    id: 'Large Cap',
    label: 'Large Cap',
    riskLevel: 2,
    riskLabel: 'Low–Medium',
    returnRange: '10–14% p.a.',
    description: 'Top 100 Indian companies by market size (Reliance, TCS, HDFC). Steady, predictable, less volatile.',
    color: 'var(--green)',
    who: 'Good for: beginners, anyone who wants stability',
  },
  {
    id: 'Mid Cap',
    label: 'Mid Cap',
    riskLevel: 3,
    riskLabel: 'Medium',
    returnRange: '14–18% p.a.',
    description: 'Companies ranked 101–250 by size. Growing businesses, more upside than large caps, more volatility too.',
    color: 'var(--amber)',
    who: 'Good for: 7+ year horizon, comfortable with 30–40% dips',
  },
  {
    id: 'Small Cap',
    label: 'Small Cap',
    riskLevel: 4,
    riskLabel: 'High',
    returnRange: '16–22% p.a.',
    description: 'Companies ranked 251+ by size. High growth potential but can fall 50% in downturns. Patience required.',
    color: 'var(--red)',
    who: 'Good for: 10+ year horizon, experienced investors',
  },
  {
    id: 'Index Fund',
    label: 'Index Fund',
    riskLevel: 2,
    riskLabel: 'Low–Medium',
    returnRange: '11–14% p.a.',
    description: 'Automatically tracks Nifty 50 or Sensex. Lowest cost, no fund manager risk, beats most active funds over time.',
    color: 'var(--blue)',
    who: 'Good for: most people — simple, reliable, low cost',
  },
  {
    id: 'ELSS',
    label: 'ELSS (Tax Saving)',
    riskLevel: 3,
    riskLabel: 'Medium',
    returnRange: '12–16% p.a.',
    description: 'Equity funds with ₹1.5 lakh tax deduction under Section 80C. 3-year lock-in. Shortest lock-in among tax-saving options.',
    color: 'var(--purple)',
    who: 'Good for: saving tax + building wealth simultaneously',
  },
  {
    id: 'Debt',
    label: 'Debt',
    riskLevel: 1,
    riskLabel: 'Very Low',
    returnRange: '6–8% p.a.',
    description: 'Government bonds, corporate debt, liquid funds. Capital protection, predictable returns. Not for wealth creation.',
    color: 'var(--text-muted)',
    who: 'Good for: emergency fund parking, short-term goals (<3 years)',
  },
  {
    id: 'Flexi Cap',
    label: 'Flexi Cap',
    riskLevel: 3,
    riskLabel: 'Medium',
    returnRange: '13–17% p.a.',
    description: 'Fund manager freely picks from any company size. More flexibility to move away from overvalued sectors.',
    color: '#2dd4bf',
    who: 'Good for: trusting a skilled fund manager to pick the best mix',
  },
]

/* ─── Static Curated Funds ──────────────────────────────────────────────── */
const CURATED_FUNDS: Fund[] = [
  // Large Cap
  {
    scheme_code: 'LC001', name: 'UTI Nifty 50 Index Fund', fund_house: 'UTI Mutual Fund',
    category: 'Index Fund', cagr_5y: 14.8, max_drawdown: -30.2, expense_ratio: 0.10,
    consistency: '10/10', star_pick: true, recommendation: 'STRONG BUY',
    why: 'Lowest cost way to own India\'s top 50 companies. Beats 85% of active large-cap funds over 10 years. Zero manager risk.',
  },
  {
    scheme_code: 'LC002', name: 'Mirae Asset Large Cap Fund', fund_house: 'Mirae Asset',
    category: 'Large Cap', cagr_5y: 16.1, max_drawdown: -31.5, expense_ratio: 0.55,
    consistency: '9/10', star_pick: true, recommendation: 'STRONG BUY',
    why: 'One of India\'s most consistent large-cap active funds. Quality-focused stock picking, low turnover.',
  },
  {
    scheme_code: 'LC003', name: 'Axis Bluechip Fund', fund_house: 'Axis Mutual Fund',
    category: 'Large Cap', cagr_5y: 14.2, max_drawdown: -29.8, expense_ratio: 0.52,
    consistency: '8/10', star_pick: false, recommendation: 'BUY',
    why: 'Conservative large-cap approach, lower drawdowns. Suitable for risk-averse investors.',
  },
  // Mid Cap
  {
    scheme_code: 'MC001', name: 'Axis Midcap Fund', fund_house: 'Axis Mutual Fund',
    category: 'Mid Cap', cagr_5y: 21.3, max_drawdown: -38.5, expense_ratio: 0.52,
    consistency: '8/10', star_pick: true, recommendation: 'STRONG BUY',
    why: 'Consistent quality bias — avoids value traps that hurt peers. Strong risk-adjusted returns over 7 years.',
  },
  {
    scheme_code: 'MC002', name: 'Kotak Emerging Equity Fund', fund_house: 'Kotak Mutual Fund',
    category: 'Mid Cap', cagr_5y: 20.8, max_drawdown: -40.1, expense_ratio: 0.47,
    consistency: '7/10', star_pick: false, recommendation: 'BUY',
    why: 'Large fund size with good diversification. Managed well through multiple market cycles.',
  },
  {
    scheme_code: 'MC003', name: 'Quant Mid Cap Fund', fund_house: 'Quant Mutual Fund',
    category: 'Mid Cap', cagr_5y: 31.2, max_drawdown: -44.8, expense_ratio: 0.67,
    consistency: '7/10', star_pick: true, recommendation: 'BUY',
    why: 'Data-driven approach spots sector opportunities early. High returns, but more volatility. Check before large allocation.',
  },
  // Small Cap
  {
    scheme_code: 'SC001', name: 'Nippon India Small Cap Fund', fund_house: 'Nippon India',
    category: 'Small Cap', cagr_5y: 28.9, max_drawdown: -52.1, expense_ratio: 0.82,
    consistency: '7/10', star_pick: true, recommendation: 'BUY',
    why: 'Largest small-cap fund — huge diversification reduces individual stock risk. Only invest if you can stay for 10+ years.',
  },
  {
    scheme_code: 'SC002', name: 'SBI Small Cap Fund', fund_house: 'SBI Mutual Fund',
    category: 'Small Cap', cagr_5y: 26.4, max_drawdown: -48.3, expense_ratio: 0.73,
    consistency: '8/10', star_pick: true, recommendation: 'BUY',
    why: 'Disciplined portfolio, refuses to buy expensive stocks even when peers chase momentum. Lower drawdowns for small-cap.',
  },
  // Index
  {
    scheme_code: 'IX001', name: 'HDFC Index Fund — Nifty 50 Plan', fund_house: 'HDFC Mutual Fund',
    category: 'Index Fund', cagr_5y: 14.7, max_drawdown: -30.1, expense_ratio: 0.20,
    consistency: '10/10', star_pick: false, recommendation: 'STRONG BUY',
    why: 'Tracks Nifty 50 faithfully. Slightly higher cost than UTI but from trusted fund house. Both are excellent.',
  },
  {
    scheme_code: 'IX002', name: 'Motilal Oswal Nifty Midcap 150 Index', fund_house: 'Motilal Oswal',
    category: 'Index Fund', cagr_5y: 18.2, max_drawdown: -38.0, expense_ratio: 0.30,
    consistency: '9/10', star_pick: false, recommendation: 'BUY',
    why: 'Passive mid-cap exposure — no fund manager bias, low cost. Good complement to a large-cap index fund.',
  },
  // ELSS
  {
    scheme_code: 'EL001', name: 'Parag Parikh Tax Saver Fund', fund_house: 'PPFAS',
    category: 'ELSS', cagr_5y: 19.1, max_drawdown: -26.5, expense_ratio: 0.68,
    consistency: '9/10', star_pick: true, recommendation: 'STRONG BUY',
    why: 'Value investing style with some international exposure. Lowest drawdown among ELSS funds. Tax saving + wealth building.',
  },
  {
    scheme_code: 'EL002', name: 'Mirae Asset Tax Saver Fund', fund_house: 'Mirae Asset',
    category: 'ELSS', cagr_5y: 18.6, max_drawdown: -32.1, expense_ratio: 0.55,
    consistency: '9/10', star_pick: false, recommendation: 'STRONG BUY',
    why: 'Consistent quality large & mid cap picks. Tax deduction of ₹46,800 if in 30% tax bracket on ₹1.5L investment.',
  },
  // Debt
  {
    scheme_code: 'DB001', name: 'HDFC Short Duration Fund', fund_house: 'HDFC Mutual Fund',
    category: 'Debt', cagr_5y: 7.2, max_drawdown: -2.1, expense_ratio: 0.28,
    consistency: '9/10', star_pick: true, recommendation: 'BUY',
    why: 'Steady income with minimal interest rate risk. Park emergency fund here — much better than savings account (6% vs 3.5%).',
  },
  {
    scheme_code: 'DB002', name: 'ICICI Prudential Liquid Fund', fund_house: 'ICICI Prudential',
    category: 'Debt', cagr_5y: 6.4, max_drawdown: -0.3, expense_ratio: 0.19,
    consistency: '10/10', star_pick: false, recommendation: 'HOLD',
    why: 'Safest option for short-term parking. Withdrawable in 1 day. Better than keeping idle money in current account.',
  },
  // Flexi Cap
  {
    scheme_code: 'FC001', name: 'Parag Parikh Flexi Cap Fund', fund_house: 'PPFAS',
    category: 'Flexi Cap', cagr_5y: 18.4, max_drawdown: -28.0, expense_ratio: 0.68,
    consistency: '10/10', star_pick: true, recommendation: 'STRONG BUY',
    why: 'India\'s most respected flexi-cap fund. Value investing + international diversification (owns Google, Meta). Lowest drawdown in category.',
  },
  {
    scheme_code: 'FC002', name: 'HDFC Flexi Cap Fund', fund_house: 'HDFC Mutual Fund',
    category: 'Flexi Cap', cagr_5y: 17.9, max_drawdown: -33.2, expense_ratio: 0.77,
    consistency: '8/10', star_pick: false, recommendation: 'BUY',
    why: 'Experienced fund management, large portfolio well-diversified across sectors. Good core holding for long-term wealth.',
  },
]

/* ─── Risk Scale Component ──────────────────────────────────────────────── */
function RiskScale({ level, color }: { level: 1 | 2 | 3 | 4 | 5; color: string }) {
  const bars = [1, 2, 3, 4, 5]
  const labels = ['Very Low', 'Low', 'Medium', 'High', 'Very High']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
      {bars.map(b => (
        <div key={b} style={{
          width: 10,
          height: 6 + b * 4,
          borderRadius: 2,
          background: b <= level ? color : 'var(--surface-3)',
          transition: 'background 0.2s',
        }} />
      ))}
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
        {labels[level - 1]}
      </span>
    </div>
  )
}

/* ─── Category Card ──────────────────────────────────────────────────────── */
function CategoryCard({
  cat, selected, onClick
}: { cat: CategoryMeta; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 'var(--radius-lg)', textAlign: 'left',
      border: `1px solid ${selected ? cat.color : 'var(--border)'}`,
      background: selected ? 'var(--surface-2)' : 'var(--surface)',
      cursor: 'pointer', transition: 'all 0.15s', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: selected ? cat.color : 'var(--text-primary)' }}>
          {cat.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
          background: selected ? cat.color : 'var(--surface-3)',
          color: selected ? '#fff' : 'var(--text-muted)',
        }}>
          {cat.returnRange}
        </span>
      </div>
      {selected && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
            {cat.description}
          </p>
          <RiskScale level={cat.riskLevel} color={cat.color} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
            {cat.who}
          </p>
        </div>
      )}
    </button>
  )
}

/* ─── Fund Card ─────────────────────────────────────────────────────────── */
function FundCard({ fund }: { fund: Fund }) {
  const [expanded, setExpanded] = useState(false)

  const recColor = fund.recommendation === 'STRONG BUY' ? 'var(--green)'
    : fund.recommendation === 'BUY' ? 'var(--blue)'
    : 'var(--amber)'

  const recBg = fund.recommendation === 'STRONG BUY' ? 'rgba(52,211,153,0.08)'
    : fund.recommendation === 'BUY' ? 'rgba(96,165,250,0.08)'
    : 'rgba(245,158,11,0.08)'

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              {fund.star_pick && (
                <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>★ TOP PICK</span>
              )}
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: recBg, color: recColor, letterSpacing: '0.04em',
              }}>
                {fund.recommendation}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {fund.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {fund.fund_house} · {fund.category}
            </div>
          </div>
          {fund.nav && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Unit price</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{fund.nav.toFixed(2)}
              </div>
              {fund.nav_date && (
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fund.nav_date}</div>
              )}
            </div>
          )}
        </div>

        {/* Metrics row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { label: '5Y Annual Return', value: `${fund.cagr_5y}%`, color: 'var(--green)' },
            { label: 'Worst fall ever', value: `${fund.max_drawdown}%`, color: 'var(--red)', note: 'recovered each time' },
            { label: 'Annual fee', value: `${fund.expense_ratio}%`, color: 'var(--text-primary)' },
          ].map(m => (
            <div key={m.label} style={{
              background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '7px 10px', flex: '1 1 70px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
              {m.note && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{m.note}</div>}
            </div>
          ))}
        </div>

        {/* Why */}
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Why: </span>
          {fund.why}
        </p>

        {/* Toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 10, background: 'none', border: 'none', padding: 0,
            fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500,
          }}
        >
          {expanded ? '▲ Less detail' : '▼ How to invest'}
        </button>
      </div>

      {/* Expanded: how to invest */}
      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border)', padding: '14px 18px',
          background: 'var(--surface-2)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            How to start a SIP
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { step: '1', text: 'Go to Zerodha Coin, Groww, or Kuvera (all free, no commission)' },
              { step: '2', text: `Search for "${fund.name}"` },
              { step: '3', text: 'Select "Direct Growth" plan — avoid Regular plans, they charge you 1% extra' },
              { step: '4', text: 'Start SIP with as little as ₹500/month. Increase when income grows.' },
              { step: '5', text: 'Stay invested through market dips. Don\'t stop SIP when markets fall — that\'s when you get the best price.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {s.step}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Score Legend ──────────────────────────────────────────────────────── */
function ScoreLegend() {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        How we rate funds
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'STRONG BUY', color: 'var(--green)', bg: 'rgba(52,211,153,0.08)', desc: 'Consistently outperforms peers, low cost, strong risk-adjusted returns. Start SIP confidently.' },
          { label: 'BUY', color: 'var(--blue)', bg: 'rgba(96,165,250,0.08)', desc: 'Good fund, suitable for regular SIP. Slightly lower score on cost or consistency.' },
          { label: 'HOLD', color: 'var(--amber)', bg: 'rgba(245,158,11,0.08)', desc: 'Decent fund. Review annually — there may be better alternatives in the category.' },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
              background: r.bg, color: r.color, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
            }}>
              {r.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.desc}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> All ratings are based on 5-year track record, expense ratio, and downside protection.
          Past returns do not guarantee future performance. Always invest according to your risk appetite and time horizon.
        </p>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function FundsPage() {
  const [selectedCat, setSelectedCat] = useState('All')
  const [search, setSearch] = useState('')
  const [showLegend, setShowLegend] = useState(false)
  const [liveNAVs, setLiveNAVs] = useState<Record<string, { nav: number; nav_date: string }>>({})

  // Try to load live NAVs in the background — page works without them
  useEffect(() => {
    fetch(`${API}/api/funds/top`)
      .then(r => r.json())
      .then(data => {
        const navMap: Record<string, { nav: number; nav_date: string }> = {}
        if (data.funds) {
          data.funds.forEach((f: any) => {
            const normalized = f.scheme_name?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
            navMap[normalized] = { nav: f.nav, nav_date: f.nav_date }
          })
        }
        setLiveNAVs(navMap)
      })
      .catch(() => {}) // silently ignore — static data shown
  }, [])

  const activeCat = CATEGORIES.find(c => c.id === selectedCat) || CATEGORIES[0]

  const visibleFunds = CURATED_FUNDS.filter(f => {
    const matchesCat = selectedCat === 'All' || f.category === selectedCat
    const matchesSearch = !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()) || f.fund_house.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  // Merge live NAVs if available
  const fundsWithNAV = visibleFunds.map(f => {
    const key = f.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const live = liveNAVs[key]
    return live ? { ...f, nav: live.nav, nav_date: live.nav_date } : f
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Mutual Fund Guide
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Curated picks · Direct Growth plans only · No commission funds
          </p>
        </div>
        <button
          onClick={() => setShowLegend(v => !v)}
          style={{
            fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: showLegend ? 'var(--surface-2)' : 'var(--surface)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          {showLegend ? '✕ Close' : '? How ratings work'}
        </button>
      </div>

      {/* Score legend */}
      {showLegend && <ScoreLegend />}

      {/* Category filter grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
          Filter by fund type
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {CATEGORIES.map(cat => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              selected={selectedCat === cat.id}
              onClick={() => setSelectedCat(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Risk scale for selected category */}
      {selectedCat !== 'All' && (
        <div style={{
          background: 'var(--surface)', border: `1px solid ${activeCat.color}`,
          borderLeft: `3px solid ${activeCat.color}`,
          borderRadius: 'var(--radius-lg)', padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{activeCat.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Expected return: {activeCat.returnRange}</div>
            </div>
            <RiskScale level={activeCat.riskLevel} color={activeCat.color} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {activeCat.description}
          </p>
          <p style={{ fontSize: 11, color: activeCat.color, margin: 0, fontWeight: 500 }}>
            {activeCat.who}
          </p>
        </div>
      )}

      {/* Search */}
      <div>
        <input
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="Search by fund name or fund house..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Fund list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {selectedCat === 'All' ? 'All Curated Funds' : `${activeCat.label} Funds`}
            <span style={{ fontWeight: 400, marginLeft: 6 }}>({fundsWithNAV.length})</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Direct Growth · No commission</div>
        </div>

        {fundsWithNAV.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '32px',
            textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
          }}>
            No funds match your search. Try a different keyword.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fundsWithNAV.map(f => <FundCard key={f.scheme_code} fund={f} />)}
          </div>
        )}
      </div>

      {/* Bottom disclaimer */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px 18px',
      }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Disclaimer:</strong>{' '}
          Fund recommendations are based on historical performance and objective criteria (expense ratio, consistency, drawdown).
          They are for informational purposes only — not personal financial advice.
          Please consult a SEBI-registered advisor before making large investment decisions.
          Mutual fund investments are subject to market risk. Past performance does not guarantee future results.
        </p>
      </div>

    </div>
  )
}
