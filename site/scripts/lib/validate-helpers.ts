/**
 * Pure validation helper functions used by validate_vault.ts.
 * Extracted for testability — no filesystem or side effects.
 */

export const ALLOWED_SOURCE_TYPES = [
  'obituary',
  'cemetery_memorial',
  'church_record',
  'secondary',
  'ship_manifest',
  'military',
  'census',
  'family_knowledge',
  'certificate',
];

export const ALLOWED_CONFIDENCE = ['high', 'moderate', 'low', 'stub', 'speculative'];
export const ALLOWED_RELIABILITY = ['high', 'moderate', 'low'];
export const ALLOWED_GENDER = ['M', 'F'];

export const SOURCE_ID_PATTERN = /^SRC-(OBIT|CEM|CHR|SEC|IMM|MIL|CENS|NOTE|CERT)-\d{3}$/;
export const GEDCOM_ID_PATTERN = /^I\d+$/;

// Recognized Vital Information field name patterns.
// Anything not matching these triggers a validation warning.
export const RECOGNIZED_VITAL_FIELDS = [
  'Full Name',
  'Born',
  'Died',
  'Birthplace',
  'Death Place',
  'Burial',
  'Burial Plot',
  'Burial Notes',
  'Gravestone',
  'Father',
  'Mother',
  'Spouse',
  'Children',
  'Siblings',
  'Religion',
  'Occupation',
  'Military',
  'Immigration',
  'Emigration',
  'Naturalization',
  'Cause of Death',
  'Confirmation',
  'Baptized',
  'Christened',
  'Nickname',
  'Also Known As',
  'Married Name',
  'Education',
  'Residence',
  'FamilySearch ID',
  'Divorce',
  'Cremation',
  'Married',
  'Marriage',
  // Supplemental fields — not parsed by build script but acceptable in the table
  'Companion',
  'Grandchildren',
  'Great-grandchildren',
  'Known Children',
  'Maternal Grandmother',
  'Maternal Grandparents',
  'Parents Married',
  'Sibling',
  'Special Friend',
  'Twin',
];

export const RECOGNIZED_VITAL_PATTERNS = [
  /^Spouse \(\d+(st|nd|rd|th)\)$/,        // Spouse (1st), Spouse (2nd), etc.
  /^Children \(\d+(st|nd|rd|th) marriage\)$/, // Children (1st marriage), etc.
];

export function isRecognizedVitalField(field: string): boolean {
  if (RECOGNIZED_VITAL_FIELDS.includes(field)) return true;
  return RECOGNIZED_VITAL_PATTERNS.some(p => p.test(field));
}

export function parseVitalTableTuples(content: string): [string, string][] {
  const entries: [string, string][] = [];
  const lines = content.split('\n');
  let inVitalSection = false;

  for (const line of lines) {
    if (line.includes('## Vital Information')) {
      inVitalSection = true;
      continue;
    }
    if (inVitalSection && line.startsWith('## ') && !line.includes('Vital')) {
      break;
    }
    if (inVitalSection && line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| Field')) {
      // Replace \| (escaped pipes inside wikilinks) with a placeholder before splitting
      const safe = line.replace(/\\\|/g, '\x00');
      const parts = safe.split('|').map(p => p.replace(/\x00/g, '|').trim()).filter(Boolean);
      if (parts.length >= 2) {
        entries.push([parts[0], parts[1]]);
      }
    }
  }

  return entries;
}

export function splitByComma(str: string): string[] {
  const segments: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of str) {
    if (char === '[' || char === '(') depth++;
    if (char === ']' || char === ')') depth--;
    if (char === ',' && depth === 0) {
      segments.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

export interface PersonRelationships {
  filePath: string;
  name: string;
  gedcomId: string;
  fatherId: string;
  motherId: string;
  childIds: string[];
  spouseIds: string[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function checkBidirectionalRelationships(
  relationships: PersonRelationships[]
): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  // Build lookup: gedcomId -> PersonRelationships
  const byId = new Map<string, PersonRelationships>();
  for (const rel of relationships) {
    if (rel.gedcomId) byId.set(rel.gedcomId, rel);
  }

  for (const person of relationships) {
    if (!person.gedcomId) continue;

    // Father: if I list father X, X must list me as a child
    if (person.fatherId) {
      const father = byId.get(person.fatherId);
      if (father && !father.childIds.includes(person.gedcomId)) {
        result.errors.push(
          `people/${person.filePath} (${person.gedcomId}): father is ${person.fatherId} but ${person.fatherId} does not list ${person.gedcomId} as a child`
        );
      }
    }

    // Mother: if I list mother X, X must list me as a child
    if (person.motherId) {
      const mother = byId.get(person.motherId);
      if (mother && !mother.childIds.includes(person.gedcomId)) {
        result.errors.push(
          `people/${person.filePath} (${person.gedcomId}): mother is ${person.motherId} but ${person.motherId} does not list ${person.gedcomId} as a child`
        );
      }
    }

    // Children: if I list child X, X must list me (or my spouse) as father or mother
    for (const childId of person.childIds) {
      const child = byId.get(childId);
      if (!child) continue;
      const childListsMe = child.fatherId === person.gedcomId || child.motherId === person.gedcomId;
      const childListsMySpouse = person.spouseIds.some(
        spId => child.fatherId === spId || child.motherId === spId
      );
      if (!childListsMe && !childListsMySpouse) {
        result.errors.push(
          `people/${person.filePath} (${person.gedcomId}): lists child ${childId} but that child does not list ${person.gedcomId} (or their spouse) as a parent`
        );
      }
    }

    // Spouses: if I list spouse X, X must list me as a spouse
    for (const spouseId of person.spouseIds) {
      const spouse = byId.get(spouseId);
      if (spouse && !spouse.spouseIds.includes(person.gedcomId)) {
        result.errors.push(
          `people/${person.filePath} (${person.gedcomId}): lists spouse ${spouseId} but ${spouseId} does not list ${person.gedcomId} as a spouse`
        );
      }
    }
  }

  return result;
}

export function crossReferenceCheck(
  sourceIds: Map<string, string>,
  personSourceRefs: Set<string>
): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const orphaned: string[] = [];
  for (const [srcId, file] of sourceIds) {
    if (!personSourceRefs.has(srcId)) {
      orphaned.push(`${file} (${srcId})`);
    }
  }

  if (orphaned.length > 0) {
    for (const o of orphaned) {
      result.errors.push(`Orphaned source: ${o} — not referenced by any person file`);
    }
  }

  return result;
}

export function checkUnprocessedMedia(
  newsAndDocEntries: { localPath: string; person: string; type: string; line: number }[],
  claimedMedia: Set<string>
): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  const groups = new Map<string, typeof newsAndDocEntries>();
  for (const entry of newsAndDocEntries) {
    const basePath = entry.localPath.replace(/_p\d+\.\w+$/, '');
    if (!groups.has(basePath)) groups.set(basePath, []);
    groups.get(basePath)!.push(entry);
  }

  for (const [, entries] of groups) {
    const isClaimed = entries.some(e => claimedMedia.has(e.localPath));

    if (!isClaimed) {
      const label = entries[0].type === 'newspaper' ? 'Newspaper clipping' : 'Document';
      const files = entries.map(e => e.localPath).join(', ');
      result.errors.push(
        `${label} NOT LINKED: ${files} (${entries[0].person}) — no source file lists this in its media: frontmatter array.`
      );
    }
  }

  return result;
}
