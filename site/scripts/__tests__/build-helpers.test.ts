import { describe, it, expect } from 'vitest';
import {
  formatDate,
  slugify,
  extractIdFromParens,
  extractWikilink,
  extractNameFromWikilink,
  extractNameFromText,
  parseVitalTable,
  extractBiography,
  parseChildren,
  parseSpouse,
  parseParent,
  inferMediaType,
  extractSection,
  extractFullText,
} from '../lib/build-helpers.js';

// ── formatDate ──

describe('formatDate', () => {
  it('returns empty string for falsy values', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(0)).toBe('');
  });

  it('converts Date objects to YYYY-MM-DD', () => {
    expect(formatDate(new Date('2024-03-15T00:00:00Z'))).toBe('2024-03-15');
    expect(formatDate(new Date('1850-01-01T00:00:00Z'))).toBe('1850-01-01');
  });

  it('converts other values to string', () => {
    expect(formatDate('circa 1920')).toBe('circa 1920');
    expect(formatDate(1920)).toBe('1920');
    expect(formatDate('1850-06-15')).toBe('1850-06-15');
  });
});

// ── slugify ──

describe('slugify', () => {
  it('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(slugify('Roger Francis Coenen')).toBe('roger-francis-coenen');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world');
  });

  it('collapses consecutive special chars into single hyphen', () => {
    expect(slugify('Anna --- Maria')).toBe('anna-maria');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles source IDs', () => {
    expect(slugify('SRC-OBIT-024')).toBe('src-obit-024');
  });
});

// ── extractIdFromParens ──

describe('extractIdFromParens', () => {
  it('extracts ID from (I123) format', () => {
    expect(extractIdFromParens('John Doe (I45)')).toBe('I45');
  });

  it('extracts ID from (I123, ...) format with trailing comma', () => {
    expect(extractIdFromParens('John Doe (I45, b. 1920)')).toBe('I45');
  });

  it('extracts ID from (I123) with closing paren', () => {
    expect(extractIdFromParens('(I123)')).toBe('I123');
  });

  it('returns empty string when no ID found', () => {
    expect(extractIdFromParens('John Doe')).toBe('');
    expect(extractIdFromParens('')).toBe('');
  });
});

// ── extractWikilink ──

describe('extractWikilink', () => {
  it('extracts path from [[path]]', () => {
    expect(extractWikilink('[[people/Coenen/Coenen_Roger.md]]')).toBe('people/Coenen/Coenen_Roger.md');
  });

  it('extracts path from [[path|alias]] (pipe alias)', () => {
    // The current regex captures everything inside brackets including the pipe alias
    expect(extractWikilink('[[people/Coenen/Coenen_Roger.md|Roger]]')).toBe('people/Coenen/Coenen_Roger.md|Roger');
  });

  it('returns empty string when no wikilink', () => {
    expect(extractWikilink('plain text')).toBe('');
    expect(extractWikilink('')).toBe('');
  });
});

// ── extractNameFromWikilink ──

describe('extractNameFromWikilink', () => {
  it('reorders Surname_First_Middle to First Middle Surname', () => {
    expect(extractNameFromWikilink('people/Coenen/Coenen_Roger_Francis.md')).toBe('Roger Francis Coenen');
  });

  it('handles two-part names', () => {
    expect(extractNameFromWikilink('people/Fuss/Fuss_Ruby.md')).toBe('Ruby Fuss');
  });

  it('handles single-part name gracefully', () => {
    expect(extractNameFromWikilink('people/Unknown.md')).toBe('Unknown');
  });

  it('strips .md extension', () => {
    expect(extractNameFromWikilink('Coenen_Roger.md')).toBe('Roger Coenen');
  });

  it('works without .md extension', () => {
    expect(extractNameFromWikilink('Coenen_Roger')).toBe('Roger Coenen');
  });
});

// ── extractNameFromText ──

describe('extractNameFromText', () => {
  it('strips wikilinks', () => {
    expect(extractNameFromText('[[people/Coenen/Coenen_Roger.md]] extra')).toBe('extra');
  });

  it('strips GEDCOM IDs in parens', () => {
    expect(extractNameFromText('John Doe (I45)')).toBe('John Doe');
  });

  it('strips marriage info', () => {
    expect(extractNameFromText('Jane Smith, m. Jun 1, 1920')).toBe('Jane Smith');
  });

  it('returns empty string for empty input', () => {
    expect(extractNameFromText('')).toBe('');
  });
});

// ── parseVitalTable ──

describe('parseVitalTable', () => {
  it('parses a standard vital table', () => {
    const content = [
      '## Vital Information',
      '| Field | Value | Source |',
      '|-------|-------|--------|',
      '| Born | 1920-05-15 | SRC-CERT-001 |',
      '| Died | 1990-12-01 | SRC-OBIT-024 |',
      '| Father | [[people/Coenen/Coenen_Henry.md]] | SRC-CERT-001 |',
      '## Biography',
    ].join('\n');

    const table = parseVitalTable(content);
    expect(table['Born']).toBe('1920-05-15');
    expect(table['Died']).toBe('1990-12-01');
    expect(table['Father']).toBe('[[people/Coenen/Coenen_Henry.md]]');
  });

  it('stops at the next ## section', () => {
    const content = [
      '## Vital Information',
      '| Field | Value | Source |',
      '|-------|-------|--------|',
      '| Born | 1920 | — |',
      '## Sources',
      '| Born | 1921 | — |',
    ].join('\n');

    const table = parseVitalTable(content);
    expect(table['Born']).toBe('1920');
    expect(Object.keys(table)).toHaveLength(1);
  });

  it('returns empty object when no vital section', () => {
    expect(parseVitalTable('## Biography\nSome text')).toEqual({});
  });

  it('skips header and separator rows', () => {
    const content = [
      '## Vital Information',
      '| Field | Value | Source |',
      '|-------|-------|--------|',
      '| Religion | Catholic | — |',
    ].join('\n');

    const table = parseVitalTable(content);
    expect(Object.keys(table)).toHaveLength(1);
    expect(table['Religion']).toBe('Catholic');
  });
});

// ── extractBiography ──

describe('extractBiography', () => {
  it('extracts biography text between ## Biography and next section', () => {
    const content = [
      '## Vital Information',
      '| Born | 1920 |',
      '## Biography',
      'Roger was born in Wisconsin.',
      '',
      'He served in WWII.',
      '## Sources',
    ].join('\n');

    expect(extractBiography(content)).toBe('Roger was born in Wisconsin.\n\nHe served in WWII.');
  });

  it('extracts biography at end of file', () => {
    const content = [
      '## Biography',
      'Some text here.',
    ].join('\n');

    expect(extractBiography(content)).toBe('Some text here.');
  });

  it('returns empty string when no biography section', () => {
    expect(extractBiography('## Sources\nstuff')).toBe('');
  });

  it('skips blank lines', () => {
    const content = [
      '## Biography',
      '',
      'Line one.',
      '',
      '',
      'Line two.',
      '',
    ].join('\n');

    expect(extractBiography(content)).toBe('Line one.\n\nLine two.');
  });
});

// ── parseChildren ──

describe('parseChildren', () => {
  it('returns empty array for dash', () => {
    expect(parseChildren('—')).toEqual([]);
  });

  it('returns empty array for "unknown"', () => {
    expect(parseChildren('unknown')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseChildren('')).toEqual([]);
  });

  it('parses children with wikilinks', () => {
    const result = parseChildren('[[people/Coenen/Coenen_Roger.md]] (I45)');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Roger Coenen');
    expect(result[0].id).toBe('I45');
    expect(result[0].link).toBe('people/Coenen/Coenen_Roger.md');
  });

  it('parses multiple children separated by commas', () => {
    const result = parseChildren('[[people/A/A_John.md]] (I1), [[people/A/A_Jane.md]] (I2)');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John A');
    expect(result[1].name).toBe('Jane A');
  });

  it('parses children with ID but no wikilink', () => {
    const result = parseChildren('John Doe (I45)');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].id).toBe('I45');
    expect(result[0].link).toBe('');
  });

  it('parses numbered children', () => {
    const result = parseChildren('1. John Doe (I45), 2. Jane Doe (I46)');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John Doe');
    expect(result[1].name).toBe('Jane Doe');
  });

  it('parses plain text children without IDs', () => {
    const result = parseChildren('John Doe, Jane Doe');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('John Doe');
    expect(result[0].id).toBe('');
  });

  it('does not split on commas inside wikilinks', () => {
    // Wikilinks with commas shouldn't split
    const result = parseChildren('[[people/Doe/Doe_John_Jr.md]] (I1)');
    expect(result).toHaveLength(1);
  });
});

// ── parseSpouse ──

describe('parseSpouse', () => {
  it('returns null for dash', () => {
    expect(parseSpouse('—')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSpouse('')).toBeNull();
  });

  it('parses spouse with wikilink and marriage date', () => {
    const result = parseSpouse('[[people/Fuss/Fuss_Ruby.md]] (I10), m. Jun 1, 1945');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Ruby Fuss');
    expect(result!.id).toBe('I10');
    expect(result!.marriageDate).toBe('Jun 1, 1945');
    expect(result!.link).toBe('people/Fuss/Fuss_Ruby.md');
  });

  it('parses spouse without marriage date', () => {
    const result = parseSpouse('[[people/Fuss/Fuss_Ruby.md]] (I10)');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Ruby Fuss');
    expect(result!.marriageDate).toBe('');
  });

  it('parses spouse without wikilink', () => {
    const result = parseSpouse('Jane Smith (I20), m. 1920');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Jane Smith');
    expect(result!.id).toBe('I20');
    expect(result!.link).toBe('');
  });
});

// ── parseParent ──

describe('parseParent', () => {
  it('returns empty fields for dash', () => {
    const result = parseParent('—');
    expect(result).toEqual({ id: '', name: '', link: '' });
  });

  it('returns empty fields for empty string', () => {
    const result = parseParent('');
    expect(result).toEqual({ id: '', name: '', link: '' });
  });

  it('parses parent with wikilink', () => {
    const result = parseParent('[[people/Coenen/Coenen_Henry.md]] (I5)');
    expect(result.name).toBe('Henry Coenen');
    expect(result.id).toBe('I5');
    expect(result.link).toBe('people/Coenen/Coenen_Henry.md');
  });

  it('parses parent without wikilink', () => {
    const result = parseParent('Henry Coenen (I5)');
    expect(result.name).toBe('Henry Coenen');
    expect(result.id).toBe('I5');
    expect(result.link).toBe('');
  });
});

// ── inferMediaType ──

describe('inferMediaType', () => {
  it('identifies gravestones', () => {
    expect(inferMediaType('gravestones/CEM_Coenen_Roger.jpg')).toBe('gravestone');
  });

  it('identifies portraits', () => {
    expect(inferMediaType('portraits/POR_Coenen_Roger.jpg')).toBe('portrait');
  });

  it('identifies documents', () => {
    expect(inferMediaType('documents/DOC_birth_cert.jpg')).toBe('document');
  });

  it('identifies newspapers', () => {
    expect(inferMediaType('newspapers/NEWS_obit_1950.jpg')).toBe('newspaper');
  });

  it('identifies group photos', () => {
    expect(inferMediaType('group_photos/GRP_family_1920.jpg')).toBe('group_photo');
  });

  it('identifies scans', () => {
    expect(inferMediaType('scans/some_scan.jpg')).toBe('scan');
  });

  it('returns other for unknown paths', () => {
    expect(inferMediaType('misc/random.jpg')).toBe('other');
    expect(inferMediaType('photo.jpg')).toBe('other');
  });
});

// ── extractSection ──

describe('extractSection', () => {
  it('extracts content under a heading', () => {
    const content = [
      '## Notes',
      'Some notes here.',
      'More notes.',
      '## Sources',
      'Source list.',
    ].join('\n');

    expect(extractSection(content, 'Notes')).toBe('Some notes here.\nMore notes.');
  });

  it('extracts section at end of file', () => {
    const content = [
      '## Extracted Facts',
      '- Born 1920',
      '- Died 1990',
    ].join('\n');

    expect(extractSection(content, 'Extracted Facts')).toBe('- Born 1920\n- Died 1990');
  });

  it('returns empty string when section not found', () => {
    expect(extractSection('## Other\nstuff', 'Notes')).toBe('');
  });

  it('is case-insensitive on heading match', () => {
    const content = '## full text\n> Some text here.';
    expect(extractSection(content, 'Full Text')).toBe('> Some text here.');
  });
});

// ── extractFullText ──

describe('extractFullText', () => {
  it('extracts blockquoted text from ## Full Text section', () => {
    const content = [
      '## Full Text',
      '> John Doe, age 85, passed away on December 1.',
      '> He is survived by his wife Jane.',
      '## Extracted Facts',
    ].join('\n');

    expect(extractFullText(content)).toBe(
      'John Doe, age 85, passed away on December 1.\nHe is survived by his wife Jane.'
    );
  });

  it('ignores non-blockquoted lines in Full Text section', () => {
    const content = [
      '## Full Text',
      'This is not quoted.',
      '> This is quoted.',
      '## Notes',
    ].join('\n');

    expect(extractFullText(content)).toBe('This is quoted.');
  });

  it('falls back to any blockquote when no Full Text section', () => {
    const content = [
      '## Memorial Data',
      '> Some memorial text.',
    ].join('\n');

    expect(extractFullText(content)).toBe('Some memorial text.');
  });

  it('returns empty string when no blockquotes at all', () => {
    expect(extractFullText('## Notes\nPlain text only.')).toBe('');
  });

  it('strips > prefix correctly', () => {
    const content = '## Full Text\n>No space after >\n> Space after >';
    expect(extractFullText(content)).toBe('No space after >\nSpace after >');
  });
});
