import rawData from './data/site-data.json'
import type { SiteData, Person } from './types'
import type { SiteConfig } from './siteConfig'

const data = rawData as unknown as SiteData

/** Media base URL — defaults to /media/ for local dev, override with VITE_MEDIA_BASE_URL for production (e.g. R2 bucket URL) */
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE_URL as string) || '/media/'

export function useData(): SiteData {
  return data
}

export function useSiteConfig(): SiteConfig {
  return data.config
}

export function useReport(): string {
  return data.report || ''
}

export function useImmigrationStories(): string {
  return data.immigrationStories || ''
}

export function useTranslation(slug: string): string {
  return data.translations?.[slug] || ''
}

export function usePeople(): Person[] {
  return data.people
}

export function usePersonBySlug(slug: string): Person | undefined {
  return data.people.find(p => p.slug === slug)
}

export function usePersonById(id: string): Person | undefined {
  if (!id) return undefined
  return data.people.find(p => p.id === id)
}

export function useSourceById(id: string) {
  if (!id) return undefined
  return data.sources.find(s => s.id === id)
}

export function useSourceBySlug(slug: string) {
  if (!slug) return undefined
  return data.sources.find(s => s.slug === slug)
}

export function getSourceSlugById(sourceId: string): string | undefined {
  const source = data.sources.find(s => s.id === sourceId)
  return source?.slug
}

export function useGeocodedLocations(): Record<string, [number, number] | null> {
  return data.geocodedLocations || {}
}

export function usePersonByName(name: string): Person | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return data.people.find(p => p.name.toLowerCase() === lower)
}

export function formatDates(born: string, died: string): string {
  const b = born || '?'
  const d = died || ''
  if (!d) return b
  return `${b} - ${d}`
}

export function formatYear(date: string): string {
  if (!date) return '?'
  const str = String(date)
  if (str.startsWith('~')) return str
  const match = str.match(/(\d{4})/)
  return match ? match[1] : str
}

export function extractYear(dateStr: string): number | null {
  if (!dateStr || dateStr === 'Unknown' || dateStr === '—') return null
  const cleaned = dateStr.replace(/^~/, '')
  const match = cleaned.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : null
}

export function confidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'bg-emerald-100 text-emerald-700'
    case 'moderate': return 'bg-amber-100 text-amber-700'
    case 'low': return 'bg-red-100 text-red-700'
    case 'stub': return 'bg-stone-100 text-stone-500'
    default: return 'bg-stone-100 text-stone-500'
  }
}
