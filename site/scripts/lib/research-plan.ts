/**
 * Pure functions for generating research plans from gap data.
 * No React or file-system dependencies — safe for testing.
 */

import type { Person, SourceEntry } from '../../src/types.js';

export interface GapData {
  total: number
  stubAndLow: Person[]
  stubs: Person[]
  low: Person[]
  missingBorn: Person[]
  missingDied: Person[]
  missingBirthplace: Person[]
  missingFather: Person[]
  missingMother: Person[]
  missingParents: Person[]
  noSources: Person[]
  noMedia: Person[]
  noBio: Person[]
  unverifiedOcr: SourceEntry[]
  untranslated: SourceEntry[]
  completeness: number
  // Document completeness (optional for backwards compatibility)
  missingObituary?: Person[]
  missingGravestone?: Person[]
  missingDeathCert?: Person[]
  missingBirthCert?: Person[]
  missingBaptism?: Person[]
  missingMarriageCert?: Person[]
  missingPhoto?: Person[]
}

/** Research suggestions keyed by gap type */
export const SUGGESTIONS: Record<string, string[]> = {
  stubAndLow: [
    'Search FamilySearch.org for census, vital records, and immigration documents',
    'Check Ancestry.com or MyHeritage for indexed records and family trees',
    'Look for church records (baptism, marriage, burial) in the person\'s known region',
    'Search FindAGrave.com or BillionGraves for cemetery records with family details',
  ],
  missingBorn: [
    'Check birth/baptismal certificates in the person\'s birthplace civil registry',
    'Search census records — age + census year can estimate birth year',
    'Look for church baptism records (often recorded within days of birth)',
    'Check immigration/naturalization records which sometimes list date of birth',
  ],
  missingDied: [
    'Search newspaper archives for obituaries (newspapers.com, chroniclingamerica.loc.gov)',
    'Check FindAGrave.com or cemetery office records for burial/death dates',
    'Look for probate or estate records in the county of last known residence',
    'Check Social Security Death Index (SSDI) for US deaths after 1962',
  ],
  missingParents: [
    'Check the person\'s birth certificate — parents are usually listed',
    'Look for marriage records which often name parents of both bride and groom',
    'Search baptism/christening records which typically name parents and sponsors',
    'Check census records — earlier censuses may show the person as a child in a household',
  ],
  noSources: [
    'Start with vital records: birth, marriage, and death certificates',
    'Search census records for every decade the person was alive',
    'Look for immigration/ship manifests if the person immigrated',
    'Check newspaper archives for mentions (marriages, obituaries, local news)',
  ],
  noMedia: [
    'Search FindAGrave.com for gravestone photos',
    'Check FamilySearch or Ancestry for digitized document images',
    'Look for portraits in family collections or historical society archives',
    'Search newspaper archives for photos accompanying articles or obituaries',
  ],
  noBio: [
    'Draft a narrative from existing vital facts and source data',
    'Combine census records to trace the person\'s life across decades',
    'Use newspaper clippings and obituaries as biographical source material',
  ],
  unverifiedOcr: [
    'Compare OCR text side-by-side with the original document image',
    'Pay special attention to names, dates, and places — OCR errors are most impactful there',
    'Mark as verified once reviewed, or correct any misread text',
  ],
  untranslated: [
    'Prioritize sources with extracted facts — translation confirms accuracy',
    'Use FamilySearch Wiki to identify the document language and find translation guides',
    'For common languages, volunteer translators are available at genealogy forums',
  ],
  missingObituary: [
    'Search Newspapers.com, Ancestry newspaper archives, and GenealogyBank',
    'Check local library microfilm or digitized newspaper collections',
    'Search the funeral home name (if known) — many post historical obituaries online',
  ],
  missingGravestone: [
    'Search FindAGrave.com and BillionGraves — many gravestones are already photographed',
    'Request a volunteer photo via FindAGrave if the stone exists but isn\'t photographed',
    'Contact the cemetery office for burial records if no stone is visible',
  ],
  missingDeathCert: [
    'Order from the state vital records office — typically $10-30 per certificate',
    'Search Ancestry or FamilySearch for indexed death certificates (1900+)',
    'Check county clerk records for older US deaths; parish burial registers for pre-civil-registration',
  ],
  missingBirthCert: [
    'Order from the state vital records office — civil registration varies by state/year',
    'Search FamilySearch and Ancestry for indexed birth records',
    'For pre-1900 births, look for baptismal records as the equivalent',
  ],
  missingBaptism: [
    'Search FamilySearch for church records in the person\'s known region',
    'Contact the local parish directly — many have records dating to the 1600s',
    'Check regional church archives (diocese, synod, classis) for consolidated records',
  ],
  missingMarriageCert: [
    'Order from the state vital records office or county clerk',
    'Search FamilySearch and Ancestry for indexed marriage records',
    'Church marriage registers often predate civil registration — contact the parish',
  ],
  missingPhoto: [
    'Check FindAGrave — memorial pages sometimes include portrait photos',
    'Ask living relatives for scanned family photos',
    'Search Ancestry member trees — relatives may have uploaded photos',
    'Check historical society collections for community portraits',
  ],
}

export function generateResearchPlan(gaps: GapData): string {
  const lines: string[] = []
  const date = new Date().toISOString().slice(0, 10)
  lines.push(`# Research Plan — ${date}`)
  lines.push('')
  lines.push(`**Completeness:** ${gaps.completeness}% of key fields filled across ${gaps.total} people`)
  lines.push('')

  // Build per-person priority list: people sorted by most gaps
  const personGapMap = new Map<string, { person: Person; gaps: string[] }>()

  function addGap(p: Person, gap: string) {
    const entry = personGapMap.get(p.id)
    if (entry) {
      entry.gaps.push(gap)
    } else {
      personGapMap.set(p.id, { person: p, gaps: [gap] })
    }
  }

  for (const p of gaps.stubs) addGap(p, 'stub — needs basic research')
  for (const p of gaps.low) addGap(p, 'low confidence — needs more sources')
  for (const p of gaps.missingBorn) addGap(p, 'missing birth date')
  for (const p of gaps.missingDied) addGap(p, 'missing death date')
  for (const p of gaps.missingBirthplace) addGap(p, 'missing birthplace')
  for (const p of gaps.missingParents) {
    const missing = []
    if (!p.father && !p.fatherName) missing.push('father')
    if (!p.mother && !p.motherName) missing.push('mother')
    addGap(p, `missing ${missing.join(' & ')}`)
  }
  for (const p of gaps.noSources) addGap(p, 'no sources cited')
  for (const p of gaps.noBio) addGap(p, 'no biography')
  for (const p of (gaps.missingObituary ?? [])) addGap(p, 'no obituary')
  for (const p of (gaps.missingGravestone ?? [])) addGap(p, 'no gravestone record')
  for (const p of (gaps.missingDeathCert ?? [])) addGap(p, 'no death certificate')
  for (const p of (gaps.missingBirthCert ?? [])) addGap(p, 'no birth certificate')
  for (const p of (gaps.missingBaptism ?? [])) addGap(p, 'no baptism/church record')
  for (const p of (gaps.missingMarriageCert ?? [])) addGap(p, 'no marriage certificate')
  for (const p of (gaps.missingPhoto ?? [])) addGap(p, 'no personal photo')

  // Sort by number of gaps descending
  const sorted = [...personGapMap.values()].sort((a, b) => b.gaps.length - a.gaps.length)

  lines.push('## Priority Research Tasks')
  lines.push('')
  lines.push('People sorted by number of gaps (most gaps first):')
  lines.push('')

  for (const { person, gaps: personGaps } of sorted) {
    const born = person.born ? ` (b. ${person.born})` : ''
    lines.push(`### ${person.name}${born} — ${person.family}`)
    lines.push('')
    for (const g of personGaps) {
      lines.push(`- [ ] ${g}`)
    }
    lines.push('')
  }

  // Source tasks
  if (gaps.unverifiedOcr.length > 0) {
    lines.push('## Unverified OCR Sources')
    lines.push('')
    lines.push('These sources need manual review against original documents:')
    lines.push('')
    for (const s of gaps.unverifiedOcr) {
      lines.push(`- [ ] ${s.title || s.id} (${s.type?.replace(/_/g, ' ')})`)
    }
    lines.push('')
  }

  if (gaps.untranslated.length > 0) {
    lines.push('## Untranslated Sources')
    lines.push('')
    lines.push('Non-English sources that need translation:')
    lines.push('')
    for (const s of gaps.untranslated) {
      const lang = s.language ? ` [${s.language}]` : ''
      lines.push(`- [ ] ${s.title || s.id}${lang} (${s.type?.replace(/_/g, ' ')})`)
    }
    lines.push('')
  }

  // Quick-reference suggestions
  lines.push('## Research Tips by Gap Type')
  lines.push('')
  const tipSections: [string, string[]][] = [
    ['Missing Birth Dates', SUGGESTIONS.missingBorn],
    ['Missing Death Dates', SUGGESTIONS.missingDied],
    ['Missing Parents', SUGGESTIONS.missingParents],
    ['No Sources', SUGGESTIONS.noSources],
  ]
  for (const [title, tips] of tipSections) {
    lines.push(`### ${title}`)
    for (const t of tips) lines.push(`- ${t}`)
    lines.push('')
  }

  return lines.join('\n')
}
