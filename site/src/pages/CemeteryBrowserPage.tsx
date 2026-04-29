import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePeople, useGeocodedLocations, formatYear, MEDIA_BASE } from '../useData'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'
import type { Person } from '../types'

function isKnownCemetery(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === '—') return false
  return !(
    normalized === 'unknown' ||
    normalized === 'details unknown' ||
    normalized === 'burial details unknown' ||
    normalized.startsWith('unknown ') ||
    normalized.startsWith('cremated at ') ||
    normalized.startsWith('presumed buried ')
  )
}

export default function CemeteryBrowserPage() {
  const people = usePeople()
  const geocoded = useGeocodedLocations()
  const [selectedCemetery, setSelectedCemetery] = useState<string | null>(null)
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const families = useMemo(() => {
    const set = new Set(people.map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  const filteredPeople = useMemo(() => {
    let result = people.filter(p => isKnownCemetery(p.burial) && !p.privacy)
    if (familyFilter.size > 0) {
      result = result.filter(p => familyFilter.has(p.family))
    }
    return result
  }, [people, familyFilter])

  const cemeteries = useMemo(() => {
    const groups: Record<string, Person[]> = {}
    for (const p of filteredPeople) {
      if (!groups[p.burial]) groups[p.burial] = []
      groups[p.burial].push(p)
    }
    return groups
  }, [filteredPeople])

  const sortedCemeteries = useMemo(() => {
    return Object.keys(cemeteries)
      .filter(name => !search || name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => cemeteries[b].length - cemeteries[a].length)
  }, [cemeteries, search])

  const activeCemetery = (selectedCemetery && cemeteries[selectedCemetery])
    ? selectedCemetery
    : sortedCemeteries[0] || null

  const buriedHere: Person[] = activeCemetery
    ? [...cemeteries[activeCemetery]].sort((a, b) => {
        const ay = String(a.born).match(/(\d{4})/)?.[1] || '9999'
        const by = String(b.born).match(/(\d{4})/)?.[1] || '9999'
        return Number(ay) - Number(by)
      })
    : []

  const coords = activeCemetery ? geocoded[activeCemetery] : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Cemetery Browser</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {filteredPeople.length} burial {filteredPeople.length === 1 ? 'record' : 'records'} across{' '}
        {sortedCemeteries.length} {sortedCemeteries.length === 1 ? 'cemetery' : 'cemeteries'}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search cemeteries..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
        />
        <FamilyFilterDropdown
          families={families}
          selected={familyFilter}
          onChange={setFamilyFilter}
          single
        />
      </div>

      {sortedCemeteries.length === 0 ? (
        <div className="text-center py-12 text-stone-400">No burial records found.</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: cemetery list */}
          <div className="lg:w-72 shrink-0">
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              {sortedCemeteries.map(name => {
                const isActive = name === activeCemetery
                const count = cemeteries[name].length
                const hasCoords = !!geocoded[name]
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedCemetery(name)}
                    className={`w-full text-left px-4 py-3.5 flex items-start justify-between gap-2 border-b last:border-b-0 border-stone-100 transition-colors ${
                      isActive
                        ? 'bg-amber-50 border-l-2 border-l-amber-400'
                        : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-sm font-medium leading-snug ${isActive ? 'text-amber-800' : 'text-stone-700'}`}>
                        {name}
                      </div>
                      {hasCoords && (
                        <div className="text-[10px] text-stone-400 mt-0.5">📍 geocoded</div>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-amber-200 text-amber-800' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: people at selected cemetery */}
          {activeCemetery && (
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-stone-800">{activeCemetery}</h2>
                  <p className="text-sm text-stone-400 mt-0.5">
                    {buriedHere.length} {buriedHere.length === 1 ? 'person' : 'people'} buried here
                  </p>
                </div>
                {coords && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}&zoom=14`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-500 hover:border-amber-300 hover:text-amber-700 transition-colors hover:no-underline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    View on map
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {buriedHere.map(person => {
                  const photo = person.media?.find(
                    m => m.type === 'photo' || m.type === 'portrait'
                  )
                  return (
                    <Link
                      key={person.id}
                      to={`/people/${person.slug}`}
                      className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 hover:border-amber-300 hover:shadow-sm transition-all hover:no-underline group"
                    >
                      {photo ? (
                        <img
                          src={`${MEDIA_BASE}${photo.path}`}
                          alt={person.name}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-stone-100"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-stone-100 shrink-0 flex items-center justify-center text-stone-300 text-xl select-none">
                          ✝
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-800 group-hover:text-amber-700 truncate">
                          {person.name}
                        </div>
                        <div className="text-xs text-stone-400 mt-0.5">
                          {formatYear(person.born)} – {formatYear(person.died)}
                        </div>
                        <div className="text-xs text-stone-400 truncate">{person.family}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
