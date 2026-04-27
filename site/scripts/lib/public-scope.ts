export interface ScopeRelationship {
  id: string;
  name: string;
  filePath: string;
  father: string;
  mother: string;
  spouses: string[];
  children: string[];
  publicScope?: string;
}

export interface PublicScopeOptions {
  rootPersonId: string;
  includeSpousesOfBloodRelatives: boolean;
  allowPersonIds: string[];
}

export interface PublicScopeResult {
  bloodIds: Set<string>;
  allowedIds: Set<string>;
  outOfScope: ScopeRelationship[];
}

function addIfKnown(edges: Map<string, Set<string>>, from: string, to: string): void {
  if (!from || !to || !edges.has(from) || !edges.has(to)) return;
  edges.get(from)!.add(to);
  edges.get(to)!.add(from);
}

export function calculatePublicScope(
  people: ScopeRelationship[],
  options: PublicScopeOptions,
): PublicScopeResult {
  const byId = new Map(people.map((p) => [p.id, p]));
  const parentChildEdges = new Map(people.map((p) => [p.id, new Set<string>()]));

  for (const person of people) {
    addIfKnown(parentChildEdges, person.id, person.father);
    addIfKnown(parentChildEdges, person.id, person.mother);
    for (const childId of person.children) {
      addIfKnown(parentChildEdges, person.id, childId);
    }
  }

  const bloodIds = new Set<string>();
  const queue = byId.has(options.rootPersonId) ? [options.rootPersonId] : [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (bloodIds.has(id)) continue;
    bloodIds.add(id);
    for (const next of parentChildEdges.get(id) ?? []) {
      if (!bloodIds.has(next)) queue.push(next);
    }
  }

  const allowedIds = new Set(bloodIds);
  if (options.includeSpousesOfBloodRelatives) {
    for (const id of bloodIds) {
      const person = byId.get(id);
      for (const spouseId of person?.spouses ?? []) {
        if (byId.has(spouseId)) allowedIds.add(spouseId);
      }
    }
  }

  for (const id of options.allowPersonIds) {
    if (byId.has(id)) allowedIds.add(id);
  }
  for (const person of people) {
    if (person.publicScope === 'include') allowedIds.add(person.id);
  }

  const outOfScope = people.filter((p) => !allowedIds.has(p.id) && p.publicScope !== 'exclude');
  return { bloodIds, allowedIds, outOfScope };
}

