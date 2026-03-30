import { Link } from 'react-router-dom'
import { useSiteConfig } from '../useData'
import type { ChangelogEntry } from '../siteConfig'

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function UpdatesPage() {
  const config = useSiteConfig()
  const entries: ChangelogEntry[] = config.changelog ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-stone-800">Research Updates</h1>
        <p className="mt-2 text-stone-500">
          A running record of what's been found, confirmed, and added to the vault.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-stone-400 italic">No changelog entries yet.</p>
      )}

      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-stone-200 hidden sm:block" />

        <div className="space-y-10">
          {entries.map((entry, i) => (
            <div key={i} className="sm:flex gap-6">
              {/* Date + version column */}
              <div className="shrink-0 w-[5.5rem] text-right hidden sm:block pt-1">
                <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                  v{entry.version}
                </span>
                <div className="text-xs text-stone-400 mt-1 leading-tight">{formatDate(entry.date)}</div>
              </div>

              {/* Timeline dot */}
              <div className="relative hidden sm:flex items-start pt-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-600 ring-2 ring-white shrink-0 mt-0.5" />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                {/* Mobile: show version + date inline */}
                <div className="sm:hidden flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    v{entry.version}
                  </span>
                  <span className="text-xs text-stone-400">{formatDate(entry.date)}</span>
                </div>
                <h2 className="text-base font-semibold text-stone-800 mb-2">{entry.title}</h2>
                <ul className="space-y-1">
                  {entry.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-sm text-stone-600">
                      <span className="text-amber-500 shrink-0 mt-0.5">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-stone-200">
        <Link to="/" className="text-sm text-amber-700 hover:text-amber-900 font-medium">
          &larr; Back to home
        </Link>
      </div>
    </div>
  )
}
