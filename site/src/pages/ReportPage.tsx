import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { useReport } from '../useData'
import type { Components } from 'react-markdown'

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl sm:text-4xl font-bold text-stone-800 tracking-tight mt-8 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-stone-800 mt-10 mb-4 pb-2 border-b border-stone-200">{children}</h2>
  ),
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

export default function ReportPage() {
  const report = useReport()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8">
        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded">Full Report</span>
      </div>
      {report ? (
        <article>
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {report}
          </Markdown>
        </article>
      ) : (
        <p className="text-stone-500">Report not available.</p>
      )}
    </div>
  )
}
