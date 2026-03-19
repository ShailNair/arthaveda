'use client'
import { useEffect, useState } from 'react'
import { GeoEvent } from '@/lib/types'
import { api } from '@/lib/api'
import { GeoIntelCard } from '@/components/GeoIntelCard'

type FilterType = 'all' | 'conflict' | 'trade' | 'energy' | 'climate' | 'policy' | 'sanctions'

export default function GeoPage() {
  const [events, setEvents] = useState<GeoEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    api.geo.events(30).then(r => {
      setEvents(r.events || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await api.geo.refresh()
    setTimeout(async () => {
      const r = await api.geo.events(30)
      setEvents(r.events || [])
      setRefreshing(false)
    }, 3000)
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter)

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">🌍 Geopolitical Intelligence</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            World events mapped to Indian market opportunities — in plain English
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors">
          {refreshing ? '⟳ Fetching...' : '⟳ Refresh'}
        </button>
      </div>

      {/* What is this banner */}
      <div className="card p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <p className="text-sm text-gray-300 leading-relaxed">
          <span className="font-bold text-blue-400">How this works:</span> We monitor RSS feeds from PIB India, BBC, Reuters, ET Markets & Moneycontrol every 10 minutes.
          Our AI classifies events, scores their India impact (1-10), and maps them to specific stocks & sectors you can invest in.
          Events scoring 7+ on India relevance with 6+ severity are flagged as HIGH IMPACT.
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'conflict', 'trade', 'energy', 'climate', 'policy', 'sanctions'] as FilterType[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-[#1e2d42] text-gray-400 hover:text-white'}`}>
            {f === 'all' ? `All (${events.length})` : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📡</div>
          <div className="text-lg font-bold text-gray-300">No events found</div>
          <p className="text-sm text-gray-500 mt-2">Click Refresh to fetch latest geopolitical events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => (
            <GeoIntelCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
