import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MEDIA_BASE, extractYear, formatYear, useData, usePeople } from '../useData'
import type { MediaEntry, Person } from '../types'
import { useLightbox } from '../hooks/useLightbox'
import Lightbox from '../components/Lightbox'

type GalleryView = 'portraits' | 'couples' | 'documents' | 'gravestones' | 'missing' | 'recent'

type MediaCard = {
  media: MediaEntry
  person?: Person
  people: Person[]
  sourceSlug?: string
}

const VIEW_LABELS: Record<GalleryView, string> = {
  portraits: 'Portrait Wall',
  couples: 'Couples',
  documents: 'Documents',
  gravestones: 'Gravestones',
  missing: 'Missing Portraits',
  recent: 'Recently Added',
}

function years(person: Person) {
  if (person.privacy) return ''
  return `${formatYear(person.born)} - ${formatYear(person.died)}`
}

function isProbablyLiving(person: Person) {
  if (person.privacy) return true
  if (person.died && person.died !== '—') return false
  const born = extractYear(person.born)
  return !born || born > new Date().getFullYear() - 100
}

function personHasPortrait(person: Person) {
  return person.media.some(m => ['portrait', 'photo', 'group_photo'].includes(m.type))
}

function sourceLabel(card: MediaCard) {
  if (card.sourceSlug) return 'View source'
  if (card.media.sourceUrl) return 'Open source'
  return ''
}

function MediaTile({ card, index, onOpen, compact = false }: {
  card: MediaCard
  index: number
  onOpen: (index: number) => void
  compact?: boolean
}) {
  const primary = card.person || card.people[0]
  return (
    <article className="overflow-hidden rounded-lg border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all">
      <button onClick={() => onOpen(index)} className="block w-full bg-stone-100">
        <img
          src={`${MEDIA_BASE}${card.media.path}`}
          alt={card.media.description}
          className={`${compact ? 'h-40' : 'h-64'} w-full object-cover`}
          loading="lazy"
        />
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {primary ? (
              <Link to={`/people/${primary.slug}`} className="text-sm font-semibold text-stone-800 hover:text-amber-700">
                {primary.name}
              </Link>
            ) : (
              <div className="text-sm font-semibold text-stone-800">{card.media.person || 'Unassigned media'}</div>
            )}
            {primary && <div className="text-xs text-stone-400">{years(primary)}</div>}
          </div>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            {card.media.type.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-snug text-stone-500">{card.media.description}</p>
        {card.people.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.people.slice(0, 4).map(p => (
              <Link key={p.id} to={`/people/${p.slug}`} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100">
                {p.name.split(' ')[0]}
              </Link>
            ))}
          </div>
        )}
        {sourceLabel(card) && (
          card.sourceSlug ? (
            <Link to={`/sources/${card.sourceSlug}`} className="mt-2 block text-xs font-medium text-amber-700 hover:text-amber-900">
              {sourceLabel(card)}
            </Link>
          ) : (
            <a href={card.media.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-xs font-medium text-amber-700 hover:text-amber-900">
              {sourceLabel(card)}
            </a>
          )
        )}
      </div>
    </article>
  )
}

function MissingPortraitCard({ person }: { person: Person }) {
  return (
    <Link to={`/people/${person.slug}`} className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-amber-300 hover:bg-amber-50/30 hover:no-underline">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-400">
          {person.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-stone-800">{person.name}</div>
          <div className="text-xs text-stone-400">{years(person)}</div>
          <div className="text-xs text-stone-500">{person.family}</div>
        </div>
      </div>
    </Link>
  )
}

export default function GalleryLabPage() {
  const { media, sources } = useData()
  const people = usePeople()
  const [activeView, setActiveView] = useState<GalleryView>('portraits')
  const [familySearch, setFamilySearch] = useState('')

  const mediaSourceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const source of sources) {
      for (const item of source.media || []) map.set(item.path, source.slug)
    }
    return map
  }, [sources])

  const peopleByMediaPath = useMemo(() => {
    const map = new Map<string, Person[]>()
    for (const person of people) {
      for (const item of person.media || []) {
        const list = map.get(item.path) || []
        list.push(person)
        map.set(item.path, list)
      }
    }
    return map
  }, [people])

  const families = useMemo(() => {
    return Array.from(new Set(people.map(p => p.family).filter(Boolean))).sort()
  }, [people])

  const familyMatches = (person: Person) => {
    const query = familySearch.trim().toLowerCase()
    if (!query) return true
    return person.family.toLowerCase().includes(query)
  }

  const allCards = useMemo<MediaCard[]>(() => {
    return media.map(item => {
      const linkedPeople = peopleByMediaPath.get(item.path) || []
      return {
        media: item,
        person: linkedPeople[0],
        people: linkedPeople,
        sourceSlug: mediaSourceMap.get(item.path),
      }
    })
  }, [media, mediaSourceMap, peopleByMediaPath])

  const portraitCards = useMemo(() => {
    const bestByPerson = new Map<string, MediaCard>()
    for (const card of allCards) {
      if (!card.person || !['portrait', 'photo', 'group_photo'].includes(card.media.type)) continue
      if (!familyMatches(card.person)) continue
      const current = bestByPerson.get(card.person.id)
      if (!current || card.media.type === 'portrait') bestByPerson.set(card.person.id, card)
    }
    return Array.from(bestByPerson.values()).sort((a, b) => (extractYear(a.person?.born || '') || 9999) - (extractYear(b.person?.born || '') || 9999))
  }, [allCards, familySearch])

  const coupleCards = useMemo(() => {
    return allCards
      .filter(card => card.people.length >= 2 && ['portrait', 'photo', 'group_photo'].includes(card.media.type))
      .filter(card => card.people.some(familyMatches))
      .sort((a, b) => (extractYear(a.people[0]?.born || '') || 9999) - (extractYear(b.people[0]?.born || '') || 9999))
  }, [allCards, familySearch])

  const documentCards = useMemo(() => {
    return allCards
      .filter(card => ['document', 'newspaper', 'scan'].includes(card.media.type))
      .filter(card => card.people.some(familyMatches))
  }, [allCards, familySearch])

  const gravestoneCards = useMemo(() => {
    return allCards
      .filter(card => ['gravestone', 'tombstone'].includes(card.media.type))
      .filter(card => card.people.some(familyMatches))
  }, [allCards, familySearch])

  const recentCards = useMemo(() => {
    return [...allCards]
      .filter(card => card.people.length === 0 || card.people.some(familyMatches))
      .sort((a, b) => (b.media.dateDownloaded || '').localeCompare(a.media.dateDownloaded || ''))
      .slice(0, 48)
  }, [allCards, familySearch])

  const missingPortraits = useMemo(() => {
    return people
      .filter(person => !person.privacy && !isProbablyLiving(person) && !personHasPortrait(person))
      .filter(familyMatches)
      .sort((a, b) => {
        const ad = extractYear(a.died) || 0
        const bd = extractYear(b.died) || 0
        return bd - ad
      })
      .slice(0, 72)
  }, [familySearch, people])

  const activeCards = activeView === 'portraits'
    ? portraitCards
    : activeView === 'couples'
      ? coupleCards
      : activeView === 'documents'
        ? documentCards
        : activeView === 'gravestones'
          ? gravestoneCards
          : activeView === 'recent'
            ? recentCards
            : []

  const lightboxMedia = activeCards.map(card => card.media)
  const lightbox = useLightbox(lightboxMedia)

  const stats = [
    { label: 'portrait people', value: portraitCards.length, view: 'portraits' as GalleryView },
    { label: 'couple images', value: coupleCards.length, view: 'couples' as GalleryView },
    { label: 'gravestones', value: gravestoneCards.length, view: 'gravestones' as GalleryView },
    { label: 'documents', value: documentCards.length, view: 'documents' as GalleryView },
  ]

  return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">Visual Gallery</h1>
        <p className="mt-2 max-w-3xl text-stone-500">
          A more purposeful media browser: portrait wall, couple photos, documents, gravestones, recently added media, and people who still need a face.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={() => setActiveView(stat.view)}
            className={`flex w-full flex-col items-start gap-1 rounded-lg border bg-white p-4 text-left transition-all hover:border-amber-300 hover:shadow-sm ${
              activeView === stat.view ? 'border-amber-300 ring-2 ring-amber-100' : 'border-stone-200'
            }`}
          >
            <div className="text-2xl font-bold text-stone-900">{stat.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{stat.label}</div>
          </button>
        ))}
      </div>

      <div className="sticky top-14 z-20 mb-6 border-b border-stone-200 bg-stone-50/95 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(VIEW_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveView(key as GalleryView)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeView === key
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              {label}
            </button>
          ))}
          <label className="relative ml-auto">
            <span className="sr-only">Search family line</span>
            <input
              list="gallery-family-options"
              value={familySearch}
              onChange={e => setFamilySearch(e.target.value)}
              placeholder="Search family line"
              className="w-56 rounded-full border border-stone-200 bg-white px-3 py-2 pr-9 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            {familySearch && (
              <button
                type="button"
                onClick={() => setFamilySearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-sm text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                aria-label="Clear family filter"
              >
                ×
              </button>
            )}
            <datalist id="gallery-family-options">
              {families.map(name => <option key={name} value={name} />)}
            </datalist>
          </label>
        </div>
      </div>

      {activeView === 'missing' ? (
        <>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-stone-800">People Missing Portraits</h2>
            <span className="text-sm text-stone-400">{missingPortraits.length} shown</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {missingPortraits.map(person => <MissingPortraitCard key={person.id} person={person} />)}
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-stone-800">{VIEW_LABELS[activeView]}</h2>
            <span className="text-sm text-stone-400">{activeCards.length} items</span>
          </div>
          {activeCards.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-stone-400">No media matched this view.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeCards.map((card, index) => (
                <MediaTile key={`${card.media.path}-${index}`} card={card} index={index} onOpen={lightbox.open} compact={activeView === 'recent'} />
              ))}
            </div>
          )}
          <Lightbox {...lightbox.lightboxProps} />
        </>
      )}
    </div>
  )
}
