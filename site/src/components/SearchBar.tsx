import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSearch, type SearchResult } from '../useSearch'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const { search } = useSearch()

  const suggestions = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []
    const results = search(trimmed)
    return [
      ...results.people.slice(0, 5),
      ...results.sources.slice(0, 3),
      ...results.media.slice(0, 2),
    ].sort((a, b) => a.score - b.score).slice(0, 7)
  }, [query, search])

  // Sync input with URL query param when on /search
  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search)
      const id = window.setTimeout(() => setQuery(params.get('q') || ''), 0)
      return () => window.clearTimeout(id)
    }
  }, [location])

  // Cmd+K / Ctrl+K to focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  function handleSuggestion(result: SearchResult) {
    setQuery(result.item.title)
    setIsFocused(false)
    navigate(result.item.link)
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center">
      <svg
        className="absolute left-2.5 w-4 h-4 text-stone-400 pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
        className="w-36 focus:w-52 transition-all pl-8 pr-8 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 focus:bg-white"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-2 text-stone-400 hover:text-stone-600"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {isFocused && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-200 bg-white shadow-lg overflow-hidden">
          {suggestions.map((result, i) => (
            <button
              key={`${result.item.type}-${result.item.link}-${i}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                handleSuggestion(result)
              }}
              className="block w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-stone-100 last:border-b-0"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-stone-800 truncate">{result.item.title}</span>
                  <span className="block text-xs text-stone-500 truncate">{result.item.subtitle}</span>
                </span>
                <span className="mt-0.5 shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                  {result.item.type}
                </span>
              </span>
            </button>
          ))}
          <button
            type="submit"
            className="block w-full px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50"
          >
            See all results for &ldquo;{query.trim()}&rdquo;
          </button>
        </div>
      )}
    </form>
  )
}
