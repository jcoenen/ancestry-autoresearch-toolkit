import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../useData'

type FilterType = 'all' | 'person' | 'source' | 'media'

interface FeedItem {
  date: string
  type: 'person' | 'source' | 'media'
  id: string
  name: string
  link: string
  subtitle: string
}

function formatDisplayDate(iso: string) {
  if (!iso) return 'Unknown date'
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day || 1)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: day ? 'numeric' : undefined })
}

const TYPE_LABELS: Record<FilterType, string> = {
  all: 'All',
  person: 'People',
  source: 'Sources',
  media: 'Media',
}

const TYPE_BADGE: Record<string, string> = {
  person: 'bg-blue-50 text-blue-700 border-blue-200',
  source: 'bg-amber-50 text-amber-700 border-amber-200',
  media: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  obituary: 'Obituary',
  cemetery: 'Cemetery/FaG',
  death_certificate: 'Death Certificate',
  birth_certificate: 'Birth Certificate',
  marriage_certificate: 'Marriage Certificate',
  baptism: 'Baptism',
  church: 'Church Record',
  secondary: 'Secondary Source',
  immigration: 'Immigration',
  military: 'Military',
  census: 'Census',
  note: 'Family Notes',
}

export default function RecentAdditionsPage() {
  const { people, sources, media } = useData()
  const [filter, setFilter] = useState<FilterType>('all')

  const allItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []

    for (const p of people) {
      if (p.privacy || !p.created) continue
      const bornYear = p.born ? p.born.split('-')[0] : null
      const subtitle = [
        bornYear ? `b. ${bornYear}` : null,
        p.family || null,
      ].filter(Boolean).join(' · ')
      items.push({
        date: p.created,
        type: 'person',
        id: p.id,
        name: p.name,
        link: `/people/${p.slug}`,
        subtitle,
      })
    }

    for (const s of sources) {
      if (!s.created) continue
      const typeLabel = SOURCE_TYPE_LABELS[s.type] || s.type || 'Source'
      const firstPerson = s.persons?.[0] || ''
      const subtitle = [typeLabel, firstPerson].filter(Boolean).join(' · ')
      items.push({
        date: s.created,
        type: 'source',
        id: s.id,
        name: s.title || s.id,
        link: `/sources/${s.slug}`,
        subtitle,
      })
    }

    for (const m of media) {
      if (!m.dateDownloaded) continue
      // Normalize dateDownloaded to YYYY-MM-DD (it may be a full ISO string)
      const date = m.dateDownloaded.split('T')[0].substring(0, 10)
      if (!date || date.length < 10) continue
      const label = m.description || m.path.split('/').pop() || m.path
      items.push({
        date,
        type: 'media',
        id: m.path,
        name: label,
        link: `/gallery`,
        subtitle: m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : 'Media',
      })
    }

    return items.sort((a, b) => b.date.localeCompare(a.date))
  }, [people, sources, media])

  const filtered = useMemo(() => {
    if (filter === 'all') return allItems
    return allItems.filter(item => item.type === filter)
  }, [allItems, filter])

  // Group by date
  const grouped = useMemo(() => {
    const groups: { date: string; items: FeedItem[] }[] = []
    let current: { date: string; items: FeedItem[] } | null = null
    for (const item of filtered) {
      if (!current || current.date !== item.date) {
        current = { date: item.date, items: [] }
        groups.push(current)
      }
      current.items.push(item)
    }
    return groups
  }, [filtered])

  const counts = useMemo(() => {
    const c: Record<FilterType, number> = { all: allItems.length, person: 0, source: 0, media: 0 }
    for (const item of allItems) c[item.type]++
    return c
  }, [allItems])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800">Recent Additions</h1>
        <p className="mt-2 text-stone-500">
          All records added to the vault, newest first.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(['all', 'person', 'source', 'media'] as FilterType[]).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === t
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'
            }`}
          >
            {TYPE_LABELS[t]} ({counts[t]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-stone-400 italic">No records found.</p>
      )}

      <div className="space-y-8">
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-stone-500">{formatDisplayDate(group.date)}</span>
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">{group.items.length} added</span>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
              {group.items.map(item => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={item.link}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-stone-50 block"
                >
                  <span className={`shrink-0 text-xs font-medium border rounded px-1.5 py-0.5 ${TYPE_BADGE[item.type]}`}>
                    {TYPE_LABELS[item.type as FilterType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-stone-800 truncate block">{item.name}</span>
                    {item.subtitle && (
                      <span className="text-xs text-stone-400">{item.subtitle}</span>
                    )}
                  </div>
                  {item.type === 'source' && (
                    <span className="text-xs font-mono text-stone-400 shrink-0">{item.id}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-stone-200">
        <Link to="/" className="text-sm text-amber-700 hover:text-amber-900 font-medium">
          &larr; Back to home
        </Link>
      </div>
    </div>
  )
}
