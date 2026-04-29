import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePeople, formatYear, confidenceColor, extractYear } from '../useData'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'

const CONFIDENCE_ORDER = ['high', 'moderate', 'medium', 'low', 'stub', 'speculative']

function confidencePillStyle(confidence: string, active: boolean): string {
  if (!active) return 'border border-stone-200 text-stone-400 bg-white'
  switch (confidence) {
    case 'high': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'moderate':
    case 'medium': return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'low': return 'bg-red-100 text-red-700 border border-red-200'
    default: return 'bg-stone-100 text-stone-500 border border-stone-200'
  }
}

export default function FamilyDirectory() {
  const people = usePeople()
  const [searchParams] = useSearchParams()
  const initialFamily = searchParams.get('family') || ''
  const initialSearch = searchParams.get('search') || ''
  const sourceFilter = searchParams.get('source') || ''
  const militaryFilter = searchParams.get('military') || ''
  const militaryBranchFilter = searchParams.get('militaryBranch') || ''
  const militaryConflictFilter = searchParams.get('militaryConflict') || ''
  const occupationFilter = searchParams.get('occupation') || ''
  const religionFilter = searchParams.get('religion') || ''
  const immigrationFilter = searchParams.get('immigration') || ''
  const [search, setSearch] = useState(initialSearch)
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(
    initialFamily ? new Set([initialFamily]) : new Set()
  )
  const [confidenceFilter, setConfidenceFilter] = useState<Set<string>>(new Set())
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')

  const families = useMemo(() => {
    const set = new Set(people.map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  const confidenceValues = useMemo(() => {
    const set = new Set(people.map(p => p.confidence).filter(Boolean))
    return CONFIDENCE_ORDER.filter(c => set.has(c))
  }, [people])

  const filtered = useMemo(() => {
    let result = [...people]

    if (familyFilter.size > 0) {
      result = result.filter(p => familyFilter.has(p.family))
    }

    if (confidenceFilter.size > 0) {
      result = result.filter(p => confidenceFilter.has(p.confidence))
    }

    if (sourceFilter) {
      result = result.filter(p => p.sources.includes(sourceFilter))
    }

    if (militaryFilter) {
      result = result.filter(p => p.military === militaryFilter)
    }

    if (militaryBranchFilter) {
      result = result.filter(p => p.militaryService?.some(s => s.branch === militaryBranchFilter))
    }

    if (militaryConflictFilter) {
      result = result.filter(p => p.militaryService?.some(s => s.conflict === militaryConflictFilter))
    }

    if (occupationFilter) {
      result = result.filter(p => p.occupation === occupationFilter)
    }

    if (religionFilter) {
      result = result.filter(p => p.religion === religionFilter)
    }

    if (immigrationFilter) {
      result = result.filter(p => p.immigration === immigrationFilter || p.emigration === immigrationFilter || p.naturalization === immigrationFilter)
    }

    const from = yearFrom ? parseInt(yearFrom, 10) : null
    const to = yearTo ? parseInt(yearTo, 10) : null
    if (from !== null || to !== null) {
      result = result.filter(p => {
        const year = extractYear(p.born)
        if (year === null) return true // unknown birth year always passes
        if (from !== null && year < from) return false
        if (to !== null && year > to) return false
        return true
      })
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.birthplace.toLowerCase().includes(q) ||
        p.deathPlace.toLowerCase().includes(q) ||
        p.burial.toLowerCase().includes(q) ||
        p.residence.toLowerCase().includes(q) ||
        p.occupation.toLowerCase().includes(q) ||
        p.military.toLowerCase().includes(q) ||
        p.militaryService?.some(s =>
          [s.branch, s.conflict, s.role, s.rank, s.unit, s.dates, s.place, s.notes]
            .some(value => value.toLowerCase().includes(q))
        ) ||
        p.religion.toLowerCase().includes(q) ||
        p.immigration.toLowerCase().includes(q) ||
        p.emigration.toLowerCase().includes(q) ||
        p.naturalization.toLowerCase().includes(q) ||
        p.family.toLowerCase().includes(q)
      )
    }

    return result
  }, [people, search, familyFilter, confidenceFilter, yearFrom, yearTo, sourceFilter, militaryFilter, militaryBranchFilter, militaryConflictFilter, occupationFilter, religionFilter, immigrationFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      const fam = p.family || 'Unknown'
      if (!groups[fam]) groups[fam] = []
      groups[fam].push(p)
    }
    for (const fam of Object.keys(groups)) {
      groups[fam].sort((a, b) => {
        const aYear = String(a.born).replace(/[^0-9]/g, '').slice(0, 4)
        const bYear = String(b.born).replace(/[^0-9]/g, '').slice(0, 4)
        return Number(aYear || 9999) - Number(bYear || 9999)
      })
    }
    return groups
  }, [filtered])

  const sortedFamilies = Object.keys(grouped).sort()

  function toggleConfidence(value: string) {
    setConfidenceFilter(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const hasAdvancedFilters = confidenceFilter.size > 0 || yearFrom || yearTo || sourceFilter || militaryFilter || militaryBranchFilter || militaryConflictFilter || occupationFilter || religionFilter || immigrationFilter
  const activeFilterLabels = [
    sourceFilter ? `Source: ${sourceFilter}` : '',
    militaryFilter ? `Military: ${militaryFilter}` : '',
    militaryBranchFilter ? `Military branch: ${militaryBranchFilter}` : '',
    militaryConflictFilter ? `Military conflict: ${militaryConflictFilter}` : '',
    occupationFilter ? `Occupation: ${occupationFilter}` : '',
    religionFilter ? `Religion: ${religionFilter}` : '',
    immigrationFilter ? `Migration: ${immigrationFilter}` : '',
  ].filter(Boolean)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Family Directory</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {people.length} people across {families.length} family lines
      </p>

      {activeFilterLabels.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Filtered by</span>
          {activeFilterLabels.map(label => (
            <span key={label} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 ring-1 ring-amber-200">
              {label}
            </span>
          ))}
          <Link to="/people" className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-800">
            Clear filters
          </Link>
        </div>
      )}

      {/* Filters row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Search by name or place..."
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

      {/* Filters row 2: confidence + year range */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        {/* Confidence toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-stone-400 font-medium mr-0.5">Confidence:</span>
          {confidenceValues.map(c => (
            <button
              key={c}
              onClick={() => toggleConfidence(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${confidencePillStyle(c, confidenceFilter.has(c))}`}
            >
              {c}
            </button>
          ))}
          {confidenceFilter.size > 0 && (
            <button
              onClick={() => setConfidenceFilter(new Set())}
              className="text-[11px] text-stone-400 hover:text-stone-600 ml-1 underline"
            >
              clear
            </button>
          )}
        </div>

        {/* Birth year range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 font-medium">Born:</span>
          <input
            type="number"
            placeholder="from"
            value={yearFrom}
            onChange={e => setYearFrom(e.target.value)}
            className="w-20 px-2 py-1 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
          <span className="text-xs text-stone-400">–</span>
          <input
            type="number"
            placeholder="to"
            value={yearTo}
            onChange={e => setYearTo(e.target.value)}
            className="w-20 px-2 py-1 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
          />
          {(yearFrom || yearTo) && (
            <button
              onClick={() => { setYearFrom(''); setYearTo('') }}
              className="text-[11px] text-stone-400 hover:text-stone-600 underline"
            >
              clear
            </button>
          )}
        </div>

        {hasAdvancedFilters && (
          <span className="text-xs text-amber-600 font-medium">
            {filtered.length} of {people.length} shown
          </span>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          No people match your search.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedFamilies.map(fam => (
            <div key={fam}>
              <h2 className="text-xl font-semibold text-stone-800 mb-3 flex items-baseline gap-2">
                {fam}
                <span className="text-sm font-normal text-stone-400">
                  ({grouped[fam].length})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[fam].map(p => (
                  <Link
                    key={p.id}
                    to={`/people/${p.slug}`}
                    className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all hover:no-underline group"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800 text-sm group-hover:text-amber-700 truncate">
                        {p.name}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {p.privacy ? '' : `${formatYear(p.born)} - ${formatYear(p.died)}`}
                      </div>
                      {p.birthplace && !p.privacy && (
                        <div className="text-xs text-stone-400 mt-0.5 truncate">{p.birthplace}</div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${confidenceColor(p.confidence)}`}>
                      {p.confidence}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
