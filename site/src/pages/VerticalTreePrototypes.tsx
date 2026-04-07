import React, { useMemo, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow, Controls, Background,
  type Node, type Edge, type NodeProps,
  Handle, Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { usePeople, useSiteConfig, formatYear } from '../useData'
import type { Person } from '../types'
/* ── Gender inference ────────────────────────────────────────── */

export function buildGenderMap(people: Person[]): Map<string, 'M' | 'F'> {
  const map = new Map<string, 'M' | 'F'>()
  for (const p of people) {
    if (p.father) map.set(p.father, 'M')
    if (p.mother) map.set(p.mother, 'F')
  }
  for (const p of people) {
    if (p.gender === 'M' || p.gender === 'F') map.set(p.id, p.gender)
  }
  return map
}

/* ── Types ─────────────────────────────────────────────────── */

interface CoupleNode {
  person: Person
  spouse: Person | null
  marriageDate: string
  children: Person[]
  fatherNode: CoupleNode | null
  motherNode: CoupleNode | null
  generation: number
}

interface VNodeData {
  person: Person
  spouse: Person | null
  marriageDate: string
  children: Person[]
  isDirect: boolean
  personGender: 'M' | 'F' | null
  spouseGender: 'M' | 'F' | null
  [key: string]: unknown
}

/* ── Constants ─────────────────────────────────────────────── */

const VCARD_W = 220

/* ── Shared: Avatar ────────────────────────────────────────── */

function Avatar({ name, gender, size = 'sm' }: { name: string; gender: 'M' | 'F' | null; size?: 'sm' | 'md' }) {
  const bg = gender === 'M' ? 'bg-blue-100 text-blue-600'
    : gender === 'F' ? 'bg-pink-100 text-pink-600'
    : 'bg-stone-100 text-stone-500'
  const sz = size === 'md' ? 'w-7 h-7 text-xs' : 'w-5 h-5 text-[10px]'
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${bg} ${sz}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/* ── Shared: Compact card for vertical trees ───────────────── */

function VCard({
  person, spouse, genderMap, isFocus, canExpand, onExpand, onClick, width, childrenList,
}: {
  person: Person | null
  spouse?: Person | null
  genderMap: Map<string, 'M' | 'F'>
  isFocus?: boolean
  canExpand?: boolean
  onExpand?: () => void
  onClick?: () => void
  width?: number
  childrenList?: Person[]
}) {
  const [showChildren, setShowChildren] = useState(false)

  if (!person) {
    return (
      <div className="rounded-lg border-2 border-dashed border-stone-200 bg-stone-50/50 flex items-center justify-center"
        style={{ width: width ?? VCARD_W, minHeight: 48 }}>
        <span className="text-xs text-stone-400 p-2">Unknown</span>
      </div>
    )
  }

  const years = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`

  return (
    <div className="flex flex-col items-center">
      <div
        className={`rounded-lg border shadow-sm bg-white transition-shadow hover:shadow-md relative ${
          isFocus ? 'border-2 border-amber-400 ring-2 ring-amber-100' : 'border-stone-200'
        } ${onClick ? 'cursor-pointer hover:border-amber-300 active:bg-stone-50' : ''}`}
        style={{ width: width ?? VCARD_W }}
      >
        {/* Small profile link icon in corner when card is clickable for navigation */}
        {onClick && person.slug && (
          <Link to={`/people/${person.slug}`} onClick={e => e.stopPropagation()}
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-stone-300 hover:text-amber-600 hover:bg-amber-50 transition-colors z-10"
            title={`View ${person.name}'s profile`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </Link>
        )}
        <div className="p-2" onClick={onClick} role={onClick ? 'button' : undefined}>
          <div className="flex items-center gap-1.5">
            <Avatar name={person.name} gender={genderMap.get(person.id) || null} />
            <div className="min-w-0 flex-1">
              {onClick ? (
                <span className="font-semibold text-xs text-stone-800 block leading-tight">
                  {person.name}
                </span>
              ) : (
                <Link to={`/people/${person.slug}`}
                  className="font-semibold text-xs text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
                  {person.name}
                </Link>
              )}
              {years && <div className="text-[10px] text-stone-500 leading-tight">{years}</div>}
            </div>
          </div>
          {spouse && (
            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-stone-100">
              <Avatar name={spouse.name} gender={genderMap.get(spouse.id) || null} />
              <div className="min-w-0 flex-1">
                {onClick ? (
                  <span className="text-xs text-stone-600 block">
                    {spouse.name}
                  </span>
                ) : (
                  <Link to={`/people/${spouse.slug}`}
                    className="text-xs text-stone-600 hover:text-amber-700 hover:underline block">
                    {spouse.name}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
        {childrenList && childrenList.length > 0 && (
          <div className="border-t border-stone-100">
            <button onClick={(e) => { e.stopPropagation(); setShowChildren(prev => !prev) }}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-stone-500 font-medium hover:bg-stone-50 transition-colors">
              <span>Children ({childrenList.length})</span>
              <svg className={`w-3.5 h-3.5 text-stone-400 transition-transform ${showChildren ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showChildren && (
              <div className="px-2 pb-1.5">
                {childrenList.map((child, i) => {
                  const cYears = child.privacy ? '' : `${formatYear(child.born)}\u2013${formatYear(child.died)}`
                  return (
                    <div key={child.id} className="flex items-center gap-1.5 py-0.5">
                      <span className="text-stone-300 text-[10px] w-3 text-center shrink-0">
                        {i === childrenList.length - 1 ? '\u2514' : '\u251C'}
                      </span>
                      {child.slug ? (
                        <Link to={`/people/${child.slug}`}
                          className="text-[11px] text-stone-700 hover:text-amber-700 hover:underline truncate">
                          {child.name}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-stone-500 truncate">{child.name}</span>
                      )}
                      {cYears && <span className="text-[10px] text-stone-400 shrink-0">{cYears}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {canExpand && onExpand && (
        <button onClick={onExpand}
          className="-mt-1 w-7 h-7 flex items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm hover:bg-amber-50 hover:border-amber-300 text-stone-400 hover:text-amber-700 transition-all z-10 relative"
          title="Show parents">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ── Vertical connectors ──────────────────────────────────── */

function VStem({ height = 20 }: { height?: number }) {
  return <div className="bg-stone-300 shrink-0 mx-auto" style={{ width: 2, height }} />
}

function VFork({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex">
      <div className="flex flex-col items-center">
        <div className="self-stretch flex">
          <div className="w-1/2" />
          <div className="w-1/2 border-t-2 border-stone-300" />
        </div>
        <VStem />
        {left}
      </div>
      <div className="flex flex-col items-center">
        <div className="self-stretch flex">
          <div className="w-1/2 border-t-2 border-stone-300" />
          <div className="w-1/2" />
        </div>
        <VStem />
        {right}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   OPTION A: VERTICAL EXPANDING TREE
   Focus person at top, ancestors expand downward on click.
   Pure CSS flexbox — no libraries. Natural vertical scrolling.
   ════════════════════════════════════════════════════════════════ */

function collectExpanded(personId: string, people: Person[], depth: number, max: number, out: Set<string>) {
  if (depth > max) return
  const p = people.find(x => x.id === personId)
  if (!p) return
  out.add(personId)
  if (p.father) collectExpanded(p.father, people, depth + 1, max, out)
  if (p.mother) collectExpanded(p.mother, people, depth + 1, max, out)
}

function VExpandingBranch({
  fatherId, motherId, people, genderMap, expanded, onToggle,
}: {
  fatherId: string | null; motherId: string | null
  people: Person[]; genderMap: Map<string, 'M' | 'F'>
  expanded: Set<string>; onToggle: (id: string) => void
}) {
  const father = fatherId ? people.find(p => p.id === fatherId) || null : null
  const mother = motherId ? people.find(p => p.id === motherId) || null : null
  if (!father && !mother) return <VCard person={null} genderMap={genderMap} />

  const primary = father || mother!
  const spouse = father && mother ? mother : null

  const coupleChildren = people
    .filter(p => {
      if (father && mother) return p.father === father.id || p.mother === mother.id
      if (father) return p.father === father.id
      return p.mother === primary.id
    })
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const hasFP = !!(father?.father || father?.mother)
  const hasMP = !!(mother?.father || mother?.mother)
  const isExp = expanded.has(primary.id)
  const canExp = (hasFP || hasMP) && !isExp

  return (
    <div className="flex flex-col items-center">
      <VCard person={primary} spouse={spouse} genderMap={genderMap}
        childrenList={coupleChildren}
        canExpand={canExp} onExpand={canExp ? () => onToggle(primary.id) : undefined} />
      {isExp && (hasFP || hasMP) && (
        <>
          <VStem />
          <VFork
            left={hasFP
              ? <VExpandingBranch fatherId={father?.father || null} motherId={father?.mother || null}
                  people={people} genderMap={genderMap} expanded={expanded} onToggle={onToggle} />
              : <VCard person={null} genderMap={genderMap} />}
            right={hasMP
              ? <VExpandingBranch fatherId={mother?.father || null} motherId={mother?.mother || null}
                  people={people} genderMap={genderMap} expanded={expanded} onToggle={onToggle} />
              : <VCard person={null} genderMap={genderMap} />}
          />
        </>
      )}
    </div>
  )
}

export function VerticalExpandingTree({ focusId, people, genderMap, initialExpandDepth = 2 }: {
  focusId: string; people: Person[]; genderMap: Map<string, 'M' | 'F'>; initialExpandDepth?: number
}) {
  const focus = people.find(p => p.id === focusId)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>()
    if (focus) {
      init.add(focus.id)
      collectExpanded(focus.id, people, 0, initialExpandDepth, init)
      const sp = focus.spouses[0]?.id
      if (sp) {
        init.add(sp)
        collectExpanded(sp, people, 0, initialExpandDepth, init)
      }
    }
    return init
  })

  const handleToggle = useCallback((id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.add(id); return n })
  }, [])

  if (!focus) return <div className="text-center py-12 text-stone-500">Person not found.</div>

  const spouseRef = focus.spouses[0]
  const spouse = spouseRef?.id ? people.find(p => p.id === spouseRef.id) || null : null
  const hasFP = !!(focus.father || focus.mother)
  const hasSP = !!(spouse?.father || spouse?.mother)

  const focusChildren = people
    .filter(p => p.father === focus.id || p.mother === focus.id ||
      (spouse && (p.father === spouse.id || p.mother === spouse.id)))
    .filter(p => p.id !== focus.id)
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  return (
    <div className="overflow-x-auto pb-8">
      <div className="flex flex-col items-center min-w-max py-4 px-4">
        <VCard person={focus} spouse={spouse} genderMap={genderMap} isFocus
          childrenList={focusChildren} />

        {(hasFP || hasSP) && (
          <>
            <VStem />
            {hasFP && hasSP ? (
              <VFork
                left={
                  <VExpandingBranch fatherId={focus.father || null} motherId={focus.mother || null}
                    people={people} genderMap={genderMap} expanded={expanded} onToggle={handleToggle} />
                }
                right={
                  <VExpandingBranch fatherId={spouse!.father || null} motherId={spouse!.mother || null}
                    people={people} genderMap={genderMap} expanded={expanded} onToggle={handleToggle} />
                }
              />
            ) : hasFP ? (
              <VExpandingBranch fatherId={focus.father || null} motherId={focus.mother || null}
                people={people} genderMap={genderMap} expanded={expanded} onToggle={handleToggle} />
            ) : (
              <VExpandingBranch fatherId={spouse!.father || null} motherId={spouse!.mother || null}
                people={people} genderMap={genderMap} expanded={expanded} onToggle={handleToggle} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   OPTION B: VERTICAL DAGRE (React Flow TB)
   Full pedigree with top-to-bottom dagre layout. Zoom/pan.
   ════════════════════════════════════════════════════════════════ */

const VTB_NODE_W = 220
const VTB_NODE_H = 120

function buildCoupleNode(
  people: Person[], fatherId: string, motherId: string,
  generation: number,
): CoupleNode | null {
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

  const fatherNode = father ? buildCoupleNode(people, father.father, father.mother, generation + 1) : null
  const motherNode = mother ? buildCoupleNode(people, mother.father, mother.mother, generation + 1) : null

  return { person: primary, spouse, marriageDate, children, fatherNode, motherNode, generation }
}

function buildPedigreeFromRoot(people: Person[], rootId: string): CoupleNode | null {
  const root = people.find(p => p.id === rootId)
  if (!root) return null

  const spouseRef = root.spouses.length > 0 ? root.spouses[0] : null
  const spouse = spouseRef ? people.find(p => p.id === spouseRef.id) || null : null

  const children = people
    .filter(p => p.father === root.id || p.mother === root.id ||
      (spouse && (p.father === spouse.id || p.mother === spouse.id)))
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const fatherNode = root.father || root.mother
    ? buildCoupleNode(people, root.father, root.mother, 1) : null

  let motherNode: CoupleNode | null = null
  if (spouse && (spouse.father || spouse.mother)) {
    motherNode = buildCoupleNode(people, spouse.father, spouse.mother, 1)
  }

  return { person: root, spouse, marriageDate: spouseRef?.marriageDate || '', children, fatherNode, motherNode, generation: 0 }
}

function flattenTree(
  node: CoupleNode, directLineIds: Set<string>, genderMap: Map<string, 'M' | 'F'>,
  nodes: Node<VNodeData>[], edges: Edge[], visited: Set<string>,
) {
  const nodeId = `node-${node.person.id}`
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  nodes.push({
    id: nodeId, type: 'vCoupleCard',
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

function applyVerticalDagreLayout(nodes: Node<VNodeData>[], edges: Edge[]): Node<VNodeData>[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 100 })
  nodes.forEach(node => g.setNode(node.id, { width: VTB_NODE_W, height: VTB_NODE_H }))
  edges.forEach(edge => g.setEdge(edge.source, edge.target))
  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return { ...node, position: { x: pos.x - VTB_NODE_W / 2, y: pos.y - VTB_NODE_H / 2 } }
  })
}

function VCoupleCardNode({ data }: NodeProps<Node<VNodeData>>) {
  const { person, spouse, children, isDirect, personGender, spouseGender } = data
  const [showChildren, setShowChildren] = useState(false)
  const pYears = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  const sYears = spouse ? (spouse.privacy ? '' : `${formatYear(spouse.born)}\u2013${formatYear(spouse.died)}`) : ''

  return (
    <div className={`rounded-lg border bg-white shadow-sm relative ${
      isDirect ? 'border-l-4 border-l-amber-400 border-t border-r border-b border-stone-200' : 'border-stone-200'
    }`} style={{ width: VTB_NODE_W }}>
      <Handle type="target" position={Position.Top} className="!bg-stone-300 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-stone-300 !w-2 !h-2" />

      <div className="p-2">
        <div className="flex items-center gap-1.5">
          <Avatar name={person.name} gender={personGender} />
          <div className="min-w-0 flex-1">
            <Link to={`/people/${person.slug}`}
              className="font-semibold text-xs text-stone-800 hover:text-amber-700 hover:underline block leading-tight">
              {person.name}
            </Link>
            {pYears && <div className="text-[10px] text-stone-500">{pYears}</div>}
          </div>
        </div>
        {spouse && (
          <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-stone-100">
            <Avatar name={spouse.name} gender={spouseGender} />
            <div className="min-w-0 flex-1">
              <Link to={`/people/${spouse.slug}`}
                className="text-xs text-stone-600 hover:text-amber-700 hover:underline block">
                {spouse.name}
              </Link>
              {sYears && <div className="text-[10px] text-stone-500">{sYears}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Children button + slide-out */}
      {children.length > 0 && (
        <div className="border-t border-stone-100">
          <button onClick={() => setShowChildren(prev => !prev)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] text-stone-500 font-medium hover:bg-stone-50 transition-colors">
            <span>Children ({children.length})</span>
            <svg className={`w-3.5 h-3.5 text-stone-400 transition-transform ${showChildren ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Slide-out children panel */}
      {showChildren && children.length > 0 && (
        <div
          className="absolute top-0 bg-white border border-stone-200 rounded-lg shadow-lg z-50"
          style={{ left: VTB_NODE_W + 8, minWidth: 180, maxWidth: 220 }}
        >
          <div className="px-2 py-1.5 border-b border-stone-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-stone-600">Children ({children.length})</span>
            <button onClick={() => setShowChildren(false)}
              className="w-4 h-4 flex items-center justify-center text-stone-400 hover:text-stone-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-2 py-1.5">
            {children.map((child, i) => {
              const cYears = child.privacy ? '' : `${formatYear(child.born)}\u2013${formatYear(child.died)}`
              return (
                <div key={child.id} className="flex items-center gap-1.5 py-0.5">
                  <span className="text-stone-300 text-[10px] w-3 text-center shrink-0">
                    {i === children.length - 1 ? '\u2514' : '\u251C'}
                  </span>
                  {child.slug ? (
                    <Link to={`/people/${child.slug}`}
                      className="text-[11px] text-stone-700 hover:text-amber-700 hover:underline truncate">
                      {child.name}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-stone-500 truncate">{child.name}</span>
                  )}
                  {cYears && <span className="text-[10px] text-stone-400 shrink-0">{cYears}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const vNodeTypes = { vCoupleCard: VCoupleCardNode }

function VerticalDagreTree({ focusId, people, genderMap }: {
  focusId: string; people: Person[]; genderMap: Map<string, 'M' | 'F'>
}) {
  const directLineIds = useMemo(() => {
    const ids = new Set<string>()
    function walkUp(pid: string) {
      const person = people.find(p => p.id === pid)
      if (!person || ids.has(person.id)) return
      ids.add(person.id)
      if (person.father) walkUp(person.father)
      if (person.mother) walkUp(person.mother)
    }
    const root = people.find(p => p.id === focusId)
    if (root) {
      ids.add(root.id)
      if (root.father) walkUp(root.father)
      if (root.mother) walkUp(root.mother)
      const sp = root.spouses[0]?.id ? people.find(p => p.id === root.spouses[0].id) : null
      if (sp) {
        ids.add(sp.id)
        if (sp.father) walkUp(sp.father)
        if (sp.mother) walkUp(sp.mother)
      }
    }
    return ids
  }, [people, focusId])

  const { layoutNodes, edges } = useMemo(() => {
    const tree = buildPedigreeFromRoot(people, focusId)
    if (!tree) return { layoutNodes: [], edges: [] }
    const nodes: Node<VNodeData>[] = []
    const edgeList: Edge[] = []
    flattenTree(tree, directLineIds, genderMap, nodes, edgeList, new Set())
    const positioned = applyVerticalDagreLayout(nodes, edgeList)
    return { layoutNodes: positioned, edges: edgeList }
  }, [people, focusId, directLineIds, genderMap])

  return (
    <div style={{ width: '100%', height: '75vh' }} className="border rounded-lg bg-stone-50">
      <ReactFlow
        nodes={layoutNodes}
        edges={edges}
        nodeTypes={vNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background gap={20} size={1} color="#e7e5e4" />
      </ReactFlow>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   OPTION C: NAVIGATOR
   Always-fits-on-screen family context window.
   Shows grandparents → parents → focus → children.
   Click any person to re-center the view.
   ════════════════════════════════════════════════════════════════ */

function NavigatorTree({ focusId, people, genderMap, onNavigate }: {
  focusId: string; people: Person[]; genderMap: Map<string, 'M' | 'F'>
  onNavigate: (id: string) => void
}) {
  const focus = people.find(p => p.id === focusId)
  if (!focus) return <div className="text-center py-12 text-stone-500">Person not found.</div>

  const father = focus.father ? people.find(p => p.id === focus.father) || null : null
  const mother = focus.mother ? people.find(p => p.id === focus.mother) || null : null
  const spouse = focus.spouses[0]?.id ? people.find(p => p.id === focus.spouses[0].id) || null : null

  const pgf = father?.father ? people.find(p => p.id === father.father) || null : null
  const pgm = father?.mother ? people.find(p => p.id === father.mother) || null : null
  const mgf = mother?.father ? people.find(p => p.id === mother.father) || null : null
  const mgm = mother?.mother ? people.find(p => p.id === mother.mother) || null : null

  const children = people
    .filter(p => p.father === focus.id || p.mother === focus.id ||
      (spouse && (p.father === spouse.id || p.mother === spouse.id)))
    .filter(p => p.id !== focus.id)
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const hasGP = pgf || pgm || mgf || mgm
  const hasParents = father || mother

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Grandparents */}
      {hasGP && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2 text-center">
            Grandparents
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {(pgf || pgm) && (
              <div className="flex gap-2 items-start">
                {pgf && <VCard person={pgf} genderMap={genderMap} onClick={() => onNavigate(pgf.id)} width={155} />}
                {pgm && <VCard person={pgm} genderMap={genderMap} onClick={() => onNavigate(pgm.id)} width={155} />}
              </div>
            )}
            {(pgf || pgm) && (mgf || mgm) && <div className="w-6 shrink-0" />}
            {(mgf || mgm) && (
              <div className="flex gap-2 items-start">
                {mgf && <VCard person={mgf} genderMap={genderMap} onClick={() => onNavigate(mgf.id)} width={155} />}
                {mgm && <VCard person={mgm} genderMap={genderMap} onClick={() => onNavigate(mgm.id)} width={155} />}
              </div>
            )}
          </div>
          <VStem height={16} />
        </div>
      )}

      {/* Parents */}
      {hasParents && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2 text-center">
            Parents
          </div>
          <div className="flex justify-center gap-4 flex-wrap">
            {father && (
              <div className="flex flex-col items-center">
                <div className="text-[10px] text-blue-500 font-medium mb-1">Father</div>
                <VCard person={father} genderMap={genderMap} onClick={() => onNavigate(father.id)} />
              </div>
            )}
            {mother && (
              <div className="flex flex-col items-center">
                <div className="text-[10px] text-pink-500 font-medium mb-1">Mother</div>
                <VCard person={mother} genderMap={genderMap} onClick={() => onNavigate(mother.id)} />
              </div>
            )}
          </div>
          <VStem height={16} />
        </div>
      )}

      {/* Focus person */}
      <div className="flex justify-center mb-2">
        <VCard person={focus} spouse={spouse} genderMap={genderMap} isFocus width={240} />
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="mt-2">
          <VStem height={16} />
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2 text-center">
            Children ({children.length})
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            {children.map(child => (
              <VCard key={child.id} person={child} genderMap={genderMap}
                onClick={() => onNavigate(child.id)} width={155} />
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-stone-400 mt-6 flex items-center justify-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
        </svg>
        Click any person to navigate
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   OPTION D: DESCENDANTS
   Collapsible indented tree showing all descendants of any person.
   ════════════════════════════════════════════════════════════════ */

function DescendantNode({ person, people, genderMap, depth = 0 }: {
  person: Person; people: Person[]; genderMap: Map<string, 'M' | 'F'>; depth?: number
}) {
  const children = people.filter(p => p.father === person.id || p.mother === person.id)
  const [open, setOpen] = useState(depth < 3)
  const years = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  const spouseInfo = person.spouses.length > 0 ? person.spouses[0] : null
  const spouse = spouseInfo?.id ? people.find(p => p.id === spouseInfo.id) : null
  const gender = genderMap.get(person.id) || null

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
        <Avatar name={person.name} gender={gender} />
        <Link to={`/people/${person.slug}`}
          className="font-medium text-sm text-stone-800 hover:text-amber-700 hover:underline">
          {person.name}
        </Link>
        {years && <span className="text-xs text-stone-400">{years}</span>}
        {spouse && (
          <span className="text-xs text-stone-400">
            + <Link to={`/people/${spouse.slug}`} className="hover:underline hover:text-amber-700">{spouse.name}</Link>
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
              genderMap={genderMap} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DescendantTree({ focusId, people, genderMap }: {
  focusId: string; people: Person[]; genderMap: Map<string, 'M' | 'F'>
}) {
  const focus = people.find(p => p.id === focusId)
  if (!focus) return <div className="text-center py-12 text-stone-500">Person not found.</div>

  const children = people.filter(p => p.father === focus.id || p.mother === focus.id)

  if (children.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-stone-500">
          No descendants found for {focus.name}.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <DescendantNode person={focus} people={people} genderMap={genderMap} />
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   PERSON SELECTOR — Search dropdown for picking the focus person
   ════════════════════════════════════════════════════════════════ */

function PersonSelector({ people, genderMap, currentId, onSelect }: {
  people: Person[]; genderMap: Map<string, 'M' | 'F'>
  currentId: string; onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const current = people.find(p => p.id === currentId)

  const filtered = useMemo(() => {
    if (!query) return people.slice().sort((a, b) => a.name.localeCompare(b.name))
    const q = query.toLowerCase()
    return people
      .filter(p => p.name.toLowerCase().includes(q) || p.family.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [people, query])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target
      if (containerRef.current && target instanceof Node && !containerRef.current.contains(target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus input when opening
  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:border-amber-300 hover:shadow-sm transition-all text-left min-w-[200px]">
        {current && <Avatar name={current.name} gender={genderMap.get(current.id) || null} size="md" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-stone-800 truncate">{current?.name || 'Select person'}</div>
          {current && (
            <div className="text-xs text-stone-400">
              {current.privacy ? '' : `${formatYear(current.born)}\u2013${formatYear(current.died)}`}
              {current.birthplace && <span className="ml-1">- {current.birthplace}</span>}
            </div>
          )}
        </div>
        <svg className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-80 bg-white border border-stone-200 rounded-lg shadow-lg z-50 flex flex-col">
          <div className="p-2 border-b border-stone-100">
            <input ref={inputRef}
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or family..."
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].id)
              }}
              className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded-md focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-stone-400 text-center">No matches</div>
            )}
            {filtered.map(p => {
              const years = p.privacy ? '' : `${formatYear(p.born)}\u2013${formatYear(p.died)}`
              const isActive = p.id === currentId
              return (
                <button key={p.id} onClick={() => handleSelect(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50 transition-colors ${
                    isActive ? 'bg-amber-50' : ''
                  }`}>
                  <Avatar name={p.name} gender={genderMap.get(p.id) || null} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate ${isActive ? 'font-semibold text-amber-800' : 'text-stone-800'}`}>
                      {p.name}
                    </div>
                    <div className="text-[10px] text-stone-400 truncate">
                      {years}{p.family && <span className="ml-1">- {p.family}</span>}
                    </div>
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT — Tab selector + routing
   ════════════════════════════════════════════════════════════════ */

type ViewMode = 'expanding' | 'dagre' | 'navigator' | 'descendants'

const viewLabels: Record<ViewMode, { label: string; desc: string }> = {
  expanding: {
    label: 'Ancestors',
    desc: 'Click to reveal ancestors below. Natural vertical scroll.',
  },
  dagre: {
    label: 'Full Pedigree',
    desc: 'Full pedigree, top-to-bottom layout. Zoom and pan.',
  },
  navigator: {
    label: 'Navigator',
    desc: 'Always fits on screen. Click any person to re-center.',
  },
  descendants: {
    label: 'Descendants',
    desc: 'Collapsible tree of all descendants from the focused person.',
  },
}

export default function VerticalTreePrototypes() {
  const { personId } = useParams<{ personId: string }>()
  const navigate = useNavigate()
  const people = usePeople()
  const config = useSiteConfig()
  const rootId = config.rootPersonId || 'I1'
  const focusId = personId || rootId
  const focusPerson = people.find(p => p.id === focusId)

  const [view, setView] = useState<ViewMode>('expanding')

  const genderMap = useMemo(() => buildGenderMap(people), [people])

  const handleNavigate = useCallback((id: string) => {
    navigate(`/tree/${id}`)
  }, [navigate])

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-stone-800">Family Tree</h1>

        {/* Person selector */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <PersonSelector people={people} genderMap={genderMap} currentId={focusId} onSelect={handleNavigate} />
          {focusId !== rootId && (
            <button onClick={() => handleNavigate(rootId)}
              className="text-sm text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Back to root
            </button>
          )}
        </div>

        {/* View selector */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(Object.keys(viewLabels) as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === v ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}>
              {viewLabels[v].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-400">{viewLabels[view].desc}</p>
      </div>

      {view === 'expanding' && (
        <VerticalExpandingTree focusId={focusId} people={people} genderMap={genderMap} />
      )}

      {view === 'dagre' && (
        <VerticalDagreTree focusId={focusId} people={people} genderMap={genderMap} />
      )}

      {view === 'navigator' && (
        <NavigatorTree focusId={focusId} people={people} genderMap={genderMap} onNavigate={handleNavigate} />
      )}

      {view === 'descendants' && (
        <DescendantTree focusId={focusId} people={people} genderMap={genderMap} />
      )}
    </div>
  )
}
