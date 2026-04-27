/**
 * Report-only audit for source/person relational links.
 *
 * This intentionally does not match names from source persons:. It checks only
 * stable IDs and reciprocal citations:
 *   - every person source citation should appear in source person_ids
 *   - every source person_ids entry should cite the source back
 *   - source persons/person_ids count mismatches are flagged for human review
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-source-person-links.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-source-person-links.ts --json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const jsonOutput = process.argv.includes('--json');

interface PersonRecord {
  id: string;
  file: string;
  sources: string[];
}

interface SourceRecord {
  id: string;
  file: string;
  persons: string[];
  personIds: string[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

const peopleById = new Map<string, PersonRecord>();
const sourceCitations = new Map<string, Set<string>>();

for (const file of (await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true })).sort()) {
  const parsed = matter(readFileSync(resolve(PEOPLE_DIR, file), 'utf8'));
  if (parsed.data.type !== 'person') continue;

  const id = typeof parsed.data.gedcom_id === 'string' ? parsed.data.gedcom_id : '';
  if (!/^I\d+$/.test(id)) continue;

  const sources = asStringArray(parsed.data.sources);
  peopleById.set(id, { id, file, sources });
  for (const sourceId of sources) {
    const citingPeople = sourceCitations.get(sourceId) ?? new Set<string>();
    citingPeople.add(id);
    sourceCitations.set(sourceId, citingPeople);
  }
}

const sourcesById = new Map<string, SourceRecord>();
for (const file of (await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] })).sort()) {
  const parsed = matter(readFileSync(resolve(SOURCES_DIR, file), 'utf8'));
  if (parsed.data.type !== 'source') continue;

  const id = typeof parsed.data.source_id === 'string' ? parsed.data.source_id : '';
  if (!id) continue;

  sourcesById.set(id, {
    id,
    file,
    persons: asStringArray(parsed.data.persons),
    personIds: asStringArray(parsed.data.person_ids),
  });
}

const missingFromSourcePersonIds: string[] = [];
const sourcePersonIdNotCitedBack: string[] = [];
const countMismatches: string[] = [];

for (const [sourceId, citingPeople] of sourceCitations) {
  const source = sourcesById.get(sourceId);
  if (!source) continue;
  const sourcePersonIds = new Set(source.personIds);

  for (const personId of citingPeople) {
    if (!sourcePersonIds.has(personId)) {
      const person = peopleById.get(personId);
      missingFromSourcePersonIds.push(`${source.file} (${sourceId}) is cited by ${person?.file ?? personId} (${personId}) but does not list that ID in person_ids`);
    }
  }
}

for (const source of sourcesById.values()) {
  const citingPeople = sourceCitations.get(source.id) ?? new Set<string>();
  for (const personId of source.personIds) {
    if (!citingPeople.has(personId)) {
      const person = peopleById.get(personId);
      sourcePersonIdNotCitedBack.push(`${source.file} (${source.id}) lists ${person?.file ?? personId} (${personId}) in person_ids, but that person does not cite the source`);
    }
  }

  if (source.persons.length !== source.personIds.length) {
    countMismatches.push(`${source.file} (${source.id}) has ${source.persons.length} persons display names and ${source.personIds.length} person_ids`);
  }
}

const result = {
  vaultRoot: ROOT,
  people: peopleById.size,
  sources: sourcesById.size,
  missingFromSourcePersonIds,
  sourcePersonIdNotCitedBack,
  countMismatches,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Vault root: ${ROOT}`);
  console.log(`People checked: ${result.people}`);
  console.log(`Sources checked: ${result.sources}`);

  console.log(`\nPerson citations missing from source person_ids: ${missingFromSourcePersonIds.length}`);
  for (const line of missingFromSourcePersonIds) console.log(`- ${line}`);

  console.log(`\nSource person_ids missing reciprocal person citation: ${sourcePersonIdNotCitedBack.length}`);
  for (const line of sourcePersonIdNotCitedBack) console.log(`- ${line}`);

  console.log(`\nDisplay-name/person_ids count mismatches for review: ${countMismatches.length}`);
  for (const line of countMismatches) console.log(`- ${line}`);
}

if (missingFromSourcePersonIds.length > 0 || sourcePersonIdNotCitedBack.length > 0) {
  process.exitCode = 1;
}
