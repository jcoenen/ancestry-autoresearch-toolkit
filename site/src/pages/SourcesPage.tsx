import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../useData'

const TYPE_LABELS: Record<string, string> = {
  obituary: 'Obituaries',
  cemetery: 'Cemetery / FindAGrave',
  church: 'Church Records',
  secondary: 'Secondary Sources',
  immigration: 'Immigration',
  military: 'Military',
  census: 'Census',
  note: 'Family Knowledge / Notes',
}

const TYPE_ORDER = ['obituary', 'cemetery', 'church', 'secondary', 'immigration', 'military', 'census', 'note']

export default function SourcesPage() {
  const { sources } = useData()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filtered = useMemo(() => {
    let result = [...sources]

    if (typeFilter) {
      result = result.filter(s => s.type === typeFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.id.toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.person || '').toLowerCase().includes(q) ||
        (s.record || '').toLowerCase().includes(q) ||
        (s.publisher || '').toLowerCase().includes(q) ||
        (s.persons || []).some(p => p.toLowerCase().includes(q))
      )
    }

    return result
  }, [sources, search, typeFilter])

  const grouped = useMemo(() => {
    const groups: Record<string, typeof sources> = {}
    for (const s of filtered) {
      const type = s.type || 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(s)
    }
    return groups
  }, [filtered])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sources) {
      const type = s.type || 'other'
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }, [sources])

  const orderedTypes = TYPE_ORDER.filter(t => grouped[t]?.length)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Sources</h1>
      <p className="mt-2 text-stone-500 mb-6">
        {sources.length} transcribed source documents used in this research
      </p>

      {/* Search + type filter */}
      <div className="flex flex-col gap-3 mb-8">
        <input
          type="text"
          placeholder="Search by title, person, publisher, or source ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !typeFilter
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            All
          </button>
          {TYPE_ORDER.filter(t => typeCounts[t]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                typeFilter === t
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              {TYPE_LABELS[t] || t} ({typeCounts[t]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-stone-400 text-center py-12">No sources match your search.</p>
      ) : (
        <div className="space-y-8">
          {orderedTypes.map(type => (
            <section key={type}>
              <h2 className="text-xl font-semibold text-stone-800 mb-3 flex items-baseline gap-2">
                {TYPE_LABELS[type] || type}
                <span className="text-sm font-normal text-stone-400">
                  ({grouped[type].length})
                </span>
              </h2>
              <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
                {grouped[type].map(s => (
                  <Link key={s.id} to={`/sources/${s.slug}`} className="px-5 py-3 block hover:bg-stone-50">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-amber-700 mr-2">{s.id}</span>
                        <span className="text-sm text-stone-700">{s.title || s.record || s.person}</span>
                      </div>
                      {s.date && (
                        <span className="text-xs text-stone-400 shrink-0">{s.date}</span>
                      )}
                    </div>
                    {s.publisher && (
                      <div className="text-xs text-stone-400 mt-1 ml-0">{s.publisher}</div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
