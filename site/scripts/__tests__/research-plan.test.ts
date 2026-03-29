import { describe, it, expect } from 'vitest';
import { generateResearchPlan } from '../lib/research-plan.js';
import type { Person, SourceEntry } from '../../src/types';

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'I1', name: 'John Smith', gender: 'M', born: '', died: '',
    family: 'Smith', privacy: false, confidence: 'moderate',
    sources: [], media: [], filePath: '', slug: 'john-smith',
    father: '', fatherName: '', mother: '', motherName: '',
    spouses: [], children: [], biography: '', birthDateAnalysis: '',
    birthplace: '', deathPlace: '', burial: '', religion: '',
    occupation: '', military: '', immigration: '', emigration: '',
    naturalization: '', causeOfDeath: '', confirmation: '',
    baptized: '', christened: '', nickname: '', education: '',
    residence: '', familySearchId: '', divorce: '', cremation: '',
    ...overrides,
  };
}

function makeSource(overrides: Partial<SourceEntry> = {}): SourceEntry {
  return {
    id: 'SRC-TEST-001', file: 'test.md', person: '', date: '',
    publisher: '', type: 'obituary', title: 'Test Source',
    reliability: '', fagNumber: '', record: '', year: '',
    slug: 'src-test-001', fullText: '', url: '', persons: [],
    extractedFacts: '', notes: '', translationSlug: '',
    ocrVerified: null, language: '', media: [],
    ...overrides,
  };
}

describe('generateResearchPlan', () => {
  it('generates a markdown research plan with header', () => {
    const plan = generateResearchPlan({
      total: 10, completeness: 45,
      stubAndLow: [], stubs: [], low: [],
      missingBorn: [], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [],
    });

    expect(plan).toContain('# Research Plan');
    expect(plan).toContain('45%');
    expect(plan).toContain('10 people');
  });

  it('lists people sorted by most gaps first', () => {
    const personA = makePerson({ id: 'I1', name: 'Alice', born: '1900', confidence: 'stub' });
    const personB = makePerson({ id: 'I2', name: 'Bob', confidence: 'stub' });

    // Bob has more gaps: stub + missing birth + missing death
    const plan = generateResearchPlan({
      total: 2, completeness: 30,
      stubAndLow: [personA, personB], stubs: [personA, personB], low: [],
      missingBorn: [personB], missingDied: [personA, personB], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [],
    });

    const aliceIdx = plan.indexOf('Alice');
    const bobIdx = plan.indexOf('Bob');
    // Bob should appear before Alice (more gaps)
    expect(bobIdx).toBeLessThan(aliceIdx);
  });

  it('includes unverified OCR section when present', () => {
    const source = makeSource({ title: 'German Newspaper Clipping', ocrVerified: false });
    const plan = generateResearchPlan({
      total: 1, completeness: 80,
      stubAndLow: [], stubs: [], low: [],
      missingBorn: [], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [source], untranslated: [],
    });

    expect(plan).toContain('Unverified OCR Sources');
    expect(plan).toContain('German Newspaper Clipping');
  });

  it('includes untranslated sources section when present', () => {
    const source = makeSource({
      title: 'Obituary in Dutch',
      language: 'Dutch',
    });
    const plan = generateResearchPlan({
      total: 1, completeness: 80,
      stubAndLow: [], stubs: [], low: [],
      missingBorn: [], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [source],
    });

    expect(plan).toContain('Untranslated Sources');
    expect(plan).toContain('Obituary in Dutch');
    expect(plan).toContain('[Dutch]');
  });

  it('includes research tips section', () => {
    const plan = generateResearchPlan({
      total: 0, completeness: 100,
      stubAndLow: [], stubs: [], low: [],
      missingBorn: [], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [],
    });

    expect(plan).toContain('Research Tips by Gap Type');
    expect(plan).toContain('Missing Birth Dates');
    expect(plan).toContain('Missing Death Dates');
  });

  it('generates checkbox format for tasks', () => {
    const person = makePerson({ id: 'I1', name: 'Jane', confidence: 'stub' });
    const plan = generateResearchPlan({
      total: 1, completeness: 10,
      stubAndLow: [person], stubs: [person], low: [],
      missingBorn: [person], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [],
    });

    expect(plan).toContain('- [ ] stub');
    expect(plan).toContain('- [ ] missing birth date');
  });

  it('omits unverified/untranslated sections when empty', () => {
    const plan = generateResearchPlan({
      total: 1, completeness: 100,
      stubAndLow: [], stubs: [], low: [],
      missingBorn: [], missingDied: [], missingBirthplace: [],
      missingFather: [], missingMother: [], missingParents: [],
      noSources: [], noMedia: [], noBio: [],
      unverifiedOcr: [], untranslated: [],
    });

    expect(plan).not.toContain('Unverified OCR Sources');
    expect(plan).not.toContain('Untranslated Sources');
  });
});
