import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePeople, useData, extractYear, confidenceColor } from '../useData'
import { generateResearchPlan, SUGGESTIONS } from '../../scripts/lib/research-plan'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'
import type { Person, SourceEntry, MediaEntry } from '../types'
import type { GapData } from '../../scripts/lib/research-plan'

/* ── Helpers ──────────────────────────────────────────────────── */

function isMissing(value: string | undefined | null): boolean {
  if (!value) return true
  const v = value.trim()
  return v === '' || v === '—' || v === '-' || v === 'Unknown'
}

/** Count how many of the 6 key fields a person is missing */
function countMissingFields(p: Person): number {
  let missing = 0
  if (!extractYear(p.born)) missing++
  if (!extractYear(p.died)) missing++
  if (isMissing(p.birthplace)) missing++
  if (!p.biography || p.biography.trim() === '') missing++
  if (!p.father && !p.fatherName) missing++
  if (!p.mother && !p.motherName) missing++
  return missing
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

/* ── Progress bar ─────────────────────────────────────────────── */

function GapBar({ have, total, label }: { have: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((have / total) * 100) : 0
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-stone-600">{label}</span>
        <span className="text-sm text-stone-500 tabular-nums">{have} / {total} ({pct}%)</span>
      </div>
      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-600/80 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ── Collapsible section ──────────────────────────────────────── */

function Section({ title, count, defaultOpen = false, suggestions, children }: {
  title: string
  count: number
  defaultOpen?: boolean
  suggestions?: string[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-stone-200 bg-white px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-stone-800">{title}</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 tabular-nums">
            {count}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
          {suggestions && suggestions.length > 0 && count > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Where to look</h3>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-amber-700 flex gap-2">
                    <span className="shrink-0 mt-0.5">&#8227;</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {children}
        </div>
      )}
    </section>
  )
}

/* ── Person row ───────────────────────────────────────────────── */

function PersonRow({ person, detail }: { person: Person; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <Link to={`/people/${person.slug}`} className="text-sm font-medium text-amber-700 hover:text-amber-900 truncate">
          {person.name}
        </Link>
        <span className="text-xs text-stone-400 shrink-0">{person.family}</span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${confidenceColor(person.confidence)}`}>
          {person.confidence}
        </span>
      </div>
      {detail && <span className="text-xs text-stone-400 shrink-0 ml-2">{detail}</span>}
    </div>
  )
}

/* ── Source row ────────────────────────────────────────────────── */

function SourceRow({ source, detail }: { source: SourceEntry; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
      <Link to={`/sources/${source.slug}`} className="text-sm font-medium text-amber-700 hover:text-amber-900 truncate">
        {source.title || source.id}
      </Link>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {detail && <span className="text-xs text-stone-400">{detail}</span>}
        <span className="text-xs text-stone-400">{source.type?.replace(/_/g, ' ')}</span>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────── */

export default function ResearchGapsPage() {
  const people = usePeople()
  const { sources } = useData()
  const [copied, setCopied] = useState(false)
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())

  const families = useMemo(() => {
    const set = new Set(people.filter(p => !p.privacy).map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  const gaps = useMemo<GapData>(() => {
    const pub = people.filter(p => !p.privacy && (familyFilter.size === 0 || familyFilter.has(p.family)))
    const total = pub.length

    // Confidence
    const stubs = pub.filter(p => p.confidence === 'stub')
    const low = pub.filter(p => p.confidence === 'low')
    const stubAndLow = [...stubs, ...low]

    // Missing vitals
    const missingBorn = pub.filter(p => !extractYear(p.born))
    const missingDied = pub.filter(p => !extractYear(p.died))
    const missingBirthplace = pub.filter(p => isMissing(p.birthplace))
    const missingFather = pub.filter(p => !p.father && !p.fatherName)
    const missingMother = pub.filter(p => !p.mother && !p.motherName)
    const missingParents = pub.filter(p => (!p.father && !p.fatherName) || (!p.mother && !p.motherName))

    // No sources / no media
    const noSources = pub.filter(p => !p.sources || p.sources.length === 0)
    const noMedia = pub.filter(p => !p.media || p.media.length === 0)

    // Missing biography
    const noBio = pub.filter(p => !p.biography || p.biography.trim() === '')

    // Unverified OCR
    const unverifiedOcr = sources.filter(s => s.ocrVerified === false)

    // Untranslated non-English sources
    const untranslated = sources.filter(s =>
      s.language && s.language.toLowerCase() !== 'english' && s.language.toLowerCase() !== 'en' && !s.translationSlug
    )

    // Completeness score: for each person, count how many of 6 key fields are present
    const fields = ['born', 'died', 'birthplace', 'biography'] as const
    let filledCount = 0
    let totalFields = 0
    for (const p of pub) {
      for (const f of fields) {
        totalFields++
        if (f === 'born' || f === 'died') {
          if (extractYear(p[f])) filledCount++
        } else {
          if (!isMissing(p[f])) filledCount++
        }
      }
      // parents
      totalFields += 2
      if (p.father || p.fatherName) filledCount++
      if (p.mother || p.motherName) filledCount++
    }
    const completeness = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0

    // Document completeness — cross-reference person source IDs with source entries
    const sourceMap = new Map<string, SourceEntry>()
    for (const s of sources) sourceMap.set(s.id, s)

    function isPrimaryForPerson(s: SourceEntry, p: Person): boolean {
      if (s.subjectPersonIds?.length) return s.subjectPersonIds.includes(p.id)
      if (s.personIds?.length) return s.personIds.includes(p.id)
      return p.sources.includes(s.id)
    }
    function hasSourceType(p: Person, types: string[], primaryOnly = false): boolean {
      return p.sources.some(sid => {
        const s = sourceMap.get(sid)
        if (!s) return false
        const sourceTypes = [s.type, ...(s.recordTypes || [])]
        return s !== undefined && sourceTypes.some(t => types.includes(t)) && (
          !primaryOnly || isPrimaryForPerson(s, p)
        )
      })
    }
    function hasMediaType(p: Person, types: string[]): boolean {
      return (p.media as MediaEntry[]).some(m => types.includes(m.type))
    }

    const missingObituary = pub.filter(p => !hasSourceType(p, ['obituary'], true))
    const missingGravestone = pub.filter(p => !hasSourceType(p, ['cemetery', 'cemetery_memorial']) && !hasMediaType(p, ['gravestone', 'tombstone']))
    const missingDeathCert = pub.filter(p => !hasSourceType(p, ['death_certificate'], true))
    const missingBirthCert = pub.filter(p => !hasSourceType(p, ['birth_certificate'], true))
    const missingBaptism = pub.filter(p => !hasSourceType(p, ['baptism', 'church'], true))
    const missingMarriageCert = pub.filter(p => !hasSourceType(p, ['marriage_certificate', 'marriage']))
    const missingPhoto = pub.filter(p => !hasMediaType(p, ['photo', 'portrait']))

    return {
      total,
      stubAndLow, stubs, low,
      missingBorn, missingDied, missingBirthplace,
      missingFather, missingMother, missingParents,
      noSources, noMedia, noBio,
      unverifiedOcr, untranslated,
      completeness,
      missingObituary, missingGravestone, missingDeathCert,
      missingBirthCert, missingBaptism, missingMarriageCert, missingPhoto,
    }
  }, [people, sources])

  // Per-person prioritized view
  const prioritized = useMemo(() => {
    const pub = people.filter(p => !p.privacy && (familyFilter.size === 0 || familyFilter.has(p.family)))
    return pub
      .map(p => ({ person: p, missing: countMissingFields(p) }))
      .filter(e => e.missing > 0)
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 20)
  }, [people])

  const handleExport = useCallback(() => {
    const plan = generateResearchPlan(gaps)
    const blob = new Blob([plan], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-plan-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [gaps])

  const handleCopy = useCallback(async () => {
    const plan = generateResearchPlan(gaps)
    await navigator.clipboard.writeText(plan)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [gaps])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-3xl font-bold text-stone-800">Research Gaps</h1>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <FamilyFilterDropdown families={families} selected={familyFilter} onChange={setFamilyFilter} single />
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Plan'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Export Plan
          </button>
        </div>
      </div>
      <p className="text-stone-500 mb-8">
        What we don't know yet — use this to prioritize your next research session.
      </p>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="People" value={gaps.total} />
        <StatCard label="Completeness" value={`${gaps.completeness}%`} sub="of key fields filled" />
        <StatCard label="Stubs + Low" value={gaps.stubAndLow.length} sub="need more research" />
        <StatCard label="Unverified OCR" value={gaps.unverifiedOcr.length} sub="need manual review" />
      </div>

      {/* Progress overview */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Field Coverage</h2>
        <GapBar have={gaps.total - gaps.missingBorn.length} total={gaps.total} label="Birth dates" />
        <GapBar have={gaps.total - gaps.missingDied.length} total={gaps.total} label="Death dates" />
        <GapBar have={gaps.total - gaps.missingBirthplace.length} total={gaps.total} label="Birthplaces" />
        <GapBar have={gaps.total - gaps.missingParents.length} total={gaps.total} label="At least one parent" />
        <GapBar have={gaps.total - gaps.noSources.length} total={gaps.total} label="Has sources" />
        <GapBar have={gaps.total - gaps.noBio.length} total={gaps.total} label="Has biography" />
      </div>

      {/* Document coverage */}
      <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6 mb-8">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">Document Coverage</h2>
        <GapBar have={gaps.total - gaps.missingObituary.length} total={gaps.total} label="Obituary" />
        <GapBar have={gaps.total - gaps.missingGravestone.length} total={gaps.total} label="Gravestone record" />
        <GapBar have={gaps.total - gaps.missingDeathCert.length} total={gaps.total} label="Death certificate" />
        <GapBar have={gaps.total - gaps.missingBirthCert.length} total={gaps.total} label="Birth certificate" />
        <GapBar have={gaps.total - gaps.missingBaptism.length} total={gaps.total} label="Baptism / church record" />
        <GapBar have={gaps.total - gaps.missingMarriageCert.length} total={gaps.total} label="Marriage certificate" />
        <GapBar have={gaps.total - gaps.missingPhoto.length} total={gaps.total} label="Personal photo" />
      </div>

      {/* Priority research targets */}
      {prioritized.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5 sm:p-6 mb-8">
          <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wide mb-1">Priority Research Targets</h2>
          <p className="text-xs text-amber-600 mb-4">People with the most missing fields — best bang for your research buck.</p>
          {prioritized.map(({ person, missing }) => (
            <PersonRow key={person.id} person={person} detail={`${missing} of 6 fields missing`} />
          ))}
        </div>
      )}

      {/* Collapsible detail sections */}
      <Section title="Stub & Low Confidence" count={gaps.stubAndLow.length} defaultOpen suggestions={SUGGESTIONS.stubAndLow}>
        {gaps.stubAndLow.length === 0 ? (
          <p className="text-sm text-stone-500">No stub or low-confidence people. Nice!</p>
        ) : (
          <div>
            {gaps.stubs.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Stubs ({gaps.stubs.length})</h3>
                {gaps.stubs.map(p => <PersonRow key={p.id} person={p} />)}
              </>
            )}
            {gaps.low.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 mt-4">Low Confidence ({gaps.low.length})</h3>
                {gaps.low.map(p => <PersonRow key={p.id} person={p} />)}
              </>
            )}
          </div>
        )}
      </Section>

      <Section title="Missing Birth Dates" count={gaps.missingBorn.length} defaultOpen suggestions={SUGGESTIONS.missingBorn}>
        {gaps.missingBorn.length === 0 ? (
          <p className="text-sm text-stone-500">All people have birth dates.</p>
        ) : (
          gaps.missingBorn.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Death Dates" count={gaps.missingDied.length} defaultOpen suggestions={SUGGESTIONS.missingDied}>
        {gaps.missingDied.length === 0 ? (
          <p className="text-sm text-stone-500">All people have death dates.</p>
        ) : (
          gaps.missingDied.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Parents" count={gaps.missingParents.length} suggestions={SUGGESTIONS.missingParents}>
        {gaps.missingParents.length === 0 ? (
          <p className="text-sm text-stone-500">All people have at least one parent recorded.</p>
        ) : (
          gaps.missingParents.map(p => {
            const missing = []
            if (!p.father && !p.fatherName) missing.push('father')
            if (!p.mother && !p.motherName) missing.push('mother')
            return <PersonRow key={p.id} person={p} detail={`missing ${missing.join(' & ')}`} />
          })
        )}
      </Section>

      <Section title="No Sources Cited" count={gaps.noSources.length} suggestions={SUGGESTIONS.noSources}>
        {gaps.noSources.length === 0 ? (
          <p className="text-sm text-stone-500">All people have at least one source.</p>
        ) : (
          gaps.noSources.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="No Media" count={gaps.noMedia.length} suggestions={SUGGESTIONS.noMedia}>
        {gaps.noMedia.length === 0 ? (
          <p className="text-sm text-stone-500">All people have media attached.</p>
        ) : (
          gaps.noMedia.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Untranslated Sources" count={gaps.untranslated.length} suggestions={SUGGESTIONS.untranslated}>
        {gaps.untranslated.length === 0 ? (
          <p className="text-sm text-stone-500">All non-English sources have translations, or no sources have a language set.</p>
        ) : (
          <>
            <p className="text-xs text-stone-400 mb-3">
              Sources with a non-English language that don't have an associated translation file.
              Run <code className="bg-stone-100 px-1 rounded">npm run translations</code> to create stubs.
            </p>
            {gaps.untranslated.map(s => (
              <SourceRow key={s.id} source={s} detail={s.language} />
            ))}
          </>
        )}
      </Section>

      <Section title="Unverified OCR Sources" count={gaps.unverifiedOcr.length} suggestions={SUGGESTIONS.unverifiedOcr}>
        {gaps.unverifiedOcr.length === 0 ? (
          <p className="text-sm text-stone-500">All OCR sources have been manually verified.</p>
        ) : (
          <>
            <p className="text-xs text-stone-400 mb-3">These sources were OCR'd from images and need manual verification against the original.</p>
            {gaps.unverifiedOcr.map(s => <SourceRow key={s.id} source={s} />)}
          </>
        )}
      </Section>

      <Section title="Missing Biography" count={gaps.noBio.length} suggestions={SUGGESTIONS.noBio}>
        {gaps.noBio.length === 0 ? (
          <p className="text-sm text-stone-500">All people have biographies.</p>
        ) : (
          gaps.noBio.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Obituary" count={gaps.missingObituary.length} suggestions={SUGGESTIONS.missingObituary}>
        {gaps.missingObituary.length === 0 ? (
          <p className="text-sm text-stone-500">All people have an obituary source.</p>
        ) : (
          gaps.missingObituary.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Gravestone" count={gaps.missingGravestone.length} suggestions={SUGGESTIONS.missingGravestone}>
        {gaps.missingGravestone.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a gravestone record or photo.</p>
        ) : (
          gaps.missingGravestone.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Death Certificate" count={gaps.missingDeathCert.length} suggestions={SUGGESTIONS.missingDeathCert}>
        {gaps.missingDeathCert.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a death certificate source.</p>
        ) : (
          gaps.missingDeathCert.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Birth Certificate" count={gaps.missingBirthCert.length} suggestions={SUGGESTIONS.missingBirthCert}>
        {gaps.missingBirthCert.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a birth certificate source.</p>
        ) : (
          gaps.missingBirthCert.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Baptism / Church Record" count={gaps.missingBaptism.length} suggestions={SUGGESTIONS.missingBaptism}>
        {gaps.missingBaptism.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a baptism or church record source.</p>
        ) : (
          gaps.missingBaptism.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Marriage Certificate" count={gaps.missingMarriageCert.length} suggestions={SUGGESTIONS.missingMarriageCert}>
        {gaps.missingMarriageCert.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a marriage certificate source.</p>
        ) : (
          gaps.missingMarriageCert.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>

      <Section title="Missing Personal Photo" count={gaps.missingPhoto.length} suggestions={SUGGESTIONS.missingPhoto}>
        {gaps.missingPhoto.length === 0 ? (
          <p className="text-sm text-stone-500">All people have a personal photo.</p>
        ) : (
          gaps.missingPhoto.map(p => <PersonRow key={p.id} person={p} />)
        )}
      </Section>
    </div>
  )
}
