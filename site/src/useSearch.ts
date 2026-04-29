import { useCallback, useMemo } from 'react'
import Fuse, { type FuseResult, type FuseResultMatch } from 'fuse.js'
import { useData, formatYear } from './useData'

export type SearchResultType = 'person' | 'source' | 'media'

export interface SearchDocument {
  type: SearchResultType
  title: string
  subtitle: string
  link: string
  marriedName?: string[]
  mediaPath?: string
  // Indexed fields
  searchId: string
  searchName: string
  searchAliases: string
  searchFamily: string
  searchDates: string
  searchPlaces: string
  searchOccupation: string
  searchRelations: string
  searchLifeEvents: string
  searchBiography: string
  searchFullText: string
  searchRecord: string
  searchPublisher: string
  searchNotes: string
  searchExtractedFacts: string
  searchSources: string
  searchMedia: string
}

export interface SearchResult {
  item: SearchDocument
  score: number
  matches: readonly FuseResultMatch[]
}

export interface GroupedSearchResults {
  people: SearchResult[]
  sources: SearchResult[]
  media: SearchResult[]
  total: number
}

const TYPE_LABELS: Record<string, string> = {
  obituary: 'Obituary',
  cemetery: 'Cemetery',
  cemetery_memorial: 'Cemetery',
  church: 'Church Record',
  church_record: 'Church Record',
  secondary: 'Secondary Source',
  immigration: 'Immigration',
  military: 'Military',
  census: 'Census',
  certificate: 'Certificate',
  newspaper: 'Newspaper',
  note: 'Family Knowledge',
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  gravestone: 'Gravestone',
  portrait: 'Portrait',
  newspaper: 'Newspaper',
  document: 'Document',
  group_photo: 'Group Photo',
  scan: 'Scan',
  other: 'Media',
}

const VARIANT_GROUPS = [
  ['castonia', 'castonguay', 'costonguay', 'gastonguay'],
  ['lemere', 'lemieux', 'lamere', 'le mere'],
  ['baehman', 'baehnmann', 'behnman', 'behnmann'],
  ['stolzman', 'stoltzman', 'stolzmann'],
  ['bohman', 'bohmann', 'bowman'],
  ['conley', 'connelly', 'connely'],
  ['elizabeth', 'eliza', 'liz', 'lizzie', 'beth', 'betty', 'bess'],
  ['raphael', 'rafael', 'ray', 'raymond', 'rafe'],
]

const SEARCH_KEYS = [
  { name: 'searchId', weight: 3.0 },
  { name: 'searchName', weight: 2.8 },
  { name: 'searchAliases', weight: 2.4 },
  { name: 'searchFamily', weight: 2.0 },
  { name: 'searchRelations', weight: 1.6 },
  { name: 'searchDates', weight: 1.2 },
  { name: 'searchPlaces', weight: 1.2 },
  { name: 'searchOccupation', weight: 1.0 },
  { name: 'searchLifeEvents', weight: 1.0 },
  { name: 'searchRecord', weight: 1.0 },
  { name: 'searchPublisher', weight: 0.8 },
  { name: 'searchSources', weight: 0.8 },
  { name: 'searchMedia', weight: 0.8 },
  { name: 'searchExtractedFacts', weight: 0.7 },
  { name: 'searchFullText', weight: 0.6 },
  { name: 'searchBiography', weight: 0.6 },
  { name: 'searchNotes', weight: 0.5 },
]

const EXACT_SEARCH_FIELDS: (keyof SearchDocument)[] = [
  'searchId',
  'searchName',
  'searchAliases',
  'searchFamily',
  'searchRelations',
  'searchDates',
  'searchPlaces',
  'searchOccupation',
  'searchLifeEvents',
  'searchRecord',
  'searchPublisher',
  'searchSources',
  'searchMedia',
  'searchExtractedFacts',
  'searchFullText',
  'searchBiography',
  'searchNotes',
]

const EXACT_FIELD_PRIORITY: Partial<Record<keyof SearchDocument, number>> = {
  searchId: 0.01,
  searchName: 0.02,
  searchAliases: 0.03,
  searchFamily: 0.04,
  searchRecord: 0.05,
  searchExtractedFacts: 0.06,
  searchFullText: 0.07,
  searchNotes: 0.08,
  searchMedia: 0.09,
  searchBiography: 0.1,
}

export function useSearch() {
  const { people, sources, media } = useData()

  const indexes = useMemo(() => {
    const personById = new Map(people.map(p => [p.id, p]))
    const sourceByMediaPath = new Map<string, string>()

    for (const source of sources) {
      for (const mediaEntry of source.media || []) {
        sourceByMediaPath.set(mediaEntry.path, `/sources/${source.slug}`)
      }
    }

    const peopleDocs: SearchDocument[] = people.map(p => {
      const spouseNames = (p.spouses || []).map(sp => sp.name).filter(Boolean)
      const childNames = (p.children || []).map(child => child.name).filter(Boolean)
      const parentNames = [p.fatherName, p.motherName].filter(Boolean)
      const sourceIds = (p.sources || []).join(' ')
      const mediaText = (p.media || [])
        .map(m => [m.path, m.person, m.description, MEDIA_TYPE_LABELS[m.type] || m.type].filter(Boolean).join(' '))
        .join(' ')

      return withSearchAliases({
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
        marriedName: p.marriedName && p.marriedName.length > 0 ? p.marriedName : undefined,
        searchId: [p.id, p.familySearchId, p.slug, p.filePath, sourceIds].filter(Boolean).join(' '),
        searchName: [p.name, p.nickname, ...(p.marriedName || []), ...(p.alsoKnownAs || [])].filter(Boolean).join(' '),
        searchAliases: '',
        searchFamily: p.family || '',
        searchDates: p.privacy ? '' : [p.born, p.died, formatYear(p.born), formatYear(p.died), p.created].filter(Boolean).join(' '),
        searchPlaces: p.privacy ? '' : [p.birthplace, p.deathPlace, p.burial, p.residence].filter(Boolean).join(' '),
        searchOccupation: p.privacy ? '' : (p.occupation || ''),
        searchRelations: p.privacy ? '' : [...parentNames, ...spouseNames, ...childNames].join(' '),
        searchLifeEvents: p.privacy ? '' : [
          p.religion,
          p.military,
          p.immigration,
          p.emigration,
          p.naturalization,
          p.causeOfDeath,
          p.confirmation,
          p.baptized,
          p.christened,
          p.education,
          p.divorce,
          p.cremation,
        ].filter(Boolean).join(' '),
        searchBiography: p.privacy ? '' : (p.biography || ''),
        searchFullText: '',
        searchRecord: '',
        searchPublisher: '',
        searchNotes: '',
        searchExtractedFacts: '',
        searchSources: p.privacy ? '' : sourceIds,
        searchMedia: p.privacy ? '' : mediaText,
      })
    })

    const sourceDocs: SearchDocument[] = sources.map(s => withSearchAliases({
        type: 'source' as const,
        title: s.title || s.record || s.id,
        subtitle: [TYPE_LABELS[s.type] || s.type, s.date, s.publisher].filter(Boolean).join(' \u00b7 '),
        link: `/sources/${s.slug}`,
        searchId: [s.id, s.fagNumber, s.slug, s.file, s.url, ...(s.personIds || []), ...(s.subjectPersonIds || [])].filter(Boolean).join(' '),
        searchName: [s.person, ...(s.persons || [])].filter(Boolean).join(' '),
        searchAliases: '',
        searchFamily: (s.families || []).join(' '),
        searchDates: [s.date, s.year, s.created].filter(Boolean).join(' '),
        searchPlaces: '',
        searchOccupation: '',
        searchRelations: (s.personIds || [])
          .map(id => personById.get(id)?.name || id)
          .filter(Boolean)
          .join(' '),
        searchLifeEvents: [s.type, TYPE_LABELS[s.type], s.reliability, s.language].filter(Boolean).join(' '),
        searchBiography: '',
        searchFullText: s.fullText || '',
        searchRecord: s.record || '',
        searchPublisher: s.publisher || '',
        searchNotes: s.notes || '',
        searchExtractedFacts: s.extractedFacts || '',
        searchSources: [s.id, ...(s.media || []).map(m => m.path)].filter(Boolean).join(' '),
        searchMedia: (s.media || []).map(m => [m.path, m.description, m.person, MEDIA_TYPE_LABELS[m.type] || m.type].filter(Boolean).join(' ')).join(' '),
      }))

    const mediaDocs: SearchDocument[] = media.map(m => withSearchAliases({
        type: 'media' as const,
        title: m.person || m.description || m.path,
        subtitle: [MEDIA_TYPE_LABELS[m.type] || m.type, m.description].filter(Boolean).join(' \u00b7 '),
        link: sourceByMediaPath.get(m.path) || `/gallery?search=${encodeURIComponent(m.person || m.description || m.path)}`,
        mediaPath: m.path,
        searchId: [m.path, m.sourceUrl, m.dateDownloaded].filter(Boolean).join(' '),
        searchName: m.person || '',
        searchAliases: '',
        searchFamily: '',
        searchDates: m.dateDownloaded || '',
        searchPlaces: '',
        searchOccupation: '',
        searchRelations: '',
        searchLifeEvents: MEDIA_TYPE_LABELS[m.type] || m.type || '',
        searchBiography: '',
        searchFullText: '',
        searchRecord: m.description || '',
        searchPublisher: '',
        searchNotes: '',
        searchExtractedFacts: '',
        searchSources: m.sourceUrl || '',
        searchMedia: [m.path, m.description, m.person, MEDIA_TYPE_LABELS[m.type] || m.type].filter(Boolean).join(' '),
      }))

    const fuseOptions = {
      keys: SEARCH_KEYS,
      threshold: 0.35,
      includeMatches: true,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    }

    return {
      peopleDocs,
      sourceDocs,
      mediaDocs,
      people: new Fuse(peopleDocs, fuseOptions),
      sources: new Fuse(sourceDocs, fuseOptions),
      media: new Fuse(mediaDocs, fuseOptions),
    }
  }, [people, sources, media])

  const search = useCallback((query: string): GroupedSearchResults => {
    if (!query || query.length < 2) return { people: [], sources: [], media: [], total: 0 }

    const people = mergeResults(
      exactKeywordResults(indexes.peopleDocs, query),
      indexes.people.search(query, { limit: 60 }).map(r => toSearchResult(r, query)),
    ).sort(compareResults).slice(0, 60)
    const sources = mergeResults(
      exactKeywordResults(indexes.sourceDocs, query),
      indexes.sources.search(query, { limit: 60 }).map(r => toSearchResult(r, query)),
    ).sort(compareResults).slice(0, 60)
    const media = mergeResults(
      exactKeywordResults(indexes.mediaDocs, query),
      indexes.media.search(query, { limit: 40 }).map(r => toSearchResult(r, query)),
    ).sort(compareResults).slice(0, 40)

    return { people, sources, media, total: people.length + sources.length + media.length }
  }, [indexes])

  return { search }
}

function toSearchResult(r: FuseResult<SearchDocument>, query: string): SearchResult {
  return {
    item: r.item,
    score: boostedScore(r.item, r.score ?? 1, query),
    matches: r.matches ?? [],
  }
}

function compareResults(a: SearchResult, b: SearchResult): number {
  return a.score - b.score || a.item.title.localeCompare(b.item.title)
}

function mergeResults(primary: SearchResult[], secondary: SearchResult[]): SearchResult[] {
  const merged = new Map<string, SearchResult>()

  for (const result of [...primary, ...secondary]) {
    const key = result.item.link
    const existing = merged.get(key)
    if (!existing || result.score < existing.score) merged.set(key, result)
  }

  return Array.from(merged.values())
}

function exactKeywordResults(documents: SearchDocument[], query: string): SearchResult[] {
  const normalizedQuery = normalizeForSearch(query)
  const queryTokens = tokenizeForSearch(query)
  if (!normalizedQuery || queryTokens.length === 0) return []

  const results: SearchResult[] = []

  for (const document of documents) {
    let best: SearchResult | null = null

    for (const field of EXACT_SEARCH_FIELDS) {
      const value = String(document[field] || '')
      const match = findExactMatch(value, normalizedQuery, queryTokens)
      if (!match) continue

      const score = (EXACT_FIELD_PRIORITY[field] ?? 0.12) + (queryTokens.length > 1 ? 0 : 0.02)
      const result: SearchResult = {
        item: document,
        score,
        matches: [{
          key: field,
          value,
          indices: [[match.start, match.end]],
        }],
      }

      if (!best || result.score < best.score) best = result
    }

    if (best) results.push(best)
  }

  return results
}

function findExactMatch(value: string, normalizedQuery: string, queryTokens: string[]): { start: number; end: number } | null {
  if (!value) return null

  const lowerValue = value.toLowerCase()
  const directIndex = lowerValue.indexOf(normalizedQuery)
  if (directIndex >= 0) return { start: directIndex, end: directIndex + normalizedQuery.length - 1 }

  const normalizedValue = normalizeForSearch(value)
  const valueTokens = normalizedValue.split(/\s+/).filter(Boolean)
  const valueTokenSet = new Set(valueTokens)

  if (queryTokens.length === 1) {
    const token = queryTokens[0]
    if (!valueTokenSet.has(token)) return null
    return approximateOriginalTokenRange(value, token)
  }

  if (!queryTokens.every(token => valueTokenSet.has(token))) return null
  return approximateOriginalTokenRange(value, queryTokens[0])
}

function approximateOriginalTokenRange(value: string, token: string): { start: number; end: number } {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escapedToken}\\b`, 'i')
  const match = regex.exec(value)
  if (match?.index != null) return { start: match.index, end: match.index + match[0].length - 1 }
  return { start: 0, end: Math.max(0, Math.min(value.length, token.length) - 1) }
}

function boostedScore(item: SearchDocument, fuseScore: number, query: string): number {
  const q = normalizeForSearch(query)
  const queryTokens = tokenizeForSearch(query)
  const title = normalizeForSearch(item.title)
  const name = normalizeForSearch(item.searchName)
  const aliases = normalizeForSearch(item.searchAliases)
  const id = normalizeForSearch(item.searchId)
  const nameTokens = tokenizeForSearch([
    item.title,
    item.searchName,
    expandGenealogyVariants([item.title, item.searchName].join(' ')),
    item.marriedName?.join(' ') || '',
  ].join(' '))
  const searchableTokens = tokenizeForSearch([
    item.title,
    item.searchName,
    item.searchAliases,
    item.searchFamily,
    item.searchRelations,
    item.searchPlaces,
    item.searchBiography,
    item.searchFullText,
    item.searchRecord,
    item.searchNotes,
    item.searchExtractedFacts,
    item.searchMedia,
  ].join(' '))
  const nameCoverage = tokenCoverage(queryTokens, nameTokens)
  const overallCoverage = tokenCoverage(queryTokens, searchableTokens)
  const nameQuery = looksLikeNameQuery(queryTokens)

  let score = fuseScore

  if (title === q || name === q || id.split(/\s+/).includes(q)) score -= 0.45
  else if (title.startsWith(q) || name.startsWith(q)) score -= 0.3
  else if (title.includes(q) || name.includes(q) || aliases.includes(q)) score -= 0.18
  else if (id.includes(q)) score -= 0.12

  if (queryTokens.length > 1) {
    if (nameCoverage === 1) score -= tokensAppearInOrder(queryTokens, nameTokens) ? 0.58 : 0.48
    else if (nameCoverage >= 0.75) score -= 0.3
    else if (nameCoverage >= 0.5) score -= 0.12

    if (overallCoverage === 1) score -= 0.1

    if (nameQuery && item.type === 'person' && nameCoverage < 1) score += (1 - nameCoverage) * 0.45
    if (nameQuery && item.type !== 'person' && nameCoverage < 1) score += (1 - nameCoverage) * 0.18
  } else if (queryTokens.length === 1 && nameCoverage === 1) {
    score -= 0.12
  }

  if (item.type === 'person') score -= 0.03

  return Math.max(-1, score)
}

function withSearchAliases<T extends SearchDocument>(document: T): T {
  const aliasSource = [
    document.searchName,
    document.searchFamily,
    document.searchRelations,
    document.searchPlaces,
    document.searchRecord,
  ].join(' ')

  return {
    ...document,
    searchAliases: [document.searchAliases, expandGenealogyVariants(aliasSource)].filter(Boolean).join(' '),
  }
}

function expandGenealogyVariants(value: string): string {
  const normalized = normalizeForSearch(value)
  const variants = new Set<string>()

  for (const group of VARIANT_GROUPS) {
    if (group.some(term => normalized.includes(term))) {
      for (const term of group) variants.add(term)
    }
  }

  return Array.from(variants).join(' ')
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenizeForSearch(value: string): string[] {
  return normalizeForSearch(value).split(/\s+/).filter(Boolean)
}

function tokenCoverage(queryTokens: string[], valueTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const valueSet = new Set(valueTokens)
  const matched = queryTokens.filter(token => valueSet.has(token)).length
  return matched / queryTokens.length
}

function tokensAppearInOrder(queryTokens: string[], valueTokens: string[]): boolean {
  let nextQueryIndex = 0

  for (const token of valueTokens) {
    if (token === queryTokens[nextQueryIndex]) nextQueryIndex += 1
    if (nextQueryIndex === queryTokens.length) return true
  }

  return false
}

function looksLikeNameQuery(tokens: string[]): boolean {
  return tokens.length >= 2 && tokens.length <= 4 && tokens.every(token => /^[a-z]+$/.test(token))
}

const FIELD_LABELS: Record<string, string> = {
  searchId: 'ID',
  searchName: 'Name',
  searchAliases: 'Name Variant',
  searchFamily: 'Family',
  searchDates: 'Dates',
  searchPlaces: 'Place',
  searchOccupation: 'Occupation',
  searchRelations: 'Family',
  searchLifeEvents: 'Life Events',
  searchBiography: 'Biography',
  searchFullText: 'Full Text',
  searchRecord: 'Record',
  searchPublisher: 'Publisher',
  searchNotes: 'Notes',
  searchExtractedFacts: 'Extracted Facts',
  searchSources: 'Source',
  searchMedia: 'Media',
}

export function getSnippet(matches: readonly FuseResultMatch[]): { field: string; before: string; match: string; after: string } | null {
  if (!matches.length) return null

  // Prefer matches in content-heavy fields for better snippets
  const preferred = ['searchName', 'searchRelations', 'searchPlaces', 'searchBiography', 'searchFullText', 'searchExtractedFacts', 'searchNotes', 'searchRecord', 'searchMedia']
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

function buildSnippet(match: FuseResultMatch): { field: string; before: string; match: string; after: string } {
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
