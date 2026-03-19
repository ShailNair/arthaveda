'use client'
import { useEffect, useState } from 'react'
import { MegaTrend } from '@/lib/types'
import { api } from '@/lib/api'
import { MegaTrendCard } from '@/components/MegaTrendCard'

export default function TrendsPage() {
  const [trends, setTrends] = useState<MegaTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    api.geo.megaTrends().then(r => {
      setTrends(r.trends || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const cats = ['All', ...Array.from(new Set(trends.map(t => t.category)))]
  const filtered = filter === 'All' ? trends : trends.filter(t => t.category === filter)

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">🚀 Mega Trends</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Structural opportunities driven by geopolitics & policy — invest now for 3-5 year returns
        </p>
      </div>

      <div className="card p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
        <p className="text-sm text-gray-300 leading-relaxed">
          <span className="font-bold text-amber-400">What are Mega Trends?</span> These are big, multi-year opportunities
          created by geopolitical shifts, government policy, or global transitions. Unlike short-term trades,
          these are "invest and hold for 3-5 years" themes where early investors make the most money.
          Examples: India's defence boom, China+1 manufacturing shift, Solar energy revolution.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === c ? 'bg-amber-500 text-black font-bold' : 'bg-[#1e2d42] text-gray-400 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-56 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(trend => (
            <MegaTrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}

      <div className="card p-4 text-xs text-gray-600">
        <span className="font-semibold text-gray-500">Note:</span> Mega trends are long-term themes. They don't move in straight lines — expect volatility. Always invest in small monthly installments (SIP) rather than all at once.
      </div>
    </div>
  )
}
