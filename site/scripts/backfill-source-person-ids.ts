/**
 * Backfill source frontmatter person_ids from person-file source citations.
 *
 * This is intentionally relational: it never attempts to match names from
 * source persons:. If a person file cites a source_id, that person's gedcom_id
 * is added to the source's person_ids list.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-source-person-ids.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-source-person-ids.ts --write
 */

import { readFileSync, writeFileSync } from 'fs';
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function addPersonIdsFrontmatter(raw: string, ids: string[]): string {
  if (ids.length === 0) return raw;
  if (!raw.startsWith('---\n')) throw new Error('File does not have YAML frontmatter');

  const end = raw.indexOf('\n---', 4);
  if (end < 0) throw new Error('File does not have closing YAML frontmatter');

  const frontmatter = raw.slice(0, end);
  const body = raw.slice(end);
  const personIdsBlock = `person_ids:\n${ids.map((id) => `  - "${id}"`).join('\n')}\n`;

  if (/^person_ids:\s*$/m.test(frontmatter) || /^person_ids:\s*\[/m.test(frontmatter)) {
    return raw.replace(/^person_ids:[\s\S]*?(?=\n[a-zA-Z_][a-zA-Z0-9_-]*:|\n---)/m, personIdsBlock.trimEnd());
  }

  const personsMatch = frontmatter.match(/^persons:\s*$/m);
  if (personsMatch?.index !== undefined) {
    const afterPersons = frontmatter.indexOf('\n', personsMatch.index) + 1;
    const rest = frontmatter.slice(afterPersons);
    const nextTopLevel = rest.match(/\n[a-zA-Z_][a-zA-Z0-9_-]*:/);
    const insertAt = nextTopLevel?.index !== undefined
      ? afterPersons + nextTopLevel.index + 1
      : frontmatter.length;
    return `${frontmatter.slice(0, insertAt)}${personIdsBlock}${frontmatter.slice(insertAt)}${body}`;
  }

  return `${frontmatter}\n${personIdsBlock}${body}`;
}

const sourceToPersonIds = new Map<string, Set<string>>();
const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });

for (const file of personFiles.sort()) {
  const fullPath = resolve(PEOPLE_DIR, file);
  const parsed = matter(readFileSync(fullPath, 'utf8'));
  if (parsed.data.type !== 'person') continue;

  const gedcomId = typeof parsed.data.gedcom_id === 'string' ? parsed.data.gedcom_id : '';
  if (!/^I\d+$/.test(gedcomId)) continue;

  for (const sourceId of asStringArray(parsed.data.sources)) {
    const ids = sourceToPersonIds.get(sourceId) ?? new Set<string>();
    ids.add(gedcomId);
    sourceToPersonIds.set(sourceId, ids);
  }
}

const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
let updated = 0;
let alreadyCurrent = 0;
let noCitingPeople = 0;

for (const file of sourceFiles.sort()) {
  const fullPath = resolve(SOURCES_DIR, file);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  if (parsed.data.type !== 'source') continue;

  const sourceId = typeof parsed.data.source_id === 'string' ? parsed.data.source_id : '';
  const derivedIds = [...(sourceToPersonIds.get(sourceId) ?? new Set<string>())]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  if (derivedIds.length === 0) {
    noCitingPeople++;
    continue;
  }

  const existingIds = asStringArray(parsed.data.person_ids)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  if (JSON.stringify(existingIds) === JSON.stringify(derivedIds)) {
    alreadyCurrent++;
    continue;
  }

  updated++;
  console.log(`${write ? 'Updated' : 'Would update'} ${file}: ${derivedIds.join(', ')}`);

  if (write) {
    writeFileSync(fullPath, addPersonIdsFrontmatter(raw, derivedIds));
  }
}

console.log('\nSummary:');
console.log(`Source files checked: ${sourceFiles.length}`);
console.log(`${write ? 'Updated' : 'Would update'}: ${updated}`);
console.log(`Already current: ${alreadyCurrent}`);
console.log(`No citing person files: ${noCitingPeople}`);
if (!write && updated > 0) console.log('\nRun again with --write to apply changes.');
