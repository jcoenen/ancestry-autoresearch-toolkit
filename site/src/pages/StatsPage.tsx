import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePeople, useData, extractYear, confidenceColor } from '../useData'
import type { Person, SourceEntry } from '../types'

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

function decadeStart(label: string): number | null {
  const match = label.match(/^(\d{4})s$/)
  return match ? parseInt(match[1], 10) : null
}

function century(year: number): string {
  return `${Math.floor((year - 1) / 100) + 1}th`
}

function hasKnownValue(value: string | undefined | null): boolean {
  if (!value) return false
  const v = value.trim()
  return v !== '' && v !== '—' && v !== '-' && v.toLowerCase() !== 'unknown'
}

function inferMilitaryBranch(text: string): string {
  const raw = text.toLowerCase()
  if (raw.includes('army air force') || raw.includes('army air forces')) return 'U.S. Army Air Forces'
  if (raw.includes('marine')) return 'U.S. Marine Corps'
  if (raw.includes('navy')) return 'U.S. Navy'
  if (raw.includes('air force')) return 'U.S. Air Force'
  if (raw.includes('army')) return 'U.S. Army'
  if (raw.includes('civil war')) return 'Union Army'
  return ''
}

function inferMilitaryConflict(text: string): string {
  const raw = text.toLowerCase()
  if (raw.includes('world war ii') || raw.includes('wwii') || raw.includes('battle of the bulge')) return 'World War II'
  if (raw.includes('world war i') || raw.includes('wwi')) return 'World War I'
  if (raw.includes('korean war') || raw.includes('korean conflict')) return 'Korean War'
  if (raw.includes('vietnam')) return 'Vietnam War'
  if (raw.includes('civil war')) return 'U.S. Civil War'
  return ''
}

function militaryBranchLabels(p: Person): string[] {
  if (p.militaryService?.length) {
    return [...new Set(p.militaryService.map(s => s.branch).filter(hasKnownValue))]
  }
  const inferred = inferMilitaryBranch(p.military || '')
  return inferred ? [inferred] : []
}

function militaryConflictLabels(p: Person): string[] {
  if (p.militaryService?.length) {
    return [...new Set(p.militaryService.map(s => s.conflict).filter(hasKnownValue))]
  }
  const inferred = inferMilitaryConflict(p.military || '')
  return inferred ? [inferred] : []
}

function occupationCategoryLabels(p: Person): string[] {
  if (p.occupations?.length) {
    return [...new Set(p.occupations.map(o => o.category).filter(hasKnownValue))]
  }
  return hasKnownValue(p.occupation) ? ['Other specific occupations'] : []
}

function shortMigrationSourceTitle(source: SourceEntry): string {
  const year = extractYear(source.date)
  const title = source.title || source.id
  const ship = title.match(/Ship Manifest\s+[—-]\s+(.+?)(?:,\s*.+)?$/i)
  if (ship) return `${ship[1]} passenger manifest${year ? ` (${year})` : ''}`
  const naturalization = title.match(/Naturalization Record\s+[—-]\s+(.+?)(?:,\s*.+)?$/i)
  if (naturalization) return `${naturalization[1]} naturalization${year ? ` (${year})` : ''}`
  return year && !title.includes(String(year)) ? `${title} (${year})` : title
}

function normalizeReligion(value: string): string {
  const raw = value.trim().toLowerCase()
  if (raw.includes('catholic') || raw.includes('catholique') || raw.includes('rooms-ka')) return 'Catholic'
  if (raw.includes('lutheran')) return 'Lutheran'
  if (raw.includes('methodist')) return 'Methodist'
  if (raw.includes('baptist')) return 'Baptist'
  if (raw.includes('reform')) return 'Reformed'
  return value.trim().replace(/\b\w/g, c => c.toUpperCase())
}

/* ── Bar chart component ─────────────────────────────────────── */

type BarItem = {
  label: string
  value: number
  link?: string
  countLink?: string
  title?: string
}

function BarChart({ items, max: maxOverride }: { items: BarItem[]; max?: number }) {
  const max = maxOverride ?? Math.max(...items.map(i => i.value), 1)
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-44 sm:w-72 text-sm text-stone-600 text-right leading-snug shrink-0" title={item.title || item.label}>
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
          <div className="w-10 text-sm text-stone-500 text-right tabular-nums">
            {item.countLink ? (
              <Link to={item.countLink} className="hover:text-amber-700">{item.value}</Link>
            ) : item.value}
          </div>
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
      .map(([n, count]) => ({
        label: `${n} child${n !== 1 ? 'ren' : ''}`,
        value: count,
        link: `/people?childrenCount=${n}`,
      }))
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
      .map(([d, count]) => {
        const start = decadeStart(d)
        return {
          label: d,
          value: count,
          link: start !== null ? `/people?bornFrom=${start}&bornTo=${start + 9}` : undefined,
        }
      })

    // --- Deaths by decade ---
    const deathsByDecade = new Map<string, number>()
    for (const p of withDied) {
      const y = extractYear(p.died)!
      const d = decade(y)
      deathsByDecade.set(d, (deathsByDecade.get(d) || 0) + 1)
    }
    const deathDecadeItems = [...deathsByDecade.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, count]) => {
        const start = decadeStart(d)
        return {
          label: d,
          value: count,
          link: start !== null ? `/people?diedFrom=${start}&diedTo=${start + 9}` : undefined,
        }
      })

    // --- Occupations ---
    const occCounts = new Map<string, number>()
    for (const p of pub) {
      for (const occ of occupationCategoryLabels(p)) {
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
      const place = hasKnownValue(raw) ? raw : 'Unknown'
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

    // --- Immigration ---
    const sourceMap = new Map(sources.map(s => [s.id, s]))
    const immCounts = new Map<string, BarItem>()
    for (const p of pub) {
      let key = ''
      let item: BarItem | null = null

      if (hasKnownValue(p.immigration)) {
        key = `person:${p.id}:immigration`
        item = {
          label: `${p.name}: ${p.immigration.trim()}`,
          value: 0,
          link: `/people/${p.slug}`,
          title: `Immigration field from ${p.name}`,
        }
      } else if (hasKnownValue(p.emigration)) {
        key = `person:${p.id}:emigration`
        item = {
          label: `${p.name}: emigration ${p.emigration.trim()}`,
          value: 0,
          link: `/people/${p.slug}`,
          title: `Emigration field from ${p.name}`,
        }
      } else if (hasKnownValue(p.naturalization)) {
        key = `person:${p.id}:naturalization`
        item = {
          label: `${p.name}: naturalization ${p.naturalization.trim()}`,
          value: 0,
          link: `/people/${p.slug}`,
          title: `Naturalization field from ${p.name}`,
        }
      }
      else {
        const migrationSource = p.sources
          .map(id => sourceMap.get(id))
          .find(s => s && ['immigration', 'ship_manifest', 'naturalization'].includes(s.type))
        if (migrationSource) {
          key = `source:${migrationSource.id}`
          item = {
            label: shortMigrationSourceTitle(migrationSource),
            value: 0,
            link: `/sources/${migrationSource.slug}`,
            countLink: `/people?source=${encodeURIComponent(migrationSource.id)}`,
            title: migrationSource.title || migrationSource.id,
          }
        }
      }

      if (key && item) {
        const existing = immCounts.get(key) || item
        existing.value++
        immCounts.set(key, existing)
      }
    }
    const topImmigration = [...immCounts.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
    const totalImmigrants = [...immCounts.values()].reduce((s, item) => s + item.value, 0)

    // --- Military ---
    const milBranchCounts = new Map<string, number>()
    const milConflictCounts = new Map<string, number>()
    let totalMilitary = 0
    for (const p of pub) {
      if (hasKnownValue(p.military) || (p.militaryService?.length || 0) > 0) {
        totalMilitary++
      }
      for (const branch of militaryBranchLabels(p)) {
        milBranchCounts.set(branch, (milBranchCounts.get(branch) || 0) + 1)
      }
      for (const conflict of militaryConflictLabels(p)) {
        milConflictCounts.set(conflict, (milConflictCounts.get(conflict) || 0) + 1)
      }
    }
    const topMilitaryBranches = [...milBranchCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
    const topMilitaryConflicts = [...milConflictCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)

    // --- Religion (normalize variants) ---
    const relCounts = new Map<string, number>()
    for (const p of pub) {
      if (hasKnownValue(p.religion)) {
        const normalized = normalizeReligion(p.religion)
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
      topOccupations, topPlaces, topImmigration, totalImmigrants, totalMilitary, topMilitaryBranches, topMilitaryConflicts, topReligions,
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
        <BarChart items={stats.topNames.map(([name, count]) => ({ label: name, value: count, link: `/people?firstName=${encodeURIComponent(name)}` }))} />
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
        <BarChart items={stats.topPlaces.map(([place, count]) => ({
          label: place,
          value: count,
          link: place !== 'Unknown' ? `/people?birthplace=${encodeURIComponent(place)}` : undefined,
        }))} />
      </Section>

      {/* Occupations */}
      {stats.topOccupations.length > 0 && (
        <Section title="Occupations">
          <BarChart items={stats.topOccupations.map(([occ, count]) => ({ label: occ, value: count, link: `/people?occupationCategory=${encodeURIComponent(occ)}` }))} />
        </Section>
      )}

      {/* Immigration */}
      {stats.topImmigration.length > 0 && (
        <Section title={`Immigration (${stats.totalImmigrants} people)`}>
          <BarChart items={stats.topImmigration} />
        </Section>
      )}

      {/* Military */}
      {stats.totalMilitary > 0 && (
        <Section title={`Military Service (${stats.totalMilitary} people)`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {stats.topMilitaryBranches.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Branch</h3>
                <BarChart items={stats.topMilitaryBranches.map(([branch, count]) => ({
                  label: branch,
                  value: count,
                  link: `/people?militaryBranch=${encodeURIComponent(branch)}`,
                }))} />
              </div>
            )}
            {stats.topMilitaryConflicts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Conflict</h3>
                <BarChart items={stats.topMilitaryConflicts.map(([conflict, count]) => ({
                  label: conflict,
                  value: count,
                  link: `/people?militaryConflict=${encodeURIComponent(conflict)}`,
                }))} />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Religion */}
      {stats.topReligions.length > 0 && (
        <Section title="Religious Affiliation">
          <BarChart items={stats.topReligions.map(([r, count]) => ({ label: r, value: count, link: `/people?religion=${encodeURIComponent(r)}` }))} />
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
                  <Link to="/research-gaps" className="hover:no-underline">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium w-24 text-center block hover:opacity-80 ${confidenceColor(level)}`}>
                      {level}
                    </span>
                  </Link>
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
