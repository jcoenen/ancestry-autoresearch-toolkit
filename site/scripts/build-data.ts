import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { resolve, relative, dirname, join } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
  formatDate,
  slugify,
  parseVitalTable,
  extractBiography,
  inferMediaType,
  extractSection,
  extractFullText,
  applyPrivacyRedaction,
  redactCrossSpouseMarriageDates,
} from './lib/build-helpers.js';
import { calculatePublicScope } from './lib/public-scope.js';

// VAULT_ROOT env var points to the vault directory (e.g. Coenen_Genealogy/).
// Falls back to ../../ for backward compatibility when site/ is inside the vault.
const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const PEOPLE_DIR = resolve(ROOT, 'people');
const MEDIA_INDEX = resolve(ROOT, 'media', '_Media_Index.md');
const SOURCE_INDEX = resolve(ROOT, 'sources', '_Source_Index.md');
const REPORT_FILE = resolve(ROOT, 'Ancestry_Report.md');
const IMMIGRATION_FILE = resolve(ROOT, 'Immigration_Stories.md');
const OUTPUT = resolve(import.meta.dirname, '..', 'src', 'data', 'site-data.json');

// Load site config from vault root
const CONFIG_FILE = resolve(ROOT, 'site-config.json');
let siteConfig: Record<string, unknown> = {};
if (existsSync(CONFIG_FILE)) {
  siteConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  console.log(`Site config: ${CONFIG_FILE}`);
} else {
  console.warn('WARNING: site-config.json not found in vault root — using defaults');
}

interface PersonData {
  id: string;
  name: string;
  gender: string;
  born: string;
  died: string;
  family: string;
  privacy: boolean;
  confidence: string;
  sources: string[];
  media: MediaEntry[];
  filePath: string;
  slug: string;
  father: string;
  fatherName: string;
  mother: string;
  motherName: string;
  spouses: { name: string; id: string; marriageDate: string; link: string }[];
  children: { name: string; id: string; link: string; spouseIndex?: number }[];
  biography: string;
  birthDateAnalysis: string;
  birthplace: string;
  deathPlace: string;
  burial: string;
  religion: string;
  occupation: string;
  military: string;
  immigration: string;
  emigration: string;
  naturalization: string;
  causeOfDeath: string;
  confirmation: string;
  baptized: string;
  christened: string;
  nickname: string;
  marriedName: string[];
  alsoKnownAs: string[];
  education: string;
  residence: string;
  familySearchId: string;
  divorce: string;
  cremation: string;
  created: string;
  _mediaRefs: string[];
  _publicScope?: string;
}

interface MediaEntry {
  path: string;
  person: string;
  sourceUrl: string;
  dateDownloaded: string;
  description: string;
  type: string;
}

interface SourceEntry {
  id: string;
  file: string;
  person: string;
  personIds: string[];
  subjectPersonIds: string[];
  date: string;
  publisher: string;
  type: string;
  recordTypes: string[];
  title: string;
  reliability: string;
  fagNumber: string;
  record: string;
  year: string;
  slug: string;
  fullText: string;
  url: string;
  persons: string[];
  families: string[];
  extractedFacts: string;
  notes: string;
  translationSlug: string;
  ocrVerified: boolean | null;
  language: string;
  media: MediaEntry[];
  created: string;
  _mediaRefs: string[];
}

function textIncludesAny(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

function normalizeSourceType(fm: Record<string, unknown>, file: string, content: string): string {
  const rawType = String(fm.source_type || '').trim();
  const title = String(fm.title || '');
  const publisher = String(fm.publisher || '');
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String).join(' ') : String(fm.tags || '');
  const metadata = `${file} ${rawType} ${title} ${publisher} ${tags}`.toLowerCase();
  const documentTypeText = `${metadata} ${content.slice(0, 500)}`.toLowerCase();

  if (rawType === 'cemetery_memorial') return 'cemetery';
  if (rawType === 'family_knowledge') return 'note';
  if (rawType === 'church_record') {
    if (textIncludesAny(metadata, ['marriage', 'huwelijk', 'trouwen', 'marr_', ' married'])) return 'marriage_certificate';
    if (textIncludesAny(metadata, ['baptism', 'baptized', 'christening', 'christened', 'doop', 'dåp', 'døpt'])) return 'baptism';
    if (textIncludesAny(metadata, ['death', 'overlijden', 'burial', 'buried', 'begraaf'])) return 'death_certificate';
    if (textIncludesAny(metadata, ['birth', 'geboorte', 'born'])) return 'birth_certificate';
    return 'church';
  }
  if (rawType === 'certificate') {
    if (textIncludesAny(metadata, ['marriage', 'huwelijk', 'huwelijksakte', 'trouwen', ' married'])) return 'marriage_certificate';
    if (textIncludesAny(metadata, ['death', 'deathcert', 'deathreg', 'overlijden', 'overlijdensakte', 'ssdi'])) return 'death_certificate';
    if (textIncludesAny(metadata, ['birth', 'geboorte', 'numident'])) return 'birth_certificate';
    if (textIncludesAny(documentTypeText, ['bs huwelijksakte'])) return 'marriage_certificate';
    if (textIncludesAny(documentTypeText, ['bs overlijdensakte'])) return 'death_certificate';
    if (textIncludesAny(documentTypeText, ['bs geboorteakte'])) return 'birth_certificate';
  }

  return rawType;
}

function inferSourceRecordTypes(fm: Record<string, unknown>, file: string, content: string): string[] {
  const primary = normalizeSourceType(fm, file, content);
  const rawType = String(fm.source_type || '').trim();
  const title = String(fm.title || '');
  const publisher = String(fm.publisher || '');
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String).join(' ') : String(fm.tags || '');
  const haystack = `${file} ${rawType} ${title} ${publisher} ${tags} ${content}`.toLowerCase();
  const types = new Set<string>(primary ? [primary] : []);

  if (rawType === 'cemetery_memorial') types.add('cemetery');
  if (rawType === 'family_knowledge') types.add('note');
  if (rawType === 'certificate') return [...types];
  if (rawType === 'church_record') {
    if (textIncludesAny(haystack, ['baptism', 'baptized', 'christening', 'christened', 'doop', 'dåp', 'døpt'])) types.add('baptism');
    if (textIncludesAny(haystack, ['birth', 'geboorte', 'birth date', 'birthplace', 'born'])) types.add('birth_certificate');
    if (textIncludesAny(haystack, ['death', 'death date', 'death place', 'deathcert', 'deathreg', 'overlijden', 'overlijdensakte', 'burial', 'buried'])) types.add('death_certificate');
    if (textIncludesAny(haystack, ['marriage', 'huwelijk', 'huwelijksakte', 'trouwen', 'married'])) types.add('marriage_certificate');
  }

  return [...types];
}

function splitVitalList(val: string | undefined): string[] {
  if (!val || val.trim() === '—') return []
  return val.split(',').map(s => s.trim()).filter(Boolean)
}

function isBlankVitalValue(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return trimmed === '' || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'unknown';
}

function inferPlaceFromDatedVital(val: string | undefined): string {
  if (isBlankVitalValue(val)) return '';
  const text = val!.trim();
  const datePlace = text.match(
    /^(?:c\.?|ca\.?|abt\.?|about|~)?\s*(?:\d{4}|(?:\d{1,2}\s+)?[A-Za-z]+\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})(?:\s*\([^)]*\))?\s*,\s*(.+)$/i,
  );
  return datePlace ? datePlace[1].trim() : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function publicScopeConfig(): {
  enabled: boolean;
  rootPersonId: string;
  includeSpousesOfBloodRelatives: boolean;
  allowPersonIds: string[];
  excludeOutOfScopeFromSite: boolean;
} {
  const cfg = (siteConfig.publicScope ?? {}) as Record<string, unknown>;
  const enabled = cfg.enabled === true;
  return {
    enabled,
    rootPersonId: String(cfg.rootPersonId || siteConfig.rootPersonId || ''),
    includeSpousesOfBloodRelatives: cfg.includeSpousesOfBloodRelatives !== false,
    allowPersonIds: asStringArray(cfg.allowPersonIds),
    excludeOutOfScopeFromSite: cfg.excludeOutOfScopeFromSite !== false,
  };
}

const SOURCES_DIR = resolve(ROOT, 'sources');
const GEOCODE_CACHE = resolve(ROOT, 'geocode-cache.json');

/* ── Geocoding (cache read-only at build time) ───────────────── */
// Run `npm run geocode` to populate the cache. Build never hits the network.

function geocodeLocations(
  people: PersonData[],
): Record<string, [number, number] | null> {
  // Load existing cache
  let cache: Record<string, [number, number] | null> = {};
  try {
    cache = JSON.parse(readFileSync(GEOCODE_CACHE, 'utf-8'));
  } catch {
    // no cache yet — map will be empty until `npm run geocode` is run
  }

  // Collect all unique location strings from person records
  const locations = new Set<string>();
  for (const p of people) {
    if (p.birthplace) locations.add(p.birthplace);
    if (p.deathPlace) locations.add(p.deathPlace);
    if (p.burial) locations.add(p.burial);
    if (p.residence) locations.add(p.residence);
    if (p.immigration) locations.add(p.immigration);
    if (p.emigration) locations.add(p.emigration);
  }

  const cached = Array.from(locations).filter(loc => loc in cache).length;
  const uncached = locations.size - cached;
  if (uncached > 0) {
    console.log(`\nGeocoding: ${cached}/${locations.size} locations cached (run \`npm run geocode\` to fill ${uncached} missing)`);
  } else {
    console.log(`\nGeocoding: all ${locations.size} locations cached`);
  }

  // Return only the locations that were requested (not the full cache which may have stale entries)
  const result: Record<string, [number, number] | null> = {};
  for (const loc of locations) {
    result[loc] = cache[loc] ?? null;
  }
  return result;
}

function parseMediaIndex(): MediaEntry[] {
  if (!existsSync(MEDIA_INDEX)) return [];
  const content = readFileSync(MEDIA_INDEX, 'utf-8');
  const entries: MediaEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Local Path') || line.startsWith('| File')) continue;
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 5 && parts[0] && parts[0] !== '—' && parts[0] !== '') {
      entries.push({
        path: parts[0],
        person: parts[1],
        sourceUrl: parts[2],
        dateDownloaded: parts[3],
        description: parts[4],
        type: inferMediaType(parts[0]),
      });
    }
  }

  return entries;
}

async function parseSourceFiles(): Promise<SourceEntry[]> {
  if (!existsSync(SOURCES_DIR)) return [];
  const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR });
  const entries: SourceEntry[] = [];

  for (const file of sourceFiles) {
    if (file.startsWith('_')) continue; // skip index files
    const fullPath = resolve(SOURCES_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm, content } = matter(raw);

    if (fm.type !== 'source') {
      console.warn(`WARNING: Skipping ${file} — type is "${fm.type}", expected "source"`);
      continue;
    }
    if (!fm.source_id) {
      console.warn(`WARNING: Skipping ${file} — missing source_id`);
      continue;
    }

    const fullText = extractFullText(content);
    const extractedFacts = extractSection(content, 'Extracted Facts');
    const notes = extractSection(content, 'Notes');

    const normalizedType = normalizeSourceType(fm, file, content);

    entries.push({
      id: fm.source_id || '',
      file: file,
      person: fm.title || '',
      personIds: Array.isArray(fm.person_ids) ? fm.person_ids.map(String) : [],
      subjectPersonIds: Array.isArray(fm.subject_person_ids) ? fm.subject_person_ids.map(String) : [],
      date: fm.date_of_document ? String(fm.date_of_document) : '',
      publisher: fm.publisher || '',
      type: normalizedType,
      recordTypes: inferSourceRecordTypes(fm, file, content),
      title: fm.title || '',
      reliability: fm.reliability || '',
      fagNumber: fm.memorial_id ? String(fm.memorial_id) : '',
      record: '',
      year: '',
      slug: slugify(fm.source_id || file),
      fullText,
      url: fm.url || '',
      persons: fm.persons || [],
      families: Array.isArray(fm.families) ? fm.families.map(String) : [],
      extractedFacts,
      notes,
      translationSlug: fm.translation_slug || '',
      ocrVerified: fm.ocr_verified === true ? true : fm.ocr_verified === false ? false : null,
      language: fm.language || '',
      media: [],
      created: formatDate(fm.created),
      _mediaRefs: fm.media || [],
    });
  }

  return entries;
}

async function main() {
  console.log(`Building site data from vault: ${ROOT}`);

  // Find all person markdown files
  const personFiles = await glob('**/*.md', { cwd: PEOPLE_DIR });
  console.log(`Found ${personFiles.length} person files`);

  const people: PersonData[] = [];
  const familySet = new Set<string>();

  // First pass: build id → name map for resolving relationship display names
  const idToName = new Map<string, string>();
  for (const file of personFiles) {
    const fullPath = resolve(PEOPLE_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm } = matter(raw);
    if (fm.type !== 'person' || !fm.gedcom_id) continue;
    idToName.set(String(fm.gedcom_id), fm.name || '');
  }

  for (const file of personFiles) {
    const fullPath = resolve(PEOPLE_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm, content } = matter(raw);

    if (fm.type !== 'person') continue;

    const vitals = parseVitalTable(content);
    const biography = extractBiography(content);
    const birthDateAnalysis = extractSection(content, 'Birth Date Analysis');
    const birthplace = isBlankVitalValue(vitals['Birthplace'])
      ? inferPlaceFromDatedVital(vitals['Born'])
      : vitals['Birthplace'];
    const deathPlace = isBlankVitalValue(vitals['Death Place'])
      ? inferPlaceFromDatedVital(vitals['Died'])
      : vitals['Death Place'];

    // Read relationships from YAML frontmatter (structured, no parsing)
    const fatherId = fm.father ? String(fm.father) : '';
    const fatherName = idToName.get(fatherId) || '';
    const motherId = fm.mother ? String(fm.mother) : '';
    const motherName = idToName.get(motherId) || '';

    type SpouseFm = { id?: string; married?: string };
    type ChildFm = string | { id?: string; spouseIndex?: number };

    const spouses: { name: string; id: string; marriageDate: string; link: string }[] =
      ((fm.spouses || []) as SpouseFm[]).map(sp => ({
        id: sp.id ? String(sp.id) : '',
        name: sp.id ? (idToName.get(String(sp.id)) || '') : '',
        marriageDate: sp.married != null ? String(sp.married) : '',
        link: '',
      }));

    const children: { name: string; id: string; link: string; spouseIndex?: number }[] =
      ((fm.children || []) as ChildFm[]).map(child => {
        const id = typeof child === 'string' ? child : (child.id ? String(child.id) : '');
        const spouseIndex = typeof child === 'object' ? child.spouseIndex : undefined;
        return { id, name: idToName.get(id) || '', link: '', spouseIndex };
      });

    const isPrivate = fm.privacy === true;
    const family = fm.family || '';
    if (family) familySet.add(family);

    // Blank marriage dates for private people
    if (isPrivate) {
      for (const sp of spouses) {
        sp.marriageDate = '';
      }
    }

    const person: PersonData = {
      id: fm.gedcom_id || '',
      name: fm.name || '',
      gender: fm.gender || '',
      born: isPrivate ? '' : formatDate(fm.born),
      died: isPrivate ? '' : formatDate(fm.died),
      family,
      privacy: isPrivate,
      confidence: fm.confidence || 'unknown',
      sources: isPrivate ? [] : (fm.sources || []),
      media: [],  // resolved below from _mediaRefs
      _mediaRefs: isPrivate ? [] : (fm.media || []),  // raw YAML paths, resolved after media index is parsed
      filePath: file,
      slug: slugify(fm.name || ''),
      father: fatherId,
      fatherName: isPrivate ? '' : fatherName,
      mother: motherId,
      motherName: isPrivate ? '' : motherName,
      spouses,
      children,
      biography: isPrivate ? '' : biography,
      birthDateAnalysis: isPrivate ? '' : birthDateAnalysis,
      birthplace: isPrivate ? '' : birthplace,
      deathPlace: isPrivate ? '' : deathPlace,
      burial: isPrivate ? '' : (vitals['Burial'] || ''),
      religion: isPrivate ? '' : (vitals['Religion'] || ''),
      occupation: isPrivate ? '' : (vitals['Occupation'] || ''),
      military: isPrivate ? '' : (vitals['Military'] || ''),
      immigration: isPrivate ? '' : (vitals['Immigration'] || ''),
      emigration: isPrivate ? '' : (vitals['Emigration'] || ''),
      naturalization: isPrivate ? '' : (vitals['Naturalization'] || ''),
      causeOfDeath: isPrivate ? '' : (vitals['Cause of Death'] || ''),
      confirmation: isPrivate ? '' : (vitals['Confirmation'] || ''),
      baptized: isPrivate ? '' : (vitals['Baptized'] || ''),
      christened: isPrivate ? '' : (vitals['Christened'] || ''),
      nickname: vitals['Nickname'] || '',
      marriedName: splitVitalList(vitals['Married Name']),
      alsoKnownAs: splitVitalList(vitals['Also Known As']),
      education: isPrivate ? '' : (vitals['Education'] || ''),
      residence: isPrivate ? '' : (vitals['Residence'] || ''),
      familySearchId: isPrivate ? '' : (vitals['FamilySearch ID'] || ''),
      divorce: isPrivate ? '' : (vitals['Divorce'] || ''),
      cremation: isPrivate ? '' : (vitals['Cremation'] || ''),
      created: formatDate(fm.created),
      _publicScope: typeof fm.public_scope === 'string' ? fm.public_scope : undefined,
    };

    people.push(person);
  }

  const scopeConfig = publicScopeConfig();
  if (scopeConfig.enabled && scopeConfig.excludeOutOfScopeFromSite) {
    const scope = calculatePublicScope(
      people.map((p) => ({
        id: p.id,
        name: p.name,
        filePath: p.filePath,
        father: p.father,
        mother: p.mother,
        spouses: p.spouses.map((sp) => sp.id).filter(Boolean),
        children: p.children.map((child) => child.id).filter(Boolean),
        publicScope: p._publicScope,
      })),
      scopeConfig,
    );

    if (!scopeConfig.rootPersonId) {
      console.warn('WARNING: publicScope.enabled is true but no rootPersonId is configured; no public-scope filtering applied');
    } else {
      const before = people.length;
      const allowedIds = scope.allowedIds;
      for (let i = people.length - 1; i >= 0; i--) {
        if (!allowedIds.has(people[i].id)) people.splice(i, 1);
      }
      const publishedIds = new Set(people.map((p) => p.id));
      for (const person of people) {
        if (!publishedIds.has(person.father)) {
          person.father = '';
          person.fatherName = '';
        }
        if (!publishedIds.has(person.mother)) {
          person.mother = '';
          person.motherName = '';
        }
        person.spouses = person.spouses.filter((sp) => publishedIds.has(sp.id));
        person.children = person.children.filter((child) => publishedIds.has(child.id));
      }
      console.log(`Public scope: ${people.length}/${before} people publishable (${scope.bloodIds.size} blood relatives + spouses/exceptions)`);
    }
  }

  for (const person of people) {
    delete (person as Partial<PersonData>)._publicScope;
  }

  // Parse media
  const media = parseMediaIndex();
  console.log(`Found ${media.length} media entries`);

  // Build media lookup by local path for resolving person file media references
  const mediaByPath = new Map<string, MediaEntry>();
  for (const m of media) {
    mediaByPath.set(m.path, m);
  }

  // Assign media to each person from their explicit YAML media: list (no name matching)
  for (const person of people) {
    const refs = person._mediaRefs;
    person.media = refs
      .map(path => mediaByPath.get(path))
      .filter((m): m is MediaEntry => m !== undefined);
    if (refs.length > 0 && person.media.length === 0) {
      console.warn(`WARNING: ${person.name} has ${refs.length} media refs but none resolved: ${refs.join(', ')}`);
    }
    delete (person as Partial<PersonData>)._mediaRefs;
  }

  // Post-processing: blank marriage dates on non-private people married to private people
  redactCrossSpouseMarriageDates(people);

  // Parse sources from actual source files
  let sources = await parseSourceFiles();
  if (scopeConfig.enabled && scopeConfig.excludeOutOfScopeFromSite && scopeConfig.rootPersonId) {
    const publishedIds = new Set(people.map((p) => p.id));
    const before = sources.length;
    sources = sources.filter((source) => {
      const linkedIds = new Set([...source.personIds, ...source.subjectPersonIds]);
      return linkedIds.size === 0 || [...linkedIds].some((id) => publishedIds.has(id));
    });
    for (const source of sources) {
      source.personIds = source.personIds.filter((id) => publishedIds.has(id));
      source.subjectPersonIds = source.subjectPersonIds.filter((id) => publishedIds.has(id));
    }
    console.log(`Public scope: ${sources.length}/${before} sources publishable`);
  }
  console.log(`Found ${sources.length} source entries`);

  // Resolve source media refs the same way as person media
  for (const source of sources) {
    const refs = source._mediaRefs;
    source.media = refs
      .map(path => mediaByPath.get(path))
      .filter((m): m is MediaEntry => m !== undefined);
    delete (source as Partial<SourceEntry>)._mediaRefs;
  }

  // Filter global media to exclude items only associated with private people
  const publicMediaPaths = new Set<string>();
  const privateMediaPaths = new Set<string>();
  for (const person of people) {
    for (const m of person.media) {
      if (person.privacy) {
        privateMediaPaths.add(m.path);
      } else {
        publicMediaPaths.add(m.path);
      }
    }
  }
  for (const source of sources) {
    for (const m of source.media) {
      publicMediaPaths.add(m.path);
    }
  }
  const filteredMedia = scopeConfig.enabled && scopeConfig.excludeOutOfScopeFromSite
    ? media.filter(m => publicMediaPaths.has(m.path))
    : media.filter(m =>
      publicMediaPaths.has(m.path) || !privateMediaPaths.has(m.path)
    );

  // Calculate stats
  const publicPeople = people.filter(p => !p.privacy);
  familySet.clear();
  for (const person of people) {
    if (person.family) familySet.add(person.family);
  }

  const oldestWithApprox = publicPeople
    .filter(p => p.born)
    .sort((a, b) => {
      const aYear = a.born.replace(/[^0-9]/g, '').slice(0, 4);
      const bYear = b.born.replace(/[^0-9]/g, '').slice(0, 4);
      return Number(aYear || 9999) - Number(bYear || 9999);
    })[0];

  const generationsTraced = (siteConfig.generationsTraced as number) || 0;

  const stats = {
    totalPeople: people.length,
    totalSources: sources.length,
    totalMedia: filteredMedia.length,
    oldestAncestor: oldestWithApprox
      ? `${oldestWithApprox.name} (${oldestWithApprox.born})`
      : 'Unknown',
    generationsTraced,
    familyLines: Array.from(familySet).sort(),
  };

  // Read the ancestry report markdown
  let report = '';
  try {
    report = readFileSync(REPORT_FILE, 'utf-8');
    console.log(`Report: ${report.length} characters`);
  } catch {
    console.warn('WARNING: Ancestry_Report.md not found');
  }


  // Read the immigration stories markdown
  let immigrationStories = '';
  try {
    immigrationStories = readFileSync(IMMIGRATION_FILE, 'utf-8');
    console.log(`Immigration stories: ${immigrationStories.length} characters`);
  } catch {
    console.warn('WARNING: Immigration_Stories.md not found');
  }

  // Read translation documents (markdown files linked as media on source files)
  const translations: Record<string, string> = {};
  const TRANSLATIONS_DIR = resolve(ROOT, 'media', 'documents');
  try {
    const translationFiles = await glob('*_ENGLISH.md', { cwd: TRANSLATIONS_DIR });
    for (const tf of translationFiles) {
      const slug = tf.replace('.md', '').toLowerCase().replace(/_/g, '-');
      translations[slug] = readFileSync(resolve(TRANSLATIONS_DIR, tf), 'utf-8');
      console.log(`Translation: ${tf} (${translations[slug].length} chars)`);
    }
  } catch {
    // no translations found, that's fine
  }

  // Geocode locations for the map page
  const geocodedLocations = geocodeLocations(people);

  const output = { people, media: filteredMedia, sources, stats, report, translations, immigrationStories, config: siteConfig, geocodedLocations };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  const tmpFile = join(dirname(OUTPUT), '.site-data.json.tmp');
  writeFileSync(tmpFile, JSON.stringify(output, null, 2));
  renameSync(tmpFile, OUTPUT);

  console.log(`\nOutput: ${relative(process.cwd(), OUTPUT)}`);
  console.log(`People: ${stats.totalPeople}`);
  console.log(`Sources: ${stats.totalSources}`);
  console.log(`Media: ${stats.totalMedia}`);
  console.log(`Family lines: ${stats.familyLines.join(', ')}`);
  console.log(`Oldest ancestor: ${stats.oldestAncestor}`);
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
