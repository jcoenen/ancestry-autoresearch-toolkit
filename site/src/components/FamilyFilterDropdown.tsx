import { useState, useRef, useEffect } from 'react'

interface FamilyFilterDropdownProps {
  families: string[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
  /** If true, only one family can be selected at a time (empty = all) */
  single?: boolean
}

export default function FamilyFilterDropdown({
  families, selected, onChange, single = false,
}: FamilyFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = selected.size === 0
    ? 'All families'
    : selected.size <= 2
      ? Array.from(selected).join(', ')
      : `${selected.size} families`

  const toggle = (f: string) => {
    if (single) {
      onChange(selected.has(f) ? new Set() : new Set([f]))
    } else {
      const next = new Set(selected)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      onChange(next)
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
          selected.size > 0
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
        }`}
      >
        <svg className="w-4 h-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {label}
        <svg className={`w-3.5 h-3.5 shrink-0 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg border border-stone-200 shadow-lg py-1 min-w-[200px] max-h-[320px] overflow-y-auto">
          {/* All option */}
          <button
            onClick={() => { onChange(new Set()); if (single) setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-stone-50 transition-colors ${
              selected.size === 0 ? 'text-stone-800 font-medium' : 'text-stone-500'
            }`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              selected.size === 0
                ? 'bg-stone-800 border-stone-800 text-white'
                : 'border-stone-300'
            }`}>
              {selected.size === 0 && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            All families
          </button>

          <div className="border-t border-stone-100 my-1" />

          {families.map(f => {
            const active = selected.has(f)
            return (
              <button
                key={f}
                onClick={() => { toggle(f); if (single) setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'border-stone-300'
                }`}>
                  {active && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {f}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
