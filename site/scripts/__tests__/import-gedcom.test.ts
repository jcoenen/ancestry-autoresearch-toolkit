import { describe, it, expect } from 'vitest';
import {
  fromGedcomDate,
  parseGedcomLines,
  extractIndividuals,
  extractFamilies,
  personFilename,
  personWikilink,
  generatePersonMarkdown,
} from '../import-gedcom.js';
import type { GedcomIndi } from '../import-gedcom.js';

// ── fromGedcomDate ──

describe('fromGedcomDate', () => {
  it('converts full GEDCOM date to ISO', () => {
    expect(fromGedcomDate('15 MAR 1920')).toBe('1920-03-15');
  });

  it('converts single-digit day', () => {
    expect(fromGedcomDate('1 JUN 1945')).toBe('1945-06-01');
  });

  it('handles ABT (approximate)', () => {
    expect(fromGedcomDate('ABT 1920')).toBe('~1920');
    expect(fromGedcomDate('ABT 15 MAR 1920')).toBe('~1920-03-15');
  });

  it('handles EST (estimated)', () => {
    expect(fromGedcomDate('EST 1880')).toBe('~1880');
  });

  it('handles BEF (before)', () => {
    expect(fromGedcomDate('BEF 1900')).toBe('~1900');
  });

  it('handles AFT (after)', () => {
    expect(fromGedcomDate('AFT 1850')).toBe('~1850');
  });

  it('handles BET...AND range', () => {
    expect(fromGedcomDate('BET 1880 AND 1890')).toBe('~1880');
  });

  it('handles month + year', () => {
    expect(fromGedcomDate('MAR 1920')).toBe('March 1920');
    expect(fromGedcomDate('DEC 1850')).toBe('December 1850');
  });

  it('handles approximate month + year', () => {
    expect(fromGedcomDate('ABT JUN 1900')).toBe('~June 1900');
  });

  it('handles year only', () => {
    expect(fromGedcomDate('1920')).toBe('1920');
  });

  it('returns empty string for empty input', () => {
    expect(fromGedcomDate('')).toBe('');
  });

  it('handles case-insensitive months', () => {
    expect(fromGedcomDate('15 mar 1920')).toBe('1920-03-15');
    expect(fromGedcomDate('ABT jan 1900')).toBe('~January 1900');
  });
});

// ── parseGedcomLines ──

describe('parseGedcomLines', () => {
  it('parses a simple GEDCOM structure', () => {
    const text = [
      '0 HEAD',
      '1 SOUR TestApp',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '2 GIVN John',
      '2 SURN Doe',
      '1 SEX M',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    expect(records).toHaveLength(3); // HEAD, INDI, TRLR
    expect(records[0].tag).toBe('HEAD');
    expect(records[1].tag).toBe('INDI');
    expect(records[1].id).toBe('I1');
    expect(records[2].tag).toBe('TRLR');
  });

  it('nests children correctly', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '2 GIVN John',
      '2 SURN Doe',
      '1 BIRT',
      '2 DATE 15 MAR 1920',
      '2 PLAC Milwaukee, WI',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indi = records[0];
    expect(indi.children).toHaveLength(2); // NAME, BIRT
    expect(indi.children[0].tag).toBe('NAME');
    expect(indi.children[0].children).toHaveLength(2); // GIVN, SURN
    expect(indi.children[1].tag).toBe('BIRT');
    expect(indi.children[1].children).toHaveLength(2); // DATE, PLAC
  });

  it('handles CONT and CONC lines', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NOTE First line of note',
      '2 CONT Second line of note',
      '2 CONC appended text',
    ].join('\n');

    const records = parseGedcomLines(text);
    const note = records[0].children[0];
    expect(note.tag).toBe('NOTE');
    expect(note.value).toBe('First line of note');
    expect(note.children).toHaveLength(2);
    expect(note.children[0].tag).toBe('CONT');
    expect(note.children[1].tag).toBe('CONC');
  });

  it('handles Windows line endings', () => {
    const text = '0 HEAD\r\n1 SOUR Test\r\n0 TRLR\r\n';
    const records = parseGedcomLines(text);
    expect(records).toHaveLength(2);
  });
});

// ── extractIndividuals ──

describe('extractIndividuals', () => {
  const SAMPLE_GEDCOM = [
    '0 HEAD',
    '0 @I1@ INDI',
    '1 NAME Roger Francis /Coenen/',
    '2 GIVN Roger Francis',
    '2 SURN Coenen',
    '1 SEX M',
    '1 BIRT',
    '2 DATE 15 MAR 1920',
    '2 PLAC Kewaunee, WI',
    '1 DEAT',
    '2 DATE 1 DEC 1990',
    '2 PLAC Green Bay, WI',
    '2 CAUS Heart failure',
    '1 OCCU Farmer',
    '1 RELI Catholic',
    '1 NICK Rog',
    '1 FAMC @F1@',
    '1 FAMS @F2@',
    '0 @I2@ INDI',
    '1 NAME Ruby /Fuss/',
    '2 GIVN Ruby',
    '2 SURN Fuss',
    '1 SEX F',
    '1 FAMS @F2@',
    '0 TRLR',
  ].join('\n');

  it('extracts individuals with all fields', () => {
    const records = parseGedcomLines(SAMPLE_GEDCOM);
    const indis = extractIndividuals(records);
    expect(indis.size).toBe(2);

    const roger = indis.get('I1')!;
    expect(roger.fullName).toBe('Roger Francis Coenen');
    expect(roger.givenName).toBe('Roger Francis');
    expect(roger.surname).toBe('Coenen');
    expect(roger.gender).toBe('M');
    expect(roger.birthDate).toBe('1920-03-15');
    expect(roger.birthPlace).toBe('Kewaunee, WI');
    expect(roger.deathDate).toBe('1990-12-01');
    expect(roger.deathPlace).toBe('Green Bay, WI');
    expect(roger.causeOfDeath).toBe('Heart failure');
    expect(roger.occupation).toBe('Farmer');
    expect(roger.religion).toBe('Catholic');
    expect(roger.nickname).toBe('Rog');
    expect(roger.familyChild).toEqual(['F1']);
    expect(roger.familySpouse).toEqual(['F2']);
  });

  it('parses name from NAME value when GIVN/SURN missing', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME Anna Maria /Schmidt/',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    const anna = indis.get('I1')!;
    expect(anna.givenName).toBe('Anna Maria');
    expect(anna.surname).toBe('Schmidt');
    expect(anna.fullName).toBe('Anna Maria Schmidt');
  });

  it('handles events with dates and places', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 IMMI',
      '2 DATE 15 JUN 1882',
      '2 PLAC New York Harbor',
      '1 NATU',
      '2 DATE 1 MAR 1888',
      '2 PLAC Kewaunee County Court',
      '1 BAPM',
      '2 DATE 20 MAR 1860',
      '2 PLAC St. Kastor Church',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    const john = indis.get('I1')!;
    expect(john.immigration).toBe('1882-06-15, New York Harbor');
    expect(john.naturalization).toBe('1888-03-01, Kewaunee County Court');
    expect(john.baptized).toBe('1860-03-20, St. Kastor Church');
  });

  it('handles custom military tag', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 _MILT U.S. Army, Pvt., 1917-1919',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    expect(indis.get('I1')!.military).toBe('U.S. Army, Pvt., 1917-1919');
  });

  it('handles EVEN with TYPE Military', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 EVEN',
      '2 TYPE Military',
      '2 DATE 1917',
      '2 PLAC Fort Sheridan, IL',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    expect(indis.get('I1')!.military).toBe('1917, Fort Sheridan, IL');
  });

  it('handles FamilySearch REFN', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 REFN KWJC-HY7',
      '2 TYPE FamilySearch',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    expect(indis.get('I1')!.familySearchId).toBe('KWJC-HY7');
  });

  it('assembles NOTE with CONT/CONC into biography', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 NOTE First paragraph.',
      '2 CONT',
      '2 CONT Second paragraph.',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const indis = extractIndividuals(records);
    expect(indis.get('I1')!.biography).toBe('First paragraph.\n\nSecond paragraph.');
  });
});

// ── extractFamilies ──

describe('extractFamilies', () => {
  it('extracts family records', () => {
    const text = [
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 MARR',
      '2 DATE 1 JUN 1945',
      '2 PLAC Green Bay, WI',
      '1 CHIL @I3@',
      '1 CHIL @I4@',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const fams = extractFamilies(records);
    expect(fams.size).toBe(1);

    const fam = fams.get('F1')!;
    expect(fam.husband).toBe('I1');
    expect(fam.wife).toBe('I2');
    expect(fam.marriageDate).toBe('1945-06-01');
    expect(fam.marriagePlace).toBe('Green Bay, WI');
    expect(fam.children).toEqual(['I3', 'I4']);
    expect(fam.divorce).toBe('');
  });

  it('handles divorce', () => {
    const text = [
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 DIV',
      '2 DATE 15 MAR 1960',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const fams = extractFamilies(records);
    expect(fams.get('F1')!.divorce).toBe('1960-03-15');
  });

  it('handles divorce without date', () => {
    const text = [
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 DIV',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const fams = extractFamilies(records);
    expect(fams.get('F1')!.divorce).toBe('Yes');
  });
});

// ── personFilename / personWikilink ──

describe('personFilename', () => {
  it('generates Surname_Given.md format', () => {
    const indi = { surname: 'Coenen', givenName: 'Roger Francis' } as GedcomIndi;
    expect(personFilename(indi)).toBe('Coenen_Roger_Francis.md');
  });

  it('handles single given name', () => {
    const indi = { surname: 'Fuss', givenName: 'Ruby' } as GedcomIndi;
    expect(personFilename(indi)).toBe('Fuss_Ruby.md');
  });

  it('handles missing surname', () => {
    const indi = { surname: '', givenName: 'Unknown' } as GedcomIndi;
    expect(personFilename(indi)).toBe('Unknown.md');
  });

  it('strips special characters', () => {
    const indi = { surname: "O'Brien", givenName: 'Mary-Jane' } as GedcomIndi;
    expect(personFilename(indi)).toBe('OBrien_MaryJane.md');
  });
});

describe('personWikilink', () => {
  it('generates people/Surname/Surname_Given.md format', () => {
    const indi = { surname: 'Coenen', givenName: 'Roger' } as GedcomIndi;
    expect(personWikilink(indi)).toBe('people/Coenen/Coenen_Roger.md');
  });

  it('uses Unknown dir for missing surname', () => {
    const indi = { surname: '', givenName: 'John' } as GedcomIndi;
    expect(personWikilink(indi)).toBe('people/Unknown/John.md');
  });
});

// ── generatePersonMarkdown ──

describe('generatePersonMarkdown', () => {
  function buildTestData() {
    const text = [
      '0 @I1@ INDI',
      '1 NAME Roger /Coenen/',
      '2 GIVN Roger',
      '2 SURN Coenen',
      '1 SEX M',
      '1 BIRT',
      '2 DATE 15 MAR 1920',
      '2 PLAC Kewaunee, WI',
      '1 DEAT',
      '2 DATE 1 DEC 1990',
      '1 OCCU Farmer',
      '1 FAMC @F1@',
      '1 FAMS @F2@',
      '0 @I2@ INDI',
      '1 NAME Ruby /Fuss/',
      '2 GIVN Ruby',
      '2 SURN Fuss',
      '1 SEX F',
      '1 FAMS @F2@',
      '0 @I3@ INDI',
      '1 NAME Henry /Coenen/',
      '2 GIVN Henry',
      '2 SURN Coenen',
      '1 SEX M',
      '1 FAMS @F1@',
      '0 @I4@ INDI',
      '1 NAME Anna /Schmidt/',
      '2 GIVN Anna',
      '2 SURN Schmidt',
      '1 SEX F',
      '1 FAMS @F1@',
      '0 @I5@ INDI',
      '1 NAME John /Coenen/',
      '2 GIVN John',
      '2 SURN Coenen',
      '1 FAMC @F2@',
      '0 @F1@ FAM',
      '1 HUSB @I3@',
      '1 WIFE @I4@',
      '1 CHIL @I1@',
      '0 @F2@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 MARR',
      '2 DATE 1 JUN 1945',
      '2 PLAC Green Bay, WI',
      '1 CHIL @I5@',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const individuals = extractIndividuals(records);
    const families = extractFamilies(records);
    return { individuals, families };
  }

  it('generates valid frontmatter', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('type: person');
    expect(md).toContain('name: "Roger Coenen"');
    expect(md).toContain('born: 1920-03-15');
    expect(md).toContain('died: 1990-12-01');
    expect(md).toContain('family: "Coenen"');
    expect(md).toContain('gender: M');
    expect(md).toContain('gedcom_id: "I1"');
    expect(md).toContain('confidence: stub');
    expect(md).toContain('imported');
  });

  it('generates vital info table with parent wikilinks', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('| Father | [[people/Coenen/Coenen_Henry.md]] (I3) |');
    expect(md).toContain('| Mother | [[people/Schmidt/Schmidt_Anna.md]] (I4) |');
  });

  it('generates spouse with marriage date and place', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('| Spouse | [[people/Fuss/Fuss_Ruby.md]] (I2), m. 1945-06-01, Green Bay, WI |');
  });

  it('generates children with wikilinks', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('| Children | [[people/Coenen/Coenen_John.md]] (I5) |');
  });

  it('includes occupation in vital table', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('| Occupation | Farmer |');
  });

  it('shows em dash for missing parents', () => {
    const { individuals, families } = buildTestData();
    const md = generatePersonMarkdown(individuals.get('I2')!, individuals, families);

    expect(md).toContain('| Father | \u2014 |');
    expect(md).toContain('| Mother | \u2014 |');
  });

  it('handles multiple spouses with ordinals', () => {
    const text = [
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '2 GIVN John',
      '2 SURN Doe',
      '1 FAMS @F1@',
      '1 FAMS @F2@',
      '0 @I2@ INDI',
      '1 NAME Jane /Smith/',
      '2 GIVN Jane',
      '2 SURN Smith',
      '1 FAMS @F1@',
      '0 @I3@ INDI',
      '1 NAME Mary /Jones/',
      '2 GIVN Mary',
      '2 SURN Jones',
      '1 FAMS @F2@',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 MARR',
      '2 DATE 1920',
      '0 @F2@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I3@',
      '1 MARR',
      '2 DATE 1935',
      '0 TRLR',
    ].join('\n');

    const records = parseGedcomLines(text);
    const individuals = extractIndividuals(records);
    const families = extractFamilies(records);
    const md = generatePersonMarkdown(individuals.get('I1')!, individuals, families);

    expect(md).toContain('Spouse (1st)');
    expect(md).toContain('Spouse (2nd)');
    expect(md).toContain('Children (1st marriage)');
    expect(md).toContain('Children (2nd marriage)');
  });
});
