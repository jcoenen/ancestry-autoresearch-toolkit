import type { Person } from './types'

/* ── Types ──────────────────────────────────────────────────── */

export interface PathStep {
  person: Person
  label: string // relationship of this person to the previous (empty for first)
}

export interface RelationshipResult {
  name: string
  path: PathStep[]
}

/* ── Internal helpers ───────────────────────────────────────── */

interface AncEntry { gen: number; via: string | null }

function getAncestorMap(startId: string, pm: Map<string, Person>): Map<string, AncEntry> {
  const map = new Map<string, AncEntry>()
  const q: [string, number, string | null][] = [[startId, 0, null]]
  while (q.length) {
    const [id, gen, via] = q.shift()!
    if (map.has(id)) continue
    map.set(id, { gen, via })
    const p = pm.get(id)
    if (!p) continue
    if (p.father && !map.has(p.father)) q.push([p.father, gen + 1, id])
    if (p.mother && !map.has(p.mother)) q.push([p.mother, gen + 1, id])
  }
  return map
}

/** Trace via-pointers from startId up to endId → [startId, ..., endId] */
function tracePath(startId: string, endId: string, ancMap: Map<string, AncEntry>): string[] {
  const chain: string[] = []
  let cur = endId
  for (;;) {
    chain.push(cur)
    if (cur === startId) break
    const e = ancMap.get(cur)
    if (!e?.via) break
    cur = e.via
  }
  return chain.reverse()
}

function gn(
  personId: string, m: string, f: string, n: string,
  gm: Map<string, 'M' | 'F'>,
): string {
  const g = gm.get(personId)
  return g === 'M' ? m : g === 'F' ? f : n
}

function greatPfx(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return 'Great-'
  return `${count}x Great-`
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function removedSuffix(n: number): string {
  if (n === 0) return ''
  if (n === 1) return ' Once Removed'
  if (n === 2) return ' Twice Removed'
  return ` ${n}x Removed`
}

function lc(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1) }

function nameRelationship(
  dA: number, dB: number, bId: string, aId: string,
  pm: Map<string, Person>, gm: Map<string, 'M' | 'F'>,
): string {
  // Direct descendant (B is below A)
  if (dA === 0) {
    if (dB === 1) return gn(bId, 'Son', 'Daughter', 'Child', gm)
    if (dB === 2) return gn(bId, 'Grandson', 'Granddaughter', 'Grandchild', gm)
    return greatPfx(dB - 2) + lc(gn(bId, 'Grandson', 'Granddaughter', 'Grandchild', gm))
  }

  // Direct ancestor (B is above A)
  if (dB === 0) {
    if (dA === 1) return gn(bId, 'Father', 'Mother', 'Parent', gm)
    if (dA === 2) return gn(bId, 'Grandfather', 'Grandmother', 'Grandparent', gm)
    return greatPfx(dA - 2) + lc(gn(bId, 'Grandfather', 'Grandmother', 'Grandparent', gm))
  }

  // Siblings (check full vs half)
  if (dA === 1 && dB === 1) {
    const a = pm.get(aId)
    const b = pm.get(bId)
    const aParents = [a?.father, a?.mother].filter(Boolean)
    const bParents = new Set([b?.father, b?.mother].filter(Boolean))
    const shared = aParents.filter(id => bParents.has(id!))
    const prefix = shared.length === 1 ? 'Half-' : ''
    return prefix + gn(bId, 'Brother', 'Sister', 'Sibling', gm)
  }

  // Uncle/Aunt
  if (dB === 1 && dA > 1) {
    const base = gn(bId, 'Uncle', 'Aunt', 'Uncle/Aunt', gm)
    if (dA === 2) return base
    return greatPfx(dA - 2) + lc(base)
  }

  // Nephew/Niece
  if (dA === 1 && dB > 1) {
    const base = gn(bId, 'Nephew', 'Niece', 'Nephew/Niece', gm)
    if (dB === 2) return base
    if (dB === 3) return 'Grand-' + lc(base)
    return greatPfx(dB - 3) + 'Grand-' + lc(base)
  }

  // Cousins
  const degree = Math.min(dA, dB) - 1
  const removed = Math.abs(dA - dB)
  return `${ordinal(degree)} Cousin${removedSuffix(removed)}`
}

/* ── Path builder ───────────────────────────────────────────── */

function buildPath(
  aId: string, bId: string, commonId: string,
  ancA: Map<string, AncEntry>, ancB: Map<string, AncEntry>,
  pm: Map<string, Person>, gm: Map<string, 'M' | 'F'>,
): PathStep[] {
  const idsUp = tracePath(aId, commonId, ancA)     // [aId … commonId]
  const idsDown = tracePath(bId, commonId, ancB)    // [bId … commonId]
  idsDown.reverse()                                  // [commonId … bId]
  const allIds = [...idsUp, ...idsDown.slice(1)]

  const steps: PathStep[] = []
  for (let i = 0; i < allIds.length; i++) {
    const person = pm.get(allIds[i])
    if (!person) continue
    let label = ''
    if (i > 0) {
      const prevId = allIds[i - 1]
      const prev = pm.get(prevId)
      if (prev) {
        if (prev.father === allIds[i]) label = gn(allIds[i], 'father', 'father', 'father', gm)
        else if (prev.mother === allIds[i]) label = gn(allIds[i], 'mother', 'mother', 'mother', gm)
        else if (person.father === prevId || person.mother === prevId)
          label = gn(allIds[i], 'son', 'daughter', 'child', gm)
      }
    }
    steps.push({ person, label })
  }
  return steps
}

/* ── Find closest common ancestor ───────────────────────────── */

function findClosestCommon(
  ancA: Map<string, AncEntry>, ancB: Map<string, AncEntry>,
): { id: string; dA: number; dB: number } | null {
  let best: { id: string; dA: number; dB: number } | null = null
  for (const [id, eA] of ancA) {
    const eB = ancB.get(id)
    if (!eB) continue
    const total = eA.gen + eB.gen
    if (!best || total < best.dA + best.dB) {
      best = { id, dA: eA.gen, dB: eB.gen }
    }
  }
  return best
}

/* ── Main export ────────────────────────────────────────────── */

export function findRelationship(
  aId: string,
  bId: string,
  people: Person[],
  genderMap: Map<string, 'M' | 'F'>,
): RelationshipResult | null {
  if (aId === bId) return null

  const pm = new Map<string, Person>()
  for (const p of people) pm.set(p.id, p)

  const personA = pm.get(aId)
  const personB = pm.get(bId)
  if (!personA || !personB) return null

  // Direct spouse
  if (personA.spouses.some(s => s.id === bId)) {
    return {
      name: gn(bId, 'Husband', 'Wife', 'Spouse', genderMap),
      path: [
        { person: personA, label: '' },
        { person: personB, label: 'spouse' },
      ],
    }
  }

  // Blood relationship
  const ancA = getAncestorMap(aId, pm)
  const ancB = getAncestorMap(bId, pm)
  const best = findClosestCommon(ancA, ancB)

  if (best) {
    return {
      name: nameRelationship(best.dA, best.dB, bId, aId, pm, genderMap),
      path: buildPath(aId, bId, best.id, ancA, ancB, pm, genderMap),
    }
  }

  // In-law: through A's spouse
  for (const sp of personA.spouses) {
    if (!sp.id) continue
    const ancSp = getAncestorMap(sp.id, pm)
    const bestSp = findClosestCommon(ancSp, ancB)
    if (bestSp) {
      const spPerson = pm.get(sp.id)!
      const baseName = nameRelationship(bestSp.dA, bestSp.dB, bId, sp.id, pm, genderMap)
      const restPath = buildPath(sp.id, bId, bestSp.id, ancSp, ancB, pm, genderMap)
      return {
        name: baseName + ' (by marriage)',
        path: [{ person: personA, label: '' }, { person: spPerson, label: 'spouse' }, ...restPath.slice(1)],
      }
    }
  }

  // In-law: through B's spouse
  for (const sp of personB.spouses) {
    if (!sp.id) continue
    const ancSp = getAncestorMap(sp.id, pm)
    const bestSp = findClosestCommon(ancA, ancSp)
    if (bestSp) {
      const spPerson = pm.get(sp.id)!
      const baseName = nameRelationship(bestSp.dA, bestSp.dB, sp.id, aId, pm, genderMap)
      const mainPath = buildPath(aId, sp.id, bestSp.id, ancA, ancSp, pm, genderMap)
      return {
        name: baseName + ' (by marriage)',
        path: [...mainPath, { person: personB, label: 'spouse' }],
      }
    }
  }

  return null
}
