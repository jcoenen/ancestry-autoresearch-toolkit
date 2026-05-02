/**
 * Backfill person frontmatter sources from source-file person_ids.
 *
 * This is intentionally relational: it never attempts to match names from
 * source persons:. If a source file lists a gedcom_id in person_ids, that
 * source_id is added to the matching person's sources list.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-sources-from-source-person-ids.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-sources-from-source-person-ids.ts --write
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-sources-from-source-person-ids.ts --json
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-sources-from-source-person-ids.ts --fail-on-changes
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const args = process.argv.slice(2);
const write = args.includes('--write');
const jsonOutput = args.includes('--json');
const failOnChanges = args.includes('--fail-on-changes');

interface PersonRecord {
  id: string;
  file: string;
  fullPath: string;
  raw: string;
  sources: string[];
}

interface Addition {
  personId: string;
  personFile: string;
  sourceId: string;
  sourceFile: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function sourceSort(a: string, b: string): number {
  const left = a.match(/^SRC-([A-Z]+)-(\d+)$/);
  const right = b.match(/^SRC-([A-Z]+)-(\d+)$/);
  if (left && right && left[1] === right[1]) return Number(left[2]) - Number(right[2]);
  return a.localeCompare(b);
}

function replaceSourcesBlock(raw: string, sources: string[]): string {
  if (!raw.startsWith('---\n')) throw new Error('File does not have YAML frontmatter');

  const end = raw.indexOf('\n---', 4);
  if (end < 0) throw new Error('File does not have closing YAML frontmatter');

  const frontmatter = raw.slice(0, end);
  const body = raw.slice(end);
  const sourcesBlock = sources.length > 0
    ? `sources:\n${sources.map((sourceId) => `  - "${sourceId}"`).join('\n')}`
    : 'sources: []';

  if (/^sources:\s*(?:\[[^\n]*\]|(?:\n\s+-[^\n]*)*)/m.test(frontmatter)) {
    return `${frontmatter.replace(/^sources:\s*(?:\[[^\n]*\]|(?:\n\s+-[^\n]*)*)/m, sourcesBlock)}${body}`;
  }

  const anchors = [/^confidence:.*$/m, /^privacy:.*$/m, /^gedcom_id:.*$/m, /^family:.*$/m];
  for (const anchor of anchors) {
    const match = frontmatter.match(anchor);
    if (match?.index !== undefined) {
      const insertAt = frontmatter.indexOf('\n', match.index) + 1;
      return `${frontmatter.slice(0, insertAt)}${sourcesBlock}\n${frontmatter.slice(insertAt)}${body}`;
    }
  }

  return `${frontmatter}\n${sourcesBlock}${body}`;
}

if (!existsSync(PEOPLE_DIR)) throw new Error(`People directory not found: ${PEOPLE_DIR}`);
if (!existsSync(SOURCES_DIR)) throw new Error(`Sources directory not found: ${SOURCES_DIR}`);

const peopleById = new Map<string, PersonRecord>();
const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });

for (const file of personFiles.sort()) {
  const fullPath = resolve(PEOPLE_DIR, file);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  if (parsed.data.type !== 'person') continue;

  const id = asString(parsed.data.gedcom_id);
  if (!/^I\d+$/.test(id)) continue;

  peopleById.set(id, {
    id,
    file,
    fullPath,
    raw,
    sources: asStringArray(parsed.data.sources),
  });
}

const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
const additionsByPerson = new Map<string, { person: PersonRecord; additions: Addition[] }>();
let sourceFilesWithPersonIds = 0;
let personIdsChecked = 0;
let skippedMissingPerson = 0;
let skippedMissingSourceId = 0;

for (const file of sourceFiles.sort()) {
  const fullPath = resolve(SOURCES_DIR, file);
  const parsed = matter(readFileSync(fullPath, 'utf8'));
  if (parsed.data.type !== 'source') continue;

  const sourceId = asString(parsed.data.source_id);
  if (!sourceId) {
    skippedMissingSourceId++;
    continue;
  }

  const personIds = asStringArray(parsed.data.person_ids);
  if (personIds.length > 0) sourceFilesWithPersonIds++;

  for (const personId of personIds) {
    personIdsChecked++;
    const person = peopleById.get(personId);
    if (!person) {
      skippedMissingPerson++;
      continue;
    }
    if (person.sources.includes(sourceId)) continue;

    const entry = additionsByPerson.get(person.id) ?? { person, additions: [] };
    entry.additions.push({ personId, personFile: person.file, sourceId, sourceFile: file });
    additionsByPerson.set(person.id, entry);
  }
}

const additions = [...additionsByPerson.values()]
  .flatMap((entry) => entry.additions)
  .sort((a, b) => a.personFile.localeCompare(b.personFile) || sourceSort(a.sourceId, b.sourceId));

for (const { person, additions: personAdditions } of additionsByPerson.values()) {
  const nextSources = [...new Set([...person.sources, ...personAdditions.map((item) => item.sourceId)])].sort(sourceSort);
  if (!jsonOutput) {
    console.log(`${write ? 'Updated' : 'Would update'} ${person.file}: ${personAdditions.map((item) => item.sourceId).sort(sourceSort).join(', ')}`);
  }

  if (write) {
    writeFileSync(person.fullPath, replaceSourcesBlock(person.raw, nextSources));
  }
}

if (jsonOutput) {
  console.log(JSON.stringify({
    vaultRoot: ROOT,
    peopleChecked: peopleById.size,
    sourceFilesChecked: sourceFiles.length,
    sourceFilesWithPersonIds,
    personIdsChecked,
    personFilesTouched: additionsByPerson.size,
    sourceRefsAdded: additions.length,
    skippedMissingPerson,
    skippedMissingSourceId,
    additions,
  }, null, 2));
} else {
  console.log('\nSummary:');
  console.log(`People checked: ${peopleById.size}`);
  console.log(`Source files checked: ${sourceFiles.length}`);
  console.log(`Source files with person_ids: ${sourceFilesWithPersonIds}`);
  console.log(`person_ids checked: ${personIdsChecked}`);
  console.log(`Person files touched: ${additionsByPerson.size}`);
  console.log(`${write ? 'Added' : 'Would add'} source refs: ${additions.length}`);
  console.log(`Skipped missing people: ${skippedMissingPerson}`);
  console.log(`Skipped missing source_id: ${skippedMissingSourceId}`);
  if (!write && additions.length > 0) console.log('\nRun again with --write to apply changes.');
}

if (failOnChanges && additions.length > 0) process.exitCode = 1;
