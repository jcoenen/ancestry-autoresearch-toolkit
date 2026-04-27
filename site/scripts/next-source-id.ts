/**
 * Report next source IDs from the vault's source files.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-source-id.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-source-id.ts --type OBIT
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-source-id.ts --type obituary --plain
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/next-source-id.ts --json
 */

import { readFileSync } from 'fs';
import { relative, resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const SOURCE_TYPE_TO_PREFIX: Record<string, string> = {
  obituary: 'OBIT',
  cemetery_memorial: 'CEM',
  church_record: 'CHR',
  secondary: 'SEC',
  ship_manifest: 'IMM',
  military: 'MIL',
  census: 'CENS',
  family_knowledge: 'NOTE',
  certificate: 'CERT',
};

const PREFIX_TO_SOURCE_TYPE = Object.fromEntries(
  Object.entries(SOURCE_TYPE_TO_PREFIX).map(([type, prefix]) => [prefix, type])
);

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const plainOutput = args.includes('--plain');
const typeArg = args.find((arg, index) => args[index - 1] === '--type');

interface SourceEntry {
  id: string;
  prefix: string;
  number: number;
  file: string;
}

interface InvalidEntry {
  value: string;
  file: string;
}

function normalizePrefix(value: string | undefined): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (PREFIX_TO_SOURCE_TYPE[upper]) return upper;
  return SOURCE_TYPE_TO_PREFIX[value.trim()] ?? null;
}

function formatSourceId(prefix: string, number: number): string {
  return `SRC-${prefix}-${String(number).padStart(3, '0')}`;
}

const selectedPrefix = normalizePrefix(typeArg);
if (typeArg && !selectedPrefix) {
  console.error(`Unknown source type "${typeArg}". Use a prefix like OBIT or a source_type like obituary.`);
  process.exit(1);
}

const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
const entries: SourceEntry[] = [];
const invalidEntries: InvalidEntry[] = [];

for (const file of sourceFiles.sort()) {
  const fullPath = resolve(SOURCES_DIR, file);
  const parsed = matter(readFileSync(fullPath, 'utf8'));
  if (parsed.data.type !== 'source' || parsed.data.source_id === undefined) continue;

  const rawId = String(parsed.data.source_id).trim();
  const match = rawId.match(/^SRC-([A-Z]+)-(\d{3})$/);
  if (!match) {
    invalidEntries.push({ value: rawId, file });
    continue;
  }

  entries.push({
    id: rawId,
    prefix: match[1],
    number: Number(match[2]),
    file,
  });
}

const byPrefix = new Map<string, SourceEntry[]>();
for (const entry of entries) {
  const matches = byPrefix.get(entry.prefix) ?? [];
  matches.push(entry);
  byPrefix.set(entry.prefix, matches);
}

const duplicateMap = new Map<string, SourceEntry[]>();
for (const entry of entries) {
  const matches = duplicateMap.get(entry.id) ?? [];
  matches.push(entry);
  duplicateMap.set(entry.id, matches);
}

const duplicates = [...duplicateMap.entries()]
  .filter(([, matches]) => matches.length > 1)
  .map(([id, matches]) => ({ id, files: matches.map((match) => match.file) }));

const nextByPrefix = Object.fromEntries(
  Object.values(SOURCE_TYPE_TO_PREFIX).map((prefix) => {
    const matches = (byPrefix.get(prefix) ?? []).sort((a, b) => a.number - b.number);
    const maxNumber = matches.at(-1)?.number ?? 0;
    return [prefix, {
      sourceType: PREFIX_TO_SOURCE_TYPE[prefix],
      count: matches.length,
      maxId: maxNumber ? formatSourceId(prefix, maxNumber) : null,
      nextId: formatSourceId(prefix, maxNumber + 1),
    }];
  })
);

const result = {
  vaultRoot: ROOT,
  sourcesDir: relative(process.cwd(), SOURCES_DIR) || SOURCES_DIR,
  sourceFiles: sourceFiles.length,
  sourceIds: entries.length,
  nextByPrefix,
  duplicates,
  invalidEntries,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else if (plainOutput && selectedPrefix) {
  console.log(nextByPrefix[selectedPrefix].nextId);
} else if (selectedPrefix) {
  const summary = nextByPrefix[selectedPrefix];
  console.log(`Vault root: ${ROOT}`);
  console.log(`Source type: ${summary.sourceType}`);
  console.log(`Source IDs found: ${summary.count}`);
  console.log(`Highest source ID: ${summary.maxId ?? 'none'}`);
  console.log(`Next source ID: ${summary.nextId}`);
} else {
  console.log(`Vault root: ${ROOT}`);
  console.log(`Source files: ${result.sourceFiles}`);
  console.log(`Source IDs found: ${result.sourceIds}`);
  console.log('\nNext source IDs:');
  for (const [prefix, summary] of Object.entries(nextByPrefix)) {
    console.log(`- ${prefix.padEnd(4)} ${summary.nextId} (${summary.sourceType}; current max ${summary.maxId ?? 'none'})`);
  }

  if (duplicates.length > 0) {
    console.log('\nDuplicate source IDs:');
    for (const duplicate of duplicates) {
      console.log(`- ${duplicate.id}: ${duplicate.files.join(', ')}`);
    }
  }

  if (invalidEntries.length > 0) {
    console.log('\nInvalid source IDs:');
    for (const invalid of invalidEntries) {
      console.log(`- ${invalid.file}: ${invalid.value}`);
    }
  }
}

if (duplicates.length > 0 || invalidEntries.length > 0) {
  process.exitCode = 1;
}
