import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSourceBySlug, useData, usePersonByName, MEDIA_BASE } from '../useData'
import type { MediaEntry } from '../types'
import { useLightbox } from '../hooks/useLightbox'
import Lightbox from '../components/Lightbox'
import type { Person } from '../types'
import ConnectionBreadcrumbs from '../components/ConnectionBreadcrumbs'

function PersonMention({ name }: { name: string }) {
  const person = usePersonByName(name)
  if (person) {
    return <Link to={`/people/${person.slug}`} className="text-amber-700 hover:text-amber-900">{name}</Link>
  }
  return <span>{name}</span>
}

export default function SourceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const source = useSourceBySlug(slug || '')
  const { people } = useData()

  if (!source) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-stone-800">Source Not Found</h1>
        <Link to="/sources" className="mt-4 inline-block text-sm font-medium text-amber-700">Back to Sources</Link>
      </div>
    )
  }

  const typeBadgeColor: Record<string, string> = {
    obituary: 'bg-blue-100 text-blue-700',
    cemetery: 'bg-green-100 text-green-700',
    cemetery_memorial: 'bg-green-100 text-green-700',
    baptism: 'bg-purple-100 text-purple-700',
    birth_certificate: 'bg-emerald-100 text-emerald-700',
    death_certificate: 'bg-rose-100 text-rose-700',
    marriage_certificate: 'bg-violet-100 text-violet-700',
    church: 'bg-purple-100 text-purple-700',
    church_record: 'bg-purple-100 text-purple-700',
    secondary: 'bg-yellow-100 text-yellow-700',
    ship_manifest: 'bg-cyan-100 text-cyan-700',
    military: 'bg-red-100 text-red-700',
    census: 'bg-indigo-100 text-indigo-700',
    note: 'bg-orange-100 text-orange-700',
    family_knowledge: 'bg-orange-100 text-orange-700',
  }

  const badgeClass = typeBadgeColor[source.type] || 'bg-stone-100 text-stone-600'

  // Media explicitly linked to this source via its YAML media: field
  const sourceMedia = source.media || []
  const imageMedia = useMemo(() =>
    sourceMedia.filter(m => {
      const ext = m.path.split('.').pop()?.toLowerCase() || ''
      return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
    }),
    [sourceMedia]
  )
  const mediaLightbox = useLightbox(imageMedia)

  const subjectPersonIds = new Set(source.subjectPersonIds || [])
  const linkedPeople = useMemo(() => {
    const byId = new Map(people.map(p => [p.id, p]))
    const seen = new Set<string>()
    const result: Person[] = []

    for (const id of [...(source.subjectPersonIds || []), ...(source.personIds || [])]) {
      const person = byId.get(id)
      if (person && !seen.has(person.id)) {
        seen.add(person.id)
        result.push(person)
      }
    }

    return result
  }, [people, source.personIds, source.subjectPersonIds])

  // Find people in the vault that cite this source. Keep this separate from
  // linkedPeople because older sources may not have person_ids backfilled.
  const citingPeople = people.filter(p => p.sources.includes(source.id))
  const quickPeople = linkedPeople.length > 0 ? linkedPeople : citingPeople

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-stone-400 mb-6">
        <Link to="/sources" className="hover:text-stone-600">Sources</Link>
        <span className="mx-2">/</span>
        <span className="text-stone-600">{source.id}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{source.title}</h1>
          <p className="text-sm text-stone-500 mt-1 font-mono">{source.id}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${badgeClass}`}>
          {source.type.replace(/_/g, ' ')}
        </span>
      </div>

      <ConnectionBreadcrumbs
        targetPersonIds={quickPeople.map(person => person.id)}
        eyebrow="Why this source is here"
      />

      {/* Metadata */}
      <section className="mb-6">
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-left">
            <tbody className="divide-y divide-stone-100">
              {source.date && (
                <tr>
                  <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-40">Date</td>
                  <td className="px-5 py-2.5 text-sm text-stone-700">{source.date}</td>
                </tr>
              )}
              {source.publisher && (
                <tr>
                  <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-40">Publisher</td>
                  <td className="px-5 py-2.5 text-sm text-stone-700">{source.publisher}</td>
                </tr>
              )}
              {source.reliability && (
                <tr>
                  <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-40">Reliability</td>
                  <td className="px-5 py-2.5 text-sm text-stone-700 capitalize">{source.reliability}</td>
                </tr>
              )}
              {source.url && (
                <tr>
                  <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-40">Original URL</td>
                  <td className="px-5 py-2.5 text-sm">
                    {/^https?:\/\//.test(source.url) ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900 break-all">
                        {source.url}
                      </a>
                    ) : (
                      <span className="text-stone-700">{source.url}</span>
                    )}
                  </td>
                </tr>
              )}
              {source.fagNumber && (
                <tr>
                  <td className="px-5 py-2.5 text-sm font-medium text-stone-500 w-40">FaG Memorial</td>
                  <td className="px-5 py-2.5 text-sm">
                    <a href={`https://www.findagrave.com/memorial/${source.fagNumber}`} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:text-amber-900">
                      #{source.fagNumber}
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Linked People */}
      {quickPeople.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">Linked People</h2>
            <span className="text-xs text-amber-800">
              {quickPeople.length} {quickPeople.length === 1 ? 'person' : 'people'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPeople.map(person => {
              const isSubject = subjectPersonIds.has(person.id)
              return (
                <Link
                  key={person.id}
                  to={`/people/${person.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-amber-400 hover:bg-amber-100 hover:no-underline"
                >
                  <span>{person.name}</span>
                  {isSubject && (
                    <span className="rounded-full bg-amber-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white">
                      subject
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Full Text */}
      {source.fullText && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Full Text</h2>
          <div className="rounded-lg border border-stone-200 bg-amber-50/50 p-6">
            {source.fullText.split('\n\n').map((para, i) => (
              <p key={i} className="text-stone-700 leading-relaxed mb-3 last:mb-0">
                {para}
              </p>
            ))}
          </div>
          {source.translationSlug && (
            <Link to={`/translations/${source.translationSlug}`}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 transition-colors hover:no-underline">
              Read Full English Translation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </section>
      )}

      {/* Media */}
      {sourceMedia.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Media ({sourceMedia.length})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {(() => {
              let imageIndex = 0
              return sourceMedia.map((m, i) => {
                const ext = m.path.split('.').pop()?.toLowerCase() || ''
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
                const isDoc = ['pdf', 'html', 'htm', 'md', 'txt'].includes(ext)
                const docIcon = ext === 'pdf' ? 'PDF' : ext === 'html' || ext === 'htm' ? 'HTML' : ext.toUpperCase()
                const currentImageIndex = isImage ? imageIndex++ : -1

                return (
                  <div key={i} className="rounded-lg border border-stone-200 bg-white overflow-hidden hover:border-amber-300 hover:shadow-sm transition-all">
                    {isImage ? (
                      <button onClick={() => mediaLightbox.open(currentImageIndex)} className="w-full">
                        <img
                          src={`${MEDIA_BASE}${m.path}`}
                          alt={m.description}
                          className="w-full object-cover bg-stone-100 cursor-zoom-in"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.alt = m.description
                            target.className = 'w-full aspect-square bg-stone-100 flex items-center justify-center text-stone-400 text-xs p-4'
                          }}
                        />
                      </button>
                    ) : (
                      <a href={`${MEDIA_BASE}${m.path}`} target="_blank" rel="noopener noreferrer">
                        <div className="w-full aspect-[4/3] bg-stone-50 flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-14 rounded border-2 border-stone-300 flex items-center justify-center">
                            <span className="text-xs font-bold text-stone-500">{docIcon}</span>
                          </div>
                          <span className="text-xs text-amber-700 font-medium">Open {docIcon} ↗</span>
                        </div>
                      </a>
                    )}
                    <div className="p-2">
                      <div className="text-xs text-stone-700">{m.description}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{m.type}</div>
                      {m.sourceUrl && (
                        <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-amber-600 hover:text-amber-800 mt-1 block truncate">
                          Source ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
          <Lightbox {...mediaLightbox.lightboxProps} />
        </section>
      )}

      {/* Extracted Facts */}
      {source.extractedFacts && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Extracted Facts</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5 overflow-x-auto">
            <MarkdownTable text={source.extractedFacts} />
          </div>
        </section>
      )}

      {/* Persons Mentioned */}
      {source.persons.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Persons Mentioned ({source.persons.length})</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap gap-2">
              {source.persons.map((name, i) => (
                <span key={i} className="inline-block">
                  <PersonMention name={name} />
                  {i < source.persons.length - 1 && <span className="text-stone-300 ml-2">|</span>}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cited By */}
      {citingPeople.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Cited By ({citingPeople.length} person files)</h2>
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
            {citingPeople.map(p => (
              <Link key={p.id} to={`/people/${p.slug}`} className="px-5 py-3 flex items-baseline justify-between gap-4 hover:bg-stone-50 block">
                <span className="font-medium text-stone-800">{p.name}</span>
                <span className="text-xs text-stone-400">{p.family}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {source.notes && (
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Notes</h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            {source.notes.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-sm text-stone-600 leading-relaxed mb-2 last:mb-0">
                {line.replace(/^-\s*/, '').trim()}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function MarkdownTable({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'))
  if (lines.length < 2) return <pre className="text-sm text-stone-600 whitespace-pre-wrap">{text}</pre>

  const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean)
  const dataRows = lines.slice(2) // skip header and separator

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          {headerCells.map((h, i) => (
            <th key={i} className="text-left px-3 py-2 text-stone-500 font-medium border-b border-stone-200">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100">
        {dataRows.map((row, ri) => {
          const cells = row.split('|').map(c => c.trim()).filter(Boolean)
          return (
            <tr key={ri}>
              {cells.map((c, ci) => (
                <td key={ci} className="px-3 py-2 text-stone-700">{c}</td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
