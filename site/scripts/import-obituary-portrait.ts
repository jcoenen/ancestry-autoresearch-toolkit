/**
 * Download and wire a reviewed obituary portrait into the vault.
 *
 * This script is deliberately conservative: it previews by default and only
 * writes files when --write is provided.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/import-obituary-portrait.ts \
 *     --source obituaries/OBIT_Coenen_Donald_2017.md \
 *     --image-url https://... \
 *     --write
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const SOURCES_DIR = resolve(ROOT, 'sources');
const PEOPLE_DIR = resolve(ROOT, 'people');
const PORTRAITS_DIR = resolve(ROOT, 'media', 'portraits');
const MEDIA_INDEX = resolve(ROOT, 'media', '_Media_Index.md');

const args = process.argv.slice(2);
const write = args.includes('--write');

interface PersonMatch {
  file: string;
  fullPath: string;
  name: string;
  media: string[];
}

function argValue(name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function compactNameForFilename(name: string, personFile: string): string {
  const fromFile = basename(personFile, '.md').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (fromFile) return fromFile;
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function sourceYear(value: unknown, sourceFile: string): string {
  const fromValue = value instanceof Date
    ? String(value.getUTCFullYear())
    : asString(value).match(/\d{4}/)?.[0];
  return fromValue || sourceFile.match(/_(\d{4})\.md$/)?.[1] || 'Undated';
}

function decedentFromSourceTitle(title: string): string {
  return title
    .replace(/^Obituary of\s+/i, '')
    .replace(/^Obituary\s*[—:-]\s*/i, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s+Obituary.*$/i, '')
    .trim();
}

function extensionFor(contentType: string, imageUrl: string): string {
  const lowerType = contentType.toLowerCase();
  if (lowerType.includes('png')) return 'png';
  if (lowerType.includes('webp')) return 'webp';
  if (lowerType.includes('gif')) return 'gif';
  const pathExt = new URL(imageUrl).pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (pathExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(pathExt)) return pathExt;
  return 'jpg';
}

function addFrontmatterMedia(raw: string, mediaPath: string): string {
  if (!raw.startsWith('---\n')) throw new Error('File does not have YAML frontmatter');
  const end = raw.indexOf('\n---', 4);
  if (end < 0) throw new Error('File does not have closing YAML frontmatter');
  const frontmatter = raw.slice(0, end);
  const body = raw.slice(end);
  const mediaLine = `  - ${yamlQuote(mediaPath)}`;

  if (frontmatter.includes(mediaLine)) return raw;

  const mediaArrayMatch = frontmatter.match(/^media:\s*\[\]\s*$/m);
  if (mediaArrayMatch?.index !== undefined) {
    const lineEnd = frontmatter.indexOf('\n', mediaArrayMatch.index);
    const endOfLine = lineEnd >= 0 ? lineEnd : frontmatter.length;
    return `${frontmatter.slice(0, mediaArrayMatch.index)}media:\n${mediaLine}${frontmatter.slice(endOfLine)}${body}`;
  }

  const mediaBlockMatch = frontmatter.match(/^media:\s*$/m);
  if (mediaBlockMatch?.index !== undefined) {
    const afterMedia = frontmatter.indexOf('\n', mediaBlockMatch.index) + 1;
    let insertAt = frontmatter.length;
    const rest = frontmatter.slice(afterMedia);
    const nextTopLevel = rest.match(/\n[a-zA-Z_][a-zA-Z0-9_-]*:/);
    if (nextTopLevel?.index !== undefined) insertAt = afterMedia + nextTopLevel.index + 1;
    return `${frontmatter.slice(0, insertAt)}${mediaLine}\n${frontmatter.slice(insertAt)}${body}`;
  }

  const insertBefore = frontmatter.match(/^(created|tags|families|reliability):/m);
  if (insertBefore?.index !== undefined) {
    const pos = insertBefore.index;
    return `${frontmatter.slice(0, pos)}media:\n${mediaLine}\n${frontmatter.slice(pos)}${body}`;
  }

  return `${frontmatter}\nmedia:\n${mediaLine}${body}`;
}

async function findPerson(sourceId: string, preferredName: string): Promise<PersonMatch | null> {
  const files = await glob('**/*.md', { cwd: PEOPLE_DIR });
  const matches: PersonMatch[] = [];

  for (const file of files) {
    const fullPath = resolve(PEOPLE_DIR, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data: fm } = matter(raw);
    if (fm.type !== 'person') continue;
    const sources = asStringArray(fm.sources);
    if (!sources.includes(sourceId)) continue;
    matches.push({
      file,
      fullPath,
      name: asString(fm.name),
      media: asStringArray(fm.media),
    });
  }

  const normalizedPreferred = preferredName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return matches.find((person) => person.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalizedPreferred)
    || matches[0]
    || null;
}

async function downloadImage(imageUrl: string, referer?: string): Promise<{ bytes: Uint8Array; extension: string; contentType: string }> {
  const headers: Record<string, string> = { 'user-agent': 'Mozilla/5.0 genealogy-obituary-importer/1.0' };
  if (referer) headers.referer = referer;

  const response = await fetch(imageUrl, {
    headers,
  });
  if (!response.ok) throw new Error(`Image download failed ${response.status} ${response.statusText}: ${imageUrl}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`URL did not return an image content-type: ${contentType || '(none)'}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    extension: extensionFor(contentType, imageUrl),
    contentType,
  };
}

function appendMediaIndexRow(raw: string, row: string): string {
  if (raw.includes(row)) return raw;
  const nextSection = raw.indexOf('\n## Documents (Certificates, Records)');
  if (nextSection < 0) return `${raw.trimEnd()}\n${row}\n`;
  return `${raw.slice(0, nextSection).trimEnd()}\n${row}\n${raw.slice(nextSection)}`;
}

async function main(): Promise<void> {
  const source = argValue('--source');
  const imageUrl = argValue('--image-url');
  const descriptionArg = argValue('--description');
  const referer = argValue('--referer');

  if (!source || !imageUrl) {
    throw new Error('Specify --source and --image-url');
  }

  const sourcePath = resolve(SOURCES_DIR, source);
  if (!existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);

  const sourceRaw = readFileSync(sourcePath, 'utf-8');
  const { data: sourceFm } = matter(sourceRaw);
  const sourceId = asString(sourceFm.source_id);
  const people = asStringArray(sourceFm.persons);
  const preferredName = decedentFromSourceTitle(asString(sourceFm.title)) || people[0] || '';
  const person = await findPerson(sourceId, preferredName);
  if (!person) throw new Error(`Could not find a person file referencing ${sourceId}`);

  const year = sourceYear(sourceFm.date_of_document, source);
  const filename = `POR_${compactNameForFilename(person.name, person.file)}_Obit${year}`;
  const downloaded = await downloadImage(imageUrl, referer);
  const localPath = `portraits/${filename}.${downloaded.extension}`;
  const fullImagePath = resolve(PORTRAITS_DIR, basename(localPath));
  const description = descriptionArg || `Portrait photo from obituary source ${sourceId}`;
  const today = new Date().toISOString().slice(0, 10);
  const indexRow = `| ${localPath} | ${person.name} | ${imageUrl} | ${today} | ${description} |`;

  const sourceUpdated = addFrontmatterMedia(sourceRaw, localPath);
  const personRaw = readFileSync(person.fullPath, 'utf-8');
  const personUpdated = addFrontmatterMedia(personRaw, localPath);
  const mediaIndexRaw = readFileSync(MEDIA_INDEX, 'utf-8');
  const mediaIndexUpdated = appendMediaIndexRow(mediaIndexRaw, indexRow);

  console.log(`Source: ${source}`);
  console.log(`Person: ${person.file} (${person.name})`);
  console.log(`Image:  ${localPath} (${downloaded.contentType}, ${downloaded.bytes.byteLength} bytes)`);
  console.log(`Index:  ${indexRow}`);

  if (!write) {
    console.log('\nPreview only. Re-run with --write to download and update vault files.');
    return;
  }

  mkdirSync(PORTRAITS_DIR, { recursive: true });
  if (existsSync(fullImagePath)) throw new Error(`Refusing to overwrite existing file: ${fullImagePath}`);
  writeFileSync(fullImagePath, downloaded.bytes);
  writeFileSync(sourcePath, sourceUpdated);
  writeFileSync(person.fullPath, personUpdated);
  writeFileSync(MEDIA_INDEX, mediaIndexUpdated);
  console.log('\nWrote portrait and updated source, person, and media index.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
