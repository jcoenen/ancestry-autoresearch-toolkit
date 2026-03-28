import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePeople, useData, extractYear, confidenceColor } from '../useData'
import type { Person } from '../types'

/* ── Helpers ──────────────────────────────────────────────────── */

function parseFirstName(name: string): string {
  // Strip quotes/nicknames, take first word
  const cleaned = name.replace(/"[^"]+"/g, '').replace(/\([^)]+\)/g, '').trim()
  return cleaned.split(/\s+/)[0] || name
}

function lifespan(p: Person): number | null {
  const b = extractYear(p.born)
  const d = extractYear(p.died)
  if (!b || !d || d <= b) return null
  return d - b
}

function decade(year: number): string {
  const d = Math.floor(year / 10) * 10
  return `${d}s`
}

function century(year: number): string {
  return `${Math.floor((year - 1) / 100) + 1}th`
}

/* ── Bar chart component ─────────────────────────────────────── */

function BarChart({ items, max: maxOverride }: { items: { label: string; value: number; link?: string }[]; max?: number }) {
  const max = maxOverride ?? Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-40 sm:w-56 text-sm text-stone-600 text-right truncate shrink-0">
            {item.link ? (
              <Link to={item.link} className="hover:text-amber-700">{item.label}</Link>
            ) : item.label}
          </div>
          <div className="flex-1 h-6 bg-stone-100 rounded overflow-hidden">
            <div
              className="h-full bg-amber-600/80 rounded transition-all"
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
          <div className="w-10 text-sm text-stone-500 text-right tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Stat card ────────────────────────────────────────────────── */

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 text-center">
      <div className="text-3xl font-bold text-stone-800">{value}</div>
      <div className="text-sm text-stone-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
    </div>
  )
}

/* ── Section wrapper ─────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-stone-800 mb-4">{title}</h2>
      <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
        {children}
      </div>
    </section>
  )
}

/* ── Main page ────────────────────────────────────────────────── */

export default function StatsPage() {
  const people = usePeople()
  const { sources, media } = useData()

  const stats = useMemo(() => {
    const pub = people.filter(p => !p.privacy)
    const withBorn = pub.filter(p => extractYear(p.born))
    const withDied = pub.filter(p => extractYear(p.died))
    const withLifespan = pub.map(p => ({ p, age: lifespan(p) })).filter((x): x is { p: Person; age: number } => x.age !== null)

    // --- Overview ---
    const totalPeople = pub.length
    const totalSources = sources.length
    const totalMedia = media.length
    const familyLines = [...new Set(pub.map(p => p.family).filter(Boolean))].sort()

    // --- Name frequency ---
    const firstNameCounts = new Map<string, number>()
    for (const p of pub) {
      const first = parseFirstName(p.name)
      if (first.length > 1) {
        firstNameCounts.set(first, (firstNameCounts.get(first) || 0) + 1)
      }
    }
    const topNames = [...firstNameCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)

    // --- Surname frequency ---
    const surnameCounts = new Map<string, number>()
    for (const p of pub) {
      if (p.family) surnameCounts.set(p.family, (surnameCounts.get(p.family) || 0) + 1)
    }
    const topSurnames = [...surnameCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)

    // --- Lifespan ---
    const avgLifespan = withLifespan.length > 0
      ? Math.round(withLifespan.reduce((s, x) => s + x.age, 0) / withLifespan.length)
      : 0
    const longest = withLifespan.sort((a, b) => b.age - a.age).slice(0, 5)
    const shortest = withLifespan.filter(x => x.age > 0).sort((a, b) => a.age - b.age).slice(0, 5)

    // Lifespan by century
    const lifespanByCentury = new Map<string, number[]>()
    for (const { p, age } of withLifespan) {
      const year = extractYear(p.born)
      if (!year) continue
      const c = century(year)
      if (!lifespanByCentury.has(c)) lifespanByCentury.set(c, [])
      lifespanByCentury.get(c)!.push(age)
    }
    const avgLifespanByCentury = [...lifespanByCentury.entries()]
      .map(([c, ages]) => ({ label: `${c} century`, value: Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) }))
      .sort((a, b) => a.label.localeCompare(b.label))

    // --- Children per family ---
    const withChildren = pub.filter(p => p.children.length > 0)
    const avgChildren = withChildren.length > 0
      ? (withChildren.reduce((s, p) => s + p.children.length, 0) / withChildren.length).toFixed(1)
      : '0'
    const childDist = new Map<number, number>()
    for (const p of withChildren) {
      const n = p.children.length
      childDist.set(n, (childDist.get(n) || 0) + 1)
    }
    const childDistItems = [...childDist.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, count]) => ({ label: `${n} child${n !== 1 ? 'ren' : ''}`, value: count }))
    const mostChildren = withChildren.sort((a, b) => b.children.length - a.children.length).slice(0, 5)

    // --- Births by decade ---
    const birthsByDecade = new Map<string, number>()
    for (const p of withBorn) {
      const y = extractYear(p.born)!
      const d = decade(y)
      birthsByDecade.set(d, (birthsByDecade.get(d) || 0) + 1)
    }
    const birthDecadeItems = [...birthsByDecade.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, count]) => ({ label: d, value: count }))

    // --- Deaths by decade ---
    const deathsByDecade = new Map<string, number>()
    for (const p of withDied) {
      const y = extractYear(p.died)!
      const d = decade(y)
      deathsByDecade.set(d, (deathsByDecade.get(d) || 0) + 1)
    }
    const deathDecadeItems = [...deathsByDecade.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, count]) => ({ label: d, value: count }))

    // --- Occupations ---
    const occCounts = new Map<string, number>()
    for (const p of pub) {
      if (p.occupation && p.occupation !== '—') {
        const occ = p.occupation.trim()
        occCounts.set(occ, (occCounts.get(occ) || 0) + 1)
      }
    }
    const topOccupations = [...occCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)

    // --- Birthplaces ---
    const placeCounts = new Map<string, number>()
    for (const p of pub) {
      const raw = p.birthplace?.trim()
      const place = (!raw || raw === '—') ? 'Unknown' : raw
      placeCounts.set(place, (placeCounts.get(place) || 0) + 1)
    }
    const topPlaces = [...placeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)

    // --- Confidence breakdown ---
    const confCounts = { high: 0, moderate: 0, low: 0, stub: 0 }
    for (const p of pub) {
      const c = p.confidence as keyof typeof confCounts
      if (c in confCounts) confCounts[c]++
    }

    // --- Source type breakdown ---
    const srcTypeCounts = new Map<string, number>()
    for (const s of sources) {
      const t = (s.type || 'unknown').replace(/_/g, ' ')
      srcTypeCounts.set(t, (srcTypeCounts.get(t) || 0) + 1)
    }
    const sourceTypeItems = [...srcTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, count]) => ({ label: t, value: count }))

    // --- Religion (normalize variants) ---
    const relCounts = new Map<string, number>()
    for (const p of pub) {
      if (p.religion && p.religion !== '—') {
        const raw = p.religion.trim().toLowerCase()
        let normalized: string
        if (raw.includes('catholic') || raw.includes('rooms-ka')) {
          normalized = 'Catholic'
        } else if (raw.includes('lutheran')) {
          normalized = 'Lutheran'
        } else if (raw.includes('methodist')) {
          normalized = 'Methodist'
        } else {
          // Title-case the original
          normalized = p.religion.trim().replace(/\b\w/g, c => c.toUpperCase())
        }
        relCounts.set(normalized, (relCounts.get(normalized) || 0) + 1)
      }
    }
    const topReligions = [...relCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    return {
      totalPeople, totalSources, totalMedia, familyLines,
      topNames, topSurnames,
      avgLifespan, longest, shortest, avgLifespanByCentury,
      avgChildren, childDistItems, mostChildren,
      birthDecadeItems, deathDecadeItems,
      topOccupations, topPlaces, topReligions,
      confCounts, sourceTypeItems,
      withLifespan: withLifespan.length,
    }
  }, [people, sources, media])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Family Statistics</h1>
      <p className="text-stone-500 mb-8">
        Analytics computed from {stats.totalPeople} people, {stats.totalSources} sources, and {stats.totalMedia} media items in the vault.
      </p>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="People" value={stats.totalPeople} />
        <StatCard label="Family Lines" value={stats.familyLines.length} />
        <StatCard label="Avg Lifespan" value={`${stats.avgLifespan} yr`} sub={`from ${stats.withLifespan} people`} />
        <StatCard label="Avg Children" value={stats.avgChildren} sub="per parent" />
      </div>

      {/* Names */}
      <Section title="Most Common First Names">
        <BarChart items={stats.topNames.map(([name, count]) => ({ label: name, value: count }))} />
      </Section>

      <Section title="Surname Distribution">
        <BarChart items={stats.topSurnames.map(([name, count]) => ({ label: name, value: count, link: `/people?family=${name}` }))} />
      </Section>

      {/* Lifespan */}
      <Section title="Longevity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Average Lifespan by Century</h3>
            <BarChart items={stats.avgLifespanByCentury} max={100} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Longest Lives</h3>
            <div className="space-y-2">
              {stats.longest.map(({ p, age }) => (
                <div key={p.id} className="flex items-baseline justify-between">
                  <Link to={`/people/${p.slug}`} className="text-sm font-medium text-stone-700 hover:text-amber-700 truncate">{p.name}</Link>
                  <span className="text-sm text-stone-500 tabular-nums ml-2 shrink-0">{age} years</span>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3 mt-6">Shortest Lives</h3>
            <div className="space-y-2">
              {stats.shortest.map(({ p, age }) => (
                <div key={p.id} className="flex items-baseline justify-between">
                  <Link to={`/people/${p.slug}`} className="text-sm font-medium text-stone-700 hover:text-amber-700 truncate">{p.name}</Link>
                  <span className="text-sm text-stone-500 tabular-nums ml-2 shrink-0">{age} years</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Children */}
      <Section title="Children per Family">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Distribution</h3>
            <BarChart items={stats.childDistItems} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Largest Families</h3>
            <div className="space-y-2">
              {stats.mostChildren.map(p => (
                <div key={p.id} className="flex items-baseline justify-between">
                  <Link to={`/people/${p.slug}`} className="text-sm font-medium text-stone-700 hover:text-amber-700 truncate">{p.name}</Link>
                  <span className="text-sm text-stone-500 tabular-nums ml-2 shrink-0">{p.children.length} children</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Births & Deaths over time */}
      <Section title="Births by Decade">
        <BarChart items={stats.birthDecadeItems} />
      </Section>

      <Section title="Deaths by Decade">
        <BarChart items={stats.deathDecadeItems} />
      </Section>

      {/* Geography */}
      <Section title="Top Birthplaces">
        <BarChart items={stats.topPlaces.map(([place, count]) => ({ label: place, value: count }))} />
      </Section>

      {/* Occupations */}
      {stats.topOccupations.length > 0 && (
        <Section title="Occupations">
          <BarChart items={stats.topOccupations.map(([occ, count]) => ({ label: occ, value: count }))} />
        </Section>
      )}

      {/* Religion */}
      {stats.topReligions.length > 0 && (
        <Section title="Religious Affiliation">
          <BarChart items={stats.topReligions.map(([r, count]) => ({ label: r, value: count }))} />
        </Section>
      )}

      {/* Data Quality */}
      <Section title="Data Quality">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Confidence Levels</h3>
            <div className="space-y-2">
              {(['high', 'moderate', 'low', 'stub'] as const).map(level => (
                <div key={level} className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium w-24 text-center ${confidenceColor(level)}`}>
                    {level}
                  </span>
                  <div className="flex-1 h-5 bg-stone-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-600/80 rounded"
                      style={{ width: `${Math.max((stats.confCounts[level] / stats.totalPeople) * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm text-stone-500 w-12 text-right tabular-nums">
                    {stats.confCounts[level]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Source Types</h3>
            <BarChart items={stats.sourceTypeItems} />
          </div>
        </div>
      </Section>
    </div>
  )
}
