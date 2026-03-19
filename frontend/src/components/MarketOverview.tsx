'use client'
import { MarketOverview as MO } from '@/lib/types'

interface Props { data: MO | null; loading?: boolean }

function IndexPill({ label, value, change }: { label: string; value: number; change: number }) {
  const pos = change >= 0
  return (
    <div className="bg-[#0f1929] rounded-lg px-3 py-2 min-w-[110px]">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-bold text-white mt-0.5">{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
      <div className={`text-xs font-semibold ${pos ? 'text-green-400' : 'text-red-400'}`}>
        {pos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
      </div>
    </div>
  )
}

const REGIME_STYLE: Record<string, { label: string; cls: string }> = {
  BULL: { label: '🟢 BULL MARKET', cls: 'badge-bull' },
  BEAR: { label: '🔴 BEAR MARKET', cls: 'badge-bear' },
  SIDEWAYS: { label: '⚪ SIDEWAYS', cls: 'badge-neutral' },
}

export function MarketOverviewBar({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="card p-3 flex gap-3 overflow-x-auto">
        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-14 w-28 shrink-0" />)}
      </div>
    )
  }

  const regime = REGIME_STYLE[data.market_regime] || REGIME_STYLE.SIDEWAYS

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <span className={regime.cls + ' shrink-0 text-xs'}>{regime.label}</span>
        <IndexPill label="Nifty 50" value={data.nifty50} change={data.nifty50_change} />
        <IndexPill label="Sensex" value={data.sensex} change={data.sensex_change} />
        <IndexPill label="Bank Nifty" value={data.nifty_bank} change={data.nifty_bank_change} />

        {data.top_gainers.length > 0 && (
          <div className="flex items-center gap-2 border-l border-[#1e2d42] pl-3 shrink-0">
            <span className="text-[10px] text-gray-500 uppercase">Top Gainers</span>
            {data.top_gainers.slice(0, 3).map(g => (
              <span key={g.symbol} className="text-xs text-green-400 font-bold">
                {g.symbol} +{g.change_pct}%
              </span>
            ))}
          </div>
        )}

        {data.top_losers.length > 0 && (
          <div className="flex items-center gap-2 border-l border-[#1e2d42] pl-3 shrink-0">
            <span className="text-[10px] text-gray-500 uppercase">Top Losers</span>
            {data.top_losers.slice(0, 3).map(l => (
              <span key={l.symbol} className="text-xs text-red-400 font-bold">
                {l.symbol} {l.change_pct}%
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto shrink-0 text-[10px] text-gray-600">
          Updated {new Date(data.timestamp).toLocaleTimeString('en-IN')}
        </div>
      </div>
    </div>
  )
}
