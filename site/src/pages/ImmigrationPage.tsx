import { useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { useImmigrationStories, usePeople } from '../useData'
import type { Components } from 'react-markdown'
import type { Person } from '../types'

function autolinkPeople(markdown: string, people: Person[]): string {
  // Sort by name length descending — match longer names first to avoid partial matches
  const sorted = people
    .filter(p => !p.privacy && p.name && p.slug && p.name.length >= 5)
    .sort((a, b) => b.name.length - a.name.length)

  return markdown.split('\n').map(line => {
    // Skip headings, blockquotes, and lines that already contain markdown links
    if (line.startsWith('#') || line.startsWith('>') || line.includes('](')) return line

    let result = line
    for (const p of sorted) {
      const escaped = p.name.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), `[${p.name}](/people/${p.slug})`)
    }
    return result
  }).join('\n')
}

/* ── Markdown components (matches ReportPage, adds id to h2) ── */

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl sm:text-4xl font-bold text-stone-800 tracking-tight mt-8 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => {
    const text = String(children)
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return (
      <h2 id={id} className="text-2xl font-semibold text-stone-800 mt-10 mb-4 pb-2 border-b border-stone-200 scroll-mt-20">
        {children}
      </h2>
    )
  },
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-stone-700 mt-8 mb-3">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-stone-600 leading-relaxed mb-4">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-6 mb-4 space-y-1 text-stone-600">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-6 mb-4 space-y-1 text-stone-600">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-stone-800">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  hr: () => <hr className="my-8 border-stone-200" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-300 bg-amber-50/50 pl-4 py-2 my-4 text-stone-600 italic">{children}</blockquote>
  ),
  a: ({ href, children }) => {
    if (href && href.startsWith('/')) {
      return <Link to={href} className="text-amber-700 hover:underline">{children}</Link>
    }
    return <a href={href} className="text-amber-700 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-stone-50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-sm font-medium text-stone-500 border-b border-stone-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-stone-600 border-b border-stone-100">{children}</td>
  ),
}

/* ── Main page ────────────────────────────────────────────────── */

export default function ImmigrationPage() {
  const content = useImmigrationStories()
  const people = usePeople()

  // Extract H2 headings for table of contents
  const toc = useMemo(() => {
    const headings: { id: string; label: string }[] = []
    const re = /^## (.+)$/gm
    let match
    while ((match = re.exec(content)) !== null) {
      const label = match[1]
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      headings.push({ id, label })
    }
    return headings
  }, [content])

  // Strip the H1 title from content — we render our own header
  const rawBody = content.replace(/^# .+\n+/, '')

  // Auto-link person names that appear in the narrative
  const body = useMemo(() => autolinkPeople(rawBody, people), [rawBody, people])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">Immigration</span>
        <h1 className="text-3xl font-bold text-stone-800 mt-4 mb-2">Immigration Stories</h1>
        <p className="text-stone-500">How six family lines crossed oceans to converge in Wisconsin</p>
      </div>

      {/* Table of contents */}
      {toc.length > 0 && (
        <nav className="rounded-lg border border-stone-200 bg-white p-5 mb-10">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Contents</h2>
          <ul className="space-y-1.5">
            {toc.map(h => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="text-sm text-amber-700 hover:text-amber-900 hover:underline">
                  {h.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Markdown body */}
      {content ? (
        <article>
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {body}
          </Markdown>
        </article>
      ) : (
        <p className="text-stone-500">Immigration stories not yet written.</p>
      )}
    </div>
  )
}
