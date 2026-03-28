import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePeople } from '../useData'
import {
  type OnThisDayEvent,
  EVENT_COLORS, EVENT_LABELS, MONTH_NAMES,
  extractEvents,
} from '../onThisDayEvents'

const EVENT_ICONS = {
  birth: '🎂',
  death: '🕊️',
  marriage: '💒',
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/* ── Date helpers ────────────────────────────────────────────── */

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  // Start on Monday (1), but if Sunday (0) go back 6
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function sameMonthDay(m1: number, d1: number, m2: number, d2: number): boolean {
  return m1 === m2 && d1 === d2
}

function isInDateRange(month: number, day: number, dates: { month: number; day: number }[]): boolean {
  return dates.some(d => sameMonthDay(month, day, d.month, d.day))
}

/* ── Main page ───────────────────────────────────────────────── */

export default function OnThisDayPage() {
  const people = usePeople()
  const allEvents = useMemo(() => extractEvents(people), [people])
  const [weekOffset, setWeekOffset] = useState(0)

  const today = useMemo(() => new Date(), [])
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()

  const weekStart = useMemo(() => {
    const base = getWeekStart(today)
    return addDays(base, weekOffset * 7)
  }, [today, weekOffset])

  // Build 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i)
      return { date: d, month: d.getMonth() + 1, day: d.getDate(), dayName: DAY_NAMES[d.getDay()] }
    })
  }, [weekStart])

  // Filter events for this week
  const weekEvents = useMemo(() => {
    const daySet = weekDays.map(d => ({ month: d.month, day: d.day }))
    return allEvents.filter(e => isInDateRange(e.month, e.day, daySet))
  }, [allEvents, weekDays])

  // Group by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, OnThisDayEvent[]>()
    for (const wd of weekDays) {
      const key = `${wd.month}-${wd.day}`
      map.set(key, [])
    }
    for (const e of weekEvents) {
      const key = `${e.month}-${e.day}`
      const arr = map.get(key)
      if (arr) arr.push(e)
    }
    // Sort events within each day by year
    for (const arr of map.values()) {
      arr.sort((a, b) => a.year - b.year)
    }
    return map
  }, [weekDays, weekEvents])

  const currentYear = today.getFullYear()

  const weekLabel = `${MONTH_NAMES[weekDays[0].month]} ${weekDays[0].day} – ${
    weekDays[0].month !== weekDays[6].month ? MONTH_NAMES[weekDays[6].month] + ' ' : ''
  }${weekDays[6].day}`

  // Total events across all data (for info line)
  const totalDatable = allEvents.length

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">On This Day</h1>
      <p className="mt-2 text-stone-500 mb-6">
        Family events that happened this week in history
      </p>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Prev
        </button>

        <div className="text-center">
          <div className="text-lg font-semibold text-stone-800">{weekLabel}</div>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-amber-700 hover:text-amber-900 mt-0.5"
            >
              Back to this week
            </button>
          )}
        </div>

        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Next
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Events by day */}
      <div className="space-y-6">
        {weekDays.map(wd => {
          const key = `${wd.month}-${wd.day}`
          const dayEvents = eventsByDay.get(key) || []
          const isToday = sameMonthDay(wd.month, wd.day, todayMonth, todayDay)

          return (
            <div key={key}>
              {/* Day header */}
              <div className={`flex items-center gap-3 mb-3 ${dayEvents.length === 0 ? 'opacity-40' : ''}`}>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  isToday
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-stone-100 text-stone-600'
                }`}>
                  {wd.dayName}
                </div>
                <div className="text-sm text-stone-500">
                  {MONTH_NAMES[wd.month]} {wd.day}
                </div>
                {isToday && (
                  <span className="text-xs font-medium text-amber-600">Today</span>
                )}
              </div>

              {/* Events */}
              {dayEvents.length === 0 ? (
                <div className="ml-4 text-sm text-stone-300 italic mb-2">No recorded events</div>
              ) : (
                <div className="space-y-2 ml-1">
                  {dayEvents.map(event => {
                    const colors = EVENT_COLORS[event.type]
                    const yearsAgo = currentYear - event.year

                    return (
                      <div
                        key={event.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${colors.border} ${colors.bg}`}
                      >
                        <span className="text-lg leading-none mt-0.5">{EVENT_ICONS[event.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <Link
                              to={`/people/${event.personSlug}`}
                              className={`font-medium text-sm ${colors.text} hover:underline`}
                            >
                              {event.personName}
                            </Link>
                            <span className={`text-xs ${colors.text} opacity-70`}>
                              {EVENT_LABELS[event.type]}, {event.year}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
                            {event.location && (
                              <span>{event.location}</span>
                            )}
                            {event.location && <span className="text-stone-300">·</span>}
                            <span>{yearsAgo} year{yearsAgo !== 1 ? 's' : ''} ago</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-10 pt-6 border-t border-stone-200 text-center text-xs text-stone-400">
        {weekEvents.length} event{weekEvents.length !== 1 ? 's' : ''} this week · {totalDatable} datable events across the family tree
      </div>
    </div>
  )
}
