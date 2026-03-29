/**
 * Import a GEDCOM 5.5.1 file into the vault as person markdown files.
 *
 * Usage: npx tsx scripts/import-gedcom.ts <input.ged> [--dry-run] [--out-dir <dir>]
 *
 * Default output: people/ directory in vault root.
 * --dry-run: Print what would be created without writing files.
 * --out-dir: Override the output directory (default: vault's people/ folder).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ── Types ──────────────────────────────────────────────────

export interface GedcomRecord {
  tag: string;
  id?: string;
  value?: string;
  children: GedcomRecord[];
}

export interface GedcomIndi {
  id: string;
  givenName: string;
  surname: string;
  fullName: string;
  gender: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  burial: string;
  cremation: string;
  baptized: string;
  christened: string;
  confirmation: string;
  occupation: string;
  education: string;
  religion: string;
  residence: string;
  nickname: string;
  immigration: string;
  emigration: string;
  naturalization: string;
  military: string;
  causeOfDeath: string;
  familySearchId: string;
  biography: string;
  familyChild: string[];   // FAM IDs where this person is a child
  familySpouse: string[];  // FAM IDs where this person is a spouse
  sourceRefs: string[];
}

export interface GedcomFam {
  id: string;
  husband: string;
  wife: string;
  children: string[];
  marriageDate: string;
  marriagePlace: string;
  divorce: string;
}

// ── GEDCOM Parsing ─────────────────────────────────────────

const GEDCOM_MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

const GEDCOM_MONTH_NAMES: Record<string, string> = {
  JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April',
  MAY: 'May', JUN: 'June', JUL: 'July', AUG: 'August',
  SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December',
};

/**
 * Convert a GEDCOM date string to ISO YYYY-MM-DD or best approximation.
 * Examples: "15 MAR 1920" -> "1920-03-15", "ABT 1920" -> "~1920", "MAR 1920" -> "1920-03"
 */
export function fromGedcomDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();

  // Handle qualifiers: ABT, BEF, AFT, EST, CAL — map to approximate prefix
  const qualMatch = cleaned.match(/^(ABT|EST|CAL|BEF|AFT|FROM|TO|BET)\s+(.+)/i);
  const approx = !!qualMatch;
  const core = qualMatch ? qualMatch[2] : cleaned;

  // Handle range: "BET date1 AND date2" — use date1
  const rangeMatch = core.match(/^(.+?)\s+AND\s+(.+)/i);
  const datePart = rangeMatch ? rangeMatch[1] : core;

  // Full date: "DD MMM YYYY"
  const full = datePart.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (full) {
    const mm = GEDCOM_MONTH_MAP[full[2].toUpperCase()];
    if (mm) {
      const dd = full[1].padStart(2, '0');
      return approx ? `~${full[3]}-${mm}-${dd}` : `${full[3]}-${mm}-${dd}`;
    }
  }

  // Month + year: "MMM YYYY"
  const monthYear = datePart.match(/^([A-Z]{3})\s+(\d{4})$/i);
  if (monthYear) {
    const mm = GEDCOM_MONTH_MAP[monthYear[1].toUpperCase()];
    if (mm) {
      const monthName = GEDCOM_MONTH_NAMES[monthYear[1].toUpperCase()];
      return approx ? `~${monthName} ${monthYear[2]}` : `${monthName} ${monthYear[2]}`;
    }
  }

  // Year only: "YYYY"
  const yearOnly = datePart.match(/^(\d{4})$/);
  if (yearOnly) {
    return approx ? `~${yearOnly[1]}` : yearOnly[1];
  }

  // Fallback: return as-is
  return approx ? `~${datePart}` : datePart;
}

/**
 * Parse raw GEDCOM text into a tree of records.
 */
export function parseGedcomLines(text: string): GedcomRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const root: GedcomRecord[] = [];
  const stack: { level: number; record: GedcomRecord }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\S+)\s?(.*)?$/);
    if (!match) continue;

    const level = parseInt(match[1], 10);
    const id = match[2]?.replace(/@/g, '');
    const tag = match[3];
    const value = match[4]?.trim() || '';

    const record: GedcomRecord = {
      tag,
      id: id || undefined,
      value: value || undefined,
      children: [],
    };

    // Pop stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(record);
    } else {
      stack[stack.length - 1].record.children.push(record);
    }

    stack.push({ level, record });
  }

  return root;
}

/** Get first child record with given tag */
function getChild(record: GedcomRecord, tag: string): GedcomRecord | undefined {
  return record.children.find(c => c.tag === tag);
}

/** Get all child records with given tag */
function getChildren(record: GedcomRecord, tag: string): GedcomRecord[] {
  return record.children.filter(c => c.tag === tag);
}

/** Get value of first child record with given tag */
function childValue(record: GedcomRecord, tag: string): string {
  return getChild(record, tag)?.value || '';
}

/** Reassemble CONT/CONC text from a NOTE or other multi-line tag */
function assembleText(record: GedcomRecord): string {
  let text = record.value || '';
  for (const child of record.children) {
    if (child.tag === 'CONT') {
      text += '\n' + (child.value || '');
    } else if (child.tag === 'CONC') {
      text += (child.value || '');
    }
  }
  return text;
}

/** Build date + place string for an event record (e.g., BIRT, DEAT, IMMI) */
function eventDatePlace(record: GedcomRecord): { date: string; place: string } {
  return {
    date: fromGedcomDate(childValue(record, 'DATE')),
    place: childValue(record, 'PLAC'),
  };
}

/** Format an event as a combined date + place string for vital info */
function formatEvent(record: GedcomRecord): string {
  const { date, place } = eventDatePlace(record);
  if (date && place) return `${date}, ${place}`;
  return date || place;
}

// ── Extract individuals and families ───────────────────────

export function extractIndividuals(records: GedcomRecord[]): Map<string, GedcomIndi> {
  const map = new Map<string, GedcomIndi>();

  for (const rec of records) {
    if (rec.tag !== 'INDI' || !rec.id) continue;

    const nameRec = getChild(rec, 'NAME');
    let givenName = '';
    let surname = '';
    if (nameRec) {
      givenName = childValue(nameRec, 'GIVN');
      surname = childValue(nameRec, 'SURN');
      // Fallback: parse from NAME value "Given /Surname/"
      if (!givenName || !surname) {
        const nameMatch = nameRec.value?.match(/^(.*?)\s*\/([^/]*)\//);
        if (nameMatch) {
          if (!givenName) givenName = nameMatch[1].trim();
          if (!surname) surname = nameMatch[2].trim();
        } else if (!givenName && nameRec.value) {
          givenName = nameRec.value.trim();
        }
      }
    }

    const fullName = surname
      ? `${givenName} ${surname}`.trim()
      : givenName;

    // Events
    const birt = getChild(rec, 'BIRT');
    const deat = getChild(rec, 'DEAT');
    const buri = getChild(rec, 'BURI');
    const crem = getChild(rec, 'CREM');
    const bapm = getChild(rec, 'BAPM');
    const chr = getChild(rec, 'CHR');
    const conf = getChild(rec, 'CONF');
    const immi = getChild(rec, 'IMMI');
    const emig = getChild(rec, 'EMIG');
    const natu = getChild(rec, 'NATU');

    // Cause of death is a sub-tag of DEAT
    const causeOfDeath = deat ? childValue(deat, 'CAUS') : '';

    // Notes → biography
    const noteRecs = getChildren(rec, 'NOTE');
    const biography = noteRecs.map(n => assembleText(n)).join('\n\n');

    // Military (custom tag _MILT or EVEN with TYPE Military)
    let military = '';
    const milt = getChild(rec, '_MILT');
    if (milt) {
      military = milt.value || formatEvent(milt);
    } else {
      for (const even of getChildren(rec, 'EVEN')) {
        if (childValue(even, 'TYPE').toLowerCase() === 'military') {
          military = formatEvent(even);
          break;
        }
      }
    }

    // Residence
    const resi = getChild(rec, 'RESI');
    let residence = '';
    if (resi) {
      const resiNote = getChild(resi, 'NOTE');
      residence = resiNote ? assembleText(resiNote) : childValue(resi, 'PLAC') || formatEvent(resi);
    }

    // FamilySearch ID from REFN with TYPE FamilySearch
    let familySearchId = '';
    for (const refn of getChildren(rec, 'REFN')) {
      if (childValue(refn, 'TYPE').toLowerCase() === 'familysearch') {
        familySearchId = refn.value || '';
        break;
      }
    }

    // Nickname
    const nickname = childValue(rec, 'NICK');

    // Source references
    const sourceRefs = getChildren(rec, 'SOUR').map(s => (s.value || '').replace(/@/g, '')).filter(Boolean);

    const indi: GedcomIndi = {
      id: rec.id,
      givenName,
      surname,
      fullName,
      gender: childValue(rec, 'SEX'),
      birthDate: birt ? fromGedcomDate(childValue(birt, 'DATE')) : '',
      birthPlace: birt ? childValue(birt, 'PLAC') : '',
      deathDate: deat ? fromGedcomDate(childValue(deat, 'DATE')) : '',
      deathPlace: deat ? childValue(deat, 'PLAC') : '',
      burial: buri ? childValue(buri, 'PLAC') : '',
      cremation: crem ? formatEvent(crem) : '',
      baptized: bapm ? formatEvent(bapm) : '',
      christened: chr ? formatEvent(chr) : '',
      confirmation: conf ? formatEvent(conf) : '',
      occupation: childValue(rec, 'OCCU'),
      education: childValue(rec, 'EDUC'),
      religion: childValue(rec, 'RELI'),
      residence,
      nickname,
      immigration: immi ? formatEvent(immi) : '',
      emigration: emig ? formatEvent(emig) : '',
      naturalization: natu ? formatEvent(natu) : '',
      military,
      causeOfDeath,
      familySearchId,
      biography,
      familyChild: getChildren(rec, 'FAMC').map(f => (f.value || '').replace(/@/g, '')),
      familySpouse: getChildren(rec, 'FAMS').map(f => (f.value || '').replace(/@/g, '')),
      sourceRefs,
    };

    map.set(rec.id, indi);
  }

  return map;
}

export function extractFamilies(records: GedcomRecord[]): Map<string, GedcomFam> {
  const map = new Map<string, GedcomFam>();

  for (const rec of records) {
    if (rec.tag !== 'FAM' || !rec.id) continue;

    const husband = childValue(rec, 'HUSB').replace(/@/g, '');
    const wife = childValue(rec, 'WIFE').replace(/@/g, '');
    const children = getChildren(rec, 'CHIL').map(c => (c.value || '').replace(/@/g, ''));

    const marr = getChild(rec, 'MARR');
    const marriageDate = marr ? fromGedcomDate(childValue(marr, 'DATE')) : '';
    const marriagePlace = marr ? childValue(marr, 'PLAC') : '';

    const div = getChild(rec, 'DIV');
    const divorce = div ? (fromGedcomDate(childValue(div, 'DATE')) || childValue(div, 'NOTE') || 'Yes') : '';

    map.set(rec.id, { id: rec.id, husband, wife, children, marriageDate, marriagePlace, divorce });
  }

  return map;
}

// ── Markdown generation ────────────────────────────────────

/** Build a filesystem-safe filename: Surname_Given_Middle.md */
export function personFilename(indi: GedcomIndi): string {
  const parts: string[] = [];
  if (indi.surname) parts.push(indi.surname.replace(/\s+/g, ''));
  if (indi.givenName) {
    for (const p of indi.givenName.split(/\s+/)) {
      parts.push(p);
    }
  }
  if (parts.length === 0) parts.push('Unknown');
  // Sanitize: remove non-alphanumeric except underscore
  return parts.map(p => p.replace(/[^a-zA-Z0-9]/g, '')).join('_') + '.md';
}

/** Build the wikilink path for a person: people/Surname/Surname_Given.md */
export function personWikilink(indi: GedcomIndi): string {
  const dir = indi.surname ? indi.surname.replace(/[^a-zA-Z0-9]/g, '') : 'Unknown';
  return `people/${dir}/${personFilename(indi)}`;
}

/** Format a parent reference for the vital table: [[wikilink]] (ID) */
function formatParentRef(indi: GedcomIndi | undefined): string {
  if (!indi) return '\u2014';
  return `[[${personWikilink(indi)}]] (${indi.id})`;
}

/** Format a spouse reference for the vital table */
function formatSpouseRef(
  indi: GedcomIndi | undefined,
  marriageDate: string,
  marriagePlace: string,
): string {
  if (!indi) return '\u2014';
  const parts = [`[[${personWikilink(indi)}]] (${indi.id})`];
  const mParts: string[] = [];
  if (marriageDate) mParts.push(marriageDate);
  if (marriagePlace) mParts.push(marriagePlace);
  if (mParts.length > 0) {
    parts.push(`, m. ${mParts.join(', ')}`);
  }
  return parts.join('');
}

/** Format children list for the vital table */
function formatChildrenRef(
  childIds: string[],
  individuals: Map<string, GedcomIndi>,
): string {
  if (childIds.length === 0) return '\u2014';
  return childIds
    .map(id => {
      const ch = individuals.get(id);
      if (!ch) return id;
      return `[[${personWikilink(ch)}]] (${ch.id})`;
    })
    .join(', ');
}

/** Generate a person markdown file */
export function generatePersonMarkdown(
  indi: GedcomIndi,
  individuals: Map<string, GedcomIndi>,
  families: Map<string, GedcomFam>,
): string {
  const today = new Date().toISOString().split('T')[0];

  // Find parents from FAMC families
  let fatherIndi: GedcomIndi | undefined;
  let motherIndi: GedcomIndi | undefined;
  for (const famId of indi.familyChild) {
    const fam = families.get(famId);
    if (!fam) continue;
    if (fam.husband && !fatherIndi) fatherIndi = individuals.get(fam.husband);
    if (fam.wife && !motherIndi) motherIndi = individuals.get(fam.wife);
  }

  // Find spouse families from FAMS
  const spouseFams: { fam: GedcomFam; spouse: GedcomIndi | undefined }[] = [];
  for (const famId of indi.familySpouse) {
    const fam = families.get(famId);
    if (!fam) continue;
    const spouseId = fam.husband === indi.id ? fam.wife : fam.husband;
    spouseFams.push({ fam, spouse: spouseId ? individuals.get(spouseId) : undefined });
  }

  // Collect all children across all spouse families
  const allChildIds = new Set<string>();
  for (const { fam } of spouseFams) {
    for (const ch of fam.children) allChildIds.add(ch);
  }

  // Build frontmatter
  const fm: string[] = [
    '---',
    'type: person',
    `name: "${indi.fullName}"`,
  ];
  if (indi.birthDate) fm.push(`born: ${indi.birthDate}`);
  if (indi.deathDate) fm.push(`died: ${indi.deathDate}`);
  if (indi.surname) fm.push(`family: "${indi.surname}"`);
  if (indi.gender === 'M' || indi.gender === 'F') fm.push(`gender: ${indi.gender}`);
  fm.push(`gedcom_id: "${indi.id}"`);
  fm.push('privacy: false');
  fm.push('confidence: stub');
  if (indi.sourceRefs.length > 0) {
    fm.push('sources:');
    for (const src of indi.sourceRefs) fm.push(`  - "${src}"`);
  }
  fm.push(`created: ${today}`);
  fm.push(`tags: [genealogy, ${indi.surname ? indi.surname.toLowerCase() : 'unknown'}, person, imported]`);
  fm.push('---');

  // Build vital information table
  const rows: [string, string][] = [];
  rows.push(['Full Name', indi.fullName]);
  if (indi.birthDate) rows.push(['Born', indi.birthDate]);
  if (indi.birthPlace) rows.push(['Birthplace', indi.birthPlace]);
  if (indi.deathDate) rows.push(['Died', indi.deathDate]);
  if (indi.deathPlace) rows.push(['Death Place', indi.deathPlace]);
  if (indi.burial) rows.push(['Burial', indi.burial]);
  rows.push(['Father', formatParentRef(fatherIndi)]);
  rows.push(['Mother', formatParentRef(motherIndi)]);

  // Spouses
  if (spouseFams.length === 0) {
    rows.push(['Spouse', '\u2014']);
  } else if (spouseFams.length === 1) {
    const { fam, spouse } = spouseFams[0];
    rows.push(['Spouse', formatSpouseRef(spouse, fam.marriageDate, fam.marriagePlace)]);
    if (fam.divorce) rows.push(['Divorce', fam.divorce]);
  } else {
    for (let i = 0; i < spouseFams.length; i++) {
      const ord = ordinal(i + 1);
      const { fam, spouse } = spouseFams[i];
      rows.push([`Spouse (${ord})`, formatSpouseRef(spouse, fam.marriageDate, fam.marriagePlace)]);
      if (fam.divorce) rows.push(['Divorce', fam.divorce]);
    }
  }

  // Children
  if (spouseFams.length <= 1) {
    rows.push(['Children', formatChildrenRef([...allChildIds], individuals)]);
  } else {
    for (let i = 0; i < spouseFams.length; i++) {
      const { fam } = spouseFams[i];
      const ord = ordinal(i + 1);
      rows.push([`Children (${ord} marriage)`, formatChildrenRef(fam.children, individuals)]);
    }
  }

  // Remaining vital fields (only if present)
  if (indi.baptized) rows.push(['Baptized', indi.baptized]);
  if (indi.christened) rows.push(['Christened', indi.christened]);
  if (indi.confirmation) rows.push(['Confirmation', indi.confirmation]);
  if (indi.religion) rows.push(['Religion', indi.religion]);
  if (indi.occupation) rows.push(['Occupation', indi.occupation]);
  if (indi.education) rows.push(['Education', indi.education]);
  if (indi.nickname) rows.push(['Nickname', indi.nickname]);
  if (indi.residence) rows.push(['Residence', indi.residence]);
  if (indi.military) rows.push(['Military', indi.military]);
  if (indi.immigration) rows.push(['Immigration', indi.immigration]);
  if (indi.emigration) rows.push(['Emigration', indi.emigration]);
  if (indi.naturalization) rows.push(['Naturalization', indi.naturalization]);
  if (indi.causeOfDeath) rows.push(['Cause of Death', indi.causeOfDeath]);
  if (indi.cremation) rows.push(['Cremation', indi.cremation]);
  if (indi.familySearchId) rows.push(['FamilySearch ID', indi.familySearchId]);

  const vitalTable = [
    '| Field | Value |',
    '|---|---|',
    ...rows.map(([field, value]) => `| ${field} | ${value} |`),
  ].join('\n');

  // Assemble the full markdown
  const sections: string[] = [
    fm.join('\n'),
    '',
    `# ${indi.fullName}`,
    '',
    '## Vital Information',
    '',
    vitalTable,
    '',
    '## Biography',
    '',
    indi.biography || '[Imported from GEDCOM — add narrative biography here.]',
    '',
    '## Sources',
    '',
    '| Source ID | Type | Title | File |',
    '|---|---|---|---|',
    '',
    '## Notes',
    '',
    `Imported from GEDCOM on ${today}.`,
    '',
  ];

  return sections.join('\n');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Main ───────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const outDirIdx = args.indexOf('--out-dir');
  const outDirArg = outDirIdx !== -1 ? args[outDirIdx + 1] : undefined;

  if (!inputFile) {
    console.error('Usage: npx tsx scripts/import-gedcom.ts <input.ged> [--dry-run] [--out-dir <dir>]');
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), inputFile);
  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const ROOT = process.env.VAULT_ROOT
    ? resolve(process.cwd(), process.env.VAULT_ROOT)
    : resolve(import.meta.dirname, '..', '..');
  const PEOPLE_DIR = outDirArg
    ? resolve(process.cwd(), outDirArg)
    : resolve(ROOT, 'people');

  console.log(`Importing GEDCOM: ${inputPath}`);
  console.log(`Output directory: ${PEOPLE_DIR}`);
  if (dryRun) console.log('(dry run — no files will be written)');

  const text = readFileSync(inputPath, 'utf-8');
  const records = parseGedcomLines(text);
  const individuals = extractIndividuals(records);
  const families = extractFamilies(records);

  console.log(`Parsed ${individuals.size} individuals, ${families.size} families`);

  let created = 0;
  let skipped = 0;

  for (const [, indi] of individuals) {
    const dir = indi.surname ? indi.surname.replace(/[^a-zA-Z0-9]/g, '') : 'Unknown';
    const filename = personFilename(indi);
    const dirPath = join(PEOPLE_DIR, dir);
    const filePath = join(dirPath, filename);

    if (existsSync(filePath)) {
      console.log(`  SKIP (exists): ${dir}/${filename}`);
      skipped++;
      continue;
    }

    const markdown = generatePersonMarkdown(indi, individuals, families);

    if (dryRun) {
      console.log(`  WOULD CREATE: ${dir}/${filename} — ${indi.fullName} (${indi.id})`);
    } else {
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, markdown);
      console.log(`  CREATED: ${dir}/${filename} — ${indi.fullName} (${indi.id})`);
    }
    created++;
  }

  console.log(`\nDone!`);
  console.log(`  Individuals: ${individuals.size}`);
  console.log(`  Families: ${families.size}`);
  console.log(`  Files ${dryRun ? 'would be ' : ''}created: ${created}`);
  console.log(`  Skipped (already exist): ${skipped}`);
}

// Only run when executed directly (not when imported by tests)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('import-gedcom.ts') ||
  process.argv[1].endsWith('import-gedcom.js')
);
if (isMainModule) {
  main();
}
