import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { findRelationship } from '../relationshipCalculator'
import { formatYear, usePeople, useSiteConfig } from '../useData'
import type { Person } from '../types'

function buildGenderMap(people: Person[]): Map<string, 'M' | 'F'> {
  const map = new Map<string, 'M' | 'F'>()
  for (const p of people) {
    if (p.gender === 'M' || p.gender === 'F') map.set(p.id, p.gender)
  }
  return map
}

function personYears(person: Person): string {
  if (person.privacy) return ''
  const born = formatYear(person.born)
  const died = formatYear(person.died)
  if (born === '?' && died === '?') return ''
  return `${born}-${died}`
}

export default function ConnectionBreadcrumbs({
  targetPersonIds,
  eyebrow = 'Family connection',
  className = '',
}: {
  targetPersonIds: string[]
  eyebrow?: string
  className?: string
}) {
  const people = usePeople()
  const config = useSiteConfig()

  const connection = useMemo(() => {
    const root = people.find(p => p.id === config.rootPersonId)
    if (!root) return null

    const genderMap = buildGenderMap(people)
    const uniqueTargets = [...new Set(targetPersonIds.filter(Boolean))]
      .map(id => people.find(p => p.id === id))
      .filter((p): p is Person => !!p)

    if (uniqueTargets.length === 0) return null
    if (uniqueTargets.some(p => p.id === root.id)) {
      return { root, target: root, relationshipName: 'Root person', path: [{ person: root, label: '' }] }
    }

    const options = uniqueTargets
      .map(target => {
        const result = findRelationship(root.id, target.id, people, genderMap)
        return result ? { root, target, relationshipName: result.name, path: result.path } : null
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.path.length - b.path.length)

    return options[0] || { root, target: uniqueTargets[0], relationshipName: '', path: [] }
  }, [people, config.rootPersonId, targetPersonIds])

  if (!connection) return null

  const hasPath = connection.path.length > 0
  const targetYears = personYears(connection.target)

  return (
    <section className={`print-hide mb-6 ${className}`}>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{eyebrow}</div>
            <div className="mt-1 text-sm text-stone-700">
              <span className="text-stone-500">Closest path from </span>
              <Link to={`/people/${connection.root.slug}`} className="font-medium text-stone-800 hover:text-amber-700">
                {connection.root.name}
              </Link>
              <span className="text-stone-500"> to </span>
              <Link to={`/people/${connection.target.slug}`} className="font-medium text-stone-800 hover:text-amber-700">
                {connection.target.name}
              </Link>
              {targetYears && <span className="text-stone-400"> ({targetYears})</span>}
            </div>
          </div>
          {connection.relationshipName && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {connection.relationshipName}
            </span>
          )}
        </div>

        {hasPath ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {connection.path.map((step, i) => (
              <span key={`${step.person.id}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {step.label && <span className="italic">{step.label}</span>}
                  </span>
                )}
                <Link
                  to={`/people/${step.person.slug}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium hover:no-underline ${
                    i === 0 || i === connection.path.length - 1
                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {step.person.name}
                </Link>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            This person is linked in the published vault, but no direct relationship path from the configured root person was found.
          </p>
        )}
      </div>
    </section>
  )
}
