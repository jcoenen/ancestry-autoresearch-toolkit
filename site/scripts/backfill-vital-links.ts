/**
 * Backfill Vital Information spouse/children wikilinks from person frontmatter.
 *
 * This does not match names. It only uses existing frontmatter GEDCOM IDs:
 *   - spouses[].id for Spouse rows
 *   - children[] for Children rows when the row segment count matches
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-vital-links.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/backfill-vital-links.ts --write
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { splitByComma } from './lib/validate-helpers.js';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const PEOPLE_DIR = resolve(ROOT, 'people');
const args = process.argv.slice(2);
const write = args.includes('--write');

interface PersonSummary {
  id: string;
  file: string;
  name: string;
  born?: string;
  died?: string;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function formatPerson(summary: PersonSummary): string {
  const dates = [summary.born, summary.died].filter(Boolean).join('-');
  const suffix = dates ? `, ${dates}` : '';
  return `[[people/${summary.file}]] ${summary.name} (${summary.id}${suffix})`;
}

function spouseIndex(field: string): number | null {
  if (field === 'Spouse') return 0;
  const match = field.match(/^Spouse \((\d+)(?:st|nd|rd|th)\)$/);
  return match ? Number(match[1]) - 1 : null;
}

const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });
const peopleById = new Map<string, PersonSummary>();

for (const file of personFiles.sort()) {
  const parsed = matter(readFileSync(resolve(PEOPLE_DIR, file), 'utf8'));
  if (parsed.data.type !== 'person') continue;
  const id = typeof parsed.data.gedcom_id === 'string' ? parsed.data.gedcom_id : '';
  if (!/^I\d+$/.test(id)) continue;
  peopleById.set(id, {
    id,
    file,
    name: typeof parsed.data.name === 'string' ? parsed.data.name : id,
    born: typeof parsed.data.born === 'string' ? parsed.data.born : undefined,
    died: typeof parsed.data.died === 'string' ? parsed.data.died : undefined,
  });
}

let touchedFiles = 0;
let changedRows = 0;

for (const file of personFiles.sort()) {
  const fullPath = resolve(PEOPLE_DIR, file);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = matter(raw);
  if (parsed.data.type !== 'person') continue;

  const spouseIds = Array.isArray(parsed.data.spouses)
    ? parsed.data.spouses
        .map((spouse: unknown) => spouse && typeof spouse === 'object' && 'id' in spouse ? String((spouse as { id?: unknown }).id ?? '') : '')
        .filter((id: string) => /^I\d+$/.test(id))
    : [];
  const childIds = asStringArray(parsed.data.children).filter((id) => /^I\d+$/.test(id));
  if (spouseIds.length === 0 && childIds.length === 0) continue;

  const lines = raw.split('\n');
  let inVital = false;
  let changed = false;

  const nextLines = lines.map((line) => {
    if (line.includes('## Vital Information')) {
      inVital = true;
      return line;
    }
    if (inVital && line.startsWith('## ') && !line.includes('Vital')) {
      inVital = false;
      return line;
    }
    if (!inVital || !line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Field')) return line;

    const cells = line.split('|');
    if (cells.length < 5) return line;
    const field = cells[1].trim();
    const value = cells[2].trim();
    if (!value) return line;

    if (field === 'Children' || /^Children \(/.test(field)) {
      const segments = splitByComma(value);
      if (segments.length !== childIds.length) return line;
      if (segments.every((segment) => segment.includes('[[') || /\(I\d+/.test(segment))) return line;
      const linkedChildren = childIds.map((id) => peopleById.get(id)).filter((p): p is PersonSummary => Boolean(p));
      if (linkedChildren.length !== childIds.length) return line;
      cells[2] = ` ${linkedChildren.map(formatPerson).join(', ')} `;
      changed = true;
      changedRows++;
      return cells.join('|');
    }

    const index = spouseIndex(field);
    if (index !== null && spouseIds[index]) {
      if (value.includes('[[') || /\(I\d+/.test(value)) return line;
      const spouse = peopleById.get(spouseIds[index]);
      if (!spouse) return line;
      cells[2] = ` ${formatPerson(spouse)} `;
      changed = true;
      changedRows++;
      return cells.join('|');
    }

    return line;
  });

  if (changed) {
    touchedFiles++;
    console.log(`${write ? 'Updated' : 'Would update'} ${file}`);
    if (write) writeFileSync(fullPath, nextLines.join('\n'));
  }
}

console.log('\nSummary:');
console.log(`Person files checked: ${personFiles.length}`);
console.log(`${write ? 'Updated' : 'Would update'} files: ${touchedFiles}`);
console.log(`${write ? 'Updated' : 'Would update'} rows: ${changedRows}`);
if (!write && touchedFiles > 0) console.log('\nRun again with --write to apply changes.');
