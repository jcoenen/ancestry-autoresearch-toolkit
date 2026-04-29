import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { extractSection, slugify } from './lib/build-helpers.js';

interface SourceEntry {
  id: string;
  file: string;
  title: string;
  slug: string;
  personIds: string[];
  subjectPersonIds: string[];
  fullText: string;
  extractedFacts: string;
  notes: string;
}

interface PersonEntry {
  id: string;
}

interface SiteData {
  people: PersonEntry[];
  sources: SourceEntry[];
}

interface SearchDocument {
  id: string;
  title: string;
  file: string;
  slug: string;
  fields: Record<string, string>;
}

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');
const SITE_DATA = resolve(import.meta.dirname, '..', 'src', 'data', 'site-data.json');

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'american', 'because', 'before', 'between',
  'burial', 'buried', 'called', 'cemetery', 'children', 'county', 'daughter',
  'deceased', 'document', 'family', 'father', 'forever', 'grave', 'husband',
  'listed', 'married', 'memorial', 'mother', 'person', 'record', 'research',
  'source', 'states', 'through', 'transcription', 'united', 'unknown', 'witness',
]);

async function main() {
  if (!existsSync(SITE_DATA)) {
    throw new Error(`Missing built site data: ${SITE_DATA}. Run npm run build:data first.`);
  }

  const siteData = JSON.parse(readFileSync(SITE_DATA, 'utf-8')) as SiteData;
  const sourceById = new Map(siteData.sources.map(source => [source.id, source]));
  const publishedPersonIds = new Set(siteData.people.map(person => person.id));
  const documents = siteData.sources.map(toSearchDocument);
  const tokenDocumentCounts = buildTokenDocumentCounts(siteData.sources);

  const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR });
  const sectionProblems: string[] = [];
  const discoverabilityProblems: string[] = [];
  let checkedSources = 0;
  let skippedSources = 0;

  for (const file of sourceFiles) {
    if (file.startsWith('_')) continue;

    const raw = readFileSync(resolve(SOURCES_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'source' || !fm.source_id) continue;

    const sourceId = String(fm.source_id);
    const built = sourceById.get(sourceId);
    if (!built) {
      const linkedIds = [
        ...(Array.isArray(fm.person_ids) ? fm.person_ids.map(String) : []),
        ...(Array.isArray(fm.subject_person_ids) ? fm.subject_person_ids.map(String) : []),
      ];
      if (linkedIds.length > 0 && !linkedIds.some(id => publishedPersonIds.has(id))) {
        continue;
      }

      sectionProblems.push(`${sourceId}: source file exists but is missing from built site data (${file})`);
      continue;
    }

    const rawFullText = extractSection(content, 'Full Text');
    if (rawFullText && !built.fullText) {
      sectionProblems.push(`${sourceId}: Full Text section has content but built data is empty (${file})`);
    }

    const rawExtractedFacts = extractSection(content, 'Extracted Facts');
    if (rawExtractedFacts && !built.extractedFacts) {
      sectionProblems.push(`${sourceId}: Extracted Facts section has content but built data is empty (${file})`);
    }

    const rawNotes = extractSection(content, 'Notes');
    if (rawNotes && !built.notes) {
      sectionProblems.push(`${sourceId}: Notes section has content but built data is empty (${file})`);
    }

    const candidate = chooseDistinctiveToken(built, tokenDocumentCounts);
    if (!candidate) {
      skippedSources += 1;
      continue;
    }

    checkedSources += 1;
    const topResults = exactKeywordSearch(documents, candidate).slice(0, 5);
    if (!topResults.some(result => result.id === built.id)) {
      const found = topResults.map(result => result.id).join(', ') || 'no results';
      discoverabilityProblems.push(`${built.id}: token "${candidate}" did not return source in top 5; found ${found}`);
    }
  }

  console.log(`Search discoverability audit`);
  console.log(`Vault: ${ROOT}`);
  console.log(`Sources in site data: ${siteData.sources.length}`);
  console.log(`Sources checked with distinctive tokens: ${checkedSources}`);
  console.log(`Sources skipped without a distinctive token: ${skippedSources}`);
  console.log(`Section extraction issues: ${sectionProblems.length}`);
  console.log(`Keyword discoverability issues: ${discoverabilityProblems.length}`);

  if (sectionProblems.length > 0) {
    console.log('\nSection extraction issues:');
    for (const problem of sectionProblems.slice(0, 50)) console.log(`- ${problem}`);
    if (sectionProblems.length > 50) console.log(`- ... ${sectionProblems.length - 50} more`);
  }

  if (discoverabilityProblems.length > 0) {
    console.log('\nKeyword discoverability issues:');
    for (const problem of discoverabilityProblems.slice(0, 50)) console.log(`- ${problem}`);
    if (discoverabilityProblems.length > 50) console.log(`- ... ${discoverabilityProblems.length - 50} more`);
  }

  if (sectionProblems.length > 0 || discoverabilityProblems.length > 0) {
    process.exitCode = 1;
  }
}

function toSearchDocument(source: SourceEntry): SearchDocument {
  return {
    id: source.id,
    title: source.title || source.id,
    file: source.file,
    slug: source.slug || slugify(source.id || source.file),
    fields: {
      title: source.title || '',
      id: source.id || '',
      file: source.file || '',
      fullText: source.fullText || '',
      extractedFacts: source.extractedFacts || '',
      notes: source.notes || '',
    },
  };
}

function buildTokenDocumentCounts(sources: SourceEntry[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const source of sources) {
    const sourceTokens = new Set(tokenize([
      source.fullText,
      source.extractedFacts,
      source.notes,
    ].join(' ')));
    for (const token of sourceTokens) counts.set(token, (counts.get(token) || 0) + 1);
  }

  return counts;
}

function chooseDistinctiveToken(source: SourceEntry, tokenDocumentCounts: Map<string, number>): string | null {
  const candidates = tokenize([
    source.fullText,
    source.extractedFacts,
    source.notes,
  ].join(' ')).filter(token =>
    token.length >= 7 &&
    token.length <= 24 &&
    /^[a-z]+$/.test(token) &&
    (tokenDocumentCounts.get(token) || 0) <= 3 &&
    !STOPWORDS.has(token)
  );

  if (candidates.length === 0) return null;

  const counts = new Map<string, number>();
  for (const token of candidates) counts.set(token, (counts.get(token) || 0) + 1);

  return Array.from(counts.entries())
    .sort((a, b) =>
      (tokenDocumentCounts.get(a[0]) || 0) - (tokenDocumentCounts.get(b[0]) || 0) ||
      a[1] - b[1] ||
      b[0].length - a[0].length ||
      a[0].localeCompare(b[0])
    )[0][0];
}

function exactKeywordSearch(documents: SearchDocument[], query: string): SearchDocument[] {
  const token = normalize(query);
  if (!token) return [];

  return documents
    .map(document => {
      const score = exactDocumentScore(document, token);
      return { document, score };
    })
    .filter(result => result.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.document.title.localeCompare(b.document.title))
    .map(result => result.document);
}

function exactDocumentScore(document: SearchDocument, token: string): number | null {
  const fieldOrder = ['id', 'title', 'extractedFacts', 'fullText', 'notes', 'file'];

  for (let index = 0; index < fieldOrder.length; index += 1) {
    const field = fieldOrder[index];
    if (tokenize(document.fields[field] || '').includes(token)) return index;
  }

  return null;
}

function tokenize(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

main().catch(error => {
  console.error('Search discoverability audit failed:', error);
  process.exit(1);
});
