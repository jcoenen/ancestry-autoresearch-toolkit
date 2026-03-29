import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { useData, formatYear } from './useData'

export type SearchResultType = 'person' | 'source'

export interface SearchDocument {
  type: SearchResultType
  title: string
  subtitle: string
  link: string
  // Indexed fields
  searchName: string
  searchFamily: string
  searchBirthplace: string
  searchOccupation: string
  searchBiography: string
  searchFullText: string
  searchRecord: string
  searchPublisher: string
  searchNotes: string
  searchExtractedFacts: string
}

export interface SearchResult {
  item: SearchDocument
  score: number
  matches: readonly Fuse.FuseResultMatch[]
}

export interface GroupedSearchResults {
  people: SearchResult[]
  sources: SearchResult[]
  total: number
}

const TYPE_LABELS: Record<string, string> = {
  obituary: 'Obituary',
  cemetery: 'Cemetery',
  church: 'Church Record',
  secondary: 'Secondary Source',
  immigration: 'Immigration',
  military: 'Military',
  census: 'Census',
  note: 'Family Knowledge',
}

export function useSearch() {
  const { people, sources } = useData()

  const fuse = useMemo(() => {
    const documents: SearchDocument[] = [
      ...people.map(p => ({
        type: 'person' as const,
        title: p.name,
        subtitle: p.privacy
          ? p.family
          : [
              `${formatYear(p.born)} - ${formatYear(p.died)}`,
              p.birthplace,
              p.family,
            ].filter(Boolean).join(' \u00b7 '),
        link: `/people/${p.slug}`,
        searchName: p.name,
        searchFamily: p.family || '',
        searchBirthplace: p.privacy ? '' : (p.birthplace || ''),
        searchOccupation: p.privacy ? '' : (p.occupation || ''),
        searchBiography: p.privacy ? '' : (p.biography || ''),
        searchFullText: '',
        searchRecord: '',
        searchPublisher: '',
        searchNotes: '',
        searchExtractedFacts: '',
      })),
      ...sources.map(s => ({
        type: 'source' as const,
        title: s.title || s.record || s.id,
        subtitle: [TYPE_LABELS[s.type] || s.type, s.date, s.publisher].filter(Boolean).join(' \u00b7 '),
        link: `/sources/${s.slug}`,
        searchName: [s.person, ...(s.persons || [])].filter(Boolean).join(' '),
        searchFamily: '',
        searchBirthplace: '',
        searchOccupation: '',
        searchBiography: '',
        searchFullText: s.fullText || '',
        searchRecord: s.record || '',
        searchPublisher: s.publisher || '',
        searchNotes: s.notes || '',
        searchExtractedFacts: s.extractedFacts || '',
      })),
    ]

    return new Fuse(documents, {
      keys: [
        { name: 'searchName', weight: 2.0 },
        { name: 'searchFamily', weight: 1.5 },
        { name: 'searchBirthplace', weight: 1.0 },
        { name: 'searchOccupation', weight: 0.8 },
        { name: 'searchRecord', weight: 1.0 },
        { name: 'searchPublisher', weight: 0.8 },
        { name: 'searchExtractedFacts', weight: 0.7 },
        { name: 'searchFullText', weight: 0.6 },
        { name: 'searchBiography', weight: 0.6 },
        { name: 'searchNotes', weight: 0.5 },
      ],
      threshold: 0.35,
      includeMatches: true,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    })
  }, [people, sources])

  function search(query: string): GroupedSearchResults {
    if (!query || query.length < 2) return { people: [], sources: [], total: 0 }

    const raw = fuse.search(query, { limit: 100 })
    const results: SearchResult[] = raw.map(r => ({
      item: r.item,
      score: r.score ?? 1,
      matches: r.matches ?? [],
    }))

    const people = results.filter(r => r.item.type === 'person')
    const sources = results.filter(r => r.item.type === 'source')

    return { people, sources, total: people.length + sources.length }
  }

  return { search }
}

const FIELD_LABELS: Record<string, string> = {
  searchName: 'Name',
  searchFamily: 'Family',
  searchBirthplace: 'Birthplace',
  searchOccupation: 'Occupation',
  searchBiography: 'Biography',
  searchFullText: 'Full Text',
  searchRecord: 'Record',
  searchPublisher: 'Publisher',
  searchNotes: 'Notes',
  searchExtractedFacts: 'Extracted Facts',
}

export function getSnippet(matches: readonly Fuse.FuseResultMatch[]): { field: string; before: string; match: string; after: string } | null {
  if (!matches.length) return null

  // Prefer matches in content-heavy fields for better snippets
  const preferred = ['searchBiography', 'searchFullText', 'searchExtractedFacts', 'searchNotes', 'searchRecord']
  const sorted = [...matches].sort((a, b) => {
    const aIdx = preferred.indexOf(a.key || '')
    const bIdx = preferred.indexOf(b.key || '')
    const aPri = aIdx === -1 ? 999 : aIdx
    const bPri = bIdx === -1 ? 999 : bIdx
    return aPri - bPri
  })

  const best = sorted[0]
  if (!best?.value || !best.indices?.length) return null

  // Skip snippet for short fields like Name — the title already shows it
  if (best.key === 'searchName' || best.key === 'searchFamily') {
    // Try next match if available
    if (sorted.length > 1 && sorted[1]?.value && sorted[1].indices?.length) {
      return buildSnippet(sorted[1])
    }
    return null
  }

  return buildSnippet(best)
}

function buildSnippet(match: Fuse.FuseResultMatch): { field: string; before: string; match: string; after: string } {
  const value = match.value || ''
  const [start, end] = match.indices[0]
  const contextStart = Math.max(0, start - 50)
  const contextEnd = Math.min(value.length, end + 80)

  return {
    field: FIELD_LABELS[match.key || ''] || match.key || '',
    before: (contextStart > 0 ? '...' : '') + value.slice(contextStart, start),
    match: value.slice(start, end + 1),
    after: value.slice(end + 1, contextEnd) + (contextEnd < value.length ? '...' : ''),
  }
}
