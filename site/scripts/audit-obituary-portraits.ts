/**
 * Audit obituary sources for missing linked portrait media.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-portraits.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-portraits.ts --json
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-portraits.ts --missing-only
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const MEDIA_INDEX = resolve(ROOT, 'media', '_Media_Index.md');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const missingOnly = args.includes('--missing-only');

interface SourceAudit {
  file: string;
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  decedent: string;
  sourcePortraits: string[];
  personPortraits: string[];
  indexPortraits: string[];
  linkedPersonFiles: string[];
  status: 'has_portrait' | 'has_person_portrait' | 'missing_portrait' | 'checked_no_portrait' | 'no_url';
  notes: string[];
}

interface PersonRef {
  file: string;
  gedcomId: string;
  name: string;
  sources: string[];
  media: string[];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function hasCheckedNoPortraitStatus(fm: Record<string, unknown>): boolean {
  return asString(fm.portrait_status) === 'checked_no_portrait'
    || fm.portrait_checked_no_portrait === true;
}

function isPortraitPath(path: string): boolean {
  return path.startsWith('portraits/') || path.split('/').some((part) => part.startsWith('POR_'));
}

function domainFor(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function decedentFromTitle(title: string): string {
  const cleaned = title
    .replace(/^Obituary of\s+/i, '')
    .replace(/^Obituary:\s*/i, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .trim();
  return cleaned || title;
}

function parseMediaIndexPortraits(): Set<string> {
  const portraits = new Set<string>();
  if (!existsSync(MEDIA_INDEX)) return portraits;

  const raw = readFileSync(MEDIA_INDEX, 'utf-8');
  for (const line of raw.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const localPath = cells[1] || '';
    if (isPortraitPath(localPath)) portraits.add(localPath);
  }
  return portraits;
}

function parseCheckedFindAGraveMemorials(): Set<string> {
  const checked = new Set<string>();
  if (!existsSync(MEDIA_INDEX)) return checked;

  const raw = readFileSync(MEDIA_INDEX, 'utf-8');
  const sections = [
    raw.match(/## Memorials With No Photos[\s\S]*?(?=\n---|\n## |$)/)?.[0] || '',
    raw.match(/## Memorials Checked — No New Photos[\s\S]*?(?=\n---|\n## |$)/)?.[0] || '',
  ];

  for (const section of sections) {
    for (const line of section.split('\n')) {
      const match = line.match(/^\|\s*(\d+)\s*\|/);
      if (match?.[1]) checked.add(match[1]);
    }
  }

  return checked;
}

function findAGraveMemorialId(url: string): string {
  return url.match(/findagrave\.com\/memorial\/(\d+)/)?.[1] || '';
}

async function loadPeople(): Promise<PersonRef[]> {
  if (!existsSync(PEOPLE_DIR)) return [];
  const files = await glob('**/*.md', { cwd: PEOPLE_DIR });
  const people: PersonRef[] = [];

  for (const file of files) {
    const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
    const { data: fm } = matter(raw);
    if (fm.type !== 'person') continue;
    people.push({
      file,
      gedcomId: asString(fm.gedcom_id),
      name: asString(fm.name),
      sources: asStringArray(fm.sources),
      media: asStringArray(fm.media),
    });
  }

  return people;
}

async function audit(): Promise<{ all: SourceAudit[]; report: SourceAudit[] }> {
  if (!existsSync(SOURCES_DIR)) {
    throw new Error(`Sources directory not found: ${SOURCES_DIR}`);
  }

  const mediaIndexPortraits = parseMediaIndexPortraits();
  const checkedFindAGraveIds = parseCheckedFindAGraveMemorials();
  const people = await loadPeople();
  const sourceFiles = await glob('obituaries/*.md', { cwd: SOURCES_DIR });
  const results: SourceAudit[] = [];

  for (const file of sourceFiles.sort()) {
    const raw = readFileSync(resolve(SOURCES_DIR, file), 'utf-8');
    const { data: fm } = matter(raw);
    if (fm.type !== 'source' || fm.source_type !== 'obituary') continue;
    const checkedNoPortrait = hasCheckedNoPortraitStatus(fm);

    const sourceId = asString(fm.source_id);
    const title = asString(fm.title);
    const url = asString(fm.url);
    const sourceMedia = asStringArray(fm.media);
    const sourcePortraits = sourceMedia.filter(isPortraitPath);
    const subjectPersonIds = asStringArray(fm.subject_person_ids);
    const linkedPeople = subjectPersonIds.length > 0
      ? people.filter((person) => subjectPersonIds.includes(person.gedcomId))
      : people.filter((person) => person.sources.includes(sourceId));
    const personPortraits = Array.from(new Set(linkedPeople.flatMap((person) => person.media.filter(isPortraitPath))));
    const allPortraits = Array.from(new Set([...sourcePortraits, ...personPortraits]));
    const indexPortraits = allPortraits.filter((path) => mediaIndexPortraits.has(path));
    const notes: string[] = [];

    if (sourcePortraits.length === 0 && personPortraits.length > 0) {
      notes.push('person has portrait, source frontmatter does not');
    }
    for (const portrait of allPortraits) {
      if (!mediaIndexPortraits.has(portrait)) notes.push(`portrait missing from _Media_Index.md: ${portrait}`);
    }
    if (subjectPersonIds.length === 0) {
      notes.push('missing subject_person_ids; fell back to person source references');
    }
    if (linkedPeople.length === 0) notes.push('no subject person file found for this source');

    let status: SourceAudit['status'] = sourcePortraits.length > 0
      ? 'has_portrait'
      : personPortraits.length > 0
        ? 'has_person_portrait'
        : url
          ? 'missing_portrait'
          : 'no_url';

    const memorialId = findAGraveMemorialId(url);
    if (status === 'missing_portrait' && memorialId && checkedFindAGraveIds.has(memorialId)) {
      status = 'checked_no_portrait';
      notes.push('FindAGrave memorial checked; no portrait photo found');
    }
    if ((status === 'missing_portrait' || status === 'no_url') && checkedNoPortrait) {
      status = 'checked_no_portrait';
      const checkNote = asString(fm.portrait_check_notes);
      notes.push(checkNote || 'source checked; no portrait photo found');
    }

    results.push({
      file,
      sourceId,
      title,
      url,
      domain: domainFor(url),
      decedent: decedentFromTitle(title),
      sourcePortraits,
      personPortraits,
      indexPortraits,
      linkedPersonFiles: linkedPeople.map((person) => person.file),
      status,
      notes,
    });
  }

  return {
    all: results,
    report: missingOnly ? results.filter((item) => item.status !== 'has_portrait') : results,
  };
}

function printReport(allResults: SourceAudit[], reportResults: SourceAudit[]): void {
  const counts = allResults.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  console.log(`Vault: ${ROOT}`);
  console.log(`Obituary sources checked: ${allResults.length}`);
  console.log(`  has source portrait: ${counts.has_portrait || 0}`);
  console.log(`  has person portrait: ${counts.has_person_portrait || 0}`);
  console.log(`  missing portrait:    ${counts.missing_portrait || 0}`);
  console.log(`  checked no portrait: ${counts.checked_no_portrait || 0}`);
  console.log(`  no URL:              ${counts.no_url || 0}`);
  if (missingOnly) console.log(`  shown below:       ${reportResults.length}`);
  console.log();

  for (const item of reportResults) {
    if (!missingOnly && item.status === 'has_portrait' && item.notes.length === 0) continue;
    const domain = item.domain || '(none)';
    console.log(`${item.status.padEnd(16)} ${item.file}  ${domain}`);
    if (item.url) console.log(`  url: ${item.url}`);
    if (item.sourcePortraits.length) console.log(`  source portraits: ${item.sourcePortraits.join(', ')}`);
    if (item.personPortraits.length) console.log(`  person portraits: ${item.personPortraits.join(', ')}`);
    for (const note of item.notes) console.log(`  note: ${note}`);
  }
}

async function main(): Promise<void> {
  const results = await audit();
  if (jsonOutput) {
    console.log(JSON.stringify(results.report, null, 2));
  } else {
    printReport(results.all, results.report);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
