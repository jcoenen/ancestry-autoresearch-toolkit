import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePeople, formatYear, confidenceColor } from '../useData'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'

export default function FamilyDirectory() {
  const people = usePeople()
  const [searchParams] = useSearchParams()
  const initialFamily = searchParams.get('family') || ''
  const initialSearch = searchParams.get('search') || ''
  const [search, setSearch] = useState(initialSearch)
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(
    initialFamily ? new Set([initialFamily]) : new Set()
  )

  const families = useMemo(() => {
    const set = new Set(people.map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  const filtered = useMemo(() => {
    let result = [...people]

    if (familyFilter.size > 0) {
      result = result.filter(p => familyFilter.has(p.family))
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.birthplace.toLowerCase().includes(q) ||
        p.family.toLowerCase().includes(q)
      )
    }

    return result
  }, [people, search, familyFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      const fam = p.family || 'Unknown'
      if (!groups[fam]) groups[fam] = []
      groups[fam].push(p)
    }
    // Sort each group by birth year
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Family Directory</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {people.length} people across {families.length} family lines
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
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
