import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { extractSection, parseVitalTable } from './lib/build-helpers.js';

interface PersonEntry {
  id: string;
  name: string;
  privacy: boolean;
  filePath: string;
  family: string;
  sources: string[];
  born: string;
  birthplace: string;
  religion: string;
  occupation: string;
  immigration: string;
  emigration: string;
  naturalization: string;
  residence: string;
  military: string;
  burial: string;
}

interface SourceEntry {
  id: string;
  file: string;
  title: string;
  type: string;
  personIds: string[];
  subjectPersonIds: string[];
  extractedFacts: string;
  fullText: string;
  notes: string;
}

interface SiteData {
  people: PersonEntry[];
  sources: SourceEntry[];
}

interface RawPerson {
  id: string;
  file: string;
  fields: Record<string, string>;
}

interface SourceFact {
  sourceId: string;
  sourceFile: string;
  sourceTitle: string;
  sourceType: string;
  field: string;
  value: string;
  confidence: string;
  linkedPersonIds: string[];
}

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const PEOPLE_DIR = resolve(ROOT, 'people');
const SITE_DATA = resolve(import.meta.dirname, '..', 'src', 'data', 'site-data.json');

const AUDIT_FIELDS = [
  'religion',
  'occupation',
  'birthplace',
  'immigration',
  'emigration',
  'naturalization',
  'residence',
  'military',
  'burial',
] as const;

type AuditField = typeof AUDIT_FIELDS[number];

const FIELD_ALIASES: Record<AuditField, RegExp[]> = {
  religion: [/^religion(?:\/community)?$/i, /religious/i, /church membership/i],
  occupation: [/^occupation/i, /employment/i, /profession/i],
  birthplace: [/^birthplace$/i, /^birth place$/i],
  immigration: [/^immigration$/i, /arrival/i, /immigrat/i],
  emigration: [/^emigration$/i, /emigrat/i],
  naturalization: [/naturalization/i, /declaration of intent/i],
  residence: [/^residence/i, /address/i],
  military: [/^military/i, /service/i, /veteran/i],
  burial: [/^burial/i, /^cemetery$/i],
};

function main() {
  if (!existsSync(SITE_DATA)) {
    throw new Error(`Missing built site data: ${SITE_DATA}. Run npm run build:data first.`);
  }

  const siteData = JSON.parse(readFileSync(SITE_DATA, 'utf-8')) as SiteData;
  const publishedPeople = siteData.people.filter(person => !person.privacy);
  const publishedPersonById = new Map(publishedPeople.map(person => [person.id, person]));
  const rawPeople = loadRawPeople();
  const sourceFacts = extractSourceFacts(siteData.sources)
    .filter(fact => fact.linkedPersonIds.some(id => publishedPersonById.has(id)));

  console.log('Stats coverage audit');
  console.log(`Vault: ${ROOT}`);
  console.log(`Public people counted by stats page: ${publishedPeople.length}`);
  console.log(`Sources in public site data: ${siteData.sources.length}`);
  console.log('');

  console.log('Field coverage');
  console.log('| Field | Person field coverage | Raw person rows | Source fact mentions | Safe single-person backfill candidates |');
  console.log('|---|---:|---:|---:|---:|');
  for (const field of AUDIT_FIELDS) {
    const siteCount = countPeopleWithField(publishedPeople, field);
    const rawCount = countRawPeopleWithField(rawPeople, field, new Set(publishedPeople.map(person => person.id)));
    const sourceCount = sourceFacts.filter(fact => factMatches(field, fact.field)).length;
    const candidateCount = backfillCandidates(field, sourceFacts, publishedPersonById).length;
    console.log(`| ${field} | ${siteCount} | ${rawCount} | ${sourceCount} | ${candidateCount} |`);
  }

  console.log('');
  printTopValues('Religion groups currently counted', publishedPeople.map(p => p.religion).filter(hasKnownValue).map(normalizeReligion));
  printTopValues('Occupation exact values currently counted', publishedPeople.map(p => p.occupation).filter(hasKnownValue), 12);
  printTopValues('Birthplace exact values currently counted', publishedPeople.map(p => p.birthplace).filter(hasKnownValue), 12);

  console.log('');
  printMigrationSources(siteData.sources, publishedPersonById);

  console.log('');
  printBackfillExamples('Religion candidates', 'religion', sourceFacts, publishedPersonById);
  printBackfillExamples('Occupation candidates', 'occupation', sourceFacts, publishedPersonById);
  printBackfillExamples('Birthplace candidates', 'birthplace', sourceFacts, publishedPersonById);
  printBackfillExamples('Migration candidates', 'immigration', sourceFacts, publishedPersonById);

  console.log('');
  console.log('Interpretation hints');
  console.log('- A high source fact count with low person field coverage means the vault has evidence, but person vital rows were not promoted.');
  console.log('- Many exact occupation or birthplace values with count 1 means the stats UI needs grouping/normalization, not necessarily more data.');
  console.log('- Migration stats should count immigration, emigration, naturalization fields and linked migration source types.');
}

function loadRawPeople(): RawPerson[] {
  const files = glob.sync('**/*.md', { cwd: PEOPLE_DIR });
  const people: RawPerson[] = [];

  for (const file of files) {
    const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'person') continue;
    people.push({ id: String(fm.gedcom_id || fm.id || ''), file, fields: parseVitalTable(content) });
  }

  return people;
}

function extractSourceFacts(sources: SourceEntry[]): SourceFact[] {
  const facts: SourceFact[] = [];

  for (const source of sources) {
    const linkedPersonIds = [...new Set([...(source.subjectPersonIds || []), ...(source.personIds || [])])];
    const factText = source.extractedFacts || extractSection([source.fullText, source.notes].join('\n'), 'Extracted Facts');
    for (const fact of parseFactsTable(factText)) {
      facts.push({
        sourceId: source.id,
        sourceFile: source.file,
        sourceTitle: source.title || source.id,
        sourceType: source.type || '',
        field: fact.field,
        value: fact.value,
        confidence: fact.confidence,
        linkedPersonIds,
      });
    }
  }

  return facts;
}

function parseFactsTable(text: string): { field: string; value: string; confidence: string }[] {
  const facts: { field: string; value: string; confidence: string }[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|') || line.includes('---') || /field\s*\|/i.test(line)) continue;
    const parts = splitMarkdownRow(line);
    if (parts.length < 2) continue;
    facts.push({
      field: cleanCell(parts[0]),
      value: cleanCell(parts[1]),
      confidence: cleanCell(parts[2] || ''),
    });
  }
  return facts.filter(fact => fact.field && hasKnownValue(fact.value));
}

function splitMarkdownRow(line: string): string[] {
  const pipePlaceholder = '__ESCAPED_PIPE__';
  return line
    .replace(/\\\|/g, pipePlaceholder)
    .split('|')
    .map(part => part.replaceAll(pipePlaceholder, '|').trim())
    .filter(Boolean);
}

function cleanCell(value: string): string {
  return value.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '; ').trim();
}

function countPeopleWithField(people: PersonEntry[], field: AuditField): number {
  return people.filter(person => hasKnownValue(person[field])).length;
}

function countRawPeopleWithField(rawPeople: RawPerson[], field: AuditField, publicIds: Set<string>): number {
  return rawPeople.filter(person => publicIds.has(person.id) && hasKnownValue(vitalField(person.fields, field))).length;
}

function vitalField(fields: Record<string, string>, field: AuditField): string {
  const labels: Record<AuditField, string[]> = {
    religion: ['Religion'],
    occupation: ['Occupation'],
    birthplace: ['Birthplace'],
    immigration: ['Immigration'],
    emigration: ['Emigration'],
    naturalization: ['Naturalization'],
    residence: ['Residence'],
    military: ['Military'],
    burial: ['Burial'],
  };

  for (const label of labels[field]) {
    if (fields[label]) return fields[label];
  }
  return '';
}

function backfillCandidates(field: AuditField, facts: SourceFact[], peopleById: Map<string, PersonEntry>): SourceFact[] {
  return facts.filter(fact => {
    if (!factMatches(field, fact.field)) return false;
    const linked = fact.linkedPersonIds.filter(id => peopleById.has(id));
    if (linked.length !== 1) return false;
    const person = peopleById.get(linked[0])!;
    return !hasKnownValue(person[field]);
  });
}

function factMatches(field: AuditField, factField: string): boolean {
  return FIELD_ALIASES[field].some(pattern => pattern.test(factField.trim()));
}

function hasKnownValue(value: string | undefined | null): value is string {
  if (!value) return false;
  const v = value.trim();
  return v !== '' && v !== '—' && v !== '-' && v.toLowerCase() !== 'unknown';
}

function normalizeReligion(value: string): string {
  const raw = value.toLowerCase();
  if (raw.includes('catholic') || raw.includes('rooms-ka')) return 'Catholic';
  if (raw.includes('lutheran')) return 'Lutheran';
  if (raw.includes('methodist')) return 'Methodist';
  if (raw.includes('reformed')) return 'Reformed';
  return value.trim().replace(/\b\w/g, c => c.toUpperCase());
}

function printTopValues(title: string, values: string[], limit = 10) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  const total = values.length;
  const unique = counts.size;
  console.log(`${title}: ${total} values, ${unique} unique`);
  for (const [value, count] of top) console.log(`- ${value}: ${count}`);
}

function printMigrationSources(sources: SourceEntry[], peopleById: Map<string, PersonEntry>) {
  const migrationSources = sources.filter(source =>
    ['immigration', 'ship_manifest', 'naturalization'].includes(source.type) ||
    /immigrat|emigrat|naturalization|ship manifest|passenger/i.test(`${source.title} ${source.file}`)
  );
  const linkedPeople = new Set<string>();
  for (const source of migrationSources) {
    for (const id of [...(source.subjectPersonIds || []), ...(source.personIds || [])]) {
      if (peopleById.has(id)) linkedPeople.add(id);
    }
  }

  console.log(`Migration-like public sources: ${migrationSources.length}; linked public people: ${linkedPeople.size}`);
  for (const source of migrationSources.slice(0, 10)) {
    const linked = [...new Set([...(source.subjectPersonIds || []), ...(source.personIds || [])])]
      .filter(id => peopleById.has(id))
      .map(id => `${peopleById.get(id)!.name} (${id})`)
      .join(', ');
    console.log(`- ${source.id} [${source.type}]: ${source.title}${linked ? ` -> ${linked}` : ''}`);
  }
}

function printBackfillExamples(title: string, field: AuditField, facts: SourceFact[], peopleById: Map<string, PersonEntry>) {
  const examples = backfillCandidates(field, facts, peopleById).slice(0, 12);
  console.log(`${title}: ${examples.length} examples shown`);
  for (const fact of examples) {
    const personId = fact.linkedPersonIds.find(id => peopleById.has(id))!;
    const person = peopleById.get(personId)!;
    console.log(`- ${person.name} (${personId}) <= ${fact.field}: ${fact.value} [${fact.sourceId}]`);
  }
}

main();
