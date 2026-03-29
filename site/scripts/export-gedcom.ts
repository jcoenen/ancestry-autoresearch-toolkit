/**
 * Export site-data.json to GEDCOM 5.5.1 format.
 *
 * Usage: npx tsx scripts/export-gedcom.ts [output-path]
 * Default output: ../export.ged (vault root)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const DATA_FILE = resolve(import.meta.dirname, '..', 'src', 'data', 'site-data.json');
const DEFAULT_OUTPUT = resolve(import.meta.dirname, '..', '..', 'export.ged');

interface Person {
  id: string;
  name: string;
  gender: string;
  born: string;
  died: string;
  birthplace: string;
  deathPlace: string;
  burial: string;
  father: string;
  mother: string;
  spouses: { id: string; name: string; marriageDate: string }[];
  children: { id: string }[];
  occupation: string;
  religion: string;
  immigration: string;
  emigration: string;
  naturalization: string;
  military: string;
  causeOfDeath: string;
  confirmation: string;
  baptized: string;
  christened: string;
  nickname: string;
  education: string;
  residence: string;
  familySearchId: string;
  divorce: string;
  cremation: string;
  privacy: boolean;
  sources: string[];
  media: MediaEntry[];
  biography: string;
}

interface MediaEntry {
  path: string;
  description: string;
  type: string;
}

interface SourceEntry {
  id: string;
  title: string;
  date: string;
  publisher: string;
  type: string;
  url: string;
  reliability: string;
  notes: string;
}

interface SiteData {
  people: Person[];
  sources: SourceEntry[];
  config: { siteName?: string };
}

// ── GEDCOM date formatting ──────────────────────────────────

const GEDCOM_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const MONTH_ABBR: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

function toGedcomDate(dateStr: string): string | null {
  if (!dateStr || dateStr === 'Unknown' || dateStr === '\u2014') return null;

  // Handle approximate dates
  const approx = dateStr.startsWith('~');
  const cleaned = approx ? dateStr.slice(1).trim() : dateStr;

  // ISO: YYYY-MM-DD
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = `${+iso[3]} ${GEDCOM_MONTHS[+iso[2] - 1]} ${iso[1]}`;
    return approx ? `ABT ${d}` : d;
  }

  // Year only: YYYY
  const yearOnly = cleaned.match(/^(\d{4})$/);
  if (yearOnly) {
    return approx ? `ABT ${yearOnly[1]}` : yearOnly[1];
  }

  // "Month DD, YYYY"
  const mdy = cleaned.match(/^([A-Z][a-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (mdy && mdy[1] in MONTH_ABBR) {
    const d = `${+mdy[2]} ${GEDCOM_MONTHS[MONTH_ABBR[mdy[1]]]} ${mdy[3]}`;
    return approx ? `ABT ${d}` : d;
  }

  // "DD Month YYYY"
  const dmy = cleaned.match(/^(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})/);
  if (dmy && dmy[2] in MONTH_ABBR) {
    const d = `${+dmy[1]} ${GEDCOM_MONTHS[MONTH_ABBR[dmy[2]]]} ${dmy[3]}`;
    return approx ? `ABT ${d}` : d;
  }

  return null;
}

// ── GEDCOM line helpers ─────────────────────────────────────

function gedLine(level: number, tag: string, value?: string): string {
  return value ? `${level} ${tag} ${value}` : `${level} ${tag}`;
}

function splitName(fullName: string): { given: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { given: fullName, surname: '' };
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return { given, surname };
}

/**
 * GEDCOM 5.5.1 limits lines to 255 chars. Long text must be split
 * using CONT (new line) and CONC (continuation on same line) tags.
 */
function gedNote(level: number, text: string): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (i === 0) {
      // First line goes on the NOTE tag itself
      if (para.length <= 200) {
        lines.push(gedLine(level, 'NOTE', para));
      } else {
        lines.push(gedLine(level, 'NOTE', para.slice(0, 200)));
        let rest = para.slice(200);
        while (rest.length > 0) {
          lines.push(gedLine(level + 1, 'CONC', rest.slice(0, 200)));
          rest = rest.slice(200);
        }
      }
    } else {
      // Subsequent lines use CONT
      if (para.length <= 200) {
        lines.push(gedLine(level + 1, 'CONT', para));
      } else {
        lines.push(gedLine(level + 1, 'CONT', para.slice(0, 200)));
        let rest = para.slice(200);
        while (rest.length > 0) {
          lines.push(gedLine(level + 1, 'CONC', rest.slice(0, 200)));
          rest = rest.slice(200);
        }
      }
    }
  }
  return lines;
}

/** Map source type string to GEDCOM-friendly media type */
function gedMediaForm(type: string): string {
  switch (type) {
    case 'gravestone': case 'cemetery': return 'photo';
    case 'portrait': return 'photo';
    case 'newspaper': case 'document': return 'electronic';
    default: return 'electronic';
  }
}

// ── Main ────────────────────────────────────────────────────

function main() {
  const outputPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DEFAULT_OUTPUT;

  const data: SiteData = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const { people, sources } = data;

  const lines: string[] = [];

  // Header
  lines.push('0 HEAD');
  lines.push('1 SOUR AncestryToolkit');
  lines.push('2 NAME Ancestry Autoresearch Toolkit');
  lines.push('2 VERS 1.0');
  lines.push('1 DEST GEDCOM');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // ── Source records ──────────────────────────────────────────
  // Emit top-level SOUR records so individuals can reference them
  const sourceIdSet = new Set<string>();
  for (const src of sources) {
    if (!src.id) continue;
    sourceIdSet.add(src.id);
    lines.push(`0 @${src.id}@ SOUR`);
    if (src.title) lines.push(gedLine(1, 'TITL', src.title));
    if (src.publisher) lines.push(gedLine(1, 'PUBL', src.publisher));
    if (src.date) {
      const gd = toGedcomDate(src.date);
      if (gd) {
        lines.push(gedLine(1, 'DATA'));
        lines.push(gedLine(2, 'DATE', gd));
      }
    }
    if (src.url) {
      lines.push(gedLine(1, 'NOTE', `URL: ${src.url}`));
    }
    if (src.reliability) {
      // GEDCOM QUAY: 0=unreliable, 1=questionable, 2=secondary, 3=direct
      const quayMap: Record<string, string> = { high: '3', moderate: '2', low: '1' };
      const quay = quayMap[src.reliability];
      if (quay) lines.push(gedLine(1, 'QUAY', quay));
    }
    if (src.notes) {
      lines.push(...gedNote(1, src.notes));
    }
  }

  // ── Build family groups ─────────────────────────────────────
  interface FamilyGroup {
    husband: string;
    wife: string;
    children: string[];
    marriageDate: string;
    divorce: string;
  }
  const familyMap = new Map<string, FamilyGroup>();
  const personSet = new Set(people.map(p => p.id));

  for (const p of people) {
    // Create family from father+mother
    if (p.father && p.mother && personSet.has(p.father) && personSet.has(p.mother)) {
      const famKey = [p.father, p.mother].sort().join('+');
      if (!familyMap.has(famKey)) {
        familyMap.set(famKey, { husband: p.father, wife: p.mother, children: [], marriageDate: '', divorce: '' });
      }
      const fam = familyMap.get(famKey)!;
      if (!fam.children.includes(p.id)) fam.children.push(p.id);
    }

    // Create families from spouse records
    for (const sp of p.spouses) {
      if (!sp.id || !personSet.has(sp.id)) continue;
      const famKey = [p.id, sp.id].sort().join('+');
      if (!familyMap.has(famKey)) {
        const pGender = p.gender;
        const isHusband = pGender === 'M' || (!pGender && p.id < sp.id);
        familyMap.set(famKey, {
          husband: isHusband ? p.id : sp.id,
          wife: isHusband ? sp.id : p.id,
          children: [],
          marriageDate: sp.marriageDate || '',
          divorce: '',
        });
      }
      if (sp.marriageDate) {
        familyMap.get(famKey)!.marriageDate = sp.marriageDate;
      }
    }

    // Attach divorce info to the matching family
    if (p.divorce) {
      for (const sp of p.spouses) {
        if (!sp.id) continue;
        const famKey = [p.id, sp.id].sort().join('+');
        const fam = familyMap.get(famKey);
        if (fam) fam.divorce = p.divorce;
      }
    }
  }

  // Assign family IDs
  const familyIds = new Map<string, string>();
  let famCounter = 1;
  for (const key of familyMap.keys()) {
    familyIds.set(key, `F${famCounter++}`);
  }

  // ── Individual records ──────────────────────────────────────
  let mediaCounter = 1;

  for (const p of people) {
    if (p.privacy) continue;

    lines.push(`0 @${p.id}@ INDI`);

    // Name
    const { given, surname } = splitName(p.name);
    lines.push(gedLine(1, 'NAME', `${given} /${surname}/`));
    if (given) lines.push(gedLine(2, 'GIVN', given));
    if (surname) lines.push(gedLine(2, 'SURN', surname));

    // Gender
    if (p.gender === 'M' || p.gender === 'F') {
      lines.push(gedLine(1, 'SEX', p.gender));
    }

    // Birth
    if (p.born || p.birthplace) {
      lines.push(gedLine(1, 'BIRT'));
      const bd = toGedcomDate(p.born);
      if (bd) lines.push(gedLine(2, 'DATE', bd));
      if (p.birthplace) lines.push(gedLine(2, 'PLAC', p.birthplace));
    }

    // Death (with cause of death)
    if (p.died || p.deathPlace || p.causeOfDeath) {
      lines.push(gedLine(1, 'DEAT'));
      const dd = toGedcomDate(p.died);
      if (dd) lines.push(gedLine(2, 'DATE', dd));
      if (p.deathPlace) lines.push(gedLine(2, 'PLAC', p.deathPlace));
      if (p.causeOfDeath) lines.push(gedLine(2, 'CAUS', p.causeOfDeath));
    }

    // Burial
    if (p.burial) {
      lines.push(gedLine(1, 'BURI'));
      lines.push(gedLine(2, 'PLAC', p.burial));
    }

    // Cremation
    if (p.cremation) {
      lines.push(gedLine(1, 'CREM'));
      const cremDate = toGedcomDate(p.cremation);
      if (cremDate) {
        lines.push(gedLine(2, 'DATE', cremDate));
      } else {
        lines.push(gedLine(2, 'NOTE', p.cremation));
      }
    }

    // Baptism
    if (p.baptized) {
      lines.push(gedLine(1, 'BAPM'));
      const bapDate = toGedcomDate(p.baptized);
      if (bapDate) {
        lines.push(gedLine(2, 'DATE', bapDate));
      } else {
        lines.push(gedLine(2, 'NOTE', p.baptized));
      }
    }

    // Christening
    if (p.christened) {
      lines.push(gedLine(1, 'CHR'));
      const chrDate = toGedcomDate(p.christened);
      if (chrDate) {
        lines.push(gedLine(2, 'DATE', chrDate));
      } else {
        lines.push(gedLine(2, 'NOTE', p.christened));
      }
    }

    // Confirmation (religious)
    if (p.confirmation) {
      lines.push(gedLine(1, 'CONF'));
      const confDate = toGedcomDate(p.confirmation);
      if (confDate) {
        lines.push(gedLine(2, 'DATE', confDate));
      } else {
        lines.push(gedLine(2, 'NOTE', p.confirmation));
      }
    }

    // Nickname
    if (p.nickname) {
      lines.push(gedLine(1, 'NICK', p.nickname));
    }

    // Occupation
    if (p.occupation) {
      lines.push(gedLine(1, 'OCCU', p.occupation));
    }

    // Education
    if (p.education) {
      lines.push(gedLine(1, 'EDUC', p.education));
    }

    // Religion
    if (p.religion) {
      lines.push(gedLine(1, 'RELI', p.religion));
    }

    // Residence
    if (p.residence) {
      lines.push(gedLine(1, 'RESI'));
      lines.push(gedLine(2, 'NOTE', p.residence));
    }

    // FamilySearch ID
    if (p.familySearchId) {
      lines.push(gedLine(1, 'REFN', p.familySearchId));
      lines.push(gedLine(2, 'TYPE', 'FamilySearch'));
    }

    // Immigration
    if (p.immigration) {
      lines.push(gedLine(1, 'IMMI'));
      lines.push(gedLine(2, 'NOTE', p.immigration));
    }

    // Emigration
    if (p.emigration) {
      lines.push(gedLine(1, 'EMIG'));
      lines.push(gedLine(2, 'NOTE', p.emigration));
    }

    // Naturalization
    if (p.naturalization) {
      lines.push(gedLine(1, 'NATU'));
      lines.push(gedLine(2, 'NOTE', p.naturalization));
    }

    // Military
    if (p.military) {
      lines.push(gedLine(1, '_MILT', p.military));
    }

    // Source references
    for (const srcId of p.sources) {
      if (sourceIdSet.has(srcId)) {
        lines.push(gedLine(1, 'SOUR', `@${srcId}@`));
      }
    }

    // Media objects (inline OBJE)
    for (const m of p.media) {
      if (!m.path) continue;
      const objId = `M${mediaCounter++}`;
      lines.push(`1 OBJE @${objId}@`);
    }

    // Biography as NOTE
    if (p.biography) {
      lines.push(...gedNote(1, p.biography));
    }

    // Family links (as child)
    for (const [famKey, fam] of familyMap) {
      if (fam.children.includes(p.id)) {
        lines.push(gedLine(1, 'FAMC', `@${familyIds.get(famKey)}@`));
      }
    }

    // Family links (as spouse)
    for (const [famKey, fam] of familyMap) {
      if (fam.husband === p.id || fam.wife === p.id) {
        lines.push(gedLine(1, 'FAMS', `@${familyIds.get(famKey)}@`));
      }
    }
  }

  // ── Media object records ────────────────────────────────────
  // Emit top-level OBJE records for all media across all people
  mediaCounter = 1;
  for (const p of people) {
    if (p.privacy) continue;
    for (const m of p.media) {
      if (!m.path) continue;
      const objId = `M${mediaCounter++}`;
      lines.push(`0 @${objId}@ OBJE`);
      lines.push(gedLine(1, 'FORM', gedMediaForm(m.type)));
      lines.push(gedLine(1, 'FILE', m.path));
      if (m.description) lines.push(gedLine(1, 'TITL', m.description));
    }
  }

  // ── Family records ──────────────────────────────────────────
  for (const [famKey, fam] of familyMap) {
    const famId = familyIds.get(famKey)!;
    lines.push(`0 @${famId}@ FAM`);

    if (fam.husband && personSet.has(fam.husband)) {
      lines.push(gedLine(1, 'HUSB', `@${fam.husband}@`));
    }
    if (fam.wife && personSet.has(fam.wife)) {
      lines.push(gedLine(1, 'WIFE', `@${fam.wife}@`));
    }

    // Marriage event
    if (fam.marriageDate) {
      lines.push(gedLine(1, 'MARR'));
      // Match date portion: ISO (YYYY-MM-DD), "Month DD, YYYY", or "DD Month YYYY"
      const mdMatch = fam.marriageDate.match(/^(\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})(.*)$/);
      if (mdMatch) {
        const gd = toGedcomDate(mdMatch[1]);
        if (gd) lines.push(gedLine(2, 'DATE', gd));
        const place = mdMatch[2]?.replace(/^[,)\s]+/, '').replace(/\)+$/, '').trim();
        if (place) lines.push(gedLine(2, 'PLAC', place));
      }
    }

    // Divorce event
    if (fam.divorce) {
      lines.push(gedLine(1, 'DIV'));
      const divDate = toGedcomDate(fam.divorce);
      if (divDate) {
        lines.push(gedLine(2, 'DATE', divDate));
      } else {
        lines.push(gedLine(2, 'NOTE', fam.divorce));
      }
    }

    // Children
    for (const childId of fam.children) {
      lines.push(gedLine(1, 'CHIL', `@${childId}@`));
    }
  }

  // Trailer
  lines.push('0 TRLR');

  writeFileSync(outputPath, lines.join('\n') + '\n');

  const indiCount = people.filter(p => !p.privacy).length;
  const mediaCount = mediaCounter - 1;
  console.log(`GEDCOM exported: ${outputPath}`);
  console.log(`  Individuals: ${indiCount}`);
  console.log(`  Families: ${familyMap.size}`);
  console.log(`  Sources: ${sourceIdSet.size}`);
  console.log(`  Media objects: ${mediaCount}`);
}

main();
