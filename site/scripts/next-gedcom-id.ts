/**
 * Report the next GEDCOM individual ID from the vault's person files.
 *
 * The person files are the source of truth. This avoids storing a stale
 * "next ID" in handover notes or other human-maintained documents.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-gedcom-id.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-gedcom-id.ts --plain
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-gedcom-id.ts --json
 */

import { readFileSync } from 'fs';
import { relative, resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const PEOPLE_DIR = resolve(ROOT, 'people');
const args = process.argv.slice(2);
const plainOutput = args.includes('--plain');
const jsonOutput = args.includes('--json');

interface GedcomEntry {
  id: string;
  number: number;
  file: string;
}

interface InvalidEntry {
  value: string;
  file: string;
}

const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });
const entries: GedcomEntry[] = [];
const invalidEntries: InvalidEntry[] = [];

for (const file of personFiles.sort()) {
  const fullPath = resolve(PEOPLE_DIR, file);
  const parsed = matter(readFileSync(fullPath, 'utf8'));
  if (parsed.data.type !== 'person' || parsed.data.gedcom_id === undefined) continue;

  const rawId = String(parsed.data.gedcom_id).trim();
  const match = rawId.match(/^I([1-9]\d*)$/);

  if (!match) {
    invalidEntries.push({ value: rawId, file });
    continue;
  }

  entries.push({
    id: rawId,
    number: Number(match[1]),
    file,
  });
}

entries.sort((a, b) => a.number - b.number);

const maxNumber = entries.at(-1)?.number ?? 0;
const nextNumber = maxNumber + 1;
const nextId = `I${nextNumber}`;
const usedNumbers = new Set(entries.map((entry) => entry.number));

const duplicateMap = new Map<string, GedcomEntry[]>();
for (const entry of entries) {
  const existing = duplicateMap.get(entry.id);
  if (existing) existing.push(entry);
  else duplicateMap.set(entry.id, [entry]);
}

const duplicates = [...duplicateMap.entries()]
  .filter(([, matches]) => matches.length > 1)
  .map(([id, matches]) => ({ id, files: matches.map((match) => match.file) }));

const gaps: string[] = [];
for (let number = 1; number < maxNumber; number += 1) {
  if (!usedNumbers.has(number)) gaps.push(`I${number}`);
}

const result = {
  vaultRoot: ROOT,
  peopleDir: relative(process.cwd(), PEOPLE_DIR) || PEOPLE_DIR,
  personFiles: personFiles.length,
  gedcomIds: entries.length,
  maxId: maxNumber ? `I${maxNumber}` : null,
  nextId,
  firstGap: gaps[0] ?? null,
  gaps,
  duplicates,
  invalidEntries,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else if (plainOutput) {
  console.log(nextId);
} else {
  console.log(`Vault root: ${ROOT}`);
  console.log(`Person files: ${result.personFiles}`);
  console.log(`GEDCOM IDs found: ${result.gedcomIds}`);
  console.log(`Highest GEDCOM ID: ${result.maxId ?? 'none'}`);
  console.log(`Next GEDCOM ID: ${result.nextId}`);

  if (result.firstGap) {
    console.log(`First unused lower ID: ${result.firstGap}`);
    console.log(`Unused lower IDs: ${result.gaps.length}`);
  }

  if (duplicates.length > 0) {
    console.log('\nDuplicate GEDCOM IDs:');
    for (const duplicate of duplicates) {
      console.log(`- ${duplicate.id}: ${duplicate.files.join(', ')}`);
    }
  }

  if (invalidEntries.length > 0) {
    console.log('\nInvalid GEDCOM IDs:');
    for (const invalid of invalidEntries) {
      console.log(`- ${invalid.file}: ${invalid.value}`);
    }
  }
}

if (duplicates.length > 0 || invalidEntries.length > 0) {
  process.exitCode = 1;
}
