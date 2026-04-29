import { readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { parseVitalTableTuples } from './lib/validate-helpers.js';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const PEOPLE_DIR = resolve(ROOT, 'people');

const PLACE_FIELDS = new Set([
  'Birthplace',
  'Death Place',
  'Burial',
  'Residence',
  'Immigration',
  'Emigration',
  'Naturalization',
]);

const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

interface Occurrence {
  value: string;
  file: string;
  field: string;
  source: string;
}

function isKnown(value: string): boolean {
  const v = value.trim();
  return v !== '' && v !== '—' && v !== '-' && v.toLowerCase() !== 'unknown';
}

function expandStateAbbreviations(value: string): string {
  return value.replace(/\b([A-Z]{2})\b/g, (match) => STATE_ABBREVIATIONS[match] || match);
}

function normalizeKey(value: string): string {
  return expandStateAbbreviations(value)
    .toLowerCase()
    .replace(/\bas of \d{4}\b/g, '')
    .replace(/\bcounty\b/g, '')
    .replace(/\barea\b/g, '')
    .replace(/\blikely\b|\bprobably\b|\bprobable\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function issueLabels(value: string): string[] {
  const labels: string[] = [];
  if (/\b[A-Z]{2}\b/.test(value)) labels.push('state abbreviation');
  if (/\s\/\s|\/[A-Za-z]/.test(value)) labels.push('slash-separated value');
  if (/\b(likely|probable|probably|area)\b/i.test(value)) labels.push('uncertain/imprecise wording');
  if (/\b(as of|last ~|\d{4})\b/i.test(value) && !/\d{4}-\d{2}-\d{2}/.test(value)) labels.push('date/status embedded in place');
  if (/;/.test(value)) labels.push('multiple places in one value');
  return labels;
}

function printGroup(title: string, groups: [string, Occurrence[]][], limit = 40): void {
  console.log(`\n${title}`);
  if (groups.length === 0) {
    console.log('  None found.');
    return;
  }
  for (const [value, occurrences] of groups.slice(0, limit)) {
    console.log(`\n  ${value} (${occurrences.length})`);
    for (const occurrence of occurrences.slice(0, 8)) {
      const source = occurrence.source ? ` [${occurrence.source}]` : '';
      console.log(`    ${occurrence.field}: ${occurrence.file}${source}`);
    }
    if (occurrences.length > 8) console.log(`    ... ${occurrences.length - 8} more`);
  }
  if (groups.length > limit) console.log(`\n  ... ${groups.length - limit} more values`);
}

async function main(): Promise<void> {
  const files = await glob('**/*.md', { cwd: PEOPLE_DIR });
  const occurrences: Occurrence[] = [];

  for (const file of files) {
    const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'person') continue;

    for (const [field, value] of parseVitalTableTuples(content)) {
      if (!PLACE_FIELDS.has(field) || !isKnown(value)) continue;
      occurrences.push({ value: value.trim(), file, field, source: '' });
    }
  }

  const byValue = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const list = byValue.get(occurrence.value) || [];
    list.push(occurrence);
    byValue.set(occurrence.value, list);
  }

  const flagged = [...byValue.entries()]
    .filter(([value]) => issueLabels(value).length > 0)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  console.log(`Vault root: ${ROOT}`);
  console.log(`Place-like vital values: ${occurrences.length} occurrences, ${byValue.size} distinct values`);

  printGroup('Values with formatting or precision review flags', flagged);

  const variantGroups = new Map<string, Set<string>>();
  for (const value of byValue.keys()) {
    const key = normalizeKey(value);
    if (!key) continue;
    const group = variantGroups.get(key) || new Set<string>();
    group.add(value);
    variantGroups.set(key, group);
  }

  const variants = [...variantGroups.entries()]
    .map(([key, values]) => [key, [...values].sort()] as const)
    .filter(([, values]) => values.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  console.log('\nLikely variant groups');
  if (variants.length === 0) {
    console.log('  None found.');
  } else {
    for (const [key, values] of variants.slice(0, 40)) {
      console.log(`\n  ${key}`);
      for (const value of values) {
        console.log(`    - ${value} (${byValue.get(value)?.length || 0})`);
      }
    }
    if (variants.length > 40) console.log(`\n  ... ${variants.length - 40} more groups`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
