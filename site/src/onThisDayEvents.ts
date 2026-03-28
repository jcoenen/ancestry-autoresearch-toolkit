import type { Person } from './types'

export interface OnThisDayEvent {
  id: string
  personId: string
  personName: string
  personSlug: string
  type: 'birth' | 'death' | 'marriage'
  month: number
  day: number
  year: number
  location: string
  family: string
}

export const EVENT_COLORS = {
  birth: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  death: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  marriage: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export const EVENT_LABELS = { birth: 'Born', death: 'Died', marriage: 'Married' }

const MONTH_ABBR: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
}

export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function parseFullDate(dateStr: string): { month: number; day: number; year: number } | null {
  if (!dateStr || dateStr === 'Unknown' || dateStr === '\u2014' || dateStr.startsWith('~')) return null
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] }
  return null
}

export function parseMarriageDate(dateStr: string): { month: number; day: number; year: number; location: string } | null {
  if (!dateStr || dateStr.startsWith('~') || dateStr.includes('md]]')) return null
  const match = dateStr.match(/^([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})(.*)/)
  if (!match) return null
  const monthNum = MONTH_ABBR[match[1]]
  if (!monthNum) return null
  const location = match[4] ? match[4].replace(/^[,\s]+/, '').replace(/\)+$/, '').trim() : ''
  return { month: monthNum, day: +match[2], year: +match[3], location }
}

export function extractEvents(people: Person[]): OnThisDayEvent[] {
  const events: OnThisDayEvent[] = []

  for (const p of people) {
    if (p.privacy) continue

    const birth = parseFullDate(p.born)
    if (birth) {
      events.push({
        id: `${p.id}-birth`,
        personId: p.id,
        personName: p.name,
        personSlug: p.slug,
        type: 'birth',
        ...birth,
        location: p.birthplace || '',
        family: p.family,
      })
    }

    const death = parseFullDate(p.died)
    if (death) {
      events.push({
        id: `${p.id}-death`,
        personId: p.id,
        personName: p.name,
        personSlug: p.slug,
        type: 'death',
        ...death,
        location: p.deathPlace || '',
        family: p.family,
      })
    }

    for (const sp of p.spouses) {
      if (!sp.marriageDate) continue
      const marriage = parseMarriageDate(sp.marriageDate)
      if (!marriage) continue
      const spouseId = sp.id || ''
      if (spouseId && spouseId < p.id) continue
      events.push({
        id: `${p.id}-marriage-${spouseId}`,
        personId: p.id,
        personName: `${p.name} & ${sp.name}`,
        personSlug: p.slug,
        type: 'marriage',
        month: marriage.month,
        day: marriage.day,
        year: marriage.year,
        location: marriage.location,
        family: p.family,
      })
    }
  }

  return events
}
