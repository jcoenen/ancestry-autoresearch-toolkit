/**
 * Report-only audit for obituary completeness.
 *
 * This is broader than portrait coverage. It finds:
 *   - formal obituary sources with missing structure/media/person links
 *   - non-obituary sources that look like they contain obituary text
 *   - people whose biographies mention obituary-like evidence but lack an
 *     obituary source citation
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-completeness.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-completeness.ts --json
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-completeness.ts --needs-review-only
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-obituary-completeness.ts --fail-on-issues
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { extractBiography, extractFullText, extractSection } from './lib/build-helpers.js';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const needsReviewOnly = args.includes('--needs-review-only');
const failOnIssues = args.includes('--fail-on-issues');

type Severity = 'warning' | 'review';
type Category =
  | 'formal_obituary_missing_subject_person_ids'
  | 'formal_obituary_missing_person_ids'
  | 'formal_obituary_missing_full_text'
  | 'formal_obituary_missing_portrait_status'
  | 'non_obituary_source_contains_obituary_text'
  | 'person_mentions_obituary_without_obituary_source';

interface SourceRecord {
  id: string;
  file: string;
  title: string;
  sourceType: string;
  url: string;
  persons: string[];
  personIds: string[];
  subjectPersonIds: string[];
  media: string[];
  portraitStatus: string;
  portraitChecked: string;
  content: string;
  fullText: string;
  extractedFacts: string;
  notes: string;
}

interface PersonRecord {
  id: string;
  file: string;
  name: string;
  sources: string[];
  biography: string;
}

interface Finding {
  severity: Severity;
  category: Category;
  file: string;
  id: string;
  title: string;
  note: string;
  suggestedAction: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function isObituarySource(source: SourceRecord): boolean {
  return source.sourceType === 'obituary' || /^SRC-OBIT-\d+/.test(source.id) || source.file.startsWith('obituaries/');
}

function hasPortraitPath(paths: string[]): boolean {
  return paths.some(path => path.startsWith('portraits/') || /\/?POR_/i.test(path));
}

function hasKnownFullText(source: SourceRecord): boolean {
  const text = [source.fullText, source.extractedFacts, source.notes].join('\n').trim();
  return text.length > 40;
}

function hasPortraitStatus(source: SourceRecord): boolean {
  return hasPortraitPath(source.media)
    || Boolean(source.portraitStatus)
    || Boolean(source.portraitChecked)
    || /portrait.*checked|checked.*portrait|checked_no_portrait|no portrait/i.test(source.content);
}

function obituaryLikeScore(text: string): number {
  const normalized = text.toLowerCase();
  let score = 0;
  const patterns = [
    /\bobituary\b/,
    /\bfuneral (?:services?|mass|will be held)\b/,
    /\bvisitation\b/,
    /\bsurviv(?:ed|ing) by\b/,
    /\bpreceded in death\b/,
    /\bpassed away\b/,
    /\bdied (?:on|at|peacefully)\b/,
    /\binterment\b/,
    /\bmemorial service\b/,
    /\bfuneral home\b/,
  ];
  for (const pattern of patterns) if (pattern.test(normalized)) score += 1;
  return score;
}

async function loadSources(): Promise<SourceRecord[]> {
  if (!existsSync(SOURCES_DIR)) throw new Error(`Sources directory not found: ${SOURCES_DIR}`);
  const files = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
  const sources: SourceRecord[] = [];

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(SOURCES_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'source') continue;

    sources.push({
      id: asString(fm.source_id),
      file,
      title: asString(fm.title),
      sourceType: asString(fm.source_type),
      url: asString(fm.url),
      persons: asStringArray(fm.persons),
      personIds: asStringArray(fm.person_ids),
      subjectPersonIds: asStringArray(fm.subject_person_ids),
      media: asStringArray(fm.media),
      portraitStatus: asString(fm.portrait_status),
      portraitChecked: asString(fm.portrait_checked),
      content,
      fullText: extractFullText(content),
      extractedFacts: extractSection(content, 'Extracted Facts'),
      notes: extractSection(content, 'Notes'),
    });
  }

  return sources;
}

async function loadPeople(): Promise<PersonRecord[]> {
  if (!existsSync(PEOPLE_DIR)) return [];
  const files = await glob('**/*.md', { cwd: PEOPLE_DIR, nodir: true });
  const people: PersonRecord[] = [];

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'person') continue;
    people.push({
      id: asString(fm.gedcom_id),
      file,
      name: asString(fm.name),
      sources: asStringArray(fm.sources),
      biography: extractBiography(content),
    });
  }

  return people;
}

const sources = await loadSources();
const people = await loadPeople();
const sourceById = new Map(sources.map(source => [source.id, source]));
const obituarySourceIds = new Set(sources.filter(isObituarySource).map(source => source.id));
const findings: Finding[] = [];

for (const source of sources.filter(isObituarySource)) {
  if (source.subjectPersonIds.length === 0) {
    findings.push({
      severity: 'warning',
      category: 'formal_obituary_missing_subject_person_ids',
      file: source.file,
      id: source.id,
      title: source.title,
      note: 'Formal obituary source has no subject_person_ids.',
      suggestedAction: 'Set subject_person_ids to the decedent/person whose obituary this is.',
    });
  }
  if (source.personIds.length === 0) {
    findings.push({
      severity: 'warning',
      category: 'formal_obituary_missing_person_ids',
      file: source.file,
      id: source.id,
      title: source.title,
      note: 'Formal obituary source has no person_ids.',
      suggestedAction: 'Link every genealogically relevant named person, creating supported stubs when appropriate.',
    });
  }
  if (!hasKnownFullText(source)) {
    findings.push({
      severity: 'review',
      category: 'formal_obituary_missing_full_text',
      file: source.file,
      id: source.id,
      title: source.title,
      note: 'Formal obituary source lacks substantive Full Text / Extracted Facts / Notes content.',
      suggestedAction: 'Re-run the appropriate extractor or manually preserve the obituary text from the source.',
    });
  }
  if (!hasPortraitStatus(source)) {
    findings.push({
      severity: 'review',
      category: 'formal_obituary_missing_portrait_status',
      file: source.file,
      id: source.id,
      title: source.title,
      note: 'Formal obituary source does not show portrait media or an explicit checked-no-portrait status.',
      suggestedAction: 'Check the source for an obituary portrait; add media or portrait_status/portrait_check_notes.',
    });
  }
}

for (const source of sources.filter(source => !isObituarySource(source))) {
  const text = [source.title, source.fullText, source.extractedFacts, source.notes].join('\n');
  const score = obituaryLikeScore(text);
  if (score >= 3) {
    findings.push({
      severity: 'review',
      category: 'non_obituary_source_contains_obituary_text',
      file: source.file,
      id: source.id,
      title: source.title,
      note: `Non-obituary source has obituary-like text signals (${score}).`,
      suggestedAction: 'Review whether this should become a formal obituary source or should link to an existing obituary source.',
    });
  }
}

for (const person of people) {
  const hasObituaryCitation = person.sources.some(sourceId => obituarySourceIds.has(sourceId));
  if (hasObituaryCitation) continue;
  const bioScore = obituaryLikeScore(person.biography);
  const citedObituaryLikeSource = person.sources
    .map(sourceId => sourceById.get(sourceId))
    .filter((source): source is SourceRecord => Boolean(source))
    .some(source => !isObituarySource(source) && obituaryLikeScore([source.title, source.fullText, source.extractedFacts, source.notes].join('\n')) >= 3);

  if (bioScore >= 2 || citedObituaryLikeSource) {
    findings.push({
      severity: 'review',
      category: 'person_mentions_obituary_without_obituary_source',
      file: person.file,
      id: person.id,
      title: person.name,
      note: 'Person biography or cited source appears to use obituary evidence, but the person cites no formal obituary source.',
      suggestedAction: 'Review cited sources and create/link a formal obituary source when the obituary text is real and attributable.',
    });
  }
}

const counts = findings.reduce<Record<string, number>>((acc, finding) => {
  acc[finding.category] = (acc[finding.category] || 0) + 1;
  return acc;
}, {});
const reportFindings = needsReviewOnly ? findings.filter(finding => finding.severity !== 'warning') : findings;

if (jsonOutput) {
  console.log(JSON.stringify({
    vaultRoot: ROOT,
    sourcesChecked: sources.length,
    peopleChecked: people.length,
    formalObituarySources: obituarySourceIds.size,
    findings,
    counts,
  }, null, 2));
} else {
  console.log('Obituary completeness audit');
  console.log(`Vault: ${ROOT}`);
  console.log(`Sources checked: ${sources.length}`);
  console.log(`People checked: ${people.length}`);
  console.log(`Formal obituary sources: ${obituarySourceIds.size}`);
  console.log(`Findings: ${findings.length}`);
  console.log('');
  console.log('| Category | Count |');
  console.log('|---|---:|');
  for (const [category, count] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`| ${category} | ${count} |`);
  }

  console.log('');
  for (const finding of reportFindings) {
    console.log(`${finding.severity.toUpperCase().padEnd(7)} ${finding.category} ${finding.file}`);
    if (finding.id) console.log(`  id: ${finding.id}`);
    if (finding.title) console.log(`  title: ${finding.title}`);
    console.log(`  note: ${finding.note}`);
    console.log(`  action: ${finding.suggestedAction}`);
  }
}

if (failOnIssues && findings.length > 0) process.exitCode = 1;
