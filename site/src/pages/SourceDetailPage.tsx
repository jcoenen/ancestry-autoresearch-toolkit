import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MEDIA_BASE, formatYear, useData, useSiteConfig, useSourceBySlug } from '../useData'
import type { Person, SourceEntry } from '../types'
import { findRelationship } from '../relationshipCalculator'
import { useLightbox } from '../hooks/useLightbox'
import Lightbox from '../components/Lightbox'

type Role = 'subject' | 'linked' | 'citing' | 'mentioned'

type PersonSourceCard = {
  person: Person
  roles: Set<Role>
  relationship: string
}

const ROLE_LABELS: Record<Role, string> = {
  subject: 'Primary subject',
  linked: 'Linked person',
  citing: 'Cites source',
  mentioned: 'Mentioned',
}

const ROLE_STYLES: Record<Role, string> = {
  subject: 'bg-amber-100 text-amber-800',
  linked: 'bg-blue-100 text-blue-700',
  citing: 'bg-emerald-100 text-emerald-700',
  mentioned: 'bg-stone-100 text-stone-600',
}

function buildGenderMap(people: Person[]): Map<string, 'M' | 'F'> {
  const map = new Map<string, 'M' | 'F'>()
  for (const person of people) {
    if (person.gender === 'M' || person.gender === 'F') map.set(person.id, person.gender)
  }
  return map
}

function personYears(person: Person) {
  if (person.privacy) return ''
  const born = formatYear(person.born)
  const died = formatYear(person.died)
  if (born === '?' && died === '?') return ''
  return `${born} - ${died}`
}

function displayDate(value: string) {
  if (!value) return ''
  const raw = String(value)
  if (/^\d{4}(-\d{2})?(-\d{2})?$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime()) && /GMT|UTC|\d{2}:\d{2}:\d{2}/.test(raw)) {
    return parsed.toISOString().slice(0, 10)
  }
  return raw
}

function sourceType(source: SourceEntry) {
  return (source.type || source.recordTypes?.[0] || 'source').replace(/_/g, ' ')
}

function originalUrlLabel(url: string) {
  if (!url) return ''
  if (url.length < 64) return url
  return `${url.slice(0, 61)}...`
}

function bestPortrait(person: Person) {
  return person.media.find(media => media.type === 'portrait')
    || person.media.find(media => ['photo', 'group_photo'].includes(media.type))
    || person.media[0]
}

function addRole(map: Map<string, PersonSourceCard>, person: Person, role: Role) {
  const existing = map.get(person.id)
  if (existing) {
    existing.roles.add(role)
    return
  }
  map.set(person.id, { person, roles: new Set([role]), relationship: '' })
}

function PeopleCard({ card }: { card: PersonSourceCard }) {
  const portrait = bestPortrait(card.person)
  const roles = Array.from(card.roles)
  const years = personYears(card.person)

  return (
    <article className="overflow-hidden rounded-lg border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all">
      <div className="flex gap-3 p-4">
        <Link to={`/people/${card.person.slug}`} className="shrink-0 overflow-hidden rounded-lg bg-stone-100 hover:no-underline">
          {portrait ? (
            <img
              src={`${MEDIA_BASE}${portrait.path}`}
              alt={portrait.description}
              className="h-20 w-20 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center text-sm font-semibold text-stone-400">
              {card.person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/people/${card.person.slug}`} className="font-semibold text-stone-900 hover:text-amber-700">
            {card.person.name}
          </Link>
          <div className="mt-0.5 text-xs text-stone-400">{years || card.person.family}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {roles.map(role => (
              <span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_STYLES[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {card.relationship && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                {card.relationship}
              </span>
            )}
            <Link to={`/tree/${card.person.id}`} className="font-medium text-stone-500 hover:text-amber-700">Tree</Link>
            <Link to={`/people/${card.person.slug}`} className="font-medium text-stone-500 hover:text-amber-700">Person</Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="border-b border-stone-100 py-3 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 text-sm text-stone-700">{children}</dd>
    </div>
  )
}

function MarkdownTable({ text }: { text: string }) {
  const lines = text.split('\n').filter(line => line.trim().startsWith('|'))
  if (lines.length < 2) return <pre className="whitespace-pre-wrap text-sm text-stone-600">{text}</pre>

  const headerCells = lines[0].split('|').map(cell => cell.trim()).filter(Boolean)
  const dataRows = lines.slice(2)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headerCells.map((header, index) => (
              <th key={index} className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {dataRows.map((row, rowIndex) => {
            const cells = row.split('|').map(cell => cell.trim()).filter(Boolean)
            return (
              <tr key={rowIndex}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-stone-700">{cell}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SourceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const source = useSourceBySlug(slug || '')
  const { people } = useData()
  const config = useSiteConfig()
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')

  const peopleCards = useMemo(() => {
    if (!source) return []
    const byId = new Map(people.map(person => [person.id, person]))
    const byName = new Map(people.map(person => [person.name.toLowerCase(), person]))
    const cards = new Map<string, PersonSourceCard>()

    for (const id of source.subjectPersonIds || []) {
      const person = byId.get(id)
      if (person) addRole(cards, person, 'subject')
    }
    for (const id of source.personIds || []) {
      const person = byId.get(id)
      if (person) addRole(cards, person, 'linked')
    }
    for (const person of people) {
      if (person.sources.includes(source.id)) addRole(cards, person, 'citing')
    }
    for (const name of source.persons || []) {
      const person = byName.get(name.toLowerCase())
      if (person) addRole(cards, person, 'mentioned')
    }

    const root = byId.get(config.rootPersonId)
    const genderMap = buildGenderMap(people)
    for (const card of cards.values()) {
      if (root && root.id !== card.person.id) {
        const relationship = findRelationship(root.id, card.person.id, people, genderMap)
        card.relationship = relationship?.name || ''
      } else if (root?.id === card.person.id) {
        card.relationship = 'Root person'
      }
    }

    return Array.from(cards.values()).sort((a, b) => {
      const roleRank = (card: PersonSourceCard) => (
        card.roles.has('subject') ? 0
          : card.roles.has('linked') ? 1
            : card.roles.has('citing') ? 2
              : 3
      )
      return roleRank(a) - roleRank(b) || a.person.name.localeCompare(b.person.name)
    })
  }, [config.rootPersonId, people, source])

  const filteredCards = peopleCards.filter(card => roleFilter === 'all' || card.roles.has(roleFilter))
  const sourceMedia = source?.media || []
  const sourceImages = sourceMedia.filter(media => /\.(jpe?g|png|gif|webp)$/i.test(media.path))
  const lightbox = useLightbox(sourceImages)

  if (!source) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-800">Source Not Found</h1>
      </div>
    )
  }

  const roleCounts = {
    all: peopleCards.length,
    subject: peopleCards.filter(card => card.roles.has('subject')).length,
    linked: peopleCards.filter(card => card.roles.has('linked')).length,
    citing: peopleCards.filter(card => card.roles.has('citing')).length,
    mentioned: peopleCards.filter(card => card.roles.has('mentioned')).length,
  }
  const citingPeople = peopleCards.filter(card => card.roles.has('citing')).map(card => card.person)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-400">
        <Link to="/sources" className="hover:text-stone-600">Sources</Link>
        <span className="mx-2">/</span>
        <span className="text-stone-600">{source.id}</span>
      </nav>

      <div className="mb-8 rounded-lg border border-stone-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Source Record</p>
            <h1 className="mt-1 max-w-4xl text-3xl font-bold tracking-tight text-stone-900">{source.title || source.person}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <span className="font-mono text-stone-700">{source.id}</span>
              <span>·</span>
              <span>{sourceType(source)}</span>
              {source.date && (
                <>
                  <span>·</span>
                  <span>{displayDate(source.date)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={() => setRoleFilter('subject')} className="flex flex-col items-start gap-1 rounded-lg border border-stone-200 p-4 text-left hover:border-amber-300">
            <div className="text-2xl font-bold text-stone-900">{roleCounts.subject}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">primary subjects</div>
          </button>
          <button onClick={() => setRoleFilter('linked')} className="flex flex-col items-start gap-1 rounded-lg border border-stone-200 p-4 text-left hover:border-amber-300">
            <div className="text-2xl font-bold text-stone-900">{roleCounts.linked}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">linked people</div>
          </button>
          <button onClick={() => setRoleFilter('mentioned')} className="flex flex-col items-start gap-1 rounded-lg border border-stone-200 p-4 text-left hover:border-amber-300">
            <div className="text-2xl font-bold text-stone-900">{roleCounts.mentioned}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">matched mentions</div>
          </button>
          <button onClick={() => setRoleFilter('all')} className="flex flex-col items-start gap-1 rounded-lg border border-stone-200 p-4 text-left hover:border-amber-300">
            <div className="text-2xl font-bold text-stone-900">{sourceMedia.length}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">source media</div>
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <main>
          {source.fullText && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-stone-800">Full Text</h2>
              <div className="rounded-lg border border-stone-200 bg-amber-50/50 p-5">
                {source.fullText.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-3 leading-relaxed text-stone-700 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
              {source.translationSlug && (
                <Link to={`/translations/${source.translationSlug}`} className="mt-3 inline-flex rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 hover:no-underline">
                  Read full English translation
                </Link>
              )}
            </section>
          )}

          <div className="sticky top-14 z-20 mb-5 border-b border-stone-200 bg-stone-50/95 py-3 backdrop-blur">
            <div className="flex flex-wrap gap-2">
              {(['all', 'subject', 'linked', 'citing', 'mentioned'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    roleFilter === role
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                  }`}
                >
                  {role === 'all' ? 'All People' : ROLE_LABELS[role]} ({roleCounts[role]})
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-stone-800">People In This Source</h2>
            <span className="text-sm text-stone-400">{filteredCards.length} shown</span>
          </div>

          {filteredCards.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-stone-400">
              No people matched this role.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredCards.map(card => <PeopleCard key={card.person.id} card={card} />)}
            </div>
          )}

          {source.extractedFacts && (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-stone-800">Extracted Facts</h2>
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                <MarkdownTable text={source.extractedFacts} />
              </div>
            </section>
          )}

          {source.persons.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-stone-800">Names Mentioned ({source.persons.length})</h2>
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                <div className="flex flex-wrap gap-2">
                  {source.persons.map((name, index) => (
                    <span key={`${name}-${index}`} className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {source.notes && (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-stone-800">Notes</h2>
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                {source.notes.split('\n').filter(line => line.trim()).map((line, index) => (
                  <p key={index} className="mb-2 text-sm leading-relaxed text-stone-600 last:mb-0">
                    {line.replace(/^-\s*/, '').trim()}
                  </p>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-stone-800">Source Details</h2>
            <dl className="mt-2">
              {source.date && <MetadataRow label="Date">{displayDate(source.date)}</MetadataRow>}
              {source.publisher && <MetadataRow label="Publisher">{source.publisher}</MetadataRow>}
              {source.reliability && <MetadataRow label="Reliability"><span className="capitalize">{source.reliability}</span></MetadataRow>}
              <MetadataRow label="Type">{sourceType(source)}</MetadataRow>
              {source.recordTypes?.length > 0 && (
                <MetadataRow label="Record Types">{source.recordTypes.map(type => type.replace(/_/g, ' ')).join(', ')}</MetadataRow>
              )}
              {source.url && (
                <MetadataRow label="Original URL">
                  {/^(https?:)?\/\//.test(source.url) ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-amber-700 hover:text-amber-900">
                      {originalUrlLabel(source.url)}
                    </a>
                  ) : (
                    <span className="break-all">{source.url}</span>
                  )}
                </MetadataRow>
              )}
              {source.fagNumber && (
                <MetadataRow label="FaG Memorial">
                  <a href={`https://www.findagrave.com/memorial/${source.fagNumber}`} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900">
                    #{source.fagNumber}
                  </a>
                </MetadataRow>
              )}
            </dl>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-stone-800">Source Media</h2>
            <p className="mt-1 text-sm text-stone-500">Images attached to this source.</p>
            {sourceImages.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {sourceImages.slice(0, 4).map((media, index) => (
                  <button key={media.path} onClick={() => lightbox.open(index)} className="overflow-hidden rounded-lg bg-stone-100">
                    <img src={`${MEDIA_BASE}${media.path}`} alt={media.description} className="aspect-square w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-400">No image media attached.</div>
            )}
          </section>

          {citingPeople.length > 0 && (
            <section className="rounded-lg border border-stone-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-stone-800">Cited By</h2>
              <p className="mt-1 text-sm text-stone-500">{citingPeople.length} person files cite this source.</p>
              <div className="mt-3 divide-y divide-stone-100">
                {citingPeople.slice(0, 10).map(person => (
                  <Link key={person.id} to={`/people/${person.slug}`} className="block py-2 text-sm font-medium text-stone-700 hover:text-amber-700">
                    {person.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-stone-800">Why It Helps</h2>
            <div className="mt-3 space-y-3 text-sm text-stone-600">
              <p>Primary subjects and mentioned relatives are separated instead of appearing as one flat source list.</p>
              <p>Each person card has a portrait when available, relationship context, and fast jumps to the person page or tree.</p>
              <p>Gallery and source pages can point here when you want to understand who a document connects.</p>
            </div>
          </section>
        </aside>
      </div>

      <Lightbox {...lightbox.lightboxProps} />
    </div>
  )
}
