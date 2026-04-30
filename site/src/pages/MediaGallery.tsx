import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData, usePeople, MEDIA_BASE } from '../useData'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'
import { useLightbox } from '../hooks/useLightbox'
import Lightbox from '../components/Lightbox'
import { CoupleGalleryView } from './CoupleGalleryPage'

const TYPE_LABELS: Record<string, string> = {
  gravestone: 'Gravestones',
  portrait: 'Portraits',
  newspaper: 'Newspapers',
  document: 'Documents',
  group_photo: 'Group Photos',
  scan: 'Scans',
  other: 'Other',
}

export default function MediaGallery() {
  const { media, sources } = useData()
  const people = usePeople()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchText, setSearchText] = useState(searchParams.get('search') || '')
  const [typeFilter, setTypeFilter] = useState('')
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())
  const view = searchParams.get('view') === 'couples' ? 'couples' : 'media'

  function setView(nextView: 'media' | 'couples') {
    const next = new URLSearchParams(searchParams)
    if (nextView === 'couples') next.set('view', 'couples')
    else next.delete('view')
    setSearchParams(next)
  }

  // Build a map from media path → source slug (via source.media linkage)
  const mediaSourceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sources) {
      for (const m of s.media) {
        map.set(m.path, s.slug)
      }
    }
    return map
  }, [sources])

  // Build a map from media path → family (via person.media linkage)
  const mediaFamilyMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of people) {
      for (const m of p.media) {
        map.set(m.path, p.family)
      }
    }
    return map
  }, [people])

  const families = useMemo(() => {
    const set = new Set<string>()
    for (const m of media) {
      const fam = mediaFamilyMap.get(m.path)
      if (fam) set.add(fam)
    }
    return Array.from(set).sort()
  }, [media, mediaFamilyMap])

  const types = useMemo(() => {
    const set = new Set(media.map(m => m.type))
    return Array.from(set).sort()
  }, [media])

  const filtered = useMemo(() => {
    let result = media
    const query = searchText.trim().toLowerCase()
    if (query) {
      result = result.filter(m => [
        m.person,
        m.description,
        m.path,
        m.sourceUrl,
        TYPE_LABELS[m.type] || m.type,
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
    }
    if (typeFilter) result = result.filter(m => m.type === typeFilter)
    if (familyFilter.size > 0) result = result.filter(m => familyFilter.has(mediaFamilyMap.get(m.path) || ''))
    return result
  }, [media, searchText, typeFilter, familyFilter, mediaFamilyMap])

  const lightbox = useLightbox(filtered)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Media Gallery</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {media.length} images and documents collected during research
      </p>

      <div className="mb-6 inline-flex rounded-lg border border-stone-200 bg-white p-1">
        <button
          onClick={() => setView('media')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'media'
              ? 'bg-stone-800 text-white'
              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}
        >
          All Media
        </button>
        <button
          onClick={() => setView('couples')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            view === 'couples'
              ? 'bg-stone-800 text-white'
              : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
          }`}
        >
          Couples
        </button>
      </div>

      {view === 'couples' && <CoupleGalleryView embedded />}

      {/* Filters */}
      {view === 'media' && <div className="flex flex-wrap items-center gap-2 mb-8">
        <label className="relative">
          <span className="sr-only">Search media</span>
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
            placeholder="Search media"
            className="w-48 rounded-full border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
        <FamilyFilterDropdown
          families={families}
          selected={familyFilter}
          onChange={setFamilyFilter}
        />
        <button
          onClick={() => setTypeFilter('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            !typeFilter
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
          }`}
        >
          All ({media.length})
        </button>
        {types.map(t => {
          const count = media.filter(m => m.type === t).length
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                typeFilter === t
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {TYPE_LABELS[t] || t} ({count})
            </button>
          )
        })}
      </div>}

      {/* Grid */}
      {view === 'media' && (filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400">No media matched the current filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m, i) => (
            <div
              key={i}
              className="rounded-lg border border-stone-200 bg-white overflow-hidden group hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <button onClick={() => lightbox.open(i)} className="w-full">
                {m.path.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full aspect-square bg-stone-100 flex flex-col items-center justify-center gap-2 cursor-zoom-in text-stone-500 p-5 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">PDF document</span>
                    <span className="line-clamp-3 text-xs leading-snug text-stone-500">{m.description}</span>
                  </div>
                ) : (
                  <img
                    src={`${MEDIA_BASE}${m.path}`}
                    alt={m.description}
                    className="w-full aspect-square object-cover bg-stone-100 cursor-zoom-in"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.alt = m.description
                      target.className = 'w-full aspect-square bg-stone-100 flex items-center justify-center text-stone-400 text-xs p-4'
                    }}
                  />
                )}
              </button>
              <div className="p-3">
                <div className="text-sm font-medium text-stone-800 leading-tight">{m.person}</div>
                <div className="text-xs text-stone-500 mt-1">{m.description}</div>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-stone-100 text-[10px] font-medium text-stone-500">
                  {TYPE_LABELS[m.type] || m.type}
                </span>
                {mediaSourceMap.get(m.path) ? (
                  <Link to={`/sources/${mediaSourceMap.get(m.path)}`}
                    className="text-xs text-amber-600 hover:text-amber-800 mt-1 block truncate">
                    View Source
                  </Link>
                ) : m.sourceUrl ? (
                  <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-amber-600 hover:text-amber-800 mt-1 block truncate">
                    Source ↗
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ))}
      {view === 'media' && <Lightbox {...lightbox.lightboxProps} />}
    </div>
  )
}
