/**
 * Translation management tool for the genealogy vault.
 *
 * Scans source files for non-English `language:` fields, reports which ones
 * are missing translations, and optionally creates translation stubs in
 * `media/documents/`.
 *
 * Usage:
 *   npx tsx scripts/manage-translations.ts              # report only
 *   npx tsx scripts/manage-translations.ts --create     # create stubs
 *   npx tsx scripts/manage-translations.ts --dry-run    # show what would be created
 *   npx tsx scripts/manage-translations.ts --link       # also update source YAML with translation_slug
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const TRANSLATIONS_DIR = resolve(ROOT, 'media', 'documents');

const args = process.argv.slice(2);
const createStubs = args.includes('--create');
const dryRun = args.includes('--dry-run');
const linkSources = args.includes('--link');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceInfo {
  file: string;
  sourceId: string;
  title: string;
  language: string;
  translationSlug: string;
  sourceType: string;
}

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Convert a source ID + language into a translation filename */
export function translationFilename(sourceId: string, language: string): string {
  const base = sourceId.replace(/[^a-zA-Z0-9-]/g, '_');
  const lang = language.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return `${base}_${lang}_to_ENGLISH.md`;
}

/** Convert a filename to its slug (matching build-data.ts convention) */
export function filenameToSlug(filename: string): string {
  return filename.replace('.md', '').toLowerCase().replace(/_/g, '-');
}

/** Check if a language value indicates non-English */
export function isNonEnglish(language: string | undefined): boolean {
  if (!language) return false;
  const lower = language.trim().toLowerCase();
  return lower !== '' && lower !== 'english' && lower !== 'en';
}

/** Generate the translation stub markdown content */
export function generateTranslationStub(source: SourceInfo): string {
  return `# English Translation — ${source.title}

**Original source:** ${source.sourceId}
**Original language:** ${source.language}
**Translation status:** Pending

---

## Translation

[Paste or write the full English translation here. Preserve paragraph breaks and any formatting from the original.]

## Translation Notes

- Translator:
- Date translated:
- Confidence: [high / moderate / low]
- Notes: [Any context about difficult passages, uncertain words, or cultural references]
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Scanning sources in: ${SOURCES_DIR}`);

  if (!existsSync(SOURCES_DIR)) {
    console.log('No sources directory found.');
    return;
  }

  // Find all source files
  const sourceFiles = await glob('**/*.md', { cwd: SOURCES_DIR });
  const sources: SourceInfo[] = [];

  for (const file of sourceFiles) {
    if (file.startsWith('_')) continue;
    const fullPath = resolve(SOURCES_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm } = matter(raw);

    if (fm.type !== 'source') continue;

    sources.push({
      file,
      sourceId: fm.source_id || '',
      title: fm.title || file,
      language: fm.language || '',
      translationSlug: fm.translation_slug || '',
      sourceType: fm.source_type || '',
    });
  }

  console.log(`Found ${sources.length} source files\n`);

  // Categorize
  const nonEnglish = sources.filter(s => isNonEnglish(s.language));
  const translated = nonEnglish.filter(s => s.translationSlug);
  const untranslated = nonEnglish.filter(s => !s.translationSlug);
  const noLanguage = sources.filter(s => !s.language);

  // Report
  console.log('=== Translation Coverage ===\n');
  console.log(`  Total sources:           ${sources.length}`);
  console.log(`  No language set:         ${noLanguage.length}`);
  console.log(`  Non-English sources:     ${nonEnglish.length}`);
  console.log(`  Already translated:      ${translated.length}`);
  console.log(`  Needing translation:     ${untranslated.length}`);
  console.log('');

  if (nonEnglish.length > 0) {
    // Group by language
    const byLang = new Map<string, SourceInfo[]>();
    for (const s of nonEnglish) {
      const lang = s.language;
      const list = byLang.get(lang) || [];
      list.push(s);
      byLang.set(lang, list);
    }

    for (const [lang, items] of byLang) {
      const done = items.filter(s => s.translationSlug).length;
      console.log(`  ${lang}: ${done}/${items.length} translated`);
    }
    console.log('');
  }

  if (untranslated.length === 0) {
    console.log('All non-English sources have translations. Nothing to do.');
    return;
  }

  // List untranslated
  console.log('=== Untranslated Sources ===\n');
  for (const s of untranslated) {
    console.log(`  [${s.language}] ${s.sourceId} — ${s.title}`);
  }
  console.log('');

  // Create stubs if requested
  if (createStubs || dryRun) {
    mkdirSync(TRANSLATIONS_DIR, { recursive: true });

    let created = 0;
    let linked = 0;

    for (const s of untranslated) {
      const filename = translationFilename(s.sourceId, s.language);
      const filePath = resolve(TRANSLATIONS_DIR, filename);
      const slug = filenameToSlug(filename);

      if (existsSync(filePath)) {
        console.log(`  SKIP (exists): ${filename}`);
        // Still link if it exists but source doesn't have the slug
        if ((linkSources || createStubs) && !dryRun) {
          linkSourceFile(s, slug);
          linked++;
        }
        continue;
      }

      if (dryRun) {
        console.log(`  WOULD CREATE: ${filename}`);
        if (linkSources) {
          console.log(`  WOULD LINK:   ${s.sourceId} → ${slug}`);
        }
      } else {
        const content = generateTranslationStub(s);
        writeFileSync(filePath, content, 'utf-8');
        console.log(`  CREATED: ${filename}`);
        created++;

        if (linkSources) {
          linkSourceFile(s, slug);
          linked++;
        }
      }
    }

    console.log(`\n${dryRun ? 'Would create' : 'Created'}: ${dryRun ? untranslated.length : created} translation stubs`);
    if (linkSources) {
      console.log(`${dryRun ? 'Would link' : 'Linked'}: ${dryRun ? untranslated.length : linked} source files`);
    }
  } else {
    console.log('Run with --create to generate translation stub files.');
    console.log('Run with --create --link to also update source YAML with translation_slug.');
    console.log('Run with --dry-run to preview changes.');
  }
}

/** Update a source file's YAML frontmatter to add translation_slug */
function linkSourceFile(source: SourceInfo, slug: string) {
  const fullPath = resolve(SOURCES_DIR, source.file);
  const raw = readFileSync(fullPath, 'utf-8');
  const { data: fm, content } = matter(raw);

  if (fm.translation_slug) return; // already linked

  fm.translation_slug = slug;
  const updated = matter.stringify(content, fm);
  writeFileSync(fullPath, updated, 'utf-8');
  console.log(`  LINKED: ${source.sourceId} → ${slug}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
