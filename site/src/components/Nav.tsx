import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSiteConfig } from '../useData'
import SearchBar from './SearchBar'

const links = [
  { to: '/', label: 'Home' },
  { to: '/tree', label: 'Family Tree' },
  { to: '/people', label: 'People' },
  { to: '/gallery', label: 'Gallery' },
]

const visualizeLinks = [
  { to: '/timeline', label: 'Timeline' },
  { to: '/map', label: 'Family Map' },
  { to: '/stats', label: 'Statistics' },
  { to: '/on-this-day', label: 'On This Day' },
]

const researchLinks = [
  { to: '/sources', label: 'Sources' },
  { to: '/report', label: 'Report' },
  { to: '/immigration', label: 'Immigration Stories' },
  { to: '/cemeteries', label: 'Cemetery Browser' },
  { to: '/research-gaps', label: 'Research Gaps' },
  { to: '/updates', label: "What's New" },
  { to: '/features', label: 'Features Guide' },
]

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function Nav() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [visualizeOpen, setVisualizeOpen] = useState(false)
  const [researchOpen, setResearchOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const visualizeRef = useRef<HTMLDivElement>(null)
  const researchRef = useRef<HTMLDivElement>(null)
  const config = useSiteConfig()

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false)
    setVisualizeOpen(false)
    setResearchOpen(false)
  }, [location.pathname])

  // Close menus on click outside
  useEffect(() => {
    if (!menuOpen && !visualizeOpen && !researchOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (visualizeRef.current && !visualizeRef.current.contains(e.target as Node)) {
        setVisualizeOpen(false)
      }
      if (researchRef.current && !researchRef.current.contains(e.target as Node)) {
        setResearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen, visualizeOpen, researchOpen])

  const isVisualizeActive = visualizeLinks.some(l => location.pathname.startsWith(l.to))
  const isResearchActive = researchLinks.some(l => location.pathname.startsWith(l.to))

  return (
    <nav ref={menuRef} className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="font-semibold text-stone-800 text-lg tracking-tight hover:no-underline">
            {config.familyName} Ancestry
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex gap-1 items-center">
            {links.map(link => {
              const isActive = link.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:no-underline ${
                    isActive
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}

            <SearchBar />

            {/* Visualize dropdown */}
            <div ref={visualizeRef} className="relative">
              <button
                onClick={() => { setVisualizeOpen(!visualizeOpen); setResearchOpen(false) }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isVisualizeActive
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                Visualize
                <ChevronIcon open={visualizeOpen} />
              </button>
              {visualizeOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50">
                  {visualizeLinks.map(link => {
                    const isActive = location.pathname.startsWith(link.to)
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`block px-4 py-2 text-sm transition-colors hover:no-underline ${
                          isActive
                            ? 'bg-stone-50 text-stone-900 font-medium'
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Research dropdown */}
            <div ref={researchRef} className="relative">
              <button
                onClick={() => { setResearchOpen(!researchOpen); setVisualizeOpen(false) }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isResearchActive
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                Research
                <ChevronIcon open={researchOpen} />
              </button>
              {researchOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-stone-200 py-1 z-50">
                  {researchLinks.map(link => {
                    const isActive = location.pathname.startsWith(link.to)
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        className={`block px-4 py-2 text-sm transition-colors hover:no-underline ${
                          isActive
                            ? 'bg-stone-50 text-stone-900 font-medium'
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-md text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-stone-200 bg-white">
          <div className="px-4 py-2 space-y-1">
            <div className="py-2">
              <SearchBar />
            </div>
            {links.map(link => {
              const isActive = link.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors hover:no-underline ${
                    isActive
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-600 hover:text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
            <div className="pt-2 mt-2 border-t border-stone-100">
              <span className="block px-3 py-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">Visualize</span>
              {visualizeLinks.map(link => {
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors hover:no-underline ${
                      isActive
                        ? 'bg-stone-100 text-stone-900'
                        : 'text-stone-600 hover:text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
            <div className="pt-2 mt-2 border-t border-stone-100">
              <span className="block px-3 py-1 text-xs font-semibold text-stone-400 uppercase tracking-wider">Research</span>
              {researchLinks.map(link => {
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block px-3 py-2.5 rounded-md text-base font-medium transition-colors hover:no-underline ${
                      isActive
                        ? 'bg-stone-100 text-stone-900'
                        : 'text-stone-600 hover:text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
