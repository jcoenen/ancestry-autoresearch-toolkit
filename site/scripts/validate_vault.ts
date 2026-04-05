import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
  ALLOWED_SOURCE_TYPES,
  ALLOWED_CONFIDENCE,
  ALLOWED_RELIABILITY,
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

// VAULT_ROOT env var points to the vault directory (e.g. Coenen_Genealogy/).
// Falls back to ../../ for backward compatibility when site/ is inside the vault.
const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const MEDIA_INDEX = resolve(ROOT, 'media', '_Media_Index.md');

console.log(`Vault root: ${ROOT}`);

function validateSourceFiles(sourceFiles: string[]): {
  result: ValidationResult;
  checked: number;
  sourceIds: Map<string, string>;
  sourceIdSet: Set<string>;
  claimedMedia: Set<string>;
  sourcePersons: Map<string, string[]>;
} {
  const result: ValidationResult = { errors: [], warnings: [] };
  const sourceIds = new Map<string, string>(); // source_id -> file
  const sourceIdSet = new Set<string>();
  const claimedMedia = new Set<string>();
  const sourcePersons = new Map<string, string[]>(); // "sources/file" -> persons array
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

    // Collect media paths declared by this source file
    if (Array.isArray(fm.media)) {
      for (const p of fm.media) {
        if (typeof p === 'string') claimedMedia.add(p);
      }
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
          result.warnings.push(`sources/${file}: ${field} is null (acceptable for ${fm.source_type})`);
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

    // Check body sections for obituaries (Full Text required with actual content)
    if (fm.source_type === 'obituary') {
      if (!content.includes('## Full Text')) {
        result.errors.push(`sources/${file}: missing ## Full Text section`);
      } else {
        // Check that Full Text has actual blockquoted content, not just the heading
        const fullTextMatch = content.match(/## Full Text\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/);
        const fullTextBody = fullTextMatch ? fullTextMatch[1].trim() : '';
        const hasBlockquote = fullTextBody.split('\n').some(l => l.startsWith('>'));
        if (!hasBlockquote) {
          result.errors.push(`sources/${file}: ## Full Text section has no blockquoted text — obituary not transcribed`);
        }
      }
    }

    // Cemetery memorials use ## Memorial Data instead of ## Full Text
    if (fm.source_type === 'cemetery_memorial') {
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
      } else {
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

  return { result, checked, sourceIds, sourceIdSet, claimedMedia, sourcePersons };
}

// parseVitalTable is imported as parseVitalTableTuples from validate-helpers
const parseVitalTable = parseVitalTableTuples;

function validatePersonFiles(personFiles: string[], sourceIdSet: Set<string>, allGedcomIds: Set<string>): {
  result: ValidationResult;
  checked: number;
  personSourceRefs: Set<string>;
  gedcomIds: Map<string, string>;
  relationships: PersonRelationships[];
  personNames: Set<string>;
} {
  const result: ValidationResult = { errors: [], warnings: [] };
  const personSourceRefs = new Set<string>();
  const gedcomIds = new Map<string, string>(); // gedcom_id -> file
  const relationships: PersonRelationships[] = [];
  const personNames = new Set<string>(); // normalized names for persons array resolution
  let checked = 0;

  const REQUIRED_PERSON_FIELDS = [
    'type',
    'name',
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

    // Collect normalized name for persons array resolution
    if (fm.name) {
      personNames.add(String(fm.name).trim().toLowerCase());
    }

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
        personSourceRefs.add(srcId);
        if (!sourceIdSet.has(srcId)) {
          result.warnings.push(
            `people/${file}: references source "${srcId}" which does not exist in sources/`
          );
        }
      }

      // Error if zero sources (unless confidence is speculative)
      if (fm.sources.length === 0) {
        if (fm.confidence === 'speculative') {
          result.warnings.push(`people/${file}: 0 sources cited (speculative — acceptable)`);
        } else {
          result.errors.push(`people/${file}: 0 sources cited — add at least one source or set confidence: speculative`);
        }
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

    // Check Vital Information field names match recognized patterns
    const vitalTable = parseVitalTable(content);
    for (const [field] of vitalTable) {
      if (!isRecognizedVitalField(field)) {
        result.errors.push(
          `people/${file}: non-standard Vital Information field "${field}" — site build will not parse this. Use a recognized field name (see METHODOLOGY.md).`
        );
      }
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
      if (!value || value === '—') continue;
      const isChildrenField = field === 'Children' || /^Children \(/.test(field);
      const isSpouseField = field === 'Spouse' || /^Spouse \(/.test(field);
      if (isChildrenField) {
        const names = splitByComma(value);
        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed || trimmed === '—') continue;
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
  }

  return { result, checked, personSourceRefs, gedcomIds, relationships, personNames };
}

interface MediaEntryInfo {
  localPath: string;
  person: string;
  type: string;
  line: number;
}

function validateMediaIndex(): { result: ValidationResult; entryCount: number; newsAndDocEntries: MediaEntryInfo[] } {
  const result: ValidationResult = { errors: [], warnings: [] };
  const newsAndDocEntries: MediaEntryInfo[] = [];

  if (!existsSync(MEDIA_INDEX)) {
    result.warnings.push('_Media_Index.md does not exist — skipping media validation');
    return { result, entryCount: 0, newsAndDocEntries };
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
    if (sourceUrl && !sourceUrl.startsWith('https://')) {
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
    }

    // Track NEWS and DOC entries for processing check
    if (localPath.startsWith('newspapers/')) {
      newsAndDocEntries.push({ localPath, person: parts[1], type: 'newspaper', line: i + 1 });
    } else if (localPath.startsWith('documents/')) {
      newsAndDocEntries.push({ localPath, person: parts[1], type: 'document', line: i + 1 });
    }
  }

  return { result, entryCount, newsAndDocEntries };
}


async function main() {
  const verbose = process.argv.includes('--verbose');
  console.log('Validating vault...\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  // ── Source Files ──
  let srcChecked = 0;
  let sourceIds = new Map<string, string>();
  let sourceIdSet = new Set<string>();
  let claimedMedia = new Set<string>();
  let sourcePersons = new Map<string, string[]>();

  if (existsSync(SOURCES_DIR)) {
    const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR });
    const srcValidation = validateSourceFiles(sourceFiles);
    srcChecked = srcValidation.checked;
    sourceIds = srcValidation.sourceIds;
    sourceIdSet = srcValidation.sourceIdSet;
    claimedMedia = srcValidation.claimedMedia;
    sourcePersons = srcValidation.sourcePersons;

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
  let personSourceRefs = new Set<string>();
  let personNames = new Set<string>();

  if (existsSync(PEOPLE_DIR)) {
    const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR });

    // Pre-pass: collect all GEDCOM IDs so relationship validation can check references
    const allGedcomIds = new Set<string>();
    for (const file of personFiles) {
      const { data: fm } = matter(readFileSync(resolve(PEOPLE_DIR, file), 'utf-8'));
      if (fm.type === 'person' && fm.gedcom_id) allGedcomIds.add(String(fm.gedcom_id));
    }

    const pplValidation = validatePersonFiles(personFiles, sourceIdSet, allGedcomIds);
    relationships = pplValidation.relationships;
    personSourceRefs = pplValidation.personSourceRefs;
    personNames = pplValidation.personNames;

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
  const { result: mediaResult, entryCount: mediaEntries, newsAndDocEntries } = validateMediaIndex();
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

  // ── Persons Array Resolution ──
  // Check that every name in a source's persons: array has a matching person file.
  // Uses case-insensitive matching on the person file's name field.
  const personsChecked = new Set<string>();
  const unresolvedPersons: string[] = [];

  for (const [sourceFile, persons] of sourcePersons) {
    for (const personName of persons) {
      const normalized = personName.trim().toLowerCase();
      if (!normalized) continue;
      const key = `${sourceFile}:${normalized}`;
      if (personsChecked.has(key)) continue;
      personsChecked.add(key);

      if (!personNames.has(normalized)) {
        unresolvedPersons.push(`${sourceFile}: "${personName}" in persons array — no matching person file found`);
        totalWarnings++;
      }
    }
  }

  console.log(`\nPersons Array Resolution: ${personsChecked.size} name-source pairs checked`);
  if (unresolvedPersons.length === 0) {
    console.log(`  \u2713 All persons in source files have matching person files`);
  } else {
    if (verbose) {
      console.log(`  ! ${unresolvedPersons.length} unresolved:`);
      for (const w of unresolvedPersons) {
        console.log(`    ${w}`);
      }
    } else {
      console.log(`  ! ${unresolvedPersons.length} unresolved (run with --verbose to see)`);
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
