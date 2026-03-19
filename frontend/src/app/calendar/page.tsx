'use client'
import { DailyBrief } from '@/components/DailyBrief'
import { EventCalendar } from '@/components/EventCalendar'

export default function CalendarPage() {
  return (
    <div className="page-container space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Event Calendar</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          RBI meetings · Budget · Results season · F&O expiry · Index rebalancing
        </p>
      </div>
      <DailyBrief />
      <EventCalendar />
    </div>
  )
}
