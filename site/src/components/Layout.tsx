import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Nav from './Nav'
import { useSiteConfig } from '../useData'

export default function Layout({ children }: { children: ReactNode }) {
  const config = useSiteConfig()

  // Set document title from config
  useEffect(() => {
    document.title = config.siteTitle
  }, [config.siteTitle])

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-stone-400">
          <p>{config.siteTitle} &middot; {config.footerTagline}</p>
          <p className="mt-1">Research by {config.researcher}</p>
        </div>
      </footer>
    </div>
  )
}
