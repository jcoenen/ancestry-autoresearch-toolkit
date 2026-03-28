import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Controls,
  Background,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { usePeople, formatYear } from '../useData'
import type { Person } from '../types'

/* ── Types ──────────────────────────────────────────────────── */

interface CoupleNode {
  person: Person
  spouse: Person | null
  marriageDate: string
  children: Person[]
  fatherNode: CoupleNode | null
  motherNode: CoupleNode | null
  generation: number
}

interface CoupleCardData {
  person: Person
  spouse: Person | null
  marriageDate: string
  children: Person[]
  isDirect: boolean
  personGender: 'M' | 'F' | null
  spouseGender: 'M' | 'F' | null
  [key: string]: unknown
}

/* ── Gender inference ────────────────────────────────────────── */

export function buildGenderMap(people: Person[]): Map<string, 'M' | 'F'> {
  const map = new Map<string, 'M' | 'F'>()
  for (const p of people) {
    if (p.father) map.set(p.father, 'M')
    if (p.mother) map.set(p.mother, 'F')
  }
  return map
}

/* ── Shared avatar ───────────────────────────────────────────── */

function PersonAvatar({ name, gender, size = 'sm' }: { name: string; gender: 'M' | 'F' | null; size?: 'sm' | 'md' }) {
  const initial = name.charAt(0).toUpperCase()
  const bg = gender === 'M' ? 'bg-blue-100 text-blue-600'
    : gender === 'F' ? 'bg-pink-100 text-pink-600'
    : 'bg-stone-100 text-stone-500'
  const sizeClass = size === 'md' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${bg} ${sizeClass}`}>
      {initial}
    </span>
  )
}

/* ════════════════════════════════════════════════════════════════
   LANDSCAPE PEDIGREE — Expanding tree (FamilySearch model)

   The tree starts with the focus person + 3 generations of ancestors.
   Clicking > on an edge card expands that person's parents IN PLACE.
   Nothing re-centers. The tree just grows. Scroll to navigate.
   ════════════════════════════════════════════════════════════════ */

const CARD_W = 250

/** Resolve children of a couple from both children[] arrays and father/mother back-links */
function resolveChildren(focusPerson: Person, focusSpouse: Person | null, people: Person[]): Person[] {
  const childIdSet = new Set<string>()
  const allChildRefs = [...focusPerson.children, ...(focusSpouse?.children || [])]
  for (const ref of allChildRefs) {
    if (ref.id && ref.id !== focusPerson.id) childIdSet.add(ref.id)
  }
  for (const p of people) {
    if (p.id === focusPerson.id) continue
    if (p.father === focusPerson.id || p.mother === focusPerson.id) childIdSet.add(p.id)
    if (focusSpouse?.id && (p.father === focusSpouse.id || p.mother === focusSpouse.id)) childIdSet.add(p.id)
  }
  const result: Person[] = []
  for (const id of childIdSet) {
    const real = people.find(p => p.id === id)
    if (real) { result.push(real); continue }
    const ref = allChildRefs.find(r => r.id === id)
    if (ref) {
      result.push({
        id, name: ref.name || 'Unknown', born: '', died: '', family: '',
        privacy: false, confidence: 'stub', sources: [], media: [],
        filePath: '', slug: '', father: '', fatherName: '', mother: '', motherName: '',
        spouses: [], children: [], biography: '', birthDateAnalysis: '', birthplace: '', deathPlace: '',
        burial: '', religion: '', occupation: '',
      })
    }
  }
  return result.sort((a, b) => (a.born || '').localeCompare(b.born || ''))
}

/** Collect IDs to auto-expand (3 generations deep from a person) */
function collectInitialExpanded(personId: string, people: Person[], depth: number, maxDepth: number, out: Set<string>) {
  if (depth > maxDepth) return
  const person = people.find(p => p.id === personId)
  if (!person) return
  out.add(personId)
  if (person.father) collectInitialExpanded(person.father, people, depth + 1, maxDepth, out)
  if (person.mother) collectInitialExpanded(person.mother, people, depth + 1, maxDepth, out)
  // Also expand spouse's ancestry
  const sp = person.spouses[0]
  if (sp?.id) {
    out.add(sp.id)
    const spouse = people.find(p => p.id === sp.id)
    if (spouse) {
      if (spouse.father) collectInitialExpanded(spouse.father, people, depth + 1, maxDepth, out)
      if (spouse.mother) collectInitialExpanded(spouse.mother, people, depth + 1, maxDepth, out)
    }
  }
}

function CoupleCard({
  person, spouse, marriageDate, genderMap, isFocus, childrenList, width,
  canExpand, onExpand,
}: {
  person: Person | null
  spouse: Person | null
  marriageDate: string
  genderMap: Map<string, 'M' | 'F'>
  isFocus?: boolean
  childrenList?: Person[]
  width?: number | string
  canExpand?: boolean
  onExpand?: () => void
}) {
  const [showChildren, setShowChildren] = useState(false)

  if (!person && !spouse) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center"
        style={{ width: width ?? CARD_W, minHeight: 80 }}>
        <span className="text-sm text-stone-400 p-4">Unknown</span>
      </div>
    )
  }

  const primary = person || spouse!
  const secondary = person && spouse ? spouse : null
  const primaryYears = primary.privacy ? '' : `${formatYear(primary.born)}\u2013${formatYear(primary.died)}`
  const secondaryYears = secondary ? (secondary.privacy ? '' : `${formatYear(secondary.born)}\u2013${formatYear(secondary.died)}`) : ''

  const cardEl = (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isFocus ? 'border-2 border-amber-400 shadow-md' : 'border-stone-200'
      }`}
      style={{ width: width ?? CARD_W }}
    >
      <div className="p-3 pb-2">
        <div className="flex items-start gap-2">
          <PersonAvatar name={primary.name} gender={genderMap.get(primary.id) || null} />
          <div className="min-w-0 flex-1">
            <Link to={`/people/${primary.slug}`}
              className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
              {primary.name}
            </Link>
            {primaryYears && <div className="text-xs text-stone-500 mt-0.5">{primaryYears}</div>}
          </div>
        </div>

        {marriageDate && (
          <div className="text-xs text-stone-400 mt-1.5 ml-8">Marriage: {marriageDate}</div>
        )}

        {secondary && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={secondary.name} gender={genderMap.get(secondary.id) || null} />
            <div className="min-w-0 flex-1">
              <Link to={`/people/${secondary.slug}`}
                className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
                {secondary.name}
              </Link>
              {secondaryYears && <div className="text-xs text-stone-500 mt-0.5">{secondaryYears}</div>}
            </div>
          </div>
        )}

        {!secondary && primary.spouses.length > 0 && primary.spouses[0].name && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={primary.spouses[0].name} gender={null} />
            <span className="text-sm text-stone-500 leading-tight">{primary.spouses[0].name}</span>
          </div>
        )}
      </div>

      {childrenList && childrenList.length > 0 && (
        <div className="border-t border-stone-100">
          <button onClick={() => setShowChildren(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-stone-600 font-medium hover:bg-stone-50 transition-colors">
            <span>Children ({childrenList.length})</span>
            <svg className={`w-4 h-4 text-stone-400 transition-transform ${showChildren ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showChildren && (
            <div className="px-3 pb-2">
              {childrenList.map((child, i) => {
                const yrs = child.privacy ? '' : `${formatYear(child.born)}\u2013${formatYear(child.died)}`
                return (
                  <div key={child.id} className="flex items-center gap-2 py-0.5">
                    <span className="text-stone-300 text-xs w-4 text-center shrink-0">
                      {i === childrenList.length - 1 ? '\u2514' : '\u251C'}
                    </span>
                    {child.slug ? (
                      <Link to={`/people/${child.slug}`} className="text-sm text-stone-700 hover:underline truncate">{child.name}</Link>
                    ) : (
                      <span className="text-sm text-stone-500 truncate">{child.name}</span>
                    )}
                    {yrs && <span className="text-xs text-stone-400 shrink-0">{yrs}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (canExpand && onExpand) {
    return (
      <div className="flex items-center">
        {cardEl}
        <button onClick={onExpand}
          className="-ml-1 w-8 h-8 flex items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm hover:bg-amber-50 hover:border-amber-300 text-stone-400 hover:text-amber-700 transition-all shrink-0 z-10"
          title="Show parents">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return cardEl
}

/* ── Tree connector lines ───────────────────────────────────── */

function TreeFork({ top, bottom }: { top: React.ReactNode; bottom: React.ReactNode }) {
  return (
    <div className="flex flex-col shrink-0">
      <div className="flex-1 flex">
        <div className="w-6 shrink-0 relative">
          <div className="absolute left-0 top-1/2 bottom-0 border-l-2 border-stone-300" />
          <div className="absolute left-0 top-1/2 right-0 border-t-2 border-stone-300 -translate-y-px" />
        </div>
        <div className="py-1">{top}</div>
      </div>
      <div className="flex-1 flex">
        <div className="w-6 shrink-0 relative">
          <div className="absolute left-0 top-0 bottom-1/2 border-l-2 border-stone-300" />
          <div className="absolute left-0 top-1/2 right-0 border-t-2 border-stone-300 -translate-y-px" />
        </div>
        <div className="py-1">{bottom}</div>
      </div>
    </div>
  )
}

function HLine() {
  return <div className="w-6 border-t-2 border-stone-300 self-center shrink-0" />
}

/* ── Expanding ancestor branch — the core of the FamilySearch model ── */

function ExpandingBranch({
  fatherId, motherId, people, genderMap, expanded, onToggleExpand,
}: {
  fatherId: string | null
  motherId: string | null
  people: Person[]
  genderMap: Map<string, 'M' | 'F'>
  expanded: Set<string>
  onToggleExpand: (id: string) => void
}) {
  const father = fatherId ? people.find(p => p.id === fatherId) || null : null
  const mother = motherId ? people.find(p => p.id === motherId) || null : null

  if (!father && !mother) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center"
        style={{ width: CARD_W, minHeight: 80 }}>
        <span className="text-sm text-stone-400 p-4">Unknown</span>
      </div>
    )
  }

  const primary = father || mother!
  const marriageDate = father?.spouses.find(s => s.id === mother?.id)?.marriageDate
    || mother?.spouses.find(s => s.id === father?.id)?.marriageDate || ''

  const hasFatherParents = !!(father?.father || father?.mother)
  const hasMotherParents = !!(mother?.father || mother?.mother)
  const isExpanded = expanded.has(primary.id)
  const canExpand = (hasFatherParents || hasMotherParents) && !isExpanded

  const coupleChildren = resolveChildren(primary, father && mother ? mother : null, people)

  const card = (
    <CoupleCard
      person={father} spouse={mother} marriageDate={marriageDate}
      genderMap={genderMap} canExpand={canExpand}
      onExpand={canExpand ? () => onToggleExpand(primary.id) : undefined}
      childrenList={coupleChildren}
    />
  )

  // Not expanded yet — just show the card (with > button if expandable)
  if (!isExpanded || (!hasFatherParents && !hasMotherParents)) return card

  // Expanded — show card + fork to parent branches (which are themselves expanding)
  const topBranch = hasFatherParents ? (
    <ExpandingBranch
      fatherId={father?.father || null} motherId={father?.mother || null}
      people={people} genderMap={genderMap} expanded={expanded} onToggleExpand={onToggleExpand}
    />
  ) : (
    <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center"
      style={{ width: CARD_W, minHeight: 80 }}>
      <span className="text-sm text-stone-400 p-4">Unknown</span>
    </div>
  )

  const bottomBranch = hasMotherParents ? (
    <ExpandingBranch
      fatherId={mother?.father || null} motherId={mother?.mother || null}
      people={people} genderMap={genderMap} expanded={expanded} onToggleExpand={onToggleExpand}
    />
  ) : (
    <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center"
      style={{ width: CARD_W, minHeight: 80 }}>
      <span className="text-sm text-stone-400 p-4">Unknown</span>
    </div>
  )

  return (
    <div className="flex items-center">
      {card}
      <HLine />
      <TreeFork top={topBranch} bottom={bottomBranch} />
    </div>
  )
}

/* ── Mobile person card ─────────────────────────────────────── */

function MobilePersonCard({
  person, genderMap, onNavigate, label,
}: {
  person: Person
  genderMap: Map<string, 'M' | 'F'>
  onNavigate: (id: string) => void
  label?: string
}) {
  const years = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  return (
    <button onClick={() => onNavigate(person.id)}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all text-left">
      <PersonAvatar name={person.name} gender={genderMap.get(person.id) || null} size="md" />
      <div className="min-w-0 flex-1">
        {label && <div className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</div>}
        <div className="text-base font-medium text-stone-800">{person.name}</div>
        {years && <div className="text-sm text-stone-500">{years}</div>}
      </div>
      <svg className="w-5 h-5 text-stone-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

/* ── Landscape Pedigree (main view) ──────────────────────────── */

export function LandscapePedigree({
  focusId, people, genderMap, onNavigate, initialExpandDepth = 3,
}: {
  focusId: string
  people: Person[]
  genderMap: Map<string, 'M' | 'F'>
  onNavigate: (id: string) => void
  initialExpandDepth?: number
}) {
  const focusPerson = people.find(p => p.id === focusId)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Track which nodes are expanded — start with N generations auto-expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (focusPerson) {
      initial.add(focusPerson.id)
      collectInitialExpanded(focusPerson.id, people, 0, initialExpandDepth, initial)
    }
    return initial
  })

  // Auto-scroll right when tree expands
  const prevExpandedSize = useRef(expanded.size)
  useEffect(() => {
    if (expanded.size > prevExpandedSize.current) {
      const el = scrollContainerRef.current
      if (el) {
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
      }
    }
    prevExpandedSize.current = expanded.size
  }, [expanded.size])

  const handleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  if (!focusPerson) {
    return <div className="text-center py-12 text-stone-500">Person not found in tree data.</div>
  }

  const spouseRef = focusPerson.spouses.length > 0 ? focusPerson.spouses[0] : null
  const focusSpouse = spouseRef?.id ? people.find(p => p.id === spouseRef.id) || null : null
  const marriageDate = spouseRef?.marriageDate || ''

  const children = resolveChildren(focusPerson, focusSpouse, people)

  const hasFocusParents = !!(focusPerson.father || focusPerson.mother)
  const hasSpouseParents = !!(focusSpouse?.father || focusSpouse?.mother)
  const focusFather = focusPerson.father ? people.find(p => p.id === focusPerson.father) || null : null
  const focusMother = focusPerson.mother ? people.find(p => p.id === focusPerson.mother) || null : null
  const spouseFather = focusSpouse?.father ? people.find(p => p.id === focusSpouse.father) || null : null
  const spouseMother = focusSpouse?.mother ? people.find(p => p.id === focusSpouse.mother) || null : null

  return (
    <div>
      {/* ── Desktop: expanding tree on scrollable canvas ── */}
      <div ref={scrollContainerRef} className="hidden lg:block overflow-x-auto pb-4">
        <div className="flex items-center min-w-max py-4 px-2">
          {/* Children / Siblings column */}
          {children.length > 0 && (
            <>
              <div className="flex flex-col shrink-0">
                {children.map((child, i) => {
                  const yrs = child.privacy ? '' : `${formatYear(child.born)}\u2013${formatYear(child.died)}`
                  const sp = child.spouses.length > 0 ? people.find(p => p.id === child.spouses[0].id) : null
                  return (
                    <div key={child.id} className="flex">
                      <button onClick={() => onNavigate(child.id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all text-left group my-0.5"
                        style={{ width: 210 }}>
                        <svg className="w-4 h-4 text-stone-300 group-hover:text-amber-500 shrink-0 transition-colors"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        <PersonAvatar name={child.name} gender={genderMap.get(child.id) || null} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-stone-800 truncate">{child.name}</div>
                          <div className="text-xs text-stone-400">
                            {yrs}
                            {sp && <span className="ml-1">+ {sp.name.split(' ')[0]}</span>}
                          </div>
                        </div>
                      </button>
                      <div className="w-5 shrink-0 relative">
                        {i < children.length - 1 && (
                          <div className="absolute right-0 top-1/2 bottom-0 border-r-2 border-stone-300" />
                        )}
                        {i > 0 && (
                          <div className="absolute right-0 top-0 bottom-1/2 border-r-2 border-stone-300" />
                        )}
                        <div className="absolute left-0 top-1/2 right-0 border-t-2 border-stone-300 -translate-y-px" />
                      </div>
                    </div>
                  )
                })}
              </div>
              <HLine />
            </>
          )}

          {/* Focus couple card */}
          <div className="shrink-0">
            <CoupleCard
              person={focusPerson} spouse={focusSpouse} marriageDate={marriageDate}
              genderMap={genderMap} isFocus childrenList={children}
            />
          </div>

          {/* Expanding ancestor tree */}
          {(hasFocusParents || hasSpouseParents) && (
            <div className="flex items-center shrink-0">
              <HLine />
              {hasFocusParents && hasSpouseParents ? (
                <TreeFork
                  top={
                    <ExpandingBranch
                      fatherId={focusPerson.father || null} motherId={focusPerson.mother || null}
                      people={people} genderMap={genderMap}
                      expanded={expanded} onToggleExpand={handleExpand}
                    />
                  }
                  bottom={
                    <ExpandingBranch
                      fatherId={focusSpouse!.father || null} motherId={focusSpouse!.mother || null}
                      people={people} genderMap={genderMap}
                      expanded={expanded} onToggleExpand={handleExpand}
                    />
                  }
                />
              ) : hasFocusParents ? (
                <ExpandingBranch
                  fatherId={focusPerson.father || null} motherId={focusPerson.mother || null}
                  people={people} genderMap={genderMap}
                  expanded={expanded} onToggleExpand={handleExpand}
                />
              ) : (
                <ExpandingBranch
                  fatherId={focusSpouse!.father || null} motherId={focusSpouse!.mother || null}
                  people={people} genderMap={genderMap}
                  expanded={expanded} onToggleExpand={handleExpand}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────── */}
      <div className="lg:hidden space-y-6 py-4">
        <CoupleCard
          person={focusPerson} spouse={focusSpouse} marriageDate={marriageDate}
          genderMap={genderMap} isFocus childrenList={children} width="100%"
        />
        {hasFocusParents && (
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-blue-400" />
              {focusPerson.name.split(' ')[0]}&rsquo;s Parents
            </h3>
            <div className="space-y-2">
              {focusFather && <MobilePersonCard person={focusFather} genderMap={genderMap} onNavigate={onNavigate} label="Father" />}
              {focusMother && <MobilePersonCard person={focusMother} genderMap={genderMap} onNavigate={onNavigate} label="Mother" />}
            </div>
          </div>
        )}
        {hasSpouseParents && focusSpouse && (
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-pink-400" />
              {focusSpouse.name.split(' ')[0]}&rsquo;s Parents
            </h3>
            <div className="space-y-2">
              {spouseFather && <MobilePersonCard person={spouseFather} genderMap={genderMap} onNavigate={onNavigate} label="Father" />}
              {spouseMother && <MobilePersonCard person={spouseMother} genderMap={genderMap} onNavigate={onNavigate} label="Mother" />}
            </div>
          </div>
        )}
        {children.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Children</h3>
            <div className="space-y-2">
              {children.map(child => (
                <MobilePersonCard key={child.id} person={child} genderMap={genderMap} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   FULL PEDIGREE (React Flow — existing)
   ════════════════════════════════════════════════════════════════ */

function buildCoupleNode(
  people: Person[], fatherId: string, motherId: string,
  generation: number, maxGen: number,
): CoupleNode | null {
  if (generation > maxGen) return null
  const father = fatherId ? people.find(p => p.id === fatherId) : null
  const mother = motherId ? people.find(p => p.id === motherId) : null
  const primary = father || mother
  if (!primary) return null

  const spouse = father && mother ? mother : null
  const marriageDate = primary.spouses.find(s => s.id === spouse?.id)?.marriageDate
    || spouse?.spouses.find(s => s.id === primary.id)?.marriageDate || ''

  const children = people
    .filter(p => {
      if (father && mother) return p.father === father.id || p.mother === mother.id
      if (father) return p.father === father.id
      return p.mother === primary.id
    })
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const fatherNode = father ? buildCoupleNode(people, father.father, father.mother, generation + 1, maxGen) : null
  const motherNode = mother ? buildCoupleNode(people, mother.father, mother.mother, generation + 1, maxGen) : null

  return { person: primary, spouse, marriageDate, children, fatherNode, motherNode, generation }
}

function buildPedigreeFromRoot(people: Person[], rootId: string, maxGen: number): CoupleNode | null {
  const root = people.find(p => p.id === rootId)
  if (!root) return null

  const spouseRef = root.spouses.length > 0 ? root.spouses[0] : null
  const spouse = spouseRef ? people.find(p => p.id === spouseRef.id) || null : null

  const children = people
    .filter(p => p.father === root.id || p.mother === root.id ||
      (spouse && (p.father === spouse.id || p.mother === spouse.id)))
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const fatherNode = root.father || root.mother
    ? buildCoupleNode(people, root.father, root.mother, 1, maxGen) : null

  let motherNode: CoupleNode | null = null
  if (spouse && (spouse.father || spouse.mother)) {
    motherNode = buildCoupleNode(people, spouse.father, spouse.mother, 1, maxGen)
  }

  return { person: root, spouse, marriageDate: spouseRef?.marriageDate || '', children, fatherNode, motherNode, generation: 0 }
}

function flattenTree(
  node: CoupleNode, directLineIds: Set<string>, genderMap: Map<string, 'M' | 'F'>,
  nodes: Node<CoupleCardData>[], edges: Edge[], visited: Set<string>,
) {
  const nodeId = `node-${node.person.id}`
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  nodes.push({
    id: nodeId, type: 'coupleCard',
    data: {
      person: node.person, spouse: node.spouse, marriageDate: node.marriageDate,
      children: node.children, isDirect: directLineIds.has(node.person.id),
      personGender: genderMap.get(node.person.id) || null,
      spouseGender: node.spouse ? (genderMap.get(node.spouse.id) || null) : null,
    },
    position: { x: 0, y: 0 },
  })

  if (node.fatherNode) {
    edges.push({
      id: `edge-${node.person.id}-father`, source: nodeId,
      target: `node-${node.fatherNode.person.id}`, type: 'smoothstep',
      style: { stroke: '#3b82f6', strokeWidth: 2 },
    })
    flattenTree(node.fatherNode, directLineIds, genderMap, nodes, edges, visited)
  }

  if (node.motherNode) {
    edges.push({
      id: `edge-${node.person.id}-mother`, source: nodeId,
      target: `node-${node.motherNode.person.id}`, type: 'smoothstep',
      style: { stroke: '#ec4899', strokeWidth: 2 },
    })
    flattenTree(node.motherNode, directLineIds, genderMap, nodes, edges, visited)
  }
}

const NODE_WIDTH = 260
const NODE_HEIGHT = 180

function applyDagreLayout(nodes: Node<CoupleCardData>[], edges: Edge[]): Node<CoupleCardData>[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 250 })
  nodes.forEach(node => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(edge => g.setEdge(edge.source, edge.target))
  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
  })
}

function CoupleCardNode({ data }: NodeProps<Node<CoupleCardData>>) {
  const { person, spouse, marriageDate, children, isDirect, personGender, spouseGender } = data
  const [showChildren, setShowChildren] = useState(false)

  const personYears = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  const spouseYears = spouse ? (spouse.privacy ? '' : `${formatYear(spouse.born)}\u2013${formatYear(spouse.died)}`) : ''

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        isDirect ? 'border-l-4 border-l-amber-400 border-t border-r border-b border-stone-200' : 'border-stone-200'
      }`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-stone-300 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-stone-300 !w-2 !h-2" />

      <div className="p-3 pb-2">
        <div className="flex items-start gap-2">
          <PersonAvatar name={person.name} gender={personGender} />
          <div className="min-w-0">
            <Link to={`/people/${person.slug}`}
              className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
              {person.name}
            </Link>
            {personYears && <div className="text-xs text-stone-500 mt-0.5">{personYears}</div>}
          </div>
        </div>

        {marriageDate && (
          <div className="text-xs text-stone-500 mt-1.5 ml-8">Marriage: {marriageDate}</div>
        )}

        {spouse && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={spouse.name} gender={spouseGender} />
            <div className="min-w-0">
              <Link to={`/people/${spouse.slug}`}
                className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
                {spouse.name}
              </Link>
              {spouseYears && <div className="text-xs text-stone-500 mt-0.5">{spouseYears}</div>}
            </div>
          </div>
        )}

        {!spouse && person.spouses.length > 0 && person.spouses[0].name && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={person.spouses[0].name} gender={null} />
            <span className="text-sm text-stone-600 leading-tight">{person.spouses[0].name}</span>
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div className="border-t border-stone-100">
          <button onClick={() => setShowChildren(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-stone-600 font-medium hover:bg-stone-50 transition-colors">
            <span>Children ({children.length})</span>
            <svg className={`w-4 h-4 text-stone-400 transition-transform ${showChildren ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showChildren && (
            <div className="px-3 pb-2">
              {children.map((child, i) => {
                const childYears = child.privacy ? '' : `${formatYear(child.born)}\u2013${formatYear(child.died)}`
                return (
                  <div key={child.id} className="flex items-center gap-2 py-0.5">
                    <span className="text-stone-300 text-xs w-4 text-center shrink-0">
                      {i === children.length - 1 ? '\u2514' : '\u251C'}
                    </span>
                    <Link to={`/people/${child.slug}`}
                      className="text-sm text-stone-700 hover:underline truncate">
                      {child.name}
                    </Link>
                    {childYears && <span className="text-xs text-stone-400 shrink-0">{childYears}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const nodeTypes = { coupleCard: CoupleCardNode }

/* ════════════════════════════════════════════════════════════════
   DESCENDANT TREE (existing)
   ════════════════════════════════════════════════════════════════ */

function DescendantNode({ person, people, depth = 0, directLineIds }: {
  person: Person; people: Person[]; depth?: number; directLineIds: Set<string>
}) {
  const children = people.filter(p => p.father === person.id || p.mother === person.id)
  const [open, setOpen] = useState(depth < 3 || children.some(c => directLineIds.has(c.id)))
  const isDirect = directLineIds.has(person.id)
  const years = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  const spouseInfo = person.spouses.length > 0 ? person.spouses[0] : null
  const spouse = spouseInfo ? people.find(p => p.id === spouseInfo.id) : null

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-stone-200 pl-4' : ''}`}>
      <div className="flex items-center gap-2 py-1.5">
        {children.length > 0 ? (
          <button onClick={() => setOpen(!open)}
            className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0">
            <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 h-5 flex items-center justify-center text-stone-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          </span>
        )}
        <Link to={`/people/${person.slug}`}
          className={`font-medium text-sm hover:underline ${isDirect ? 'text-amber-700' : 'text-stone-800'}`}>
          {person.name}
        </Link>
        {years && <span className="text-xs text-stone-400">{years}</span>}
        {spouse && (
          <span className="text-xs text-stone-400">
            + <Link to={`/people/${spouse.slug}`} className="hover:underline">{spouse.name}</Link>
          </span>
        )}
        {!spouse && spouseInfo && <span className="text-xs text-stone-400">+ {spouseInfo.name}</span>}
        {children.length > 0 && !open && (
          <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{children.length}</span>
        )}
      </div>
      {open && children.length > 0 && (
        <div>
          {children.sort((a, b) => (a.born || '').localeCompare(b.born || '')).map(child => (
            <DescendantNode key={child.id} person={child} people={people}
              depth={depth + 1} directLineIds={directLineIds} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN TREE VIEW
   ════════════════════════════════════════════════════════════════ */

export default function TreeView() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const people = usePeople()
  const [view, setView] = useState<'landscape' | 'pedigree' | 'descendants'>('landscape')

  const focusId = personId || 'I1'
  const focusPerson = people.find(p => p.id === focusId)

  const handleNavigate = useCallback((id: string) => {
    navigate(`/tree/${id}`)
  }, [navigate])

  const genderMap = useMemo(() => buildGenderMap(people), [people])

  const directLineIds = useMemo(() => {
    const ids = new Set<string>()
    function walkUp(pid: string) {
      const person = people.find(p => p.id === pid)
      if (!person || ids.has(person.id)) return
      ids.add(person.id)
      if (person.father) walkUp(person.father)
      if (person.mother) walkUp(person.mother)
    }
    const root = people.find(p => p.id === 'I1')
    if (root) {
      ids.add(root.id)
      if (root.father) walkUp(root.father)
      if (root.mother) walkUp(root.mother)
      const spouseRef = root.spouses.length > 0 ? root.spouses[0] : null
      const spouse = spouseRef ? people.find(p => p.id === spouseRef.id) : null
      if (spouse) {
        ids.add(spouse.id)
        if (spouse.father) walkUp(spouse.father)
        if (spouse.mother) walkUp(spouse.mother)
      }
    }
    return ids
  }, [people])

  const patrilinealIds = useMemo(() => {
    const ids = new Set<string>()
    let current = people.find(p => p.id === 'I1')
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      ids.add(current.id)
      current = current.father ? people.find(p => p.id === current!.father) : undefined
    }
    return ids
  }, [people])

  const extendedLine = useMemo(() => {
    const line: Person[] = []
    let current = people.find(p => p.id === 'I1')
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      line.push(current)
      current = current.father ? people.find(p => p.id === current!.father) : undefined
    }
    return line
  }, [people])

  const { layoutNodes, edges } = useMemo(() => {
    const tree = buildPedigreeFromRoot(people, 'I1', 8)
    if (!tree) return { layoutNodes: [], edges: [] }
    const nodes: Node<CoupleCardData>[] = []
    const edgeList: Edge[] = []
    flattenTree(tree, directLineIds, genderMap, nodes, edgeList, new Set())
    const positioned = applyDagreLayout(nodes, edgeList)
    return { layoutNodes: positioned, edges: edgeList }
  }, [people, directLineIds, genderMap])

  const oldest = extendedLine.length > 0 ? extendedLine[extendedLine.length - 1] : null

  const viewLabels: Record<string, string> = {
    landscape: 'Landscape',
    pedigree: 'Full Pedigree',
    descendants: 'Descendant Tree',
  }

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto mb-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Family Tree</h1>
          {view === 'landscape' && focusPerson ? (
            <p className="mt-1 text-stone-500">
              Viewing: <span className="font-medium text-stone-700">{focusPerson.name}</span>
              {focusId !== 'I1' && (
                <button onClick={() => handleNavigate('I1')}
                  className="ml-3 text-sm text-amber-700 hover:text-amber-900 hover:underline">
                  Back to Jeremy
                </button>
              )}
              <span className="ml-4 text-xs">
                <span className="inline-block w-3 h-0.5 bg-blue-400 mr-1 align-middle" />paternal
                <span className="inline-block w-3 h-0.5 bg-pink-400 ml-3 mr-1 align-middle" />maternal
              </span>
            </p>
          ) : (
            <p className="mt-2 text-stone-500">
              {extendedLine.length} generations from Jeremy to {oldest?.name || 'unknown'} ({formatYear(oldest?.born || '')}).
              <span className="ml-2 text-xs">
                <span className="inline-block w-3 h-0.5 bg-blue-500 mr-1 align-middle" />paternal
                <span className="inline-block w-3 h-0.5 bg-pink-500 ml-3 mr-1 align-middle" />maternal
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {(['landscape', 'pedigree', 'descendants'] as const).map(v => (
            <button key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === v ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}>
              {viewLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {view === 'landscape' && (
        <LandscapePedigree focusId={focusId} people={people} genderMap={genderMap} onNavigate={handleNavigate} />
      )}

      {view === 'pedigree' && (
        <div style={{ width: '100%', height: '75vh' }} className="border rounded-lg bg-stone-50">
          <ReactFlow
            nodes={layoutNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls />
            <Background gap={20} size={1} color="#e7e5e4" />
          </ReactFlow>
        </div>
      )}

      {view === 'descendants' && oldest && (
        <div className="max-w-4xl mx-auto">
          <div className="rounded-lg border border-stone-200 bg-white p-6">
            <DescendantNode person={oldest} people={people} directLineIds={patrilinealIds} />
          </div>
        </div>
      )}

    </div>
  )
}
