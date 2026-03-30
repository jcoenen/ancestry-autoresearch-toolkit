import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePersonBySlug, usePersonById, useData, usePeople, formatYear, confidenceColor, getSourceSlugById, MEDIA_BASE } from '../useData'
import type { Person, ChildRef, SpouseRef } from '../types'
import { buildGenderMap } from './VerticalTreePrototypes'
import { findRelationship } from '../relationshipCalculator'
import type { RelationshipResult } from '../relationshipCalculator'

/* ── Biography text with clickable source links ──────────── */

function InlineMarkdown({ text, linkBoldToAnchor }: { text: string; linkBoldToAnchor?: string }) {
  // Handle **bold** markers within plain text
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2)
          if (linkBoldToAnchor) {
            return <a key={i} href={`#${linkBoldToAnchor}`} className="font-bold text-amber-700 hover:text-amber-900 hover:underline">{inner}</a>
          }
          return <strong key={i}>{inner}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function BiographyText({ text, linkBoldToAnchor }: { text: string; linkBoldToAnchor?: string }) {
  // Split text around source ID references like (SRC-OBIT-004) or SRC-CEM-017
  const parts = text.split(/(SRC-[A-Z]+-\d+)/g)
  return (
    <>
      {parts.map((part, i) => {
        const slug = getSourceSlugById(part)
        if (slug) {
          return (
            <Link key={i} to={`/sources/${slug}`}
              className="text-amber-700 hover:text-amber-900 hover:underline font-mono text-sm">
              {part}
            </Link>
          )
        }
        return <InlineMarkdown key={i} text={part} linkBoldToAnchor={linkBoldToAnchor} />
      })}
    </>
  )
}

function PersonLink({ id, name }: { id: string; name: string }) {
  const person = usePersonById(id)
  if (person) {
    return (
      <Link to={`/people/${person.slug}`} className="font-medium">
        {person.name}
      </Link>
    )
  }
  return <span className="text-stone-600">{name || id || 'Unknown'}</span>
}

function ChildCard({ child }: { child: ChildRef }) {
  const person = usePersonById(child.id)
  const born = person ? formatYear(person.born) : ''
  const died = person ? formatYear(person.died) : ''
  const years = born ? (died && died !== '?' ? `${born}\u2013${died}` : `b. ${born}`) : ''

  if (person) {
    return (
      <Link to={`/people/${person.slug}`} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-stone-50 transition-colors group">
        <span className="w-6 h-6 rounded-full bg-stone-200 group-hover:bg-amber-200 flex items-center justify-center text-xs text-stone-500 transition-colors">
          {person.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-stone-800 truncate">{person.name}</div>
          {years && <div className="text-xs text-stone-400">{years}</div>}
        </div>
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-400">?</span>
      <span className="text-sm text-stone-500">{child.name || child.id}</span>
    </div>
  )
}

function CollapsibleChildren({ children, defaultOpen = false }: { children: ChildRef[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  if (children.length === 0) return null

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left px-1 py-1 rounded hover:bg-stone-50 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          Children ({children.length})
        </span>
      </button>
      {open && (
        <div className="ml-1 mt-1 border-l-2 border-stone-200 pl-2">
          {children.map((ch, i) => (
            <ChildCard key={i} child={ch} />
          ))}
        </div>
      )}
    </div>
  )
}

function FamilyUnit({ person, spouse, children }: { person: Person; spouse?: SpouseRef; children: ChildRef[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-0.5">
            {spouse ? 'Spouse' : 'Unknown Partner'}
          </div>
          {spouse ? (
            <div className="flex items-baseline gap-2">
              <PersonLink id={spouse.id} name={spouse.name} />
              {spouse.marriageDate && (
                <span className="text-xs text-stone-400">m. {spouse.marriageDate}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-stone-400 italic">Unknown</span>
          )}
        </div>
      </div>
      <CollapsibleChildren children={children} defaultOpen={children.length <= 5} />
    </div>
  )
}

function FamilyUnits({ person }: { person: Person }) {
  const allPeople = usePeople()

  if (person.spouses.length === 0 && person.children.length === 0) return null

  // Group children by which spouse they belong to
  const spouseChildMap = new Map<string, ChildRef[]>()
  const unmatched: ChildRef[] = []

  // Initialize a bucket for each spouse
  for (const sp of person.spouses) {
    spouseChildMap.set(sp.id || sp.name, [])
  }

  for (const ch of person.children) {
    // 1. Use explicit spouseIndex from build data (set when Children (Nth marriage) was used)
    if (ch.spouseIndex !== undefined && ch.spouseIndex < person.spouses.length) {
      const sp = person.spouses[ch.spouseIndex]
      const key = sp.id || sp.name
      spouseChildMap.get(key)?.push(ch)
      continue
    }

    // 2. Cross-reference: look up child in allPeople and match parent to a spouse
    const childPerson = ch.id ? allPeople.find(p => p.id === ch.id) : undefined
    if (childPerson) {
      let matched = false
      for (const sp of person.spouses) {
        const spouseId = sp.id
        if (
          childPerson.father === spouseId || childPerson.mother === spouseId ||
          childPerson.fatherName === sp.name || childPerson.motherName === sp.name
        ) {
          const key = sp.id || sp.name
          spouseChildMap.get(key)?.push(ch)
          matched = true
          break
        }
      }
      if (matched) continue
    }

    // 3. Fallback: if only one spouse, assign to them
    if (person.spouses.length === 1) {
      const key = person.spouses[0].id || person.spouses[0].name
      spouseChildMap.get(key)?.push(ch)
    } else {
      unmatched.push(ch)
    }
  }

  return (
    <>
      {person.spouses.map((sp, i) => {
        const key = sp.id || sp.name
        const children = spouseChildMap.get(key) || []
        return <FamilyUnit key={i} person={person} spouse={sp} children={children} />
      })}
      {unmatched.length > 0 && person.spouses.length !== 1 && (
        <FamilyUnit person={person} children={unmatched} />
      )}
      {person.spouses.length === 0 && person.children.length > 0 && (
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <CollapsibleChildren children={person.children} defaultOpen={person.children.length <= 5} />
        </div>
      )}
    </>
  )
}

function MarkdownSection({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.JSX.Element[] = []
  let tableRows: string[][] = []
  let tableHeaders: string[] = []

  function flushTable() {
    if (tableHeaders.length === 0) return
    elements.push(
      <div key={elements.length} className="overflow-x-auto my-3">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {tableHeaders.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 bg-stone-50 border border-stone-200 font-medium text-stone-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 border border-stone-200 text-stone-700">
                    <InlineMarkdown text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableHeaders = []
    tableRows = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushTable()
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushTable()
      elements.push(
        <h3 key={elements.length} className="text-base font-semibold text-stone-700 mt-4 mb-2">
          {trimmed.slice(4)}
        </h3>
      )
    } else if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean)
      if (trimmed.match(/^\|[\s-|]+\|$/)) continue // separator row
      if (tableHeaders.length === 0) {
        tableHeaders = cells
      } else {
        tableRows.push(cells)
      }
    } else {
      flushTable()
      elements.push(
        <p key={elements.length} className="text-stone-700 leading-relaxed mb-3">
          <InlineMarkdown text={trimmed} />
        </p>
      )
    }
  }
  flushTable()

  return <>{elements}</>
}

/* ── Relationship Calculator ────────────────────────────────── */

function RelationshipCalculator({ person }: { person: Person }) {
  const people = usePeople()
  const genderMap = useMemo(() => buildGenderMap(people), [people])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Person | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return people
      .filter(p => p.id !== person.id && p.name.toLowerCase().includes(q))
      .slice(0, 12)
  }, [query, people, person.id])

  const result: RelationshipResult | null = useMemo(() => {
    if (!selected) return null
    return findRelationship(person.id, selected.id, people, genderMap)
  }, [selected, person.id, people, genderMap])

  function handleSelect(p: Person) {
    setSelected(p)
    setQuery(p.name)
    setShowDropdown(false)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-stone-800 mb-3">Relationship Calculator</h2>
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <p className="text-sm text-stone-500 mb-3">
          How is <span className="font-medium text-stone-700">{person.name}</span> related to&hellip;
        </p>

        <div ref={wrapperRef} className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); setShowDropdown(true) }}
              onFocus={() => { if (query.trim() && !selected) setShowDropdown(true) }}
              placeholder="Type a name…"
              className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
            {(query || selected) && (
              <button onClick={handleClear}
                className="px-3 py-2 rounded-lg text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                Clear
              </button>
            )}
          </div>

          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex items-baseline gap-2 transition-colors"
                >
                  <span className="font-medium text-stone-800">{p.name}</span>
                  <span className="text-xs text-stone-400">
                    {formatYear(p.born)}{p.died ? `–${formatYear(p.died)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result */}
        {selected && result && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg font-bold text-amber-700">{result.name}</span>
            </div>

            {/* Path visualization */}
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {result.path.map((step, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && step.label && (
                    <span className="text-xs text-stone-400 flex items-center gap-0.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="italic">{step.label}</span>
                    </span>
                  )}
                  {step.person.id === person.id ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-xs">
                      {step.person.name}
                    </span>
                  ) : step.person.id === selected.id ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-xs">
                      {step.person.name}
                    </span>
                  ) : (
                    <Link
                      to={`/people/${step.person.slug}`}
                      className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 hover:bg-amber-50 hover:text-amber-800 text-xs transition-colors"
                    >
                      {step.person.name}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {selected && !result && (
          <div className="mt-4 text-sm text-stone-500 italic">
            No relationship found between these two people.
          </div>
        )}
      </div>
    </section>
  )
}

export default function PersonPage() {
  const { slug } = useParams<{ slug: string }>()
  const person = usePersonBySlug(slug || '')
  const { sources, media } = useData()

  if (!person) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-800">Person Not Found</h1>
        <p className="mt-2 text-stone-500">No person found with that identifier.</p>
        <Link to="/people" className="mt-4 inline-block text-sm font-medium">
          Back to Directory
        </Link>
      </div>
    )
  }

  const personSources = sources.filter(s => person.sources.includes(s.id))
  const personMedia = person.media

  const years = person.privacy
    ? ''
    : `${formatYear(person.born)} - ${formatYear(person.died)}`

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-stone-400 mb-6 print-hide">
        <Link to="/people" className="hover:text-stone-600">People</Link>
        <span className="mx-2">/</span>
        <Link to={`/people?family=${person.family}`} className="hover:text-stone-600">{person.family}</Link>
        <span className="mx-2">/</span>
        <span className="text-stone-600">{person.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">{person.name}</h1>
          {years && <p className="text-lg text-stone-500 mt-1">{years}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="print-hide inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-700 hover:bg-amber-100 hover:text-amber-800 transition-colors"
            title="Print this page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <Link to={`/tree/${person.id}`}
            className="print-hide inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-700 hover:bg-amber-100 hover:text-amber-800 transition-colors hover:no-underline">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            View in Tree
          </Link>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${confidenceColor(person.confidence)}`}>
            {person.confidence}
          </span>
        </div>
      </div>

      {/* Privacy Notice */}
      {person.privacy && (
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <strong>Private:</strong> This person is marked as private. Personal details, sources, and media are not displayed.
        </div>
      )}

      {/* Vital Information */}
      {!person.privacy && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Vital Information</h2>
          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-stone-100">
                {person.born && (
                  <VitalRow label="Born" value={String(person.born)} />
                )}
                {person.birthplace && (
                  <VitalRow label="Birthplace" value={person.birthplace} />
                )}
                {person.died && (
                  <VitalRow label="Died" value={String(person.died)} />
                )}
                {person.deathPlace && person.deathPlace !== '—' && (
                  <VitalRow label="Death Place" value={person.deathPlace} />
                )}
                {person.causeOfDeath && person.causeOfDeath !== '—' && (
                  <VitalRow label="Cause of Death" value={person.causeOfDeath} />
                )}
                {person.burial && person.burial !== '—' && (
                  <VitalRow label="Burial" value={person.burial} />
                )}
                {person.religion && person.religion !== '—' && (
                  <VitalRow label="Religion" value={person.religion} />
                )}
                {person.confirmation && person.confirmation !== '—' && (
                  <VitalRow label="Confirmation" value={person.confirmation} />
                )}
                {person.occupation && person.occupation !== '—' && (
                  <VitalRow label="Occupation" value={person.occupation} />
                )}
                {person.military && person.military !== '—' && (
                  <VitalRow label="Military" value={person.military} />
                )}
                {person.immigration && person.immigration !== '—' && (
                  <VitalRow label="Immigration" value={person.immigration} />
                )}
                {person.emigration && person.emigration !== '—' && (
                  <VitalRow label="Emigration" value={person.emigration} />
                )}
                {person.naturalization && person.naturalization !== '—' && (
                  <VitalRow label="Naturalization" value={person.naturalization} />
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Family */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-stone-800 mb-3">Family</h2>
        <div className="space-y-4">
          {/* Parents */}
          {(person.father || person.fatherName || person.mother || person.motherName) && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(person.father || person.fatherName) && (
                  <div>
                    <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-0.5">Father</div>
                    <PersonLink id={person.father} name={person.fatherName} />
                  </div>
                )}
                {(person.mother || person.motherName) && (
                  <div>
                    <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-0.5">Mother</div>
                    <PersonLink id={person.mother} name={person.motherName} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Spouse/Children Family Units */}
          <FamilyUnits person={person} />
        </div>
      </section>

      {/* Biography */}
      {!person.privacy && person.biography && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Biography</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            {person.biography.split('\n\n').map((para, i) => (
              <p key={i} className="text-stone-700 leading-relaxed mb-3 last:mb-0">
                <BiographyText text={para} linkBoldToAnchor={i === 0 && person.birthDateAnalysis ? 'birth-date-analysis' : undefined} />
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Birth Date Analysis */}
      {!person.privacy && person.birthDateAnalysis && (
        <section id="birth-date-analysis" className="mb-8 scroll-mt-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Birth Date Analysis</h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-5">
            <MarkdownSection content={person.birthDateAnalysis} />
          </div>
        </section>
      )}

      {/* Sources */}
      {!person.privacy && personSources.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Sources</h2>
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
            {personSources.map(s => (
              <Link key={s.id} to={`/sources/${s.slug}`} className="px-5 py-3 flex items-baseline justify-between gap-4 hover:bg-stone-50 block">
                <div>
                  <span className="text-sm font-mono text-amber-700">{s.id}</span>
                  <span className="text-sm text-stone-600 ml-2">{s.title || s.person}</span>
                </div>
                <span className="text-xs text-stone-400 shrink-0">{s.type.replace(/_/g, ' ')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Media */}
      {!person.privacy && personMedia.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Media ({personMedia.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {personMedia.map((m, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-white overflow-hidden hover:border-amber-300 hover:shadow-sm transition-all">
                <a href={`${MEDIA_BASE}${m.path}`} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`${MEDIA_BASE}${m.path}`}
                    alt={m.description}
                    className="w-full object-cover bg-stone-100 cursor-zoom-in"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.alt = m.description
                      target.className = 'w-full aspect-square bg-stone-100 flex items-center justify-center text-stone-400 text-xs p-4'
                    }}
                  />
                </a>
                <div className="p-2">
                  <div className="text-xs text-stone-700">{m.description}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{m.type}</div>
                  {m.sourceUrl && (
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-amber-600 hover:text-amber-800 mt-1 block truncate">
                      Source ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lineage */}
      <LineageSection person={person} />

      {/* Descendants */}
      <DescendantsSection person={person} />

      {/* Relationship Calculator — hidden in print */}
      <div className="print-hide">
        <RelationshipCalculator person={person} />
      </div>
    </div>
  )
}

function AncestorChain({ startId, label, color }: { startId: string; label: string; color: 'blue' | 'pink' }) {
  const allPeople = usePeople()
  const chain: Person[] = []
  const seen = new Set<string>()
  let currentId = startId
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    const p = allPeople.find(x => x.id === currentId)
    if (!p) break
    chain.push(p)
    currentId = label === 'Paternal' ? p.father : p.mother
  }

  if (chain.length === 0) return null

  const lineColor = color === 'blue' ? 'border-blue-200' : 'border-pink-200'
  const dotColor = color === 'blue' ? 'bg-blue-400' : 'bg-pink-400'

  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-2">
        <span className={`inline-block w-3 h-0.5 ${color === 'blue' ? 'bg-blue-400' : 'bg-pink-400'}`} />
        {label} Line
      </h3>
      <div className={`border-l-2 ${lineColor} ml-1.5`}>
        {chain.map((p, i) => {
          const years = p.privacy ? '' : `${formatYear(p.born)}\u2013${formatYear(p.died)}`
          return (
            <div key={p.id} className="flex items-center gap-3 py-1.5 pl-4 relative">
              <span className={`absolute -left-[5px] w-2 h-2 rounded-full ${dotColor}`} />
              <Link to={`/people/${p.slug}`} className="text-sm font-medium text-stone-700 hover:text-amber-700 hover:underline">
                {p.name}
              </Link>
              {years && <span className="text-xs text-stone-400">{years}</span>}
              {i === 0 && <span className="text-xs text-stone-400 italic">(self)</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineageSection({ person }: { person: Person }) {
  const hasFather = !!person.father
  const hasMother = !!person.mother

  if (!hasFather && !hasMother) return null

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-stone-800 mb-3">Lineage</h2>
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {hasFather && (
            <AncestorChain startId={person.id} label="Paternal" color="blue" />
          )}
          {hasMother && (
            <AncestorChain startId={person.id} label="Maternal" color="pink" />
          )}
        </div>
      </div>
    </section>
  )
}

function VitalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-36">{label}</td>
      <td className="px-5 py-2.5 text-sm text-stone-700">{value}</td>
    </tr>
  )
}

/* ── Descendant tree types & helpers ─────────────────────────── */

interface DescNode {
  person: Person
  gender: 'M' | 'F' | null
  spouse: Person | null
  children: DescNode[]
  depth: number
}

function buildDescTree(
  rootId: string,
  people: Person[],
  genderMap: Map<string, 'M' | 'F'>,
  depth: number,
  visited: Set<string>,
): DescNode | null {
  if (visited.has(rootId)) return null
  visited.add(rootId)

  const person = people.find(p => p.id === rootId)
  if (!person) return null

  const spouseRef = person.spouses[0]
  const spouse = spouseRef?.id ? people.find(p => p.id === spouseRef.id) || null : null

  const childIds = new Set<string>()
  for (const c of person.children) if (c.id) childIds.add(c.id)
  if (spouse) for (const c of spouse.children) if (c.id) childIds.add(c.id)
  for (const p of people) {
    if (p.father === rootId || p.mother === rootId) childIds.add(p.id)
    if (spouse && (p.father === spouse.id || p.mother === spouse.id)) childIds.add(p.id)
  }
  childIds.delete(rootId)
  if (spouse) childIds.delete(spouse.id)

  const childNodes: DescNode[] = []
  for (const cid of childIds) {
    const node = buildDescTree(cid, people, genderMap, depth + 1, visited)
    if (node) childNodes.push(node)
  }
  childNodes.sort((a, b) => {
    const ya = a.person.born?.replace(/[^0-9]/g, '').slice(0, 4)
    const yb = b.person.born?.replace(/[^0-9]/g, '').slice(0, 4)
    return Number(ya || 9999) - Number(yb || 9999)
  })

  return { person, gender: genderMap.get(rootId) || null, spouse, children: childNodes, depth }
}

function countDescendants(node: DescNode): number {
  let count = 0
  for (const c of node.children) {
    count += 1 + countDescendants(c)
  }
  return count
}

function maxDepth(node: DescNode): number {
  let max = node.depth
  for (const c of node.children) {
    const d = maxDepth(c)
    if (d > max) max = d
  }
  return max
}

/* ── Descendant row (recursive) ─────────────────────────────── */

function DescRow({
  node,
  expanded,
  toggleExpand,
  rootDepth,
}: {
  node: DescNode
  expanded: Set<string>
  toggleExpand: (id: string) => void
  rootDepth: number
}) {
  const isOpen = expanded.has(node.person.id)
  const hasChildren = node.children.length > 0
  const indent = node.depth - rootDepth

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-stone-50 group"
        style={{ paddingLeft: `${indent * 24 + 4}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(node.person.id)}
            className="w-5 h-5 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors shrink-0"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Avatar */}
        <span className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 w-6 h-6 text-xs ${
          node.gender === 'M' ? 'bg-blue-100 text-blue-600'
          : node.gender === 'F' ? 'bg-pink-100 text-pink-600'
          : 'bg-stone-100 text-stone-500'
        }`}>
          {node.person.name.charAt(0)}
        </span>

        <Link
          to={`/people/${node.person.slug}`}
          className="text-sm font-medium text-stone-800 hover:text-amber-700 hover:no-underline truncate"
        >
          {node.person.name}
        </Link>

        <span className="text-xs text-stone-400 shrink-0">
          {formatYear(node.person.born)}{node.person.died ? `\u2013${formatYear(node.person.died)}` : ''}
        </span>

        {node.spouse && (
          <span className="text-xs text-stone-400 shrink-0 hidden sm:inline">
            m.{' '}
            <Link to={`/people/${node.spouse.slug}`} className="text-stone-500 hover:text-amber-700 hover:no-underline">
              {node.spouse.name}
            </Link>
          </span>
        )}

        {hasChildren && (
          <span className="text-xs text-stone-300 shrink-0 hidden md:inline">
            ({node.children.length})
          </span>
        )}
      </div>

      {isOpen && node.children.map(child => (
        <DescRow
          key={child.person.id}
          node={child}
          expanded={expanded}
          toggleExpand={toggleExpand}
          rootDepth={rootDepth}
        />
      ))}
    </div>
  )
}

/* ── Descendants section ─────────────────────────────────────── */

function DescendantsSection({ person }: { person: Person }) {
  const people = usePeople()
  const genderMap = useMemo(() => buildGenderMap(people), [people])

  const tree = useMemo(() => {
    return buildDescTree(person.id, people, genderMap, 0, new Set())
  }, [person.id, people, genderMap])

  const totalDesc = useMemo(() => tree ? countDescendants(tree) : 0, [tree])
  const generations = useMemo(() => tree ? maxDepth(tree) : 0, [tree])

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand first 2 levels
    if (!tree) return new Set<string>()
    const initial = new Set<string>()
    function walk(node: DescNode, d: number) {
      if (d >= 2) return
      if (node.children.length > 0) initial.add(node.person.id)
      for (const c of node.children) walk(c, d + 1)
    }
    walk(tree, 0)
    return initial
  })

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (!tree || totalDesc === 0) return null

  const expandAll = () => {
    const all = new Set<string>()
    function walk(node: DescNode) {
      if (node.children.length > 0) all.add(node.person.id)
      for (const c of node.children) walk(c)
    }
    walk(tree)
    setExpanded(all)
  }

  const collapseAll = () => setExpanded(new Set())

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-semibold text-stone-800">Descendants</h2>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>{totalDesc} descendant{totalDesc !== 1 ? 's' : ''}</span>
          <span>{generations} generation{generations !== 1 ? 's' : ''}</span>
          <button onClick={expandAll} className="text-stone-500 hover:text-stone-700 underline">expand</button>
          <button onClick={collapseAll} className="text-stone-500 hover:text-stone-700 underline">collapse</button>
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
        {tree.children.map(child => (
          <DescRow
            key={child.person.id}
            node={child}
            expanded={expanded}
            toggleExpand={toggleExpand}
            rootDepth={1}
          />
        ))}
      </div>
    </section>
  )
}
