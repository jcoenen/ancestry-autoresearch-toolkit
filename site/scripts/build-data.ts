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
  education: string;
  residence: string;
  familySearchId: string;
  divorce: string;
  cremation: string;
  _mediaRefs: string[];
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
  date: string;
  publisher: string;
  type: string;
  title: string;
  reliability: string;
  fagNumber: string;
  record: string;
  year: string;
  slug: string;
  fullText: string;
  url: string;
  persons: string[];
  extractedFacts: string;
  notes: string;
  translationSlug: string;
  ocrVerified: boolean | null;
  language: string;
  media: MediaEntry[];
  _mediaRefs: string[];
}

const SOURCES_DIR = resolve(ROOT, 'sources');
const GEOCODE_CACHE = resolve(import.meta.dirname, '..', 'src', 'data', 'geocode-cache.json');

/* ── Geocoding via Nominatim ─────────────────────────────────── */

async function geocodeLocations(
  people: PersonData[],
): Promise<Record<string, [number, number] | null>> {
  // Load existing cache
  let cache: Record<string, [number, number] | null> = {};
  try {
    cache = JSON.parse(readFileSync(GEOCODE_CACHE, 'utf-8'));
  } catch {
    // no cache yet
  }

  // Collect all unique location strings
  const locations = new Set<string>();
  for (const p of people) {
    if (p.birthplace) locations.add(p.birthplace);
    if (p.deathPlace) locations.add(p.deathPlace);
    if (p.burial) locations.add(p.burial);
    if (p.residence) locations.add(p.residence);
    if (p.immigration) locations.add(p.immigration);
    if (p.emigration) locations.add(p.emigration);
    for (const sp of p.spouses) {
      if (!sp.marriageDate) continue;
      const yearMatch = sp.marriageDate.match(/(\d{4})/);
      if (yearMatch) {
        const afterYear = sp.marriageDate
          .slice(sp.marriageDate.indexOf(yearMatch[1]) + 4)
          .replace(/^[,\s]+/, '');
        if (afterYear) locations.add(afterYear);
      }
    }
  }

  // Find locations not yet cached
  const uncached = Array.from(locations).filter(loc => !(loc in cache));
  if (uncached.length > 0) {
    console.log(`\nGeocoding ${uncached.length} new locations (${locations.size} total)...`);
    for (const loc of uncached) {
      // Skip strings that are clearly not geocodable (partial dates, lone years, etc.)
      if (/^-?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(loc.trim())) {
        cache[loc] = null;
        continue;
      }
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ancestry-toolkit/1.0 (personal genealogy project)' },
        });
        if (!res.ok) {
          cache[loc] = null;
          console.warn(`  ${loc} -> HTTP ${res.status}`);
          await new Promise(r => setTimeout(r, 1100));
          continue;
        }
        const ct = res.headers.get('content-type') ?? '';
        if (!ct.includes('json')) {
          cache[loc] = null;
          console.warn(`  ${loc} -> non-JSON response (${ct})`);
          await new Promise(r => setTimeout(r, 1100));
          continue;
        }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          cache[loc] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          console.log(`  ${loc} -> [${cache[loc]![0].toFixed(4)}, ${cache[loc]![1].toFixed(4)}]`);
        } else {
          cache[loc] = null;
          console.warn(`  ${loc} -> NOT FOUND`);
        }
        // Rate limit: 1 request per second per Nominatim policy
        await new Promise(r => setTimeout(r, 1100));
      } catch (err) {
        cache[loc] = null;
        console.warn(`  ${loc} -> ERROR: ${err}`);
      }
    }

    // Write updated cache back
    writeFileSync(GEOCODE_CACHE, JSON.stringify(cache, null, 2));
    console.log(`Geocode cache updated: ${GEOCODE_CACHE}`);
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

    entries.push({
      id: fm.source_id || '',
      file: file,
      person: fm.title || '',
      date: fm.date_of_document ? String(fm.date_of_document) : '',
      publisher: fm.publisher || '',
      type: fm.source_type || '',
      title: fm.title || '',
      reliability: fm.reliability || '',
      fagNumber: fm.memorial_id ? String(fm.memorial_id) : '',
      record: '',
      year: '',
      slug: slugify(fm.source_id || file),
      fullText,
      url: fm.url || '',
      persons: fm.persons || [],
      extractedFacts,
      notes,
      translationSlug: fm.translation_slug || '',
      ocrVerified: fm.ocr_verified === true ? true : fm.ocr_verified === false ? false : null,
      language: fm.language || '',
      media: [],
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
        marriageDate: sp.married || '',
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
      birthplace: isPrivate ? '' : (vitals['Birthplace'] || ''),
      deathPlace: isPrivate ? '' : (vitals['Death Place'] || ''),
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
      nickname: isPrivate ? '' : (vitals['Nickname'] || vitals['Also Known As'] || ''),
      education: isPrivate ? '' : (vitals['Education'] || ''),
      residence: isPrivate ? '' : (vitals['Residence'] || ''),
      familySearchId: isPrivate ? '' : (vitals['FamilySearch ID'] || ''),
      divorce: isPrivate ? '' : (vitals['Divorce'] || ''),
      cremation: isPrivate ? '' : (vitals['Cremation'] || ''),
    };

    people.push(person);
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
  const sources = await parseSourceFiles();
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
  const filteredMedia = media.filter(m =>
    publicMediaPaths.has(m.path) || !privateMediaPaths.has(m.path)
  );

  // Calculate stats
  const publicPeople = people.filter(p => !p.privacy);

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
  const geocodedLocations = await geocodeLocations(people);

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
