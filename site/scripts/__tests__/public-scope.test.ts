import { describe, expect, it } from 'vitest';
import { calculatePublicScope, type ScopeRelationship } from '../lib/public-scope.js';

function person(input: Partial<ScopeRelationship> & { id: string }): ScopeRelationship {
  return {
    id: input.id,
    name: input.name ?? input.id,
    filePath: input.filePath ?? `${input.id}.md`,
    father: input.father ?? '',
    mother: input.mother ?? '',
    spouses: input.spouses ?? [],
    children: input.children ?? [],
    publicScope: input.publicScope,
  };
}

describe('calculatePublicScope', () => {
  it('includes blood relatives through parent-child edges and spouses of blood relatives', () => {
    const scope = calculatePublicScope(
      [
        person({ id: 'I1', children: ['I2'] }),
        person({ id: 'I2', father: 'I1', spouses: ['I3'], children: ['I4'] }),
        person({ id: 'I3', spouses: ['I2'], children: ['I4', 'I5'] }),
        person({ id: 'I4', father: 'I2', mother: 'I3' }),
        person({ id: 'I5', father: 'I3' }),
      ],
      { rootPersonId: 'I1', includeSpousesOfBloodRelatives: true, allowPersonIds: [] },
    );

    expect([...scope.bloodIds].sort()).toEqual(['I1', 'I2', 'I4']);
    expect([...scope.allowedIds].sort()).toEqual(['I1', 'I2', 'I3', 'I4']);
    expect(scope.outOfScope.map((p) => p.id)).toEqual(['I5']);
  });

  it('does not treat a blood relative co-parent as blood', () => {
    const scope = calculatePublicScope(
      [
        person({ id: 'I1', children: ['I2'] }),
        person({ id: 'I2', father: 'I1', mother: 'I3' }),
        person({ id: 'I3', children: ['I2'], father: 'I4' }),
        person({ id: 'I4' }),
      ],
      { rootPersonId: 'I1', includeSpousesOfBloodRelatives: false, allowPersonIds: [] },
    );

    expect(scope.bloodIds.has('I2')).toBe(true);
    expect(scope.bloodIds.has('I3')).toBe(false);
    expect(scope.bloodIds.has('I4')).toBe(false);
  });

  it('allows explicit exceptions without opening an in-law chain', () => {
    const scope = calculatePublicScope(
      [
        person({ id: 'I1', spouses: ['I2'] }),
        person({ id: 'I2', spouses: ['I1'], father: 'I3' }),
        person({ id: 'I3' }),
        person({ id: 'I4', publicScope: 'include' }),
      ],
      { rootPersonId: 'I1', includeSpousesOfBloodRelatives: true, allowPersonIds: [] },
    );

    expect(scope.allowedIds.has('I2')).toBe(true);
    expect(scope.allowedIds.has('I3')).toBe(false);
    expect(scope.allowedIds.has('I4')).toBe(true);
  });
});
