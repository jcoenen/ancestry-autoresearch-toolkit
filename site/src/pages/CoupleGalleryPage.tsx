import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'
import { MEDIA_BASE, formatYear, useData } from '../useData'
import type { MediaEntry, Person } from '../types'

interface CoupleCard {
  id: string
  media: MediaEntry
  people: Person[]
  families: string[]
  sourceSlug: string
  marriageDate: string
}

function years(person: Person): string {
  if (person.privacy) return ''
  const born = formatYear(person.born)
  const died = formatYear(person.died)
  if (born === '?' && died === '?') return ''
  return `${born}-${died}`
}

function marriageDateFor(a: Person, b: Person): string {
  return a.spouses.find(sp => sp.id === b.id)?.marriageDate
    || b.spouses.find(sp => sp.id === a.id)?.marriageDate
    || ''
}

function isSpousePair(a: Person, b: Person): boolean {
  return a.spouses.some(sp => sp.id === b.id) || b.spouses.some(sp => sp.id === a.id)
}

export function CoupleGalleryView({ embedded = false }: { embedded?: boolean }) {
  const { people, sources, media } = useData()
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())
  const [searchText, setSearchText] = useState('')

  const sourceByMediaPath = useMemo(() => {
    const map = new Map<string, string>()
    for (const source of sources) {
      for (const m of source.media || []) map.set(m.path, source.slug)
    }
    return map
  }, [sources])

  const peopleByMediaPath = useMemo(() => {
    const map = new Map<string, Person[]>()
    for (const person of people) {
      for (const m of person.media || []) {
        if (!map.has(m.path)) map.set(m.path, [])
        map.get(m.path)!.push(person)
      }
    }
    return map
  }, [people])

  const cards = useMemo(() => {
    const result: CoupleCard[] = []
    const seen = new Set<string>()

    for (const m of media) {
      if (m.type !== 'portrait' && m.type !== 'group_photo') continue
      const linkedPeople = (peopleByMediaPath.get(m.path) || []).filter(p => !p.privacy)
      if (linkedPeople.length < 2) continue

      const spousePair = linkedPeople.flatMap((a, i) =>
        linkedPeople.slice(i + 1).map(b => [a, b] as [Person, Person])
      ).find(([a, b]) => isSpousePair(a, b))

      if (!spousePair) continue
      const [a, b] = spousePair
      const key = `${m.path}:${a.id}:${b.id}`
      if (seen.has(key)) continue
      seen.add(key)

      result.push({
        id: key,
        media: m,
        people: [a, b],
        families: [...new Set([a.family, b.family].filter(Boolean))].sort(),
        sourceSlug: sourceByMediaPath.get(m.path) || '',
        marriageDate: marriageDateFor(a, b),
      })
    }

    return result.sort((a, b) => {
      const ay = a.marriageDate.match(/\d{4}/)?.[0] || a.people[0].born.match(/\d{4}/)?.[0] || ''
      const by = b.marriageDate.match(/\d{4}/)?.[0] || b.people[0].born.match(/\d{4}/)?.[0] || ''
      return ay.localeCompare(by)
    })
  }, [media, peopleByMediaPath, sourceByMediaPath])

  const families = useMemo(() => {
    const set = new Set<string>()
    for (const card of cards) for (const family of card.families) set.add(family)
    return [...set].sort()
  }, [cards])

  const filteredCards = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return cards.filter(card => {
      if (familyFilter.size > 0 && !card.families.some(f => familyFilter.has(f))) return false
      if (!query) return true
      const haystack = [
        card.media.person,
        card.media.description,
        card.people.map(p => p.name).join(' '),
        card.families.join(' '),
        card.marriageDate,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [cards, familyFilter, searchText])

  return (
    <div className={embedded ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 py-8'}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          {!embedded && <h1 className="text-3xl font-bold text-stone-800">Couple Gallery</h1>}
          <p className="mt-2 text-stone-500">
            Shared portraits and wedding photos for couples in the tree.
          </p>
        </div>
        <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-500">
          {filteredCards.length} of {cards.length} couples
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <label className="relative">
          <span className="sr-only">Search couple portraits</span>
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search couples"
            className="w-56 rounded-full border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
        <FamilyFilterDropdown families={families} selected={familyFilter} onChange={setFamilyFilter} />
      </div>

      {filteredCards.length === 0 ? (
        <div className="py-12 text-center text-stone-400">No couple portraits matched the current filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCards.map(card => {
            const [a, b] = card.people
            return (
              <article key={card.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all">
                <Link to={card.sourceSlug ? `/sources/${card.sourceSlug}` : `/gallery?search=${encodeURIComponent(card.media.path)}`} className="block hover:no-underline">
                  <img
                    src={`${MEDIA_BASE}${card.media.path}`}
                    alt={card.media.description}
                    className="aspect-[4/3] w-full object-contain bg-stone-100"
                    loading="lazy"
                  />
                </Link>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-stone-800">
                        <Link to={`/people/${a.slug}`} className="hover:text-amber-700">{a.name}</Link>
                        <span className="text-stone-400"> & </span>
                        <Link to={`/people/${b.slug}`} className="hover:text-amber-700">{b.name}</Link>
                      </h2>
                      <p className="mt-1 text-xs text-stone-500">
                        {[years(a), years(b)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {card.marriageDate && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                        m. {card.marriageDate}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-stone-600">{card.media.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.families.map(family => (
                      <Link key={family} to={`/people?family=${encodeURIComponent(family)}`} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-200 hover:no-underline">
                        {family}
                      </Link>
                    ))}
                  </div>
                  {card.sourceSlug && (
                    <Link to={`/sources/${card.sourceSlug}`} className="mt-3 inline-block text-xs font-medium text-amber-700 hover:text-amber-900">
                      View source
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CoupleGalleryPage() {
  return <CoupleGalleryView />
}
