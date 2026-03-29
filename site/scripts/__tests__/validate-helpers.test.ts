import { describe, it, expect } from 'vitest';
import {
  ALLOWED_SOURCE_TYPES,
  ALLOWED_CONFIDENCE,
  ALLOWED_RELIABILITY,
  SOURCE_ID_PATTERN,
  GEDCOM_ID_PATTERN,
  isRecognizedVitalField,
  parseVitalTableTuples,
  splitByComma,
  checkBidirectionalRelationships,
  crossReferenceCheck,
  checkUnprocessedMedia,
} from '../lib/validate-helpers.js';

// ── Constants ──

describe('constants', () => {
  it('ALLOWED_SOURCE_TYPES includes expected types', () => {
    expect(ALLOWED_SOURCE_TYPES).toContain('obituary');
    expect(ALLOWED_SOURCE_TYPES).toContain('cemetery_memorial');
    expect(ALLOWED_SOURCE_TYPES).toContain('census');
    expect(ALLOWED_SOURCE_TYPES).toContain('certificate');
    expect(ALLOWED_SOURCE_TYPES).not.toContain('photograph');
  });

  it('ALLOWED_CONFIDENCE includes expected values', () => {
    expect(ALLOWED_CONFIDENCE).toEqual(['high', 'moderate', 'low', 'stub']);
  });

  it('ALLOWED_RELIABILITY includes expected values', () => {
    expect(ALLOWED_RELIABILITY).toEqual(['high', 'moderate', 'low']);
  });
});

// ── SOURCE_ID_PATTERN ──

describe('SOURCE_ID_PATTERN', () => {
  it('matches valid source IDs', () => {
    expect(SOURCE_ID_PATTERN.test('SRC-OBIT-024')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-CEM-001')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-CHR-100')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-SEC-999')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-IMM-001')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-MIL-050')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-CENS-001')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-NOTE-001')).toBe(true);
    expect(SOURCE_ID_PATTERN.test('SRC-CERT-001')).toBe(true);
  });

  it('rejects invalid source IDs', () => {
    expect(SOURCE_ID_PATTERN.test('SRC-OBIT-1')).toBe(false);    // not 3 digits
    expect(SOURCE_ID_PATTERN.test('SRC-OBIT-1234')).toBe(false);  // too many digits
    expect(SOURCE_ID_PATTERN.test('SRC-PHOTO-001')).toBe(false);  // invalid type
    expect(SOURCE_ID_PATTERN.test('OBIT-001')).toBe(false);       // missing SRC prefix
    expect(SOURCE_ID_PATTERN.test('src-obit-001')).toBe(false);   // lowercase
    expect(SOURCE_ID_PATTERN.test('')).toBe(false);
  });
});

// ── GEDCOM_ID_PATTERN ──

describe('GEDCOM_ID_PATTERN', () => {
  it('matches valid GEDCOM IDs', () => {
    expect(GEDCOM_ID_PATTERN.test('I1')).toBe(true);
    expect(GEDCOM_ID_PATTERN.test('I45')).toBe(true);
    expect(GEDCOM_ID_PATTERN.test('I999')).toBe(true);
  });

  it('rejects invalid GEDCOM IDs', () => {
    expect(GEDCOM_ID_PATTERN.test('I')).toBe(false);         // no digits
    expect(GEDCOM_ID_PATTERN.test('45')).toBe(false);        // no I prefix
    expect(GEDCOM_ID_PATTERN.test('i1')).toBe(false);        // lowercase
    expect(GEDCOM_ID_PATTERN.test('IX')).toBe(false);        // non-digit
    expect(GEDCOM_ID_PATTERN.test('')).toBe(false);
  });
});

// ── isRecognizedVitalField ──

describe('isRecognizedVitalField', () => {
  it('recognizes standard fields', () => {
    expect(isRecognizedVitalField('Full Name')).toBe(true);
    expect(isRecognizedVitalField('Born')).toBe(true);
    expect(isRecognizedVitalField('Died')).toBe(true);
    expect(isRecognizedVitalField('Father')).toBe(true);
    expect(isRecognizedVitalField('Mother')).toBe(true);
    expect(isRecognizedVitalField('Spouse')).toBe(true);
    expect(isRecognizedVitalField('Children')).toBe(true);
    expect(isRecognizedVitalField('Religion')).toBe(true);
    expect(isRecognizedVitalField('Occupation')).toBe(true);
    expect(isRecognizedVitalField('Military')).toBe(true);
    expect(isRecognizedVitalField('Immigration')).toBe(true);
    expect(isRecognizedVitalField('Emigration')).toBe(true);
    expect(isRecognizedVitalField('Naturalization')).toBe(true);
    expect(isRecognizedVitalField('Cause of Death')).toBe(true);
    expect(isRecognizedVitalField('Confirmation')).toBe(true);
    expect(isRecognizedVitalField('Burial')).toBe(true);
  });

  it('recognizes supplemental fields', () => {
    expect(isRecognizedVitalField('Also Known As')).toBe(true);
    expect(isRecognizedVitalField('Baptized')).toBe(true);
    expect(isRecognizedVitalField('FamilySearch ID')).toBe(true);
    expect(isRecognizedVitalField('Nickname')).toBe(true);
  });

  it('recognizes ordinal spouse patterns', () => {
    expect(isRecognizedVitalField('Spouse (1st)')).toBe(true);
    expect(isRecognizedVitalField('Spouse (2nd)')).toBe(true);
    expect(isRecognizedVitalField('Spouse (3rd)')).toBe(true);
    expect(isRecognizedVitalField('Spouse (4th)')).toBe(true);
  });

  it('recognizes ordinal children patterns', () => {
    expect(isRecognizedVitalField('Children (1st marriage)')).toBe(true);
    expect(isRecognizedVitalField('Children (2nd marriage)')).toBe(true);
    expect(isRecognizedVitalField('Children (3rd marriage)')).toBe(true);
  });

  it('rejects unrecognized fields', () => {
    expect(isRecognizedVitalField('Height')).toBe(false);
    expect(isRecognizedVitalField('Favorite Color')).toBe(false);
    expect(isRecognizedVitalField('Spouse (first)')).toBe(false);  // wrong ordinal format
    expect(isRecognizedVitalField('Children (first marriage)')).toBe(false);
    expect(isRecognizedVitalField('')).toBe(false);
  });
});

// ── parseVitalTableTuples ──

describe('parseVitalTableTuples', () => {
  it('parses vital table as tuples', () => {
    const content = [
      '## Vital Information',
      '| Field | Value | Source |',
      '|-------|-------|--------|',
      '| Born | 1920 | SRC-CERT-001 |',
      '| Died | 1990 | SRC-OBIT-024 |',
      '## Biography',
    ].join('\n');

    const result = parseVitalTableTuples(content);
    expect(result).toEqual([
      ['Born', '1920'],
      ['Died', '1990'],
    ]);
  });

  it('preserves duplicate field names (multiple spouses)', () => {
    const content = [
      '## Vital Information',
      '| Field | Value | Source |',
      '|-------|-------|--------|',
      '| Spouse (1st) | Jane (I10) | — |',
      '| Spouse (2nd) | Mary (I20) | — |',
    ].join('\n');

    const result = parseVitalTableTuples(content);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe('Spouse (1st)');
    expect(result[1][0]).toBe('Spouse (2nd)');
  });

  it('returns empty array when no vital section', () => {
    expect(parseVitalTableTuples('## Other\nstuff')).toEqual([]);
  });
});

// ── splitByComma ──

describe('splitByComma', () => {
  it('splits simple comma-separated values', () => {
    expect(splitByComma('John, Jane, Bob')).toEqual(['John', 'Jane', 'Bob']);
  });

  it('does not split inside brackets', () => {
    expect(splitByComma('[[path/to/file.md]], other')).toEqual([
      '[[path/to/file.md]]',
      'other',
    ]);
  });

  it('does not split inside parentheses', () => {
    expect(splitByComma('John (I1, b. 1920), Jane (I2)')).toEqual([
      'John (I1, b. 1920)',
      'Jane (I2)',
    ]);
  });

  it('handles nested brackets and parens', () => {
    expect(splitByComma('[[file.md]] (I1, twin), [[file2.md]] (I2)')).toEqual([
      '[[file.md]] (I1, twin)',
      '[[file2.md]] (I2)',
    ]);
  });

  it('handles single value', () => {
    expect(splitByComma('only one')).toEqual(['only one']);
  });

  it('handles empty string', () => {
    expect(splitByComma('')).toEqual([]);
  });

  it('trims whitespace', () => {
    expect(splitByComma('  a ,  b  , c  ')).toEqual(['a', 'b', 'c']);
  });
});

// ── checkBidirectionalRelationships ──

describe('checkBidirectionalRelationships', () => {
  it('returns no errors for fully reciprocal relationships', () => {
    const relationships = [
      {
        filePath: 'Coenen/Coenen_Henry.md',
        name: 'Henry Coenen',
        gedcomId: 'I1',
        fatherLink: '',
        motherLink: '',
        childLinks: ['people/Coenen/Coenen_Roger.md'],
        spouseLinks: ['people/Fuss/Fuss_Mary.md'],
      },
      {
        filePath: 'Fuss/Fuss_Mary.md',
        name: 'Mary Fuss',
        gedcomId: 'I2',
        fatherLink: '',
        motherLink: '',
        childLinks: ['people/Coenen/Coenen_Roger.md'],
        spouseLinks: ['people/Coenen/Coenen_Henry.md'],
      },
      {
        filePath: 'Coenen/Coenen_Roger.md',
        name: 'Roger Coenen',
        gedcomId: 'I3',
        fatherLink: 'people/Coenen/Coenen_Henry.md',
        motherLink: 'people/Fuss/Fuss_Mary.md',
        childLinks: [],
        spouseLinks: [],
      },
    ];

    const result = checkBidirectionalRelationships(relationships);
    expect(result.errors).toHaveLength(0);
  });

  it('detects missing child backlink from father', () => {
    const relationships = [
      {
        filePath: 'Coenen/Coenen_Henry.md',
        name: 'Henry Coenen',
        gedcomId: 'I1',
        fatherLink: '',
        motherLink: '',
        childLinks: [],  // Missing Roger as child!
        spouseLinks: [],
      },
      {
        filePath: 'Coenen/Coenen_Roger.md',
        name: 'Roger Coenen',
        gedcomId: 'I3',
        fatherLink: 'people/Coenen/Coenen_Henry.md',
        motherLink: '',
        childLinks: [],
        spouseLinks: [],
      },
    ];

    const result = checkBidirectionalRelationships(relationships);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('lists father');
    expect(result.errors[0]).toContain('does not list this person as a child');
  });

  it('detects missing spouse backlink', () => {
    const relationships = [
      {
        filePath: 'Coenen/Coenen_Henry.md',
        name: 'Henry Coenen',
        gedcomId: 'I1',
        fatherLink: '',
        motherLink: '',
        childLinks: [],
        spouseLinks: ['people/Fuss/Fuss_Mary.md'],
      },
      {
        filePath: 'Fuss/Fuss_Mary.md',
        name: 'Mary Fuss',
        gedcomId: 'I2',
        fatherLink: '',
        motherLink: '',
        childLinks: [],
        spouseLinks: [],  // Missing Henry as spouse!
      },
    ];

    const result = checkBidirectionalRelationships(relationships);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('lists spouse');
    expect(result.errors[0]).toContain('does not list this person as a spouse');
  });

  it('accepts child listing spouse as parent (indirect link)', () => {
    // Henry lists Roger as child, Roger lists Mary (Henry's spouse) as mother
    // This should be acceptable
    const relationships = [
      {
        filePath: 'Coenen/Coenen_Henry.md',
        name: 'Henry Coenen',
        gedcomId: 'I1',
        fatherLink: '',
        motherLink: '',
        childLinks: ['people/Coenen/Coenen_Roger.md'],
        spouseLinks: ['people/Fuss/Fuss_Mary.md'],
      },
      {
        filePath: 'Fuss/Fuss_Mary.md',
        name: 'Mary Fuss',
        gedcomId: 'I2',
        fatherLink: '',
        motherLink: '',
        childLinks: ['people/Coenen/Coenen_Roger.md'],
        spouseLinks: ['people/Coenen/Coenen_Henry.md'],
      },
      {
        filePath: 'Coenen/Coenen_Roger.md',
        name: 'Roger Coenen',
        gedcomId: 'I3',
        fatherLink: '',  // Doesn't list Henry directly
        motherLink: 'people/Fuss/Fuss_Mary.md',  // Lists Mary (Henry's spouse)
        childLinks: [],
        spouseLinks: [],
      },
    ];

    const result = checkBidirectionalRelationships(relationships);
    // Henry->Roger: Roger lists Mary (Henry's spouse) as mother — acceptable
    expect(result.errors).toHaveLength(0);
  });

  it('ignores links to people not in the dataset', () => {
    const relationships = [
      {
        filePath: 'Coenen/Coenen_Roger.md',
        name: 'Roger Coenen',
        gedcomId: 'I3',
        fatherLink: 'people/Coenen/Coenen_Henry.md',  // Henry not in dataset
        motherLink: '',
        childLinks: [],
        spouseLinks: [],
      },
    ];

    const result = checkBidirectionalRelationships(relationships);
    expect(result.errors).toHaveLength(0);  // Can't check if Henry doesn't exist in dataset
  });
});

// ── crossReferenceCheck ──

describe('crossReferenceCheck', () => {
  it('returns no warnings when all sources are referenced', () => {
    const sourceIds = new Map([
      ['SRC-OBIT-001', 'sources/obit_john.md'],
      ['SRC-CEM-001', 'sources/cem_john.md'],
    ]);
    const personSourceRefs = new Set(['SRC-OBIT-001', 'SRC-CEM-001']);

    const result = crossReferenceCheck(sourceIds, personSourceRefs);
    expect(result.warnings).toHaveLength(0);
  });

  it('errors on orphaned sources', () => {
    const sourceIds = new Map([
      ['SRC-OBIT-001', 'sources/obit_john.md'],
      ['SRC-CEM-001', 'sources/cem_john.md'],
    ]);
    const personSourceRefs = new Set(['SRC-OBIT-001']);  // CEM-001 not referenced

    const result = crossReferenceCheck(sourceIds, personSourceRefs);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('SRC-CEM-001');
    expect(result.errors[0]).toContain('Orphaned source');
  });

  it('handles empty inputs', () => {
    const result = crossReferenceCheck(new Map(), new Set());
    expect(result.errors).toHaveLength(0);
  });
});

// ── checkUnprocessedMedia ──

describe('checkUnprocessedMedia', () => {
  it('returns no errors when all media is claimed', () => {
    const entries = [
      { localPath: 'newspapers/NEWS_Doe_John.jpg', person: 'John Doe', type: 'newspaper', line: 5 },
    ];
    const claimed = new Set(['newspapers/NEWS_Doe_John.jpg']);

    const result = checkUnprocessedMedia(entries, claimed);
    expect(result.errors).toHaveLength(0);
  });

  it('reports unclaimed newspaper clippings', () => {
    const entries = [
      { localPath: 'newspapers/NEWS_Doe_John.jpg', person: 'John Doe', type: 'newspaper', line: 5 },
    ];
    const claimed = new Set<string>();

    const result = checkUnprocessedMedia(entries, claimed);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Newspaper clipping NOT LINKED');
  });

  it('reports unclaimed documents', () => {
    const entries = [
      { localPath: 'documents/DOC_birth_cert.jpg', person: 'John Doe', type: 'document', line: 5 },
    ];
    const claimed = new Set<string>();

    const result = checkUnprocessedMedia(entries, claimed);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Document NOT LINKED');
  });

  it('groups multi-part clippings and accepts if any part is claimed', () => {
    const entries = [
      { localPath: 'newspapers/NEWS_Doe_John_p1.jpeg', person: 'John Doe', type: 'newspaper', line: 5 },
      { localPath: 'newspapers/NEWS_Doe_John_p2.jpeg', person: 'John Doe', type: 'newspaper', line: 6 },
    ];
    // Only p1 is claimed, but that's enough for the group
    const claimed = new Set(['newspapers/NEWS_Doe_John_p1.jpeg']);

    const result = checkUnprocessedMedia(entries, claimed);
    expect(result.errors).toHaveLength(0);
  });

  it('reports multi-part group as single error when none claimed', () => {
    const entries = [
      { localPath: 'newspapers/NEWS_Doe_John_p1.jpeg', person: 'John Doe', type: 'newspaper', line: 5 },
      { localPath: 'newspapers/NEWS_Doe_John_p2.jpeg', person: 'John Doe', type: 'newspaper', line: 6 },
    ];
    const claimed = new Set<string>();

    const result = checkUnprocessedMedia(entries, claimed);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('NEWS_Doe_John_p1.jpeg');
    expect(result.errors[0]).toContain('NEWS_Doe_John_p2.jpeg');
  });

  it('handles empty inputs', () => {
    const result = checkUnprocessedMedia([], new Set());
    expect(result.errors).toHaveLength(0);
  });
});
