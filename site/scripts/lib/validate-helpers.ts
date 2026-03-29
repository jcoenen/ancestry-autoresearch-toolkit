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

export const ALLOWED_CONFIDENCE = ['high', 'moderate', 'low', 'stub'];
export const ALLOWED_RELIABILITY = ['high', 'moderate', 'low'];

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
  'Gravestone',
  'Father',
  'Mother',
  'Spouse',
  'Children',
  'Siblings',
  'Religion',
  'Occupation',
  'Married',
  'Marriage',
  // Supplemental fields — not parsed by build script but acceptable in the table
  'Also Known As',
  'Baptized',
  'Christened',
  'Cause of Death',
  'Companion',
  'Education',
  'FamilySearch ID',
  'Grandchildren',
  'Great-grandchildren',
  'Immigration',
  'Known Children',
  'Maternal Grandmother',
  'Maternal Grandparents',
  'Nickname',
  'Parents Married',
  'Residence',
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
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
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
  fatherLink: string;
  motherLink: string;
  childLinks: string[];
  spouseLinks: string[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function checkBidirectionalRelationships(
  relationships: PersonRelationships[]
): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  // Build lookup: "people/{file}" -> PersonRelationships
  const byPath = new Map<string, PersonRelationships>();
  for (const rel of relationships) {
    byPath.set(`people/${rel.filePath}`, rel);
  }

  for (const person of relationships) {
    const personPath = `people/${person.filePath}`;

    // If I list a Father wikilink, that father's file should list me as a child
    if (person.fatherLink) {
      const father = byPath.get(person.fatherLink);
      if (father && !father.childLinks.includes(personPath)) {
        result.errors.push(
          `people/${person.filePath}: lists father [[${person.fatherLink}]] but that file does not list this person as a child — add wikilink to ${person.fatherLink}`
        );
      }
    }

    // If I list a Mother wikilink, that mother's file should list me as a child
    if (person.motherLink) {
      const mother = byPath.get(person.motherLink);
      if (mother && !mother.childLinks.includes(personPath)) {
        result.errors.push(
          `people/${person.filePath}: lists mother [[${person.motherLink}]] but that file does not list this person as a child — add wikilink to ${person.motherLink}`
        );
      }
    }

    // If I list a Child wikilink, that child's file should list me (or my spouse) as a parent
    for (const childLink of person.childLinks) {
      const child = byPath.get(childLink);
      if (!child) continue;

      const childListsMe = child.fatherLink === personPath || child.motherLink === personPath;
      const childListsMySpouse = person.spouseLinks.some(
        sp => child.fatherLink === sp || child.motherLink === sp
      );

      if (!childListsMe && !childListsMySpouse) {
        result.errors.push(
          `people/${person.filePath}: lists child [[${childLink}]] but that child's file does not list this person (or their spouse) as a parent`
        );
      }
    }

    // If I list a Spouse wikilink, that spouse's file should list me as a spouse
    for (const spouseLink of person.spouseLinks) {
      const spouse = byPath.get(spouseLink);
      if (spouse && !spouse.spouseLinks.includes(personPath)) {
        result.errors.push(
          `people/${person.filePath}: lists spouse [[${spouseLink}]] but that file does not list this person as a spouse — add wikilink to ${spouseLink}`
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
      result.warnings.push(`Orphaned source: ${o} — not referenced by any person file`);
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
