'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AppShell'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface WatchlistItem { id: string; symbol: string; note: string; added_at: string }
interface PortfolioItem {
  id: string; symbol: string; name: string; asset_type: string
  quantity: number | null; avg_price: number | null; monthly_sip: number | null
}

export function WatchlistPortfolio() {
  const { user, token } = useAuth()
  const authFetch = (url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { ...((init.headers as any) || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
  const [tab,       setTab]       = useState<'watchlist' | 'portfolio'>('watchlist')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [addSymbol, setAddSymbol] = useState('')
  const [addNote,   setAddNote]   = useState('')
  const [showAdd,   setShowAdd]   = useState(false)
  const [portForm,  setPortForm]  = useState({ symbol: '', name: '', asset_type: 'stock', quantity: '', avg_price: '', monthly_sip: '' })
  const [showPortAdd, setShowPortAdd] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [wRes, pRes] = await Promise.all([
        authFetch(`${API}/api/user/watchlist`),
        authFetch(`${API}/api/user/portfolio`),
      ])
      if (wRes.ok) setWatchlist(await wRes.json())
      if (pRes.ok) setPortfolio(await pRes.json())
    } catch {}
    setLoading(false)
  }, [user, authFetch])

  useEffect(() => { loadData() }, [loadData])

  const addToWatchlist = async () => {
    if (!addSymbol.trim()) return
    const res = await authFetch(`${API}/api/user/watchlist`, {
      method: 'POST',
      body: JSON.stringify({ symbol: addSymbol.toUpperCase(), note: addNote }),
    })
    if (res.ok) { setAddSymbol(''); setAddNote(''); setShowAdd(false); loadData() }
    else { const e = await res.json(); alert(e.detail) }
  }

  const removeFromWatchlist = async (symbol: string) => {
    await authFetch(`${API}/api/user/watchlist/${symbol}`, { method: 'DELETE' })
    loadData()
  }

  const addToPortfolio = async () => {
    if (!portForm.symbol.trim()) return
    const res = await authFetch(`${API}/api/user/portfolio`, {
      method: 'POST',
      body: JSON.stringify({
        ...portForm,
        symbol:     portForm.symbol.toUpperCase(),
        quantity:   portForm.quantity   ? parseFloat(portForm.quantity)   : null,
        avg_price:  portForm.avg_price  ? parseFloat(portForm.avg_price)  : null,
        monthly_sip:portForm.monthly_sip? parseFloat(portForm.monthly_sip): null,
      }),
    })
    if (res.ok) { setPortForm({ symbol:'',name:'',asset_type:'stock',quantity:'',avg_price:'',monthly_sip:'' }); setShowPortAdd(false); loadData() }
    else { const e = await res.json(); alert(e.detail) }
  }

  const removeFromPortfolio = async (symbol: string) => {
    await authFetch(`${API}/api/user/portfolio/${symbol}`, { method: 'DELETE' })
    loadData()
  }

  if (!user) {
    return (
      <div className="card p-6 text-center space-y-3">
        <div className="text-3xl">🔒</div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Login to track your portfolio</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Save watchlist, track holdings, get personalised alerts
        </p>
        <div className="flex justify-center gap-2 mt-2">
          <a href="/login"    className="btn-primary text-sm px-4 py-2">Sign in</a>
          <a href="/register" className="btn-ghost text-sm px-4 py-2">Register</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
        {(['watchlist', 'portfolio'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all capitalize"
            style={{
              background: tab === t ? 'var(--card)' : 'transparent',
              color:      tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              border:     tab === t ? '1px solid var(--border)' : '1px solid transparent',
            }}>
            {t === 'watchlist' ? `👁 Watchlist (${watchlist.length})` : `💼 Portfolio (${portfolio.length})`}
          </button>
        ))}
      </div>

      {loading && <div className="skeleton h-24 rounded-xl" />}

      {/* ── WATCHLIST ─────────────────────────────────────────────── */}
      {tab === 'watchlist' && !loading && (
        <div className="space-y-2">
          {watchlist.length === 0 && !showAdd && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">👁</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No stocks in watchlist yet</p>
            </div>
          )}
          {watchlist.map(item => (
            <div key={item.id} className="card p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.symbol}</div>
                {item.note && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.note}</div>}
              </div>
              <button onClick={() => removeFromWatchlist(item.symbol)}
                className="text-xs px-2 py-1 rounded" style={{ color: 'var(--bear)', background: '#f8717115' }}>
                Remove
              </button>
            </div>
          ))}

          {showAdd ? (
            <div className="card p-3 space-y-2 animate-fade-in">
              <input value={addSymbol} onChange={e => setAddSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol (e.g. RELIANCE)" className="input text-sm"
                onKeyDown={e => e.key === 'Enter' && addToWatchlist()} />
              <input value={addNote} onChange={e => setAddNote(e.target.value)}
                placeholder="Note (optional)" className="input text-sm" />
              <div className="flex gap-2">
                <button onClick={addToWatchlist} className="btn-primary text-xs py-1.5 px-3">Add</button>
                <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="w-full py-2.5 rounded-xl text-xs font-medium border-dashed transition-colors"
              style={{ border: '1.5px dashed var(--border)', color: 'var(--text-muted)' }}>
              + Add to watchlist
            </button>
          )}
        </div>
      )}

      {/* ── PORTFOLIO ─────────────────────────────────────────────── */}
      {tab === 'portfolio' && !loading && (
        <div className="space-y-2">
          {portfolio.length === 0 && !showPortAdd && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">💼</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add your holdings to track performance</p>
            </div>
          )}
          {portfolio.map(item => (
            <div key={item.id} className="card p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.symbol}</span>
                    <span className="badge-neutral text-[9px]">{item.asset_type}</span>
                  </div>
                  {item.name && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.name}</div>}
                </div>
                <button onClick={() => removeFromPortfolio(item.symbol)}
                  className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="flex gap-3 mt-2">
                {item.quantity   != null && <div><div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Qty</div><div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{item.quantity}</div></div>}
                {item.avg_price  != null && <div><div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Avg price</div><div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>₹{item.avg_price}</div></div>}
                {item.monthly_sip!= null && <div><div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>SIP/mo</div><div className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>₹{item.monthly_sip}</div></div>}
              </div>
            </div>
          ))}

          {showPortAdd ? (
            <div className="card p-3 space-y-2 animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <input value={portForm.symbol} onChange={e => setPortForm(f=>({...f,symbol:e.target.value.toUpperCase()}))}
                  placeholder="Symbol / Fund code" className="input text-xs" />
                <select value={portForm.asset_type} onChange={e => setPortForm(f=>({...f,asset_type:e.target.value}))}
                  className="input text-xs">
                  <option value="stock">Stock</option>
                  <option value="fund">Mutual Fund</option>
                  <option value="etf">ETF</option>
                </select>
              </div>
              <input value={portForm.name} onChange={e => setPortForm(f=>({...f,name:e.target.value}))}
                placeholder="Name (optional)" className="input text-xs" />
              <div className="grid grid-cols-3 gap-2">
                <input value={portForm.quantity}    onChange={e => setPortForm(f=>({...f,quantity:e.target.value}))}
                  placeholder="Qty" className="input text-xs" type="number" />
                <input value={portForm.avg_price}   onChange={e => setPortForm(f=>({...f,avg_price:e.target.value}))}
                  placeholder="Avg ₹" className="input text-xs" type="number" />
                <input value={portForm.monthly_sip} onChange={e => setPortForm(f=>({...f,monthly_sip:e.target.value}))}
                  placeholder="SIP ₹/mo" className="input text-xs" type="number" />
              </div>
              <div className="flex gap-2">
                <button onClick={addToPortfolio} className="btn-primary text-xs py-1.5 px-3">Save</button>
                <button onClick={() => setShowPortAdd(false)} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPortAdd(true)}
              className="w-full py-2.5 rounded-xl text-xs font-medium border-dashed"
              style={{ border: '1.5px dashed var(--border)', color: 'var(--text-muted)' }}>
              + Add holding
            </button>
          )}
        </div>
      )}
    </div>
  )
}
