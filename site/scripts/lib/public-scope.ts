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

export function calculatePublicScope(
  people: ScopeRelationship[],
  options: PublicScopeOptions,
): PublicScopeResult {
  const byId = new Map(people.map((p) => [p.id, p]));
  const parentToChildren = new Map(people.map((p) => [p.id, new Set<string>()]));

  for (const person of people) {
    if (person.father && parentToChildren.has(person.father)) {
      parentToChildren.get(person.father)!.add(person.id);
    }
    if (person.mother && parentToChildren.has(person.mother)) {
      parentToChildren.get(person.mother)!.add(person.id);
    }
    for (const childId of person.children) {
      if (parentToChildren.has(childId)) {
        parentToChildren.get(person.id)!.add(childId);
      }
    }
  }

  const ancestorIds = new Set<string>();
  const ancestorQueue = byId.has(options.rootPersonId) ? [options.rootPersonId] : [];
  while (ancestorQueue.length > 0) {
    const id = ancestorQueue.shift()!;
    if (ancestorIds.has(id)) continue;
    ancestorIds.add(id);
    const person = byId.get(id);
    for (const parentId of [person?.father, person?.mother]) {
      if (parentId && byId.has(parentId) && !ancestorIds.has(parentId)) {
        ancestorQueue.push(parentId);
      }
    }
  }

  const bloodIds = new Set<string>();
  const queue = [...ancestorIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (bloodIds.has(id)) continue;
    bloodIds.add(id);
    for (const childId of parentToChildren.get(id) ?? []) {
      if (!bloodIds.has(childId)) queue.push(childId);
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
