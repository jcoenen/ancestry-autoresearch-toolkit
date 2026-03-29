import type { Person } from './types'

export type EventType = 'birth' | 'death' | 'marriage' | 'immigration' | 'emigration' | 'naturalization' | 'military' | 'baptism' | 'christening' | 'confirmation' | 'divorce'

export interface OnThisDayEvent {
  id: string
  personId: string
  personName: string
  personSlug: string
  type: EventType
  month: number
  day: number
  year: number
  location: string
  family: string
}

export const EVENT_COLORS: Record<EventType, { dot: string; bg: string; text: string; border: string }> = {
  birth: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  death: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  marriage: { dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  immigration: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  emigration: { dot: 'bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  naturalization: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  military: { dot: 'bg-stone-500', bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' },
  baptism: { dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  christening: { dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  confirmation: { dot: 'bg-fuchsia-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' },
  divorce: { dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
}

export const EVENT_LABELS: Record<EventType, string> = {
  birth: 'Born',
  death: 'Died',
  marriage: 'Married',
  immigration: 'Immigrated',
  emigration: 'Emigrated',
  naturalization: 'Naturalized',
  military: 'Military',
  baptism: 'Baptized',
  christening: 'Christened',
  confirmation: 'Confirmed',
  divorce: 'Divorced',
}

const MONTH_ABBR: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  January: 1, February: 2, March: 3, April: 4, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
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

/**
 * Attempt to extract a full date (with month and day) from freeform vital info text.
 * Supports ISO (YYYY-MM-DD), "Month DD, YYYY", and "DD Month YYYY" formats.
 * Returns null if no date with month+day can be parsed.
 */
export function parseDateFromText(text: string): { month: number; day: number; year: number; remainder: string } | null {
  if (!text || text === 'Unknown' || text === '\u2014' || text.startsWith('~')) return null

  // ISO: YYYY-MM-DD
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const remainder = text.replace(iso[0], '').replace(/^[,;\s]+/, '').trim()
    return { year: +iso[1], month: +iso[2], day: +iso[3], remainder }
  }

  // "Month DD, YYYY" or "Month DD YYYY"
  const mdy = text.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/)
  if (mdy) {
    const monthNum = MONTH_ABBR[mdy[1]]
    if (monthNum) {
      const remainder = text.replace(mdy[0], '').replace(/^[,;\s]+/, '').trim()
      return { month: monthNum, day: +mdy[2], year: +mdy[3], remainder }
    }
  }

  // "DD Month YYYY"
  const dmy = text.match(/(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/)
  if (dmy) {
    const monthNum = MONTH_ABBR[dmy[2]]
    if (monthNum) {
      const remainder = text.replace(dmy[0], '').replace(/^[,;\s]+/, '').trim()
      return { month: monthNum, day: +dmy[1], year: +dmy[3], remainder }
    }
  }

  return null
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

    // Vital info fields with potential dates
    const vitalFields: { field: string; type: EventType }[] = [
      { field: 'immigration', type: 'immigration' },
      { field: 'emigration', type: 'emigration' },
      { field: 'naturalization', type: 'naturalization' },
      { field: 'military', type: 'military' },
      { field: 'baptized', type: 'baptism' },
      { field: 'christened', type: 'christening' },
      { field: 'confirmation', type: 'confirmation' },
      { field: 'divorce', type: 'divorce' },
    ]

    for (const { field, type } of vitalFields) {
      const value = p[field as keyof Person] as string
      if (!value) continue
      const parsed = parseDateFromText(value)
      if (!parsed) continue
      events.push({
        id: `${p.id}-${type}`,
        personId: p.id,
        personName: p.name,
        personSlug: p.slug,
        type,
        month: parsed.month,
        day: parsed.day,
        year: parsed.year,
        location: parsed.remainder,
        family: p.family,
      })
    }
  }

  return events
}
