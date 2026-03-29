import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData, usePeople, useSiteConfig, formatYear } from '../useData'
import { extractEvents, EVENT_COLORS, EVENT_LABELS, MONTH_NAMES } from '../onThisDayEvents'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function HomePage() {
  const { stats } = useData()
  const people = usePeople()
  const config = useSiteConfig()

  const todayEvents = useMemo(() => {
    const now = new Date()
    const m = now.getMonth() + 1
    const d = now.getDate()
    return extractEvents(people)
      .filter(e => e.month === m && e.day === d)
      .sort((a, b) => a.year - b.year)
  }, [people])

  const extendedLine = useMemo(() => {
    if (!config.rootPersonId) return []
    const line: ReturnType<typeof usePeople> = []
    let current = people.find(p => p.id === config.rootPersonId)
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      line.push(current)
      current = current.father ? people.find(p => p.id === current!.father) : undefined
    }
    return line
  }, [people, config.rootPersonId])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="py-16 sm:py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-800 tracking-tight">
          {config.siteTitle}
        </h1>
        <p className="mt-4 text-lg text-stone-500 max-w-2xl mx-auto">
          {config.heroSubtitle}
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/tree"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-amber-700 text-white font-medium text-sm hover:bg-amber-800 transition-colors hover:no-underline"
          >
            View Family Tree
          </Link>
          <Link
            to="/people"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-amber-700 text-white font-medium text-sm hover:bg-amber-800 transition-colors hover:no-underline"
          >
            Browse People
          </Link>
          <Link
            to="/report"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-amber-700 text-white font-medium text-sm hover:bg-amber-800 transition-colors hover:no-underline"
          >
            View Family Report
          </Link>
          <Link
            to="/immigration"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-amber-700 text-white font-medium text-sm hover:bg-amber-800 transition-colors hover:no-underline"
          >
            Immigration Stories
          </Link>
        </div>
      </section>

      {/* Surname Origin (from config, optional) */}
      {config.surnameOrigin && (
        <section className="pb-16">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-stone-800 mb-3">{config.surnameOrigin.title}</h2>
            <div className="text-stone-600 leading-relaxed prose prose-stone prose-a:text-amber-700 prose-a:font-medium max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    // Use React Router Link for internal paths
                    if (href && href.startsWith('/')) {
                      return <Link to={href} className="text-amber-700 font-medium hover:underline">{children}</Link>
                    }
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-700 font-medium hover:underline">{children}</a>
                  }
                }}
              >
                {config.surnameOrigin.markdown}
              </ReactMarkdown>
            </div>
          </div>
        </section>
      )}

      {/* On This Day */}
      {todayEvents.length > 0 && (
        <section className="pb-16">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-2xl font-semibold text-stone-800">On This Day</h2>
            <Link to="/on-this-day" className="text-sm text-amber-700 hover:text-amber-900 font-medium hover:no-underline">
              See this week &rarr;
            </Link>
          </div>
          <p className="text-stone-500 text-sm mb-4">
            {MONTH_NAMES[new Date().getMonth() + 1]} {new Date().getDate()} in family history
          </p>
          <div className="space-y-2">
            {todayEvents.map(event => {
              const colors = EVENT_COLORS[event.type]
              const yearsAgo = new Date().getFullYear() - event.year
              return (
                <div key={event.id} className={`flex items-center gap-3 p-3 rounded-lg border ${colors.border} ${colors.bg}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/people/${event.personSlug}`}
                      className={`font-medium text-sm ${colors.text} hover:underline`}
                    >
                      {event.personName}
                    </Link>
                    <span className={`ml-2 text-xs ${colors.text} opacity-70`}>
                      {EVENT_LABELS[event.type]}, {event.year} ({yearsAgo} year{yearsAgo !== 1 ? 's' : ''} ago)
                    </span>
                  </div>
                  {event.location && (
                    <span className="text-xs text-stone-500 hidden sm:block shrink-0">{event.location}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Direct Patrilineal Line */}
      {extendedLine.length > 1 && (
        <section className="pb-16">
          <h2 className="text-2xl font-semibold text-stone-800 mb-4">
            Direct Patrilineal Line ({extendedLine.length} Generations)
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 text-sm text-stone-500">
                  <th className="px-4 py-3 font-medium">Gen</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Born</th>
                  <th className="px-4 py-3 font-medium">Died</th>
                  <th className="px-4 py-3 font-medium">Birthplace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {extendedLine.map((p, i) => (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm text-stone-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/people/${p.slug}`} className="font-medium text-sm">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">{p.privacy ? '' : formatYear(p.born)}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{p.privacy ? '' : formatYear(p.died)}</td>
                    <td className="px-4 py-3 text-sm text-stone-500">{p.privacy ? '' : p.birthplace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Family Lines */}
      <section className="pb-16">
        <h2 className="text-2xl font-semibold text-stone-800 mb-6">Family Lines</h2>
        <div className="flex flex-wrap gap-2">
          {stats.familyLines.map(f => (
            <Link
              key={f}
              to={`/people?family=${f}`}
              className="px-3 py-1.5 rounded-full border border-stone-200 text-sm text-stone-600 hover:bg-stone-100 hover:no-underline transition-colors"
            >
              {f}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pb-16">
        <StatCard label="People" value={stats.totalPeople} />
        <StatCard label="Generations" value={stats.generationsTraced} />
        <StatCard label="Sources" value={stats.totalSources} />
        <StatCard label="Media" value={stats.totalMedia} />
        <StatCard label="Family Lines" value={stats.familyLines.length} />
        <StatCard label="Oldest Record" value={config.oldestRecord} />
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 text-center">
      <div className="text-2xl font-bold text-stone-800">{value}</div>
      <div className="text-xs text-stone-500 mt-1">{label}</div>
    </div>
  )
}
