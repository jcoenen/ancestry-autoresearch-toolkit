import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSearch, getSnippet, type SearchResult } from '../useSearch'

type ActiveTab = 'all' | 'people' | 'sources' | 'media'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const { search } = useSearch()

  const results = useMemo(() => search(query), [search, query])
  const tabs: { id: ActiveTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: results.total },
    { id: 'people', label: 'People', count: results.people.length },
    { id: 'sources', label: 'Sources', count: results.sources.length },
    { id: 'media', label: 'Media', count: results.media.length },
  ]
  const showPeople = activeTab === 'all' || activeTab === 'people'
  const showSources = activeTab === 'all' || activeTab === 'sources'
  const showMedia = activeTab === 'all' || activeTab === 'media'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800">Search</h1>

      {!query ? (
        <p className="mt-6 text-stone-400 text-center py-12">
          Enter a search term to find people, sources, and media.
        </p>
      ) : results.total === 0 ? (
        <p className="mt-6 text-stone-400 text-center py-12">
          No results found for &ldquo;{query}&rdquo;. Try a different search term.
        </p>
      ) : (
        <>
          <p className="mt-2 text-stone-500 mb-6">
            {results.total} result{results.total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeTab === tab.id
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {showPeople && results.people.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-stone-800 mb-3 flex items-baseline gap-2">
                People
                <span className="text-sm font-normal text-stone-400">
                  ({results.people.length})
                </span>
              </h2>
              <div className="space-y-2">
                {results.people.map((r, i) => (
                  <ResultCard key={i} result={r} />
                ))}
              </div>
            </section>
          )}

          {showSources && results.sources.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-stone-800 mb-3 flex items-baseline gap-2">
                Sources
                <span className="text-sm font-normal text-stone-400">
                  ({results.sources.length})
                </span>
              </h2>
              <div className="space-y-2">
                {results.sources.map((r, i) => (
                  <ResultCard key={i} result={r} />
                ))}
              </div>
            </section>
          )}

          {showMedia && results.media.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-stone-800 mb-3 flex items-baseline gap-2">
                Media
                <span className="text-sm font-normal text-stone-400">
                  ({results.media.length})
                </span>
              </h2>
              <div className="space-y-2">
                {results.media.map((r, i) => (
                  <ResultCard key={i} result={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const snippet = getSnippet(result.matches)

  return (
    <Link
      to={result.item.link}
      className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-amber-300 hover:shadow-sm transition-all hover:no-underline group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-stone-800 text-sm group-hover:text-amber-700">
            {result.item.title}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {result.item.subtitle}
          </div>
          {result.item.marriedName && result.item.marriedName.length > 0 && (
            <div className="text-xs text-stone-400 mt-0.5">
              <span className="text-stone-500">Married name{result.item.marriedName.length > 1 ? 's' : ''}:</span>{' '}
              {result.item.marriedName.join(' · ')}
            </div>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
          result.item.type === 'person'
            ? 'bg-blue-50 text-blue-600'
            : result.item.type === 'source'
              ? 'bg-amber-50 text-amber-600'
              : 'bg-emerald-50 text-emerald-600'
        }`}>
          {result.item.type === 'person' ? 'Person' : result.item.type === 'source' ? 'Source' : 'Media'}
        </span>
      </div>
      {snippet && (
        <div className="mt-2 text-xs text-stone-500 leading-relaxed">
          <span className="text-stone-400 font-medium">{snippet.field}: </span>
          {snippet.before}
          <mark className="bg-amber-100 text-amber-900 rounded px-0.5">{snippet.match}</mark>
          {snippet.after}
        </div>
      )}
    </Link>
  )
}
