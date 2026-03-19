'use client'
import { SignalOutcomeTracker } from '@/components/SignalOutcomeTracker'
import { WatchlistPortfolio } from '@/components/WatchlistPortfolio'

export default function TrackRecordPage() {
  return (
    <div className="page-container space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Track Record</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Every signal we've generated, and exactly how it performed. We hide nothing.
        </p>
      </div>
      <SignalOutcomeTracker />
      <div className="divider" />
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Your Portfolio & Watchlist</h2>
        <WatchlistPortfolio />
      </div>
    </div>
  )
}
