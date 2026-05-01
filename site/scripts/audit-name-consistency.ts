/**
 * Report-only audit for person-name consistency.
 *
 * The vault standard is birth name as the primary person `name`; married names
 * belong in the Vital Information `Married Name` row.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-name-consistency.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-name-consistency.ts --json
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-name-consistency.ts --fail-on-issues
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { parseVitalTable } from './lib/build-helpers.js';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const PEOPLE_DIR = resolve(ROOT, 'people');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const failOnIssues = args.includes('--fail-on-issues');

type Severity = 'error' | 'warning' | 'review';
type Category =
  | 'primary_name_contains_nee'
  | 'primary_name_matches_married_name'
  | 'female_family_mismatch'
  | 'file_folder_family_mismatch'
  | 'full_name_contains_married_context'
  | 'married_female_missing_married_name';

interface PersonRecord {
  file: string;
  folder: string;
  id: string;
  name: string;
  gender: string;
  family: string;
  privacy: boolean;
  sources: string[];
  fullName: string;
  marriedName: string;
  spouseRows: string[];
  frontmatterSpouses: string[];
}

interface Finding {
  severity: Severity;
  category: Category;
  file: string;
  id: string;
  name: string;
  family: string;
  value: string;
  note: string;
  suggestedAction: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/"[^"]*"/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compact(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function splitNames(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function hasKnownValue(value: string): boolean {
  return Boolean(value && !['—', '-', '~', 'unknown', 'n/a'].includes(value.trim().toLowerCase()));
}

function rowValues(fields: Record<string, string>, pattern: RegExp): string[] {
  return Object.entries(fields)
    .filter(([field]) => pattern.test(field))
    .map(([, value]) => value)
    .filter(hasKnownValue);
}

function familyMatchesName(family: string, name: string): boolean {
  const familyKey = compact(family);
  const nameKey = compact(name);
  if (!familyKey || !nameKey) return true;
  return nameKey.includes(familyKey);
}

function fileFolderMatchesFamily(folder: string, family: string): boolean {
  const folderKey = compact(folder);
  const familyKey = compact(family);
  if (!folderKey || !familyKey) return true;
  return folderKey === familyKey;
}

async function loadPeople(): Promise<PersonRecord[]> {
  if (!existsSync(PEOPLE_DIR)) throw new Error(`People directory not found: ${PEOPLE_DIR}`);

  const files = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });
  const people: PersonRecord[] = [];

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'person') continue;

    const fields = parseVitalTable(content);
    const spouses = asStringArray(fm.spouses).length > 0
      ? asStringArray(fm.spouses)
      : Array.isArray(fm.spouses)
        ? fm.spouses.map(item => typeof item === 'object' && item ? asString((item as Record<string, unknown>).id) : asString(item))
        : [];

    people.push({
      file,
      folder: file.split('/')[0] || '',
      id: asString(fm.gedcom_id),
      name: asString(fm.name),
      gender: asString(fm.gender),
      family: asString(fm.family),
      privacy: fm.privacy === true,
      sources: asStringArray(fm.sources),
      fullName: fields['Full Name'] || '',
      marriedName: fields['Married Name'] || '',
      spouseRows: rowValues(fields, /^Spouse(?:\s+\([^)]+\))?$/i),
      frontmatterSpouses: spouses.filter(Boolean),
    });
  }

  return people;
}

function auditPerson(person: PersonRecord): Finding[] {
  const findings: Finding[] = [];
  const isFemale = person.gender.toUpperCase() === 'F';

  if (isFemale && /\bne[eé]\b|\(nee|\(née/i.test(person.name)) {
    findings.push({
      severity: 'warning',
      category: 'primary_name_contains_nee',
      file: person.file,
      id: person.id,
      name: person.name,
      family: person.family,
      value: person.name,
      note: 'Primary name includes nee/née wording instead of a clean birth name.',
      suggestedAction: 'Move married/current name to Married Name and keep primary name as birth/maiden name.',
    });
  }

  if (isFemale && person.marriedName) {
    const matchingMarriedNames = splitNames(person.marriedName)
      .filter(name => normalize(name) === normalize(person.name));
    if (matchingMarriedNames.length > 0) {
      findings.push({
        severity: person.privacy ? 'review' : 'warning',
        category: 'primary_name_matches_married_name',
        file: person.file,
        id: person.id,
        name: person.name,
        family: person.family,
        value: matchingMarriedNames.join(', '),
        note: 'Primary name exactly matches a Married Name value.',
        suggestedAction: 'Verify whether the primary name is actually a married name or a same-surname/unknown-maiden case.',
      });
    }
  }

  if (isFemale && person.family && person.name && !familyMatchesName(person.family, person.name)) {
    findings.push({
      severity: 'review',
      category: 'female_family_mismatch',
      file: person.file,
      id: person.id,
      name: person.name,
      family: person.family,
      value: person.name,
      note: 'Female primary name does not contain the family field surname.',
      suggestedAction: 'If birth surname is known, align family/file folder to birth surname; if unknown, document associated married-surname filing.',
    });
  }

  if (person.family && person.folder && !fileFolderMatchesFamily(person.folder, person.family)) {
    findings.push({
      severity: 'review',
      category: 'file_folder_family_mismatch',
      file: person.file,
      id: person.id,
      name: person.name,
      family: person.family,
      value: person.folder,
      note: 'Person file folder does not match the family field.',
      suggestedAction: 'Move the file to people/{family}/ or document why this folder is an intentional project exception.',
    });
  }

  if (isFemale && /\bmarried\b|married name|\bnee\b|\bnée\b/i.test(person.fullName)) {
    findings.push({
      severity: 'review',
      category: 'full_name_contains_married_context',
      file: person.file,
      id: person.id,
      name: person.name,
      family: person.family,
      value: person.fullName,
      note: 'Full Name row mixes name value with explanatory married-name context.',
      suggestedAction: 'Keep Full Name as the birth/full legal name and move married/current name to Married Name or notes.',
    });
  }

  const hasSpouse = person.spouseRows.length > 0 || person.frontmatterSpouses.length > 0;
  if (isFemale && hasSpouse && !person.privacy && !person.marriedName) {
    findings.push({
      severity: 'review',
      category: 'married_female_missing_married_name',
      file: person.file,
      id: person.id,
      name: person.name,
      family: person.family,
      value: '',
      note: 'Non-private female person has spouse data but no Married Name row.',
      suggestedAction: 'Add Married Name only when a source supports the married surname.',
    });
  }

  return findings;
}

const people = await loadPeople();
const findings = people.flatMap(auditPerson);
const counts = findings.reduce<Record<string, number>>((acc, finding) => {
  acc[finding.category] = (acc[finding.category] || 0) + 1;
  return acc;
}, {});

if (jsonOutput) {
  console.log(JSON.stringify({
    vaultRoot: ROOT,
    peopleChecked: people.length,
    findings,
    counts,
  }, null, 2));
} else {
  console.log('Name consistency audit');
  console.log(`Vault: ${ROOT}`);
  console.log(`People checked: ${people.length}`);
  console.log(`Findings: ${findings.length}`);
  console.log('');
  console.log('| Category | Count |');
  console.log('|---|---:|');
  for (const [category, count] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`| ${category} | ${count} |`);
  }

  console.log('');
  for (const finding of findings) {
    console.log(`${finding.severity.toUpperCase().padEnd(7)} ${finding.category} ${finding.file}`);
    console.log(`  person: ${finding.name || '(unnamed)'} ${finding.id ? `(${finding.id})` : ''}`);
    if (finding.family) console.log(`  family: ${finding.family}`);
    if (finding.value) console.log(`  value: ${finding.value}`);
    console.log(`  note: ${finding.note}`);
    console.log(`  action: ${finding.suggestedAction}`);
  }
}

if (failOnIssues && findings.length > 0) process.exitCode = 1;
