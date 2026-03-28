import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePeople, extractYear } from '../useData'
import type { Person } from '../types'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'

/* ── Types ───────────────────────────────────────────────────── */

interface TimelineEvent {
  id: string
  personId: string
  personName: string
  personSlug: string
  type: 'birth' | 'death' | 'marriage'
  year: number
  dateStr: string
  approximate: boolean
  family: string
}

const EVENT_COLORS = {
  birth: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  death: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  marriage: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

const EVENT_LABELS = { birth: 'Born', death: 'Died', marriage: 'Married' }

/* ── Extract events from people data ─────────────────────────── */

function extractEvents(people: Person[]): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const p of people) {
    if (p.privacy) continue

    const birthYear = extractYear(p.born)
    if (birthYear) {
      events.push({
        id: `${p.id}-birth`,
        personId: p.id,
        personName: p.name,
        personSlug: p.slug,
        type: 'birth',
        year: birthYear,
        dateStr: p.born,
        approximate: p.born.startsWith('~'),
        family: p.family,
      })
    }

    const deathYear = extractYear(p.died)
    if (deathYear) {
      events.push({
        id: `${p.id}-death`,
        personId: p.id,
        personName: p.name,
        personSlug: p.slug,
        type: 'death',
        year: deathYear,
        dateStr: p.died,
        approximate: p.died.startsWith('~'),
        family: p.family,
      })
    }

    for (const sp of p.spouses) {
      if (!sp.marriageDate) continue
      // Extract year from formats like "Apr 10, 1880, Neenah, WI" or "1918"
      const mYear = extractYear(sp.marriageDate)
      if (mYear) {
        // Dedupe: only add marriage from the person with the lower ID
        const spouseId = sp.id || ''
        if (spouseId && spouseId < p.id) continue
        events.push({
          id: `${p.id}-marriage-${spouseId}`,
          personId: p.id,
          personName: `${p.name} & ${sp.name}`,
          personSlug: p.slug,
          type: 'marriage',
          year: mYear,
          dateStr: sp.marriageDate,
          approximate: false,
          family: p.family,
        })
      }
    }
  }

  events.sort((a, b) => a.year - b.year || a.type.localeCompare(b.type))
  return events
}

/* ── Year axis ticks ─────────────────────────────────────────── */

function generateTicks(minYear: number, maxYear: number, interval: number): number[] {
  const ticks: number[] = []
  const start = Math.floor(minYear / interval) * interval
  for (let y = start; y <= maxYear; y += interval) {
    ticks.push(y)
  }
  return ticks
}

/* ── Tooltip component ───────────────────────────────────────── */

function EventTooltip({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const colors = EVENT_COLORS[event.type]
  return (
    <div className={`absolute z-50 left-full ml-3 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border ${colors.border} p-3 w-64 animate-in fade-in`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} mb-1`}>
            {EVENT_LABELS[event.type]}
          </span>
          <div className="text-sm font-medium text-stone-800 mt-1">{event.personName}</div>
          <div className="text-xs text-stone-500 mt-0.5">
            {event.approximate && '~'}{event.dateStr}
          </div>
        </div>
        <button onClick={onClose} className="text-stone-300 hover:text-stone-500 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <Link
        to={`/people/${event.personSlug}`}
        className="inline-block mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium hover:no-underline"
      >
        View profile &rarr;
      </Link>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────── */

export default function TimelinePage() {
  const people = usePeople()
  const allEvents = useMemo(() => extractEvents(people), [people])

  // Filters
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['birth', 'death', 'marriage']))
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const families = useMemo(() => {
    const set = new Set(people.map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  const filtered = useMemo(() => {
    return allEvents.filter(e => {
      if (!typeFilter.has(e.type)) return false
      if (familyFilter.size > 0 && !familyFilter.has(e.family)) return false
      return true
    })
  }, [allEvents, typeFilter, familyFilter])

  // Year range
  const minYear = useMemo(() => filtered.length ? Math.min(...filtered.map(e => e.year)) : 1700, [filtered])
  const maxYear = useMemo(() => filtered.length ? Math.max(...filtered.map(e => e.year)) : 2026, [filtered])

  // Group events by year for the vertical layout
  const byYear = useMemo(() => {
    const map = new Map<number, TimelineEvent[]>()
    for (const e of filtered) {
      if (!map.has(e.year)) map.set(e.year, [])
      map.get(e.year)!.push(e)
    }
    return map
  }, [filtered])

  const ticks = useMemo(() => generateTicks(minYear, maxYear, 25), [minYear, maxYear])

  const toggleType = (type: string) => {
    setTypeFilter(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Counts per type
  const counts = useMemo(() => {
    const c = { birth: 0, death: 0, marriage: 0 }
    for (const e of filtered) c[e.type]++
    return c
  }, [filtered])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Family Timeline</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {filtered.length} events spanning {maxYear - minYear} years ({minYear} - {maxYear})
      </p>

      {/* Filters */}
      <div className="mb-8 space-y-3">
        {/* Event type toggles */}
        <div className="flex gap-2">
          {(['birth', 'death', 'marriage'] as const).map(type => {
            const active = typeFilter.has(type)
            const colors = EVENT_COLORS[type]
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-white text-stone-400 border-stone-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? colors.dot : 'bg-stone-300'}`} />
                {EVENT_LABELS[type]}
                <span className="text-xs opacity-70">{counts[type]}</span>
              </button>
            )
          })}
        </div>

        {/* Family filter */}
        <FamilyFilterDropdown
          families={families}
          selected={familyFilter}
          onChange={setFamilyFilter}
        />
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400">No events match the current filters.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[72px] sm:left-[88px] top-0 bottom-0 w-px bg-stone-200" />

          {/* Year sections */}
          {ticks.map((tickYear, i) => {
            const nextTick = ticks[i + 1] || maxYear + 1
            const yearEvents: TimelineEvent[] = []
            for (let y = tickYear; y < nextTick; y++) {
              const evts = byYear.get(y)
              if (evts) yearEvents.push(...evts)
            }
            if (yearEvents.length === 0 && i < ticks.length - 1) return null

            return (
              <div key={tickYear} className="mb-1">
                {/* Year marker */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-[64px] sm:w-[80px] text-right">
                    <span className="text-sm font-bold text-stone-700">{tickYear}</span>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 border-2 border-white shadow-sm relative z-10" />
                </div>

                {/* Events in this range */}
                {yearEvents.map(event => {
                  const colors = EVENT_COLORS[event.type]
                  const isSelected = selectedEventId === event.id
                  return (
                    <div key={event.id} className="flex items-start gap-3 mb-1 group">
                      <div className="w-[64px] sm:w-[80px] text-right">
                        <span className="text-xs text-stone-400">{event.year}</span>
                      </div>
                      <div className="relative flex items-center">
                        <button
                          onClick={() => setSelectedEventId(isSelected ? null : event.id)}
                          className={`w-2.5 h-2.5 rounded-full ${colors.dot} border-2 border-white shadow-sm relative z-10 hover:scale-150 transition-transform cursor-pointer`}
                        />
                        {isSelected && (
                          <EventTooltip event={event} onClose={() => setSelectedEventId(null)} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <Link
                          to={`/people/${event.personSlug}`}
                          className="text-sm text-stone-700 hover:text-amber-700 hover:no-underline truncate block"
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-1.5 relative -top-px`} />
                          {event.personName}
                        </Link>
                        {event.approximate && (
                          <span className="text-[10px] text-stone-400 ml-3.5">approx.</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
