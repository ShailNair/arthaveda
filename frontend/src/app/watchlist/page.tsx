'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ScoreGauge } from '@/components/ScoreGauge'

interface WatchItem { symbol: string; note: string; addedAt: string }

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [scores, setScores] = useState<Record<string, any>>({})
  const [newSym, setNewSym] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('watchlist')
    if (saved) {
      const items: WatchItem[] = JSON.parse(saved)
      setWatchlist(items)
      // Load scores for each
      items.forEach(async (item) => {
        try {
          const r = await api.alerts.scoreStock(item.symbol)
          if (r && !r.error) {
            setScores(prev => ({ ...prev, [item.symbol]: r }))
          }
        } catch { }
      })
    }
  }, [])

  const save = (items: WatchItem[]) => {
    setWatchlist(items)
    localStorage.setItem('watchlist', JSON.stringify(items))
  }

  const handleAdd = async () => {
    const sym = newSym.trim().toUpperCase()
    if (!sym) return
    if (watchlist.find(w => w.symbol === sym)) {
      setAddError('Already in watchlist')
      return
    }
    setAdding(true)
    setAddError('')
    try {
      const r = await api.alerts.scoreStock(sym)
      if (r && r.error) {
        setAddError(`${sym}: ${r.error}`)
      } else {
        const item: WatchItem = { symbol: sym, note: '', addedAt: new Date().toISOString() }
        save([item, ...watchlist])
        if (r) setScores(prev => ({ ...prev, [sym]: r }))
        setNewSym('')
      }
    } catch {
      setAddError('Could not fetch data. Check the symbol (e.g. RELIANCE, TCS)')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = (sym: string) => {
    save(watchlist.filter(w => w.symbol !== sym))
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">👁️ Watchlist</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track stocks and get live signal scores on demand</p>
      </div>

      {/* Add stock */}
      <div className="card p-4 space-y-3">
        <div className="text-sm font-medium text-white">Add a Stock</div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#0f1929] border border-[#1e2d42] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500 uppercase"
            placeholder="e.g. RELIANCE, HAL, TCS"
            value={newSym}
            onChange={e => setNewSym(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} disabled={adding || !newSym.trim()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-sm rounded-lg transition-colors">
            {adding ? '...' : '+ Add'}
          </button>
        </div>
        {addError && <div className="text-xs text-red-400">{addError}</div>}
        <div className="text-xs text-gray-600">Enter NSE symbols (without .NS) e.g. HDFCBANK, INFY, NTPC</div>
      </div>

      {/* Watchlist items */}
      {watchlist.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-4xl">👁️</div>
          <div className="text-lg font-bold text-gray-300">Your watchlist is empty</div>
          <p className="text-sm text-gray-500">Add stocks above to track their signal scores in realtime</p>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlist.map(item => {
            const score = scores[item.symbol]
            return (
              <div key={item.symbol} className="card p-4 flex items-center gap-4">
                {score ? <ScoreGauge score={score.score} size={64} /> : (
                  <div className="w-16 h-16 skeleton rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{item.symbol}</span>
                    {score && <span className="text-gray-400 text-sm">{score.name}</span>}
                  </div>
                  {score && (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-white font-bold">₹{score.price?.toLocaleString('en-IN')}</span>
                      <span className="text-xs text-gray-400">{score.time_horizon}</span>
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: score.risk_level === 'Low' ? '#16a34a22' : score.risk_level === 'High' ? '#ef444422' : '#f59e0b22', color: score.risk_level === 'Low' ? '#4ade80' : score.risk_level === 'High' ? '#f87171' : '#f59e0b' }}>
                        {score.risk_level} Risk
                      </span>
                    </div>
                  )}
                  {score && (
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-2">{score.plain_reason}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {score && (
                    <div className="text-right">
                      <div className="text-green-400 text-xs font-bold">+{score.potential_gain_low}%-{score.potential_gain_high}%</div>
                      <div className="text-red-400 text-[10px]">SL: -{score.stop_loss_pct}%</div>
                    </div>
                  )}
                  <button onClick={() => handleRemove(item.symbol)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-red-400/10">
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
