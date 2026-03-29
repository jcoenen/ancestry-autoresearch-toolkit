import { describe, it, expect } from 'vitest';
import {
  applyPrivacyRedaction,
  redactCrossSpouseMarriageDates,
} from '../lib/build-helpers.js';

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'I1',
    name: 'John Smith',
    gender: 'M',
    born: '1990-01-15',
    died: '',
    family: 'Smith',
    privacy: false,
    confidence: 'high',
    sources: ['S1', 'S2'],
    media: [{ path: 'photos/john.jpg', description: 'Photo', type: 'portrait' }],
    _mediaRefs: ['photos/john.jpg'],
    filePath: 'people/Smith/John_Smith.md',
    slug: 'john-smith',
    father: 'I2',
    fatherName: 'Robert Smith',
    mother: 'I3',
    motherName: 'Mary Smith',
    spouses: [{ id: 'I4', name: 'Jane Doe', marriageDate: '2015-06-20', link: '' }],
    children: [{ id: 'I5', name: 'Baby Smith', link: '' }],
    biography: 'John was born in Chicago.',
    birthDateAnalysis: 'Based on census records...',
    birthplace: 'Chicago, IL',
    deathPlace: '',
    burial: '',
    religion: 'Catholic',
    occupation: 'Engineer',
    military: 'US Army, 2010-2014',
    immigration: '',
    emigration: '',
    naturalization: '',
    causeOfDeath: '',
    confirmation: '2005',
    baptized: '1990-02-01',
    christened: '',
    nickname: 'Johnny',
    education: 'MIT',
    residence: 'Chicago, IL',
    familySearchId: 'LXYZ-123',
    divorce: '',
    cremation: '',
    ...overrides,
  };
}

// ── applyPrivacyRedaction ──

describe('applyPrivacyRedaction', () => {
  it('returns non-private person unchanged', () => {
    const person = makePerson({ privacy: false });
    const result = applyPrivacyRedaction(person);
    expect(result.born).toBe('1990-01-15');
    expect(result.sources).toEqual(['S1', 'S2']);
    expect(result.media).toHaveLength(1);
    expect(result.biography).toBe('John was born in Chicago.');
    expect(result.religion).toBe('Catholic');
    expect(result.occupation).toBe('Engineer');
    expect(result.nickname).toBe('Johnny');
    expect(result.spouses[0].marriageDate).toBe('2015-06-20');
  });

  it('preserves structural/identity fields for private people', () => {
    const person = makePerson({ privacy: true });
    applyPrivacyRedaction(person);
    expect(person.id).toBe('I1');
    expect(person.name).toBe('John Smith');
    expect(person.gender).toBe('M');
    expect(person.family).toBe('Smith');
    expect(person.privacy).toBe(true);
    expect(person.slug).toBe('john-smith');
    expect(person.father).toBe('I2');
    expect(person.fatherName).toBe('Robert Smith');
    expect(person.mother).toBe('I3');
    expect(person.motherName).toBe('Mary Smith');
    expect(person.children).toHaveLength(1);
    expect(person.spouses).toHaveLength(1);
    expect(person.spouses[0].id).toBe('I4');
    expect(person.spouses[0].name).toBe('Jane Doe');
  });

  it('blanks all personal detail fields for private people', () => {
    const person = makePerson({ privacy: true });
    applyPrivacyRedaction(person);

    // All string detail fields should be empty
    expect(person.born).toBe('');
    expect(person.died).toBe('');
    expect(person.biography).toBe('');
    expect(person.birthDateAnalysis).toBe('');
    expect(person.birthplace).toBe('');
    expect(person.deathPlace).toBe('');
    expect(person.burial).toBe('');
    expect(person.religion).toBe('');
    expect(person.occupation).toBe('');
    expect(person.military).toBe('');
    expect(person.immigration).toBe('');
    expect(person.emigration).toBe('');
    expect(person.naturalization).toBe('');
    expect(person.causeOfDeath).toBe('');
    expect(person.confirmation).toBe('');
    expect(person.baptized).toBe('');
    expect(person.christened).toBe('');
    expect(person.nickname).toBe('');
    expect(person.education).toBe('');
    expect(person.residence).toBe('');
    expect(person.familySearchId).toBe('');
    expect(person.divorce).toBe('');
    expect(person.cremation).toBe('');
  });

  it('blanks sources and media for private people', () => {
    const person = makePerson({ privacy: true });
    applyPrivacyRedaction(person);
    expect(person.sources).toEqual([]);
    expect(person.media).toEqual([]);
    expect(person._mediaRefs).toEqual([]);
  });

  it('blanks spouse marriage dates for private people', () => {
    const person = makePerson({
      privacy: true,
      spouses: [
        { id: 'I4', name: 'Jane', marriageDate: '2015-06-20', link: '' },
        { id: 'I6', name: 'Sarah', marriageDate: '2020-01-01', link: '' },
      ],
    });
    applyPrivacyRedaction(person);
    expect(person.spouses[0].marriageDate).toBe('');
    expect(person.spouses[1].marriageDate).toBe('');
  });
});

// ── redactCrossSpouseMarriageDates ──

describe('redactCrossSpouseMarriageDates', () => {
  it('blanks marriage date on public person married to private person', () => {
    const publicPerson = makePerson({
      id: 'I1',
      privacy: false,
      spouses: [{ id: 'I2', name: 'Jane', marriageDate: '2015-06-20', link: '' }],
    });
    const privatePerson = makePerson({
      id: 'I2',
      privacy: true,
      spouses: [{ id: 'I1', name: 'John', marriageDate: '', link: '' }],
    });

    redactCrossSpouseMarriageDates([publicPerson, privatePerson]);

    expect(publicPerson.spouses[0].marriageDate).toBe('');
  });

  it('does not blank marriage date when both spouses are public', () => {
    const person1 = makePerson({
      id: 'I1',
      privacy: false,
      spouses: [{ id: 'I2', name: 'Jane', marriageDate: '1920-05-10', link: '' }],
    });
    const person2 = makePerson({
      id: 'I2',
      privacy: false,
      spouses: [{ id: 'I1', name: 'John', marriageDate: '1920-05-10', link: '' }],
    });

    redactCrossSpouseMarriageDates([person1, person2]);

    expect(person1.spouses[0].marriageDate).toBe('1920-05-10');
    expect(person2.spouses[0].marriageDate).toBe('1920-05-10');
  });

  it('handles person with no spouses', () => {
    const person = makePerson({ id: 'I1', privacy: false, spouses: [] });
    redactCrossSpouseMarriageDates([person]);
    expect(person.spouses).toEqual([]);
  });

  it('only blanks the specific spouse who is private, not all spouses', () => {
    const person = makePerson({
      id: 'I1',
      privacy: false,
      spouses: [
        { id: 'I2', name: 'Jane', marriageDate: '1920-05-10', link: '' },
        { id: 'I3', name: 'Sarah', marriageDate: '1930-08-15', link: '' },
      ],
    });
    const privatePerson = makePerson({ id: 'I2', privacy: true, spouses: [] });
    const publicPerson = makePerson({ id: 'I3', privacy: false, spouses: [] });

    redactCrossSpouseMarriageDates([person, privatePerson, publicPerson]);

    expect(person.spouses[0].marriageDate).toBe(''); // I2 is private
    expect(person.spouses[1].marriageDate).toBe('1930-08-15'); // I3 is public
  });
});
