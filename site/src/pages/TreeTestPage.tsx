import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ReactFlow,
  Controls,
  MiniMap,
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

function buildGenderMap(people: Person[]): Map<string, 'M' | 'F'> {
  const map = new Map<string, 'M' | 'F'>()
  for (const p of people) {
    if (p.father) map.set(p.father, 'M')
    if (p.mother) map.set(p.mother, 'F')
  }
  return map
}

/* ── Pedigree building ───────────────────────────────────────── */

function buildCoupleNode(
  people: Person[],
  fatherId: string,
  motherId: string,
  generation: number,
  maxGen: number,
): CoupleNode | null {
  if (generation > maxGen) return null
  const father = fatherId ? people.find(p => p.id === fatherId) : null
  const mother = motherId ? people.find(p => p.id === motherId) : null
  const primary = father || mother
  if (!primary) return null

  const spouse = father && mother ? mother : null
  const marriageDate = primary.spouses.find(s => s.id === spouse?.id)?.marriageDate
    || spouse?.spouses.find(s => s.id === primary.id)?.marriageDate
    || ''

  const children = people
    .filter(p => {
      if (father && mother) return p.father === father.id || p.mother === mother.id
      if (father) return p.father === father.id
      return p.mother === primary.id
    })
    .sort((a, b) => (a.born || '').localeCompare(b.born || ''))

  const fatherNode = father
    ? buildCoupleNode(people, father.father, father.mother, generation + 1, maxGen)
    : null
  const motherNode = mother
    ? buildCoupleNode(people, mother.father, mother.mother, generation + 1, maxGen)
    : null

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
    ? buildCoupleNode(people, root.father, root.mother, 1, maxGen)
    : null

  let motherNode: CoupleNode | null = null
  if (spouse && (spouse.father || spouse.mother)) {
    motherNode = buildCoupleNode(people, spouse.father, spouse.mother, 1, maxGen)
  }

  return {
    person: root, spouse, marriageDate: spouseRef?.marriageDate || '',
    children, fatherNode, motherNode, generation: 0,
  }
}

/* ── Flatten the couple tree into React Flow nodes and edges ── */

function flattenTree(
  node: CoupleNode,
  directLineIds: Set<string>,
  genderMap: Map<string, 'M' | 'F'>,
  nodes: Node<CoupleCardData>[],
  edges: Edge[],
  visited: Set<string>,
) {
  const nodeId = `node-${node.person.id}`
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  const isDirect = directLineIds.has(node.person.id)
  const personGender = genderMap.get(node.person.id) || null
  const spouseGender = node.spouse ? (genderMap.get(node.spouse.id) || null) : null

  nodes.push({
    id: nodeId,
    type: 'coupleCard',
    data: {
      person: node.person,
      spouse: node.spouse,
      marriageDate: node.marriageDate,
      children: node.children,
      isDirect,
      personGender,
      spouseGender,
    },
    position: { x: 0, y: 0 }, // dagre will set this
  })

  if (node.fatherNode) {
    const targetId = `node-${node.fatherNode.person.id}`
    edges.push({
      id: `edge-${node.person.id}-father`,
      source: nodeId,
      target: targetId,
      type: 'smoothstep',
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      animated: false,
    })
    flattenTree(node.fatherNode, directLineIds, genderMap, nodes, edges, visited)
  }

  if (node.motherNode) {
    const targetId = `node-${node.motherNode.person.id}`
    edges.push({
      id: `edge-${node.person.id}-mother`,
      source: nodeId,
      target: targetId,
      type: 'smoothstep',
      style: { stroke: '#ec4899', strokeWidth: 2 },
      animated: false,
    })
    flattenTree(node.motherNode, directLineIds, genderMap, nodes, edges, visited)
  }
}

/* ── Dagre layout ────────────────────────────────────────────── */

const NODE_WIDTH = 260
const NODE_HEIGHT = 180

function applyDagreLayout(nodes: Node<CoupleCardData>[], edges: Edge[]): Node<CoupleCardData>[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 250 })

  nodes.forEach(node => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}

/* ── Person avatar ───────────────────────────────────────────── */

function PersonAvatar({ name, gender }: { name: string; gender: 'M' | 'F' | null }) {
  const initial = name.charAt(0).toUpperCase()
  const bg = gender === 'M' ? 'bg-blue-100 text-blue-600'
    : gender === 'F' ? 'bg-pink-100 text-pink-600'
    : 'bg-stone-100 text-stone-500'
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${bg}`}>
      {initial}
    </span>
  )
}

/* ── Custom couple card node ─────────────────────────────────── */

function CoupleCardNode({ data }: NodeProps<Node<CoupleCardData>>) {
  const { person, spouse, marriageDate, children, isDirect, personGender, spouseGender } = data
  const [showChildren, setShowChildren] = useState(false)

  const personYears = person.privacy ? '' : `${formatYear(person.born)}\u2013${formatYear(person.died)}`
  const spouseYears = spouse
    ? (spouse.privacy ? '' : `${formatYear(spouse.born)}\u2013${formatYear(spouse.died)}`)
    : ''

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        isDirect ? 'border-l-4 border-l-amber-400 border-t border-r border-b border-stone-200' : 'border-stone-200'
      }`}
      style={{ width: NODE_WIDTH }}
    >
      {/* Source handle (left side — child connects here from the left) */}
      <Handle type="target" position={Position.Left} className="!bg-stone-300 !w-2 !h-2" />
      {/* Target handle (right side — connects to parent nodes to the right) */}
      <Handle type="source" position={Position.Right} className="!bg-stone-300 !w-2 !h-2" />

      <div className="p-3 pb-2">
        {/* Primary person */}
        <div className="flex items-start gap-2">
          <PersonAvatar name={person.name} gender={personGender} />
          <div className="min-w-0">
            <Link
              to={`/people/${person.slug}`}
              className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight"
            >
              {person.name}
            </Link>
            {personYears && <div className="text-xs text-stone-500 mt-0.5">{personYears}</div>}
          </div>
        </div>

        {/* Marriage date */}
        {marriageDate && (
          <div className="text-xs text-stone-500 mt-1.5 ml-8">Marriage: {marriageDate}</div>
        )}

        {/* Spouse */}
        {spouse && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={spouse.name} gender={spouseGender} />
            <div className="min-w-0">
              <Link
                to={`/people/${spouse.slug}`}
                className="font-semibold text-sm text-stone-800 hover:text-amber-700 hover:underline block leading-tight"
              >
                {spouse.name}
              </Link>
              {spouseYears && <div className="text-xs text-stone-500 mt-0.5">{spouseYears}</div>}
            </div>
          </div>
        )}

        {/* Spouse from spouseRef (no person file) */}
        {!spouse && person.spouses.length > 0 && person.spouses[0].name && (
          <div className="flex items-start gap-2 mt-1.5">
            <PersonAvatar name={person.spouses[0].name} gender={null} />
            <span className="text-sm text-stone-600 leading-tight">{person.spouses[0].name}</span>
          </div>
        )}
      </div>

      {/* Collapsible children */}
      {children.length > 0 && (
        <div className="border-t border-stone-100">
          <button
            onClick={() => setShowChildren(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            <span>Children ({children.length})</span>
            <svg
              className={`w-4 h-4 text-stone-400 transition-transform ${showChildren ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
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
                    <Link
                      to={`/people/${child.slug}`}
                      className="text-sm text-stone-700 hover:underline truncate"
                    >
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

/* ── Node types registry (must be stable / outside component) ── */

const nodeTypes = { coupleCard: CoupleCardNode }

/* ── Main page component ─────────────────────────────────────── */

export default function TreeTestPage() {
  const people = usePeople()

  const genderMap = useMemo(() => buildGenderMap(people), [people])

  const directLineIds = useMemo(() => {
    const ids = new Set<string>()
    const queue: string[] = ['I1']
    // Walk up patrilineal + matrilineal lines from root
    function walkUp(personId: string) {
      const person = people.find(p => p.id === personId)
      if (!person || ids.has(person.id)) return
      ids.add(person.id)
      if (person.father) walkUp(person.father)
      if (person.mother) walkUp(person.mother)
    }
    const root = people.find(p => p.id === 'I1')
    if (root) {
      ids.add(root.id)
      // Root's parents
      if (root.father) walkUp(root.father)
      if (root.mother) walkUp(root.mother)
      // Root's spouse's parents
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

  const { layoutNodes, edges } = useMemo(() => {
    const tree = buildPedigreeFromRoot(people, 'I1', 8)
    if (!tree) return { layoutNodes: [], edges: [] }

    const nodes: Node<CoupleCardData>[] = []
    const edgeList: Edge[] = []
    const visited = new Set<string>()

    flattenTree(tree, directLineIds, genderMap, nodes, edgeList, visited)

    const positioned = applyDagreLayout(nodes, edgeList)
    return { layoutNodes: positioned, edges: edgeList }
  }, [people, directLineIds, genderMap])

  return (
    <div className="max-w-full mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Tree Visualization Test</h1>
      <p className="text-stone-500 mb-1">Option D: React Flow + dagre</p>
      <p className="text-sm text-stone-400 mb-4">
        {layoutNodes.length} couple nodes | Scroll to zoom, drag to pan
      </p>

      <div style={{ width: '100%', height: '80vh' }} className="border rounded-lg bg-stone-50">
        <ReactFlow
          nodes={layoutNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              const data = node.data as CoupleCardData
              return data.isDirect ? '#f59e0b' : '#d6d3d1'
            }}
            className="!bg-white !border-stone-200"
          />
          <Background gap={20} size={1} color="#e7e5e4" />
        </ReactFlow>
      </div>
    </div>
  )
}
