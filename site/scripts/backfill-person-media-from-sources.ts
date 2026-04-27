/**
 * Backfill person frontmatter media from source media links.
 *
 * This is intentionally conservative. A media file is added to a person only
 * when:
 *   - the source file lists the media in frontmatter
 *   - the source file has exactly one person_ids entry
 *   - no person file already claims that media
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-media-from-sources.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-media-from-sources.ts --write
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-person-media-from-sources.ts --all-person-ids --write
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
const allPersonIds = args.includes('--all-person-ids');

interface PersonRecord {
  file: string;
  fullPath: string;
  raw: string;
  media: string[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function replaceMediaBlock(raw: string, media: string[]): string {
  if (!raw.startsWith('---\n')) throw new Error('File does not have YAML frontmatter');

  const end = raw.indexOf('\n---', 4);
  if (end < 0) throw new Error('File does not have closing YAML frontmatter');

  const frontmatter = raw.slice(0, end);
  const body = raw.slice(end);
  const mediaBlock = media.length > 0
    ? `media:\n${media.map((ref) => `  - "${ref}"`).join('\n')}`
    : 'media: []';

  if (/^media:\s*\[\]\s*$/m.test(frontmatter)) {
    return `${frontmatter.replace(/^media:\s*\[\]\s*$/m, mediaBlock)}${body}`;
  }

  if (/^media:\s*$/m.test(frontmatter)) {
    return `${frontmatter.replace(/^media:[\s\S]*?(?=\n[a-zA-Z_][a-zA-Z0-9_-]*:|\n---)/m, mediaBlock)}${body}`;
  }

  return `${frontmatter}\n${mediaBlock}${body}`;
}

const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });
const peopleById = new Map<string, PersonRecord>();
const claimedByPeople = new Map<string, string[]>();

for (const file of personFiles.sort()) {
  const fullPath = resolve(PEOPLE_DIR, file);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  if (parsed.data.type !== 'person') continue;

  const gedcomId = typeof parsed.data.gedcom_id === 'string' ? parsed.data.gedcom_id : '';
  if (!/^I\d+$/.test(gedcomId)) continue;

  const media = asStringArray(parsed.data.media);
  const person: PersonRecord = { file, fullPath, raw, media };
  peopleById.set(gedcomId, person);
  for (const ref of media) {
    claimedByPeople.set(ref, [...(claimedByPeople.get(ref) ?? []), file]);
  }
}

const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
const additions = new Map<string, { person: PersonRecord; refs: Set<string> }>();
let skippedMultiplePeople = 0;
let skippedAlreadyClaimed = 0;
let skippedMissingPerson = 0;

for (const file of sourceFiles.sort()) {
  const fullPath = resolve(SOURCES_DIR, file);
  const parsed = matter(readFileSync(fullPath, 'utf8'));
  if (parsed.data.type !== 'source') continue;

  const media = asStringArray(parsed.data.media);
  if (media.length === 0) continue;

  const personIds = asStringArray(parsed.data.person_ids);
  if (personIds.length !== 1 && !allPersonIds) {
    skippedMultiplePeople += media.filter((ref) => !claimedByPeople.has(ref)).length;
    continue;
  }

  for (const ref of media) {
    if (claimedByPeople.has(ref)) {
      skippedAlreadyClaimed++;
      continue;
    }

    for (const personId of personIds) {
      const person = peopleById.get(personId);
      if (!person) {
        skippedMissingPerson++;
        continue;
      }

      const entry = additions.get(person.file) ?? { person, refs: new Set<string>() };
      entry.refs.add(ref);
      additions.set(person.file, entry);
    }
  }
}

let addedRefs = 0;
for (const { person, refs } of additions.values()) {
  const nextMedia = [...new Set([...person.media, ...refs])].sort();
  addedRefs += refs.size;
  console.log(`${write ? 'Updated' : 'Would update'} ${person.file}: ${[...refs].join(', ')}`);

  if (write) {
    writeFileSync(person.fullPath, replaceMediaBlock(person.raw, nextMedia));
  }
}

console.log('\nSummary:');
console.log(`Person files checked: ${personFiles.length}`);
console.log(`Source files checked: ${sourceFiles.length}`);
console.log(`${write ? 'Added' : 'Would add'} media refs: ${addedRefs}`);
console.log(`Person files touched: ${additions.size}`);
console.log(`Skipped already claimed refs: ${skippedAlreadyClaimed}`);
console.log(`Skipped refs from multi-person sources: ${skippedMultiplePeople}`);
console.log(`Skipped refs with missing person record: ${skippedMissingPerson}`);
if (!write && addedRefs > 0) console.log('\nRun again with --write to apply changes.');
