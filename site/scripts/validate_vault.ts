import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
  ALLOWED_SOURCE_TYPES,
  ALLOWED_CONFIDENCE,
  ALLOWED_RELIABILITY,
  ALLOWED_GENDER,
  SOURCE_ID_PATTERN,
  GEDCOM_ID_PATTERN,
  isRecognizedVitalField,
  parseVitalTableTuples,
  splitByComma,
  checkBidirectionalRelationships,
  crossReferenceCheck,
  checkUnprocessedMedia,
  type ValidationResult,
  type PersonRelationships,
} from './lib/validate-helpers.js';
import { slugify } from './lib/build-helpers.js';
import { calculatePublicScope, type ScopeRelationship } from './lib/public-scope.js';

// VAULT_ROOT env var points to the vault directory (e.g. Coenen_Genealogy/).
// Falls back to ../../ for backward compatibility when site/ is inside the vault.

// ---------------------------------------------------------------------------
// Media path rules — per METHODOLOGY.md "Media Rules"
// Every media ref must be "subfolder/filename.ext". The subfolder is determined
// by the filename TYPE prefix (e.g. CEM_ → gravestones/, POR_ → portraits/).
// Refs must also exist in _Media_Index.md or the image will never render on site.
// ---------------------------------------------------------------------------
const MEDIA_TYPE_TO_SUBFOLDER: Record<string, string> = {
  CEM:  'gravestones',
  POR:  'portraits',
  NEWS: 'newspapers',
  DOC:  'documents',
  GRP:  'group',
  MISC: 'misc',
};
const VALID_MEDIA_SUBFOLDERS = new Set(Object.values(MEDIA_TYPE_TO_SUBFOLDER));
const ALLOWED_MILITARY_BRANCHES = [
  'U.S. Army',
  'U.S. Army Air Forces',
  'U.S. Navy',
  'U.S. Marine Corps',
  'U.S. Air Force',
  'U.S. Coast Guard',
  'U.S. National Guard',
  'U.S. Army Reserve',
  'U.S. Navy Reserve',
  'U.S. Marine Corps Reserve',
  'U.S. Air Force Reserve',
  'Union Army',
  'Confederate Army',
  'Wisconsin State Guard',
  'Unknown',
];
const ALLOWED_MILITARY_CONFLICTS = [
  'American Revolution',
  'War of 1812',
  'U.S. Civil War',
  'Spanish-American War',
  'World War I',
  'World War II',
  'Korean War',
  'Vietnam War',
  'Persian Gulf War',
  'War in Afghanistan',
  'Iraq War',
  'Peacetime service',
  'Unknown',
];
const ALLOWED_MILITARY_CONFIDENCE = ['high', 'moderate', 'low'];
const ALLOWED_OCCUPATION_CATEGORIES = [
  'Agriculture / Farming',
  'Business / Management',
  'Education',
  'Healthcare',
  'Religious / Clergy',
  'Trades / Manufacturing',
  'Transportation',
  'Public Service / Government',
  'Military',
  'Domestic / Homemaking',
  'Arts / Creative',
  'Retail / Service',
  'Technology / Engineering',
  'Legal / Finance',
  'Other specific occupations',
  'Unknown',
];
const ALLOWED_OCCUPATION_CONFIDENCE = ['high', 'moderate', 'low'];
const SOURCE_TYPE_TO_PREFIX: Record<string, string> = {
  obituary: 'OBIT',
  cemetery_memorial: 'CEM',
  church_record: 'CHR',
  secondary: 'SEC',
  ship_manifest: 'IMM',
  military: 'MIL',
  census: 'CENS',
  family_knowledge: 'NOTE',
  certificate: 'CERT',
};
const SOURCE_TYPE_TO_FOLDER: Record<string, string> = {
  obituary: 'obituaries',
  cemetery_memorial: 'cemetery',
  church_record: 'church',
  secondary: 'secondary',
  ship_manifest: 'immigration',
  military: 'military',
  census: 'census',
  family_knowledge: 'notes',
  certificate: 'certificates',
};

function firstYear(value: unknown): number | null {
  const match = String(value || '').match(/(?:abt\.?|about|circa|ca\.?|before|after|between|from|to)?\s*(\d{4})/i);
  return match ? Number(match[1]) : null;
}

function normalizeNameForComparison(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/"[^"]*"/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function documentsSameNameReuse(text: string): boolean {
  return /\b(not the same|different people|same name|name reused|second son named|given the same name|reusing a deceased child'?s name)\b/i.test(text);
}

function mediaKindFromPath(path: string): 'portrait' | 'gravestone' | 'document' | 'newspaper' | 'group' | 'misc' | 'unknown' {
  if (path.startsWith('portraits/')) return 'portrait';
  if (path.startsWith('gravestones/')) return 'gravestone';
  if (path.startsWith('documents/')) return 'document';
  if (path.startsWith('newspapers/')) return 'newspaper';
  if (path.startsWith('group/')) return 'group';
  if (path.startsWith('misc/')) return 'misc';
  return 'unknown';
}

function mediaKindFromDescription(description: string): 'portrait' | 'gravestone' | 'document' | 'newspaper' | 'group' | 'misc' | 'unknown' {
  const text = description.toLowerCase();
  if (/\b(newspaper obituary|obituary clipping|obituary body|obituary continuation|obituary header|obituary p\d|green bay press|post-crescent|press-gazette|oshkosh northwestern|daily herald|death notice)\b/.test(text)) return 'newspaper';
  if (/\b(gravestone|headstone|grave marker|mausoleum|family plot|plot view|tombstone)\b/.test(text)) return 'gravestone';
  if (/\b(couple photo|family photo|group photo|wedding photo|wedding portrait|family portrait)\b/.test(text)) return 'group';
  if (/\b(portrait photo|studio portrait|portrait|person photo|profile image)\b/.test(text)) return 'portrait';
  if (/\b(death certificate|birth certificate|marriage record|certificate|census|ship manifest|register scan|document|paper|record scan)\b/.test(text)) return 'document';
  if (/\b(obituary|newspaper|clipping|article)\b/.test(text)) return 'newspaper';
  return 'unknown';
}

/**
 * Validates a single media ref path against METHODOLOGY.md rules.
 * Returns an error string if the path is malformed, null if it looks correct.
 * Does NOT check existence in _Media_Index.md — that is a separate cross-reference pass.
 */
function checkMediaRefFormat(ref: string, context: string): string | null {
  const parts = ref.split('/');

  if (parts.length === 1) {
    // Bare filename — no subfolder at all
    const typePrefix = ref.split('_')[0].toUpperCase();
    const expectedFolder = MEDIA_TYPE_TO_SUBFOLDER[typePrefix];
    const hint = expectedFolder
      ? ` Correct path: "${expectedFolder}/${ref}"`
      : ` Expected format: "gravestones/CEM_...", "portraits/POR_...", "newspapers/NEWS_...", etc.`;
    return `${context}: media ref "${ref}" is a bare filename with no subfolder.${hint}`;
  }

  if (parts.length > 2) {
    // e.g. "media/portraits/POR_..." or "Coenen_Genealogy/media/..."
    const stripped = ref.startsWith('media/') ? ref.slice(6) : parts.slice(-2).join('/');
    return `${context}: media ref "${ref}" has too many path segments — must be "subfolder/filename.ext". Did you mean "${stripped}"?`;
  }

  // Exactly subfolder/filename — check subfolder is valid
  const [subfolder, filename] = parts;
  if (!VALID_MEDIA_SUBFOLDERS.has(subfolder)) {
    const typePrefix = filename.split('_')[0].toUpperCase();
    const expectedFolder = MEDIA_TYPE_TO_SUBFOLDER[typePrefix];
    const hint = expectedFolder
      ? ` "${typePrefix}_" files belong in "${expectedFolder}/".`
      : ` Valid subfolders: ${[...VALID_MEDIA_SUBFOLDERS].join(', ')}.`;
    return `${context}: media ref "${ref}" uses unknown subfolder "${subfolder}".${hint}`;
  }

  // Check that the subfolder matches the filename TYPE prefix
  const typePrefix = filename.split('_')[0].toUpperCase();
  const expectedFolder = MEDIA_TYPE_TO_SUBFOLDER[typePrefix];
  if (expectedFolder && expectedFolder !== subfolder) {
    return `${context}: media ref "${ref}" — "${typePrefix}_" files belong in "${expectedFolder}/", not "${subfolder}/".`;
  }

  return null; // format is correct
}

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const MEDIA_DIR = resolve(ROOT, 'media');
const MEDIA_INDEX = resolve(ROOT, 'media', '_Media_Index.md');
const CONFIG_FILE = resolve(ROOT, 'site-config.json');

let siteConfig: Record<string, unknown> = {};
if (existsSync(CONFIG_FILE)) {
  siteConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
}

console.log(`Vault root: ${ROOT}`);

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function publicScopeConfig(): {
  enabled: boolean;
  mode: 'warn' | 'error';
  rootPersonId: string;
  includeSpousesOfBloodRelatives: boolean;
  allowPersonIds: string[];
} {
  const cfg = (siteConfig.publicScope ?? {}) as Record<string, unknown>;
  const mode = cfg.mode === 'error' ? 'error' : 'warn';
  return {
    enabled: cfg.enabled === true,
    mode,
    rootPersonId: String(cfg.rootPersonId || siteConfig.rootPersonId || ''),
    includeSpousesOfBloodRelatives: cfg.includeSpousesOfBloodRelatives !== false,
    allowPersonIds: asStringArray(cfg.allowPersonIds),
  };
}

function validateSourceFiles(sourceFiles: string[]): {
  result: ValidationResult;
  checked: number;
  sourceIds: Map<string, string>;
  sourceIdSet: Set<string>;
  claimedMedia: Set<string>;
  sourcePersons: Map<string, string[]>;
  sourcePersonIds: Map<string, string[]>;
  sourceSubjectPersonIds: Map<string, string[]>;
  sourceMediaRefs: Map<string, string[]>;
} {
  const result: ValidationResult = { errors: [], warnings: [] };
  const sourceIds = new Map<string, string>(); // source_id -> file
  const sourceIdSet = new Set<string>();
  const claimedMedia = new Set<string>();
  const sourcePersons = new Map<string, string[]>(); // "sources/file" -> persons array
  const sourcePersonIds = new Map<string, string[]>(); // "sources/file" -> person_ids array
  const sourceSubjectPersonIds = new Map<string, string[]>(); // "sources/file" -> subject_person_ids array
  const sourceMediaRefs = new Map<string, string[]>(); // file -> valid-format media paths
  let checked = 0;

  const REQUIRED_SOURCE_FIELDS = [
    'source_id',
    'type',
    'source_type',
    'title',
    'date_of_document',
    'date_accessed',
    'url',
    'publisher',
    'persons',
    'families',
    'reliability',
    'created',
    'tags',
  ];

  for (const file of sourceFiles) {
    if (file.startsWith('_')) continue;
    checked++;

    const fullPath = resolve(SOURCES_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm, content } = matter(raw);

    // Collect and validate media paths declared by this source file
    if (Array.isArray(fm.media)) {
      const fileRefs: string[] = [];
      for (const p of fm.media) {
        if (typeof p !== 'string') continue;
        claimedMedia.add(p);
        const formatError = checkMediaRefFormat(p, `sources/${file}`);
        if (formatError) {
          result.errors.push(formatError);
        } else {
          fileRefs.push(p);
        }
      }
      if (fileRefs.length > 0) sourceMediaRefs.set(file, fileRefs);
    }

    // Check type: source
    if (fm.type !== 'source') {
      result.errors.push(`sources/${file}: type is "${fm.type}", expected "source"`);
      continue;
    }

    // Source types where url/date_of_document/publisher may legitimately be null
    const ARCHIVAL_TYPES = ['family_knowledge', 'military', 'ship_manifest', 'census', 'secondary'];
    const isArchival = ARCHIVAL_TYPES.includes(fm.source_type);

    // Check required fields
    for (const field of REQUIRED_SOURCE_FIELDS) {
      if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
        // Downgrade to warning for fields that may not apply to archival/physical sources
        if (isArchival && (field === 'url' || field === 'date_of_document' || field === 'publisher')) {
          continue;
        } else if (field === 'url' && fm.source_type === 'obituary' && Array.isArray(fm.media)) {
          continue;
        } else if (field === 'url' && fm.source_type === 'obituary') {
          // Obituaries from blocked funeral home sites may have empty URL
          result.warnings.push(`sources/${file}: url is empty (web-blocked source?)`);
        } else {
          result.errors.push(`sources/${file}: missing ${field} field`);
        }
      }
    }

    // Check source_id pattern
    if (fm.source_id) {
      if (!SOURCE_ID_PATTERN.test(fm.source_id)) {
        result.errors.push(
          `sources/${file}: source_id "${fm.source_id}" does not match pattern SRC-{TYPE}-{NNN}`
        );
      }
      const expectedPrefix = SOURCE_TYPE_TO_PREFIX[String(fm.source_type || '')];
      if (expectedPrefix && !String(fm.source_id).startsWith(`SRC-${expectedPrefix}-`)) {
        result.warnings.push(
          `sources/${file}: source_id "${fm.source_id}" does not match source_type "${fm.source_type}" (expected SRC-${expectedPrefix}-###)`
        );
      }

      // Check uniqueness
      if (sourceIds.has(fm.source_id)) {
        result.errors.push(
          `sources/${file}: duplicate source_id "${fm.source_id}" (also in ${sourceIds.get(fm.source_id)})`
        );
      } else {
        sourceIds.set(fm.source_id, `sources/${file}`);
        sourceIdSet.add(fm.source_id);
      }
    }

    // Check source_type is allowed
    if (fm.source_type && !ALLOWED_SOURCE_TYPES.includes(fm.source_type)) {
      result.errors.push(
        `sources/${file}: source_type "${fm.source_type}" is not in allowed values: ${ALLOWED_SOURCE_TYPES.join(', ')}`
      );
    } else if (fm.source_type) {
      const expectedFolder = SOURCE_TYPE_TO_FOLDER[String(fm.source_type)];
      if (expectedFolder && !file.startsWith(`${expectedFolder}/`)) {
        result.warnings.push(
          `sources/${file}: source_type "${fm.source_type}" usually belongs in sources/${expectedFolder}/`
        );
      }
    }

    // Check reliability is allowed
    if (fm.reliability && !ALLOWED_RELIABILITY.includes(fm.reliability)) {
      result.errors.push(
        `sources/${file}: reliability "${fm.reliability}" is not in allowed values: ${ALLOWED_RELIABILITY.join(', ')}`
      );
    }

    // Check persons is non-empty array
    if (fm.persons) {
      if (!Array.isArray(fm.persons) || fm.persons.length === 0) {
        result.errors.push(`sources/${file}: persons must be a non-empty array`);
      } else {
        sourcePersons.set(`sources/${file}`, fm.persons.map((p: unknown) => String(p)));
      }
    }

    // Optional relational source-to-person links. Unlike persons:, these are stable keys.
    if (fm.person_ids !== undefined) {
      if (!Array.isArray(fm.person_ids)) {
        result.errors.push(`sources/${file}: person_ids must be an array of GEDCOM IDs`);
      } else {
        sourcePersonIds.set(`sources/${file}`, fm.person_ids.map((p: unknown) => String(p)));
      }
    }

    // subject_person_ids identifies who this source is primarily about.
    // person_ids remains the broader "everyone genealogically relevant mentioned here" list.
    if (fm.subject_person_ids !== undefined) {
      if (!Array.isArray(fm.subject_person_ids) || fm.subject_person_ids.length === 0) {
        result.errors.push(`sources/${file}: subject_person_ids must be a non-empty array of GEDCOM IDs`);
      } else {
        sourceSubjectPersonIds.set(`sources/${file}`, fm.subject_person_ids.map((p: unknown) => String(p)));
      }
    }

    if (Array.isArray(fm.subject_person_ids)) {
      const personIdSet = new Set(Array.isArray(fm.person_ids) ? fm.person_ids.map((p: unknown) => String(p)) : []);
      for (const subjectId of fm.subject_person_ids.map((p: unknown) => String(p))) {
        if (!personIdSet.has(subjectId)) {
          result.errors.push(`sources/${file}: subject_person_ids entry "${subjectId}" must also be present in person_ids`);
        }
      }
    }

    // Check body sections for obituaries (Full Text required with actual content)
    if (fm.source_type === 'obituary') {
      if (!sourceSubjectPersonIds.has(`sources/${file}`)) {
        result.errors.push(`sources/${file}: obituary source missing subject_person_ids - do not infer obituary subject from person_ids order`);
      }
      if (!Array.isArray(fm.person_ids)) {
        result.errors.push(`sources/${file}: obituary source missing person_ids - subject_person_ids must also be included in person_ids`);
      }
      if (!content.includes('## Full Text')) {
        result.errors.push(`sources/${file}: missing ## Full Text section`);
      } else {
        // Check that Full Text has actual blockquoted content, not just the heading
        const fullTextMatch = content.match(/## Full Text\s*\n([\s\S]*?)(?=\n## |\n---|$)/);
        const fullTextBody = fullTextMatch ? fullTextMatch[1].trim() : '';
        const hasBlockquote = fullTextBody.split('\n').some(l => l.startsWith('>'));
        if (!hasBlockquote) {
          result.errors.push(`sources/${file}: ## Full Text section has no blockquoted text — obituary not transcribed`);
        }
      }
    }

    // Cemetery memorials use ## Memorial Data instead of ## Full Text
    if (fm.source_type === 'cemetery_memorial') {
      if (Array.isArray(fm.person_ids) && fm.person_ids.length > 0 && (!Array.isArray(fm.subject_person_ids) || fm.subject_person_ids.length === 0)) {
        result.errors.push(`sources/${file}: cemetery memorial has person_ids but no subject_person_ids — mark the memorial subject so source pages and linked people are precise`);
      }
      if (!content.includes('## Memorial Data') && !content.includes('## Full Text')) {
        result.errors.push(`sources/${file}: missing ## Memorial Data or ## Full Text section`);
      }
    }

    if (fm.source_type === 'obituary') {
      if (!content.includes('## Extracted Facts')) {
        result.errors.push(`sources/${file}: missing ## Extracted Facts section`);
      }
    }

    // Check that ALL source types have at least a ## Full Text or ## Memorial Data section
    // This ensures the build script can extract content for the site
    if (fm.source_type !== 'obituary' && fm.source_type !== 'cemetery_memorial') {
      const hasFullText = content.includes('## Full Text');
      const hasMemorialData = content.includes('## Memorial Data');
      if (!hasFullText && !hasMemorialData) {
        result.errors.push(
          `sources/${file}: missing ## Full Text section — content will not appear on the site. See CLAUDE.md for required body sections.`
        );
      }
    }

    // Check that source files have actual primary content, not just secondary narrative
    // A source with url: null and no document behind it is incomplete
    if (!fm.url && fm.source_type !== 'family_knowledge') {
      const hasDocument = content.includes('>') || content.includes('## Full Text') || content.includes('## Memorial Data');
      if (!hasDocument) {
        result.errors.push(`sources/${file}: no URL and no primary document content — source is unverified narrative only`);
        } else if (fm.source_type === 'obituary' && !Array.isArray(fm.media)) {
          result.warnings.push(`sources/${file}: url is null — primary document not yet located online`);
      }
    }

    // Check OCR verification status
    if (fm.ocr_verified === false) {
      result.warnings.push(`sources/${file}: ocr_verified: false — needs manual review against source image before data is trusted`);
    }

    // Check for Notes section (any source type)
    const hasNotes = content.includes('## Notes') || content.includes('## Research Notes');
    if (!hasNotes) {
      result.warnings.push(`sources/${file}: missing ## Notes section`);
    }
  }

  return { result, checked, sourceIds, sourceIdSet, claimedMedia, sourcePersons, sourcePersonIds, sourceSubjectPersonIds, sourceMediaRefs };
}

// parseVitalTable is imported as parseVitalTableTuples from validate-helpers
const parseVitalTable = parseVitalTableTuples;

function validatePersonFiles(personFiles: string[], sourceIdSet: Set<string>, allGedcomIds: Set<string>): {
  result: ValidationResult;
  checked: number;
  personSourceRefs: Set<string>;
  personSourcesById: Map<string, Set<string>>;
  gedcomIds: Map<string, string>;
  relationships: PersonRelationships[];
  scopeRelationships: ScopeRelationship[];
  personMediaRefs: Map<string, string[]>;
  personFactsById: Map<string, PersonFactInfo>;
} {
  const result: ValidationResult = { errors: [], warnings: [] };
  const personSourceRefs = new Set<string>();
  const personSourcesById = new Map<string, Set<string>>();
  const gedcomIds = new Map<string, string>(); // gedcom_id -> file
  const relationships: PersonRelationships[] = [];
  const scopeRelationships: ScopeRelationship[] = [];
  const personMediaRefs = new Map<string, string[]>(); // file -> media ref paths
  const personFactsById = new Map<string, PersonFactInfo>();
  const personSlugEntries: Array<{ baseSlug: string; finalSlug: string; file: string; id: string; born: string }> = [];
  let checked = 0;

  const REQUIRED_PERSON_FIELDS = [
    'type',
    'name',
    'gender',
    'family',
    'gedcom_id',
    'privacy',
    'confidence',
    'sources',
    'created',
  ];

  for (const file of personFiles) {
    const fullPath = resolve(PEOPLE_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm, content } = matter(raw);

    if (fm.type !== 'person') continue;
    checked++;

    // Check required fields
    for (const field of REQUIRED_PERSON_FIELDS) {
      if (fm[field] === undefined || fm[field] === null) {
        // Allow empty arrays for sources and privacy=false
        if (field === 'sources' && Array.isArray(fm[field])) continue;
        if (field === 'privacy' && fm[field] === false) continue;
        result.errors.push(`people/${file}: missing ${field} field`);
      }
    }

    // Check gedcom_id pattern
    if (fm.gedcom_id) {
      const gid = String(fm.gedcom_id);
      if (!GEDCOM_ID_PATTERN.test(gid)) {
        result.errors.push(
          `people/${file}: gedcom_id "${gid}" does not match pattern I{N}`
        );
      }
      // Check uniqueness
      if (gedcomIds.has(gid)) {
        result.errors.push(
          `people/${file}: duplicate gedcom_id "${gid}" (also in ${gedcomIds.get(gid)})`
        );
      } else {
        gedcomIds.set(gid, `people/${file}`);
      }
    }

    // Check gender value
    if (fm.gender && !ALLOWED_GENDER.includes(fm.gender)) {
      result.errors.push(
        `people/${file}: gender "${fm.gender}" is not in allowed values: ${ALLOWED_GENDER.join(', ')}`
      );
    }

    // Check confidence
    if (fm.confidence && !ALLOWED_CONFIDENCE.includes(fm.confidence)) {
      result.errors.push(
        `people/${file}: confidence "${fm.confidence}" is not in allowed values: ${ALLOWED_CONFIDENCE.join(', ')}`
      );
    }

    // Check that born/died are strings — unquoted ISO dates (e.g. born: 1824-10-16) are parsed
    // as JavaScript Date objects by the YAML parser, which crashes the site at runtime.
    if (fm.born != null && typeof fm.born !== 'string') {
      result.errors.push(
        `people/${file}: "born" is a ${fm.born instanceof Date ? 'Date object' : typeof fm.born} (value: ${fm.born}) — must be a quoted string. ` +
        `Unquoted ISO dates crash the site. Fix: born: "${fm.born instanceof Date ? fm.born.toISOString().split('T')[0] : fm.born}"`
      );
    }
    if (fm.died != null && typeof fm.died !== 'string') {
      result.errors.push(
        `people/${file}: "died" is a ${fm.died instanceof Date ? 'Date object' : typeof fm.died} (value: ${fm.died}) — must be a quoted string. ` +
        `Unquoted ISO dates crash the site. Fix: died: "${fm.died instanceof Date ? fm.died.toISOString().split('T')[0] : fm.died}"`
      );
    }

    // Check that every source_id references an existing source file
    if (Array.isArray(fm.sources)) {
      for (const srcId of fm.sources) {
        const sourceId = String(srcId);
        personSourceRefs.add(sourceId);
        if (fm.gedcom_id) {
          const personId = String(fm.gedcom_id);
          if (!personSourcesById.has(personId)) personSourcesById.set(personId, new Set<string>());
          personSourcesById.get(personId)!.add(sourceId);
        }
        if (!sourceIdSet.has(srcId)) {
          result.errors.push(
            `people/${file}: references source "${srcId}" which does not exist in sources/`
          );
        }
      }

      // Error if zero sources (unless confidence is speculative)
      if (fm.sources.length === 0) {
        if (fm.confidence !== 'speculative') {
          result.errors.push(`people/${file}: 0 sources cited — add at least one source or set confidence: speculative`);
        }
      }
    }

    // Validate structured military_service frontmatter. The legacy Vital row is
    // still allowed for display, but structured entries drive stats/GEDCOM.
    if (fm.military_service !== undefined) {
      if (!Array.isArray(fm.military_service)) {
        result.errors.push(`people/${file}: military_service must be an array`);
      } else {
        fm.military_service.forEach((entry: unknown, index: number) => {
          const prefix = `people/${file}: military_service[${index}]`;
          if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
            result.errors.push(`${prefix} must be an object`);
            return;
          }
          const svc = entry as Record<string, unknown>;
          const branch = String(svc.branch || '').trim();
          const conflict = String(svc.conflict || '').trim();
          const source = String(svc.source || svc.source_id || '').trim();
          const confidence = String(svc.confidence || '').trim();

          if (!branch) result.errors.push(`${prefix}: branch is required`);
          else if (!ALLOWED_MILITARY_BRANCHES.includes(branch)) {
            result.errors.push(`${prefix}: branch "${branch}" is not recognized. Use one of: ${ALLOWED_MILITARY_BRANCHES.join(', ')}`);
          }

          if (conflict && !ALLOWED_MILITARY_CONFLICTS.includes(conflict)) {
            result.errors.push(`${prefix}: conflict "${conflict}" is not recognized. Use one of: ${ALLOWED_MILITARY_CONFLICTS.join(', ')}`);
          }

          if (!source) result.errors.push(`${prefix}: source is required`);
          else if (!sourceIdSet.has(source)) {
            result.errors.push(`${prefix}: source "${source}" does not exist in sources/`);
          }

          if (!confidence) result.errors.push(`${prefix}: confidence is required`);
          else if (!ALLOWED_MILITARY_CONFIDENCE.includes(confidence)) {
            result.errors.push(`${prefix}: confidence "${confidence}" must be high, moderate, or low`);
          }
        });
      }
    }

    // Validate structured occupations frontmatter. The Vital row remains the
    // human-readable summary; structured entries drive category stats/search.
    if (fm.occupations !== undefined) {
      if (!Array.isArray(fm.occupations)) {
        result.errors.push(`people/${file}: occupations must be an array`);
      } else {
        fm.occupations.forEach((entry: unknown, index: number) => {
          const prefix = `people/${file}: occupations[${index}]`;
          if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
            result.errors.push(`${prefix} must be an object`);
            return;
          }
          const occ = entry as Record<string, unknown>;
          const category = String(occ.category || '').trim();
          const label = String(occ.label || '').trim();
          const confidence = String(occ.confidence || '').trim();
          const sources = Array.isArray(occ.sources)
            ? occ.sources.map(String).map(s => s.trim()).filter(Boolean)
            : (occ.source || occ.source_id ? [String(occ.source || occ.source_id).trim()] : []);

          if (!category) result.errors.push(`${prefix}: category is required`);
          else if (!ALLOWED_OCCUPATION_CATEGORIES.includes(category)) {
            result.errors.push(`${prefix}: category "${category}" is not recognized. Use one of: ${ALLOWED_OCCUPATION_CATEGORIES.join(', ')}`);
          }

          if (!label) result.errors.push(`${prefix}: label is required`);

          if (sources.length === 0) result.errors.push(`${prefix}: at least one source is required`);
          for (const source of sources) {
            if (!sourceIdSet.has(source)) {
              result.errors.push(`${prefix}: source "${source}" does not exist in sources/`);
            }
          }

          if (!confidence) result.errors.push(`${prefix}: confidence is required`);
          else if (!ALLOWED_OCCUPATION_CONFIDENCE.includes(confidence)) {
            result.errors.push(`${prefix}: confidence "${confidence}" must be high, moderate, or low`);
          }
        });
      }
    }

    // Check wikilinks in body (Father/Mother/Spouse rows) point to existing files
    // Handles both [[path]] and [[path\|alias]] (Obsidian escaped pipe) formats
    const wikilinkPattern = /\[\[([^\]|\\]+?)(?:[\\|][^\]]*?)?\]\]/g;
    let match;
    while ((match = wikilinkPattern.exec(raw)) !== null) {
      const linkPath = match[1];
      if (linkPath.startsWith('people/') || linkPath.startsWith('sources/')) {
        const targetPath = resolve(ROOT, linkPath);
        if (!existsSync(targetPath)) {
          result.errors.push(
            `people/${file}: broken wikilink [[${linkPath}]] — target file does not exist`
          );
        }
      }
    }

    // Validate media refs per METHODOLOGY.md — format must be "subfolder/filename.ext"
    // and every ref must exist in _Media_Index.md (checked in cross-reference pass below).
    if (Array.isArray(fm.media)) {
      const fileRefs: string[] = [];
      for (const ref of fm.media) {
        if (typeof ref !== 'string') continue;
        const formatError = checkMediaRefFormat(ref, `people/${file}`);
        if (formatError) {
          result.errors.push(formatError);
        } else {
          fileRefs.push(ref); // only track correctly-formatted refs for existence check
        }
      }
      if (fileRefs.length > 0) personMediaRefs.set(file, fileRefs);
    }

    // Check Vital Information field names match recognized patterns
    const vitalTable = parseVitalTable(content);
    for (const [field] of vitalTable) {
      if (!isRecognizedVitalField(field)) {
        result.errors.push(
          `people/${file}: non-standard Vital Information field "${field}" — site build will not parse this. Use a recognized field name (see METHODOLOGY.md).`
        );
      }
    }

    const burialValue = vitalTable.find(([f]) => f === 'Burial')?.[1] || '';
    const burialPlotValue = vitalTable.find(([f]) => f === 'Burial Plot')?.[1] || '';
    if (burialValue && /\b(section|sec\.?|lot|plot|grave|gravesite|block|row)\b/i.test(burialValue)) {
      result.warnings.push(
        `people/${file}: Burial appears to include plot/section/lot details — keep cemetery name in Burial and move plot details to Burial Plot or Burial Notes`
      );
    }
    if (burialPlotValue && /\b(cemetery|memorial park|mausoleum|churchyard|graveyard)\b/i.test(burialPlotValue)) {
      result.warnings.push(
        `people/${file}: Burial Plot appears to include a cemetery name — keep cemetery name in Burial and plot/section/lot only in Burial Plot`
      );
    }

    const hasMilitaryVital = vitalTable.some(([f, v]) => f === 'Military' && v && !v.trim().startsWith('—'));
    const hasStructuredMilitary = Array.isArray(fm.military_service) && fm.military_service.length > 0;
    if (hasMilitaryVital && !hasStructuredMilitary) {
      result.warnings.push(
        `people/${file}: Military vital row is not mirrored in structured military_service frontmatter — branch/conflict stats and GEDCOM export will be less precise`
      );
    }

    const hasOccupationVital = vitalTable.some(([f, v]) => f === 'Occupation' && v && !v.trim().startsWith('—'));
    const hasStructuredOccupations = Array.isArray(fm.occupations) && fm.occupations.length > 0;
    if (hasOccupationVital && !hasStructuredOccupations) {
      result.warnings.push(
        `people/${file}: Occupation vital row is not mirrored in structured occupations frontmatter — occupation category stats and GEDCOM export will be less precise`
      );
    }

    // Check that children are tagged by marriage when multiple spouses exist
    const spouseFields = vitalTable.filter(([f]) => f === 'Spouse' || /^Spouse \(/.test(f));
    const childFields = vitalTable.filter(([f]) => f === 'Children' || /^Children \(/.test(f));
    if (spouseFields.length > 1) {
      const unqualifiedChildren = childFields.filter(([f]) => f === 'Children');
      if (unqualifiedChildren.length > 0) {
        result.warnings.push(
          `people/${file}: has ${spouseFields.length} spouses but uses plain "Children" — use "Children (1st marriage)" / "Children (2nd marriage)" so the site can group children under the correct spouse`
        );
      }
    }

    // Check that children and spouse entries have wikilinks or GEDCOM IDs
    for (const [field, value] of vitalTable) {
      if (!value || value.trim().startsWith('—')) continue;
      const isChildrenField = field === 'Children' || /^Children \(/.test(field);
      const isSpouseField = field === 'Spouse' || /^Spouse \(/.test(field);
      if (isChildrenField) {
        const names = splitByComma(value);
        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed || trimmed === '—' || /^\+?\s*\d+\s+unknown\b/i.test(trimmed)) continue;
          if (/^\d+\s+children\b/i.test(trimmed)) continue;
          if (!trimmed.includes('[[') && !/\(I\d+/.test(trimmed)) {
            const cleanName = trimmed.replace(/^\d+\.\s*/, '').replace(/\s*\([^)]*\)/g, '').trim();
            result.warnings.push(
              `people/${file}: child "${cleanName}" has no wikilink or GEDCOM ID — will not link on site`
            );
          }
        }
      }
      if (isSpouseField) {
        const trimmed = value.trim();
        if (!trimmed.includes('[[') && !/\(I\d+/.test(trimmed)) {
          const spouseName = trimmed.replace(/,\s*m\..*$/, '').replace(/\s*\([^)]*\)/g, '').trim();
          if (!spouseName || /^(unknown|none)$/i.test(spouseName)) continue;
          result.warnings.push(
            `people/${file}: spouse "${spouseName}" has no wikilink or GEDCOM ID — will not link on site`
          );
        }
      }
    }

    // Validate frontmatter relationship IDs exist in the vault
    if (fm.father) {
      if (!GEDCOM_ID_PATTERN.test(String(fm.father))) {
        result.errors.push(`people/${file}: father "${fm.father}" is not a valid GEDCOM ID (expected I{N})`);
      } else if (!allGedcomIds.has(String(fm.father))) {
        result.errors.push(`people/${file}: father "${fm.father}" does not exist in the vault`);
      }
    }
    if (fm.mother) {
      if (!GEDCOM_ID_PATTERN.test(String(fm.mother))) {
        result.errors.push(`people/${file}: mother "${fm.mother}" is not a valid GEDCOM ID (expected I{N})`);
      } else if (!allGedcomIds.has(String(fm.mother))) {
        result.errors.push(`people/${file}: mother "${fm.mother}" does not exist in the vault`);
      }
    }
    for (const sp of (fm.spouses || []) as Array<{ id?: string; married?: unknown }>) {
      if (sp.id) {
        if (!GEDCOM_ID_PATTERN.test(String(sp.id))) {
          result.errors.push(`people/${file}: spouse id "${sp.id}" is not a valid GEDCOM ID`);
        } else if (!allGedcomIds.has(String(sp.id))) {
          result.errors.push(`people/${file}: spouse "${sp.id}" does not exist in the vault`);
        }
      }
      // Check that married date is a string — unquoted integers (e.g. married: 1774) are parsed
      // as numbers by the YAML parser, which crashes the site at runtime.
      if (sp.married != null && typeof sp.married !== 'string') {
        result.errors.push(
          `people/${file}: spouse "married" is a ${typeof sp.married} (value: ${sp.married}) — must be a quoted string. ` +
          `Fix: married: "${sp.married}"`
        );
      }
    }
    for (const child of (fm.children || []) as Array<string | { id?: string }>) {
      const childId = typeof child === 'string' ? child : child.id;
      if (childId) {
        if (!GEDCOM_ID_PATTERN.test(String(childId))) {
          result.errors.push(`people/${file}: child id "${childId}" is not a valid GEDCOM ID`);
        } else if (!allGedcomIds.has(String(childId))) {
          result.errors.push(`people/${file}: child "${childId}" does not exist in the vault`);
        }
      }
    }

    // Check that married women have a Married Name vital field
    if (fm.gender === 'F' && !fm.privacy && fm.confidence !== 'stub') {
      const spouseCount = Array.isArray(fm.spouses) ? fm.spouses.length : 0;
      if (spouseCount > 0) {
        const hasMarriedName = vitalTable.some(([f, v]) => f === 'Married Name' && v && v.trim() !== '—');
        if (!hasMarriedName) {
          result.errors.push(
            `people/${file}: married female missing "Married Name" in Vital Information table — required for GEDCOM export and search`
          );
        }
      }
    }

    // Collect relationship data for bidirectional cross-referencing (ID-based)
    const childIds = (fm.children || [] as Array<string | { id?: string }>)
      .map((c: string | { id?: string }) => typeof c === 'string' ? c : (c.id || ''))
      .filter(Boolean);
    const spouseIds = (fm.spouses || [] as Array<{ id?: string }>)
      .map((s: { id?: string }) => s.id || '')
      .filter(Boolean);

    relationships.push({
      filePath: file,
      name: fm.name || '',
      gedcomId: fm.gedcom_id ? String(fm.gedcom_id) : '',
      fatherId: fm.father ? String(fm.father) : '',
      motherId: fm.mother ? String(fm.mother) : '',
      childIds,
      spouseIds,
    });

    scopeRelationships.push({
      filePath: file,
      name: fm.name || '',
      id: fm.gedcom_id ? String(fm.gedcom_id) : '',
      father: fm.father ? String(fm.father) : '',
      mother: fm.mother ? String(fm.mother) : '',
      children: childIds,
      spouses: spouseIds,
      publicScope: typeof fm.public_scope === 'string' ? fm.public_scope : undefined,
    });

    const baseSlug = slugify(String(fm.name || ''));
    const bornYear = String(fm.born || '').match(/\d{4}/)?.[0] || '';
    personSlugEntries.push({
      baseSlug,
      finalSlug: baseSlug,
      file,
      id: fm.gedcom_id ? String(fm.gedcom_id) : '',
      born: bornYear,
    });

    if (fm.gedcom_id) {
      personFactsById.set(String(fm.gedcom_id), {
        file,
        name: String(fm.name || ''),
        gender: String(fm.gender || ''),
        family: String(fm.family || ''),
        born: typeof fm.born === 'string' ? fm.born : '',
        died: typeof fm.died === 'string' ? fm.died : '',
        burial: burialValue,
        father: fm.father ? String(fm.father) : '',
        mother: fm.mother ? String(fm.mother) : '',
        spouses: (fm.spouses || []) as Array<{ id?: string; married?: unknown }>,
        notesText: content,
      });
    }
  }

  const baseCounts = new Map<string, number>();
  for (const entry of personSlugEntries) {
    if (!entry.baseSlug) continue;
    baseCounts.set(entry.baseSlug, (baseCounts.get(entry.baseSlug) ?? 0) + 1);
  }
  const usedFinalSlugs = new Map<string, string>();
  for (const entry of personSlugEntries) {
    if (!entry.baseSlug) continue;
    const duplicateBase = (baseCounts.get(entry.baseSlug) ?? 0) > 1;
    let finalSlug = duplicateBase
      ? `${entry.baseSlug}-${entry.born || entry.id.toLowerCase()}`
      : entry.baseSlug;
    if (!finalSlug) finalSlug = entry.id ? `person-${entry.id.toLowerCase()}` : '';
    while (usedFinalSlugs.has(finalSlug) && entry.id) {
      finalSlug = `${finalSlug}-${entry.id.toLowerCase()}`;
    }
    entry.finalSlug = finalSlug;
    const existing = usedFinalSlugs.get(finalSlug);
    if (existing) {
      result.errors.push(`people/${entry.file}: generated route slug "${finalSlug}" collides with ${existing} — person pages may route to the wrong person`);
    } else {
      usedFinalSlugs.set(finalSlug, `people/${entry.file}`);
    }
  }

  return { result, checked, personSourceRefs, personSourcesById, gedcomIds, relationships, scopeRelationships, personMediaRefs, personFactsById };
}

interface MediaEntryInfo {
  localPath: string;
  person: string;
  type: string;
  line: number;
}

interface PersonFactInfo {
  file: string;
  name: string;
  gender: string;
  family: string;
  born: string;
  died: string;
  burial: string;
  father: string;
  mother: string;
  spouses: Array<{ id?: string; married?: unknown }>;
  notesText: string;
}

interface MediaIndexEntryInfo {
  localPath: string;
  person: string;
  description: string;
  line: number;
  pathKind: ReturnType<typeof mediaKindFromPath>;
  descriptionKind: ReturnType<typeof mediaKindFromDescription>;
}

function validateMediaIndex(): { result: ValidationResult; entryCount: number; newsAndDocEntries: MediaEntryInfo[]; indexPaths: Set<string>; mediaInfoByPath: Map<string, MediaIndexEntryInfo> } {
  const result: ValidationResult = { errors: [], warnings: [] };
  const newsAndDocEntries: MediaEntryInfo[] = [];
  const indexPaths = new Set<string>();
  const mediaInfoByPath = new Map<string, MediaIndexEntryInfo>();

  if (!existsSync(MEDIA_INDEX)) {
    result.warnings.push('_Media_Index.md does not exist — skipping media validation');
    return { result, entryCount: 0, newsAndDocEntries, indexPaths, mediaInfoByPath };
  }

  const content = readFileSync(MEDIA_INDEX, 'utf-8');
  const lines = content.split('\n');
  const localPaths = new Set<string>();
  let entryCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      !line.startsWith('|') ||
      line.startsWith('|---') ||
      line.startsWith('|-') ||
      line.startsWith('| Local Path') ||
      line.startsWith('| File') ||
      line.startsWith('| FaG') ||
      line.startsWith('| Category') ||
      line.startsWith('| Persons')
    )
      continue;

    const parts = line
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;

    // Skip header-like rows and section separator rows
    if (parts[0] === '' || parts[0] === '—') continue;
    // Skip stats/summary rows
    if (parts[0].startsWith('**') || parts[0].startsWith('Gravestones') ||
        parts[0].startsWith('Portraits') || parts[0].startsWith('Documents') ||
        parts[0].startsWith('Newspapers') || parts[0].startsWith('Group') ||
        parts[0].startsWith('Scans') || parts[0].startsWith('Total')) continue;
    // Skip memorial tracking rows (FaG #NNN format)
    if (/^\d+$/.test(parts[0])) continue;

    entryCount++;

    // Check all 5 columns are filled
    if (parts.length < 5) {
      result.errors.push(
        `_Media_Index.md line ${i + 1}: expected 5 columns, found ${parts.length}`
      );
      continue;
    }

    for (let col = 0; col < 5; col++) {
      if (!parts[col] || parts[col].trim() === '') {
        result.errors.push(
          `_Media_Index.md line ${i + 1}: column ${col + 1} is empty`
        );
      }
    }

    // Check source URL starts with https://
    const sourceUrl = parts[2];
    if (sourceUrl && sourceUrl !== 'local' && sourceUrl !== '—' && !sourceUrl.startsWith('https://')) {
      result.warnings.push(
        `_Media_Index.md line ${i + 1}: source URL does not start with https://`
      );
    }

    // Check no duplicate local paths
    const localPath = parts[0];
    if (localPaths.has(localPath)) {
      result.errors.push(`_Media_Index.md: duplicate local path "${localPath}"`);
    } else {
      localPaths.add(localPath);
      indexPaths.add(localPath);
    }

    if (!existsSync(resolve(MEDIA_DIR, localPath))) {
      result.errors.push(`_Media_Index.md line ${i + 1}: local media file "${localPath}" does not exist`);
    }

    const description = parts[4];
    const pathKind = mediaKindFromPath(localPath);
    let descriptionKind = mediaKindFromDescription(description);
    if (pathKind === 'portrait' && /\b(portrait|person photo|profile image|studio)\b/i.test(description)) {
      descriptionKind = 'portrait';
    }
    if (pathKind === 'newspaper' && /\b(newspaper|obituary|clipping|press|gazette|post-crescent|northwestern)\b/i.test(description)) {
      descriptionKind = 'newspaper';
    }
    mediaInfoByPath.set(localPath, {
      localPath,
      person: parts[1],
      description,
      line: i + 1,
      pathKind,
      descriptionKind,
    });
    if (descriptionKind !== 'unknown' && pathKind !== 'unknown' && pathKind !== 'misc') {
      const compatible =
        pathKind === descriptionKind ||
        (pathKind === 'group' && (descriptionKind === 'group' || descriptionKind === 'portrait')) ||
        (pathKind === 'portrait' && descriptionKind === 'group');
      if (!compatible) {
        result.warnings.push(`_Media_Index.md line ${i + 1}: "${localPath}" is in ${pathKind} media but description looks like ${descriptionKind} media`);
      }
    }

    // Track NEWS and DOC entries for processing check
    if (localPath.startsWith('newspapers/')) {
      newsAndDocEntries.push({ localPath, person: parts[1], type: 'newspaper', line: i + 1 });
    } else if (localPath.startsWith('documents/')) {
      newsAndDocEntries.push({ localPath, person: parts[1], type: 'document', line: i + 1 });
    }
  }

  return { result, entryCount, newsAndDocEntries, indexPaths, mediaInfoByPath };
}


async function main() {
  const verbose = process.argv.includes('--verbose');
  const strictSourcePersonIds = process.argv.includes('--strict-source-person-ids');
  console.log('Validating vault...\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  // ── Source Files ──
  let srcChecked = 0;
  let sourceIds = new Map<string, string>();
  let sourceIdSet = new Set<string>();
  let claimedMedia = new Set<string>();
  let sourcePersons = new Map<string, string[]>();
  let sourcePersonIds = new Map<string, string[]>();
  let sourceSubjectPersonIds = new Map<string, string[]>();
  let sourceMediaRefs = new Map<string, string[]>();

  if (existsSync(SOURCES_DIR)) {
    const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR });
    const srcValidation = validateSourceFiles(sourceFiles);
    srcChecked = srcValidation.checked;
    sourceIds = srcValidation.sourceIds;
    sourceIdSet = srcValidation.sourceIdSet;
    claimedMedia = srcValidation.claimedMedia;
    sourcePersons = srcValidation.sourcePersons;
    sourcePersonIds = srcValidation.sourcePersonIds;
    sourceSubjectPersonIds = srcValidation.sourceSubjectPersonIds;
    sourceMediaRefs = srcValidation.sourceMediaRefs;

    const srcErrors = srcValidation.result.errors.length;
    const srcWarnings = srcValidation.result.warnings.length;
    totalErrors += srcErrors;
    totalWarnings += srcWarnings;

    console.log(`Source Files: ${srcChecked} checked`);
    if (srcErrors === 0 && srcWarnings === 0) {
      console.log(`  \u2713 All valid`);
    }
    if (srcErrors > 0) {
      console.log(`  \u2717 ${srcErrors} errors:`);
      for (const e of srcValidation.result.errors) {
        console.log(`    ${e}`);
      }
    }
    if (srcWarnings > 0) {
      if (verbose) {
        console.log(`  ! ${srcWarnings} warnings:`);
        for (const w of srcValidation.result.warnings) {
          console.log(`    ${w}`);
        }
      } else {
        console.log(`  ! ${srcWarnings} warnings (run with --verbose to see)`);
      }
    }
  } else {
    console.log('Source Files: sources/ directory not found — skipping');
  }

  // ── Person Files ──
  let relationships: PersonRelationships[] = [];
  let scopeRelationships: ScopeRelationship[] = [];
  let personSourceRefs = new Set<string>();
  let personSourcesById = new Map<string, Set<string>>();
  let personMediaRefs = new Map<string, string[]>();
  let personFactsById = new Map<string, PersonFactInfo>();
  const allGedcomIds = new Set<string>();

  if (existsSync(PEOPLE_DIR)) {
    const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR });

    // Pre-pass: collect all GEDCOM IDs so relationship validation can check references
    for (const file of personFiles) {
      const { data: fm } = matter(readFileSync(resolve(PEOPLE_DIR, file), 'utf-8'));
      if (fm.type === 'person' && fm.gedcom_id) allGedcomIds.add(String(fm.gedcom_id));
    }

    const pplValidation = validatePersonFiles(personFiles, sourceIdSet, allGedcomIds);
    relationships = pplValidation.relationships;
    scopeRelationships = pplValidation.scopeRelationships;
    personSourceRefs = pplValidation.personSourceRefs;
    personSourcesById = pplValidation.personSourcesById;
    personMediaRefs = pplValidation.personMediaRefs;
    personFactsById = pplValidation.personFactsById;

    const pplErrors = pplValidation.result.errors.length;
    const pplWarnings = pplValidation.result.warnings.length;
    totalErrors += pplErrors;
    totalWarnings += pplWarnings;

    console.log(`\nPerson Files: ${pplValidation.checked} checked`);
    if (pplErrors === 0 && pplWarnings === 0) {
      console.log(`  \u2713 All valid`);
    }
    if (pplErrors > 0) {
      console.log(`  \u2717 ${pplErrors} errors:`);
      for (const e of pplValidation.result.errors) {
        console.log(`    ${e}`);
      }
    }
    if (pplWarnings > 0) {
      if (verbose) {
        console.log(`  ! ${pplWarnings} warnings:`);
        for (const w of pplValidation.result.warnings) {
          console.log(`    ${w}`);
        }
      } else {
        console.log(`  ! ${pplWarnings} warnings (run with --verbose to see)`);
      }
    }
  } else {
    console.log('\nPerson Files: people/ directory not found — skipping');
  }

  // ── Media Index ──
  const { result: mediaResult, entryCount: mediaEntries, newsAndDocEntries, indexPaths, mediaInfoByPath } = validateMediaIndex();
  const mediaErrors = mediaResult.errors.length;
  const mediaWarnings = mediaResult.warnings.length;
  totalErrors += mediaErrors;
  totalWarnings += mediaWarnings;

  console.log(`\nMedia Index: ${mediaEntries} entries`);
  if (mediaErrors === 0 && mediaWarnings === 0) {
    console.log(`  \u2713 All valid`);
  }
  if (mediaErrors > 0) {
    console.log(`  \u2717 ${mediaErrors} errors:`);
    for (const e of mediaResult.errors) {
      console.log(`    ${e}`);
    }
  }
  if (mediaWarnings > 0) {
    if (verbose) {
      console.log(`  ! ${mediaWarnings} warnings:`);
      for (const w of mediaResult.warnings) {
        console.log(`    ${w}`);
      }
    } else {
      console.log(`  ! ${mediaWarnings} warnings (run with --verbose to see)`);
    }
  }

  // ── Unprocessed Media ──
  const unprocessedResult = checkUnprocessedMedia(newsAndDocEntries, claimedMedia);
  const unprocessedErrors = unprocessedResult.errors.length;
  totalErrors += unprocessedErrors;

  console.log(`\nUnprocessed Media: ${newsAndDocEntries.length} newspaper/document images`);
  if (unprocessedErrors === 0) {
    console.log(`  \u2713 All newspaper clippings and documents are linked to source files via media: frontmatter`);
  } else {
    console.log(`  \u2717 ${unprocessedErrors} unprocessed:`);
    for (const e of unprocessedResult.errors) {
      console.log(`    ${e}`);
    }
  }

  // ── Media Linkage Check ──
  // Per METHODOLOGY.md, an image appears on the site only if it has THREE entries:
  //   1. source file media: array
  //   2. person file media: array
  //   3. _Media_Index.md
  // Check all three directions: refs in person/source files must be in the index,
  // and every index entry must be claimed by at least one source file and one person file.
  {
    // Build reverse maps: index path → which source/person files claim it
    const indexClaimedBySources = new Map<string, string[]>();
    const indexClaimedByPeople = new Map<string, string[]>();

    for (const [file, refs] of sourceMediaRefs) {
      for (const ref of refs) indexClaimedBySources.set(ref, [...(indexClaimedBySources.get(ref) ?? []), `sources/${file}`]);
    }
    for (const [file, refs] of personMediaRefs) {
      for (const ref of refs) indexClaimedByPeople.set(ref, [...(indexClaimedByPeople.get(ref) ?? []), `people/${file}`]);
    }

    const mediaLinkErrors: string[] = [];
    const mediaLinkWarnings: string[] = [];

    // 1. Every correctly-formatted source media ref must exist in _Media_Index.md
    for (const [file, refs] of sourceMediaRefs) {
      for (const ref of refs) {
        if (!indexPaths.has(ref)) {
          mediaLinkErrors.push(`sources/${file}: media ref "${ref}" not found in _Media_Index.md — image will not appear on site`);
        }
      }
    }

    // 2. Every correctly-formatted person media ref must exist in _Media_Index.md
    for (const [file, refs] of personMediaRefs) {
      for (const ref of refs) {
        if (!indexPaths.has(ref)) {
          mediaLinkErrors.push(`people/${file}: media ref "${ref}" not found in _Media_Index.md — image will not appear on site`);
        }
      }
    }

    // 3. Every _Media_Index.md entry must be claimed by at least one source file
    //    (per Source Acquisition Protocol: every downloaded image must have a source file)
    for (const indexPath of indexPaths) {
      if (!indexClaimedBySources.has(indexPath)) {
        mediaLinkErrors.push(`_Media_Index.md: "${indexPath}" is not referenced in any source file media: array — add it to the source it came from`);
      }
    }

    // 4. Every _Media_Index.md entry must be claimed by at least one person file
    //    (per Linking rules: image needs person file ref to render on the person's page)
    for (const indexPath of indexPaths) {
      if (!indexClaimedByPeople.has(indexPath)) {
        mediaLinkWarnings.push(`_Media_Index.md: "${indexPath}" is not referenced in any person file media: array — image is registered but will not appear on any person's page`);
      }
    }

    // 5. The first person media item drives the person header image. If a portrait
    // exists later in the list, warn when the hero would be a document/stone.
    for (const [file, refs] of personMediaRefs) {
      if (refs.length < 2) continue;
      const firstKind = mediaInfoByPath.get(refs[0])?.pathKind ?? mediaKindFromPath(refs[0]);
      const hasPortrait = refs.slice(1).some(ref => {
        const kind = mediaInfoByPath.get(ref)?.pathKind ?? mediaKindFromPath(ref);
        return kind === 'portrait' || kind === 'group';
      });
      if (hasPortrait && firstKind !== 'portrait' && firstKind !== 'group') {
        mediaLinkWarnings.push(`people/${file}: first media ref "${refs[0]}" is ${firstKind}, but a portrait/group image exists later — reorder media so the profile header uses the person photo`);
      }
    }

    totalErrors += mediaLinkErrors.length;
    totalWarnings += mediaLinkWarnings.length;

    console.log(`\nMedia Linkage: ${indexPaths.size} index entries, ${[...sourceMediaRefs.values()].flat().length} source refs, ${[...personMediaRefs.values()].flat().length} person refs`);
    if (mediaLinkErrors.length === 0 && mediaLinkWarnings.length === 0) {
      console.log(`  \u2713 All media refs resolve and every index entry is fully linked (source + person + index)`);
    }
    if (mediaLinkErrors.length > 0) {
      console.log(`  \u2717 ${mediaLinkErrors.length} broken links:`);
      for (const e of mediaLinkErrors) console.log(`    ${e}`);
    }
    if (mediaLinkWarnings.length > 0) {
      if (verbose) {
        console.log(`  ! ${mediaLinkWarnings.length} warnings:`);
        for (const w of mediaLinkWarnings) console.log(`    ${w}`);
      } else {
        console.log(`  ! ${mediaLinkWarnings.length} warnings (run with --verbose to see)`);
      }
    }
  }

  // ── Cross-references ──
  const xrefResult = crossReferenceCheck(sourceIds, personSourceRefs);
  const xrefErrors = xrefResult.errors.length;
  totalErrors += xrefErrors;

  console.log(`\nCross-references:`);
  if (xrefErrors === 0) {
    console.log(`  \u2713 All sources referenced by at least one person file`);
  } else {
    console.log(`  \u2717 ${xrefErrors} orphaned sources:`);
    for (const e of xrefResult.errors) {
      console.log(`    ${e}`);
    }
  }

  // ── Bidirectional Relationships ──
  const biResult = checkBidirectionalRelationships(relationships);
  const biErrors = biResult.errors.length;
  totalErrors += biErrors;

  console.log(`\nBidirectional Relationships: ${relationships.length} people checked`);
  if (biErrors === 0) {
    console.log(`  \u2713 All parent↔child and spouse↔spouse links are reciprocal`);
  } else {
    console.log(`  \u2717 ${biErrors} broken links:`);
    for (const e of biResult.errors) {
      console.log(`    ${e}`);
    }
  }

  // ── Public Scope ──
  {
    const scopeConfig = publicScopeConfig();
    if (scopeConfig.enabled) {
      const publicScopeErrors: string[] = [];
      const publicScopeWarnings: string[] = [];

      if (!scopeConfig.rootPersonId) {
        publicScopeErrors.push('site-config.json: publicScope.enabled is true but neither publicScope.rootPersonId nor rootPersonId is configured');
        console.log(`\nPublic Scope: configuration incomplete`);
      } else {
        const scope = calculatePublicScope(scopeRelationships, scopeConfig);
        console.log(`\nPublic Scope: ${scopeRelationships.length} people checked, ${scope.bloodIds.size} blood relatives, ${scope.allowedIds.size} publishable`);

        if (scope.bloodIds.size === 0) {
          publicScopeErrors.push(`site-config.json: public scope root "${scopeConfig.rootPersonId}" was not found in people/`);
        }
        for (const person of scope.outOfScope) {
          const msg = `people/${person.filePath} (${person.id} ${person.name}): outside public scope — not connected to ${scopeConfig.rootPersonId} by parent/child blood links or as a spouse of a blood relative`;
          if (scopeConfig.mode === 'error') publicScopeErrors.push(msg);
          else publicScopeWarnings.push(msg);
        }
      }

      totalErrors += publicScopeErrors.length;
      totalWarnings += publicScopeWarnings.length;

      if (publicScopeErrors.length === 0 && publicScopeWarnings.length === 0) {
        console.log(`  \u2713 All people are inside configured public scope`);
      }
      if (publicScopeErrors.length > 0) {
        console.log(`  \u2717 ${publicScopeErrors.length} errors:`);
        for (const e of publicScopeErrors) console.log(`    ${e}`);
      }
      if (publicScopeWarnings.length > 0) {
        if (verbose) {
          console.log(`  ! ${publicScopeWarnings.length} warnings:`);
          for (const w of publicScopeWarnings) console.log(`    ${w}`);
        } else {
          console.log(`  ! ${publicScopeWarnings.length} warnings (run with --verbose to see)`);
        }
      }
    }
  }

  // ── Source Person IDs ──
  // persons: is display/extracted text. person_ids: and subject_person_ids: are relational key lists.
  const sourcePersonIdErrors: string[] = [];
  const sourcePersonIdWarnings: string[] = [];
  let sourcePersonIdsChecked = 0;

  for (const [sourceFile, ids] of sourcePersonIds) {
    for (const id of ids) {
      sourcePersonIdsChecked++;
      if (!GEDCOM_ID_PATTERN.test(id)) {
        sourcePersonIdErrors.push(`${sourceFile}: person_ids entry "${id}" is not a valid GEDCOM ID`);
      } else if (!allGedcomIds.has(id)) {
        sourcePersonIdErrors.push(`${sourceFile}: person_ids entry "${id}" does not exist in the vault`);
      }
    }
  }

  for (const [sourceFile, ids] of sourceSubjectPersonIds) {
    for (const id of ids) {
      sourcePersonIdsChecked++;
      if (!GEDCOM_ID_PATTERN.test(id)) {
        sourcePersonIdErrors.push(`${sourceFile}: subject_person_ids entry "${id}" is not a valid GEDCOM ID`);
      } else if (!allGedcomIds.has(id)) {
        sourcePersonIdErrors.push(`${sourceFile}: subject_person_ids entry "${id}" does not exist in the vault`);
      }
    }
  }

  if (strictSourcePersonIds) {
    for (const [sourceFile, persons] of sourcePersons) {
      if (persons.length > 0 && !sourcePersonIds.has(sourceFile)) {
        sourcePersonIdErrors.push(`${sourceFile}: has persons: display names but no relational person_ids: list`);
      }
    }
  } else {
    for (const [sourceFile, persons] of sourcePersons) {
      if (persons.length > 0 && !sourcePersonIds.has(sourceFile)) {
        sourcePersonIdWarnings.push(`${sourceFile}: persons: is display text only; add person_ids: for relational source-to-person links`);
      }
    }
  }

  totalErrors += sourcePersonIdErrors.length;
  totalWarnings += sourcePersonIdWarnings.length;

  console.log(`\nSource Person IDs: ${sourcePersonIdsChecked} person_ids/subject_person_ids checked`);
  if (sourcePersonIdErrors.length === 0 && sourcePersonIdWarnings.length === 0) {
    console.log(`  \u2713 All source person_ids entries are valid`);
  }
  if (sourcePersonIdErrors.length > 0) {
    console.log(`  \u2717 ${sourcePersonIdErrors.length} errors:`);
    for (const e of sourcePersonIdErrors) {
      console.log(`    ${e}`);
    }
  }
  if (sourcePersonIdWarnings.length > 0) {
    if (verbose) {
      console.log(`  ! ${sourcePersonIdWarnings.length} warnings:`);
      for (const w of sourcePersonIdWarnings) {
        console.log(`    ${w}`);
      }
    } else {
      console.log(`  ! ${sourcePersonIdWarnings.length} warnings (run with --verbose to see)`);
    }
  }

  // ── Source/Person Reciprocity ──
  // If a source declares person_ids, each listed person should cite that source.
  // If a person cites a source that has person_ids, the person should be listed there.
  {
    const reciprocityWarnings: string[] = [];
    const sourceFileToId = new Map<string, string>();
    for (const [sourceId, sourceFile] of sourceIds) sourceFileToId.set(sourceFile, sourceId);

    for (const [sourceFile, ids] of sourcePersonIds) {
      const sourceId = sourceFileToId.get(sourceFile);
      if (!sourceId) continue;
      for (const personId of ids) {
        if (!allGedcomIds.has(personId)) continue;
        const personSources = personSourcesById.get(personId) ?? new Set<string>();
        if (!personSources.has(sourceId)) {
          const person = personFactsById.get(personId);
          reciprocityWarnings.push(`${sourceFile}: lists ${personId}${person ? ` (${person.name})` : ''} in person_ids, but that person file does not cite ${sourceId}`);
        }
      }
    }

    for (const [personId, citedSources] of personSourcesById) {
      const person = personFactsById.get(personId);
      for (const sourceId of citedSources) {
        const sourceFile = sourceIds.get(sourceId);
        if (!sourceFile) continue;
        const ids = sourcePersonIds.get(sourceFile);
        if (ids && !ids.includes(personId)) {
          reciprocityWarnings.push(`people/${person?.file ?? personId}: cites ${sourceId}, but ${sourceFile} does not include ${personId} in person_ids`);
        }
      }
    }

    totalWarnings += reciprocityWarnings.length;
    console.log(`\nSource/Person Reciprocity: ${sourcePersonIds.size} source person_id lists checked`);
    if (reciprocityWarnings.length === 0) {
      console.log(`  \u2713 All source person_ids and person source citations are reciprocal`);
    } else if (verbose) {
      console.log(`  ! ${reciprocityWarnings.length} warnings:`);
      for (const w of reciprocityWarnings) console.log(`    ${w}`);
    } else {
      console.log(`  ! ${reciprocityWarnings.length} warnings (run with --verbose to see)`);
    }
  }

  // ── Chronology Sanity ──
  {
    const chronologyWarnings: string[] = [];
    for (const [personId, person] of personFactsById) {
      const birthYear = firstYear(person.born);
      const deathYear = firstYear(person.died);
      const burialYear = firstYear(person.burial);

      if (birthYear && deathYear && deathYear < birthYear) {
        chronologyWarnings.push(`people/${person.file}: died year ${deathYear} is before born year ${birthYear}`);
      }
      if (deathYear && burialYear && burialYear < deathYear) {
        chronologyWarnings.push(`people/${person.file}: burial year ${burialYear} is before died year ${deathYear}`);
      }

      for (const parentId of [person.father, person.mother].filter(Boolean)) {
        const parent = personFactsById.get(parentId);
        if (!parent || !birthYear) continue;
        const parentBirthYear = firstYear(parent.born);
        if (!parentBirthYear) continue;
        const age = birthYear - parentBirthYear;
        if (age < 0) {
          chronologyWarnings.push(`people/${person.file}: born ${birthYear}, before parent ${parentId} (${parent.name}) born ${parentBirthYear}`);
        } else if (age < 12) {
          chronologyWarnings.push(`people/${person.file}: parent ${parentId} (${parent.name}) appears only ${age} at this child's birth`);
        } else if (parent.gender === 'F' && age > 60) {
          chronologyWarnings.push(`people/${person.file}: mother ${parentId} (${parent.name}) appears ${age} at this child's birth`);
        } else if (parent.gender === 'M' && age > 90) {
          chronologyWarnings.push(`people/${person.file}: father ${parentId} (${parent.name}) appears ${age} at this child's birth`);
        }
      }

      for (const spouse of person.spouses) {
        const marriedYear = firstYear(spouse.married);
        if (!marriedYear) continue;
        if (birthYear && marriedYear < birthYear) {
          chronologyWarnings.push(`people/${person.file}: marriage year ${marriedYear} is before birth year ${birthYear}`);
        }
        if (deathYear && marriedYear > deathYear) {
          chronologyWarnings.push(`people/${person.file}: marriage year ${marriedYear} is after death year ${deathYear}`);
        }
      }
    }

    totalWarnings += chronologyWarnings.length;
    console.log(`\nChronology Sanity: ${personFactsById.size} people checked`);
    if (chronologyWarnings.length === 0) {
      console.log(`  \u2713 No obvious date chronology issues found`);
    } else if (verbose) {
      console.log(`  ! ${chronologyWarnings.length} warnings:`);
      for (const w of chronologyWarnings) console.log(`    ${w}`);
    } else {
      console.log(`  ! ${chronologyWarnings.length} warnings (run with --verbose to see)`);
    }
  }

  // ── Duplicate Person Suspicion ──
  {
    const duplicateWarnings: string[] = [];
    const exactNameAndBirth = new Map<string, Array<[string, PersonFactInfo]>>();
    const exactParentsAndName = new Map<string, Array<[string, PersonFactInfo]>>();

    for (const [personId, person] of personFactsById) {
      const name = normalizeNameForComparison(person.name);
      if (!name) continue;
      const birthYear = firstYear(person.born);
      const deathYear = firstYear(person.died);
      if (birthYear) {
        const key = `${name}|b:${birthYear}|d:${deathYear ?? ''}`;
        exactNameAndBirth.set(key, [...(exactNameAndBirth.get(key) ?? []), [personId, person]]);
      }
      if (person.father || person.mother) {
        const key = `${name}|f:${person.father}|m:${person.mother}`;
        exactParentsAndName.set(key, [...(exactParentsAndName.get(key) ?? []), [personId, person]]);
      }
    }

    const seenGroups = new Set<string>();
    for (const groups of [exactNameAndBirth, exactParentsAndName]) {
      for (const [, matches] of groups) {
        if (matches.length < 2) continue;
        const groupKey = matches.map(([id]) => id).sort().join('|');
        if (seenGroups.has(groupKey)) continue;
        if (matches.some(([, p]) => documentsSameNameReuse(p.notesText))) continue;
        seenGroups.add(groupKey);
        duplicateWarnings.push(`Possible duplicate people: ${matches.map(([id, p]) => `${id} ${p.name} (${p.born || '?'}-${p.died || '?'}) in people/${p.file}`).join(' | ')}`);
      }
    }

    totalWarnings += duplicateWarnings.length;
    console.log(`\nDuplicate Person Suspicion: ${personFactsById.size} people checked`);
    if (duplicateWarnings.length === 0) {
      console.log(`  \u2713 No exact same-name/date or same-name/parents duplicate suspects found`);
    } else if (verbose) {
      console.log(`  ! ${duplicateWarnings.length} warnings:`);
      for (const w of duplicateWarnings) console.log(`    ${w}`);
    } else {
      console.log(`  ! ${duplicateWarnings.length} warnings (run with --verbose to see)`);
    }
  }

  // ── Summary ──
  console.log(`\nSummary: ${totalErrors} errors, ${totalWarnings} warnings`);

  if (totalErrors > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
