/**
 * Static obituary extractor.
 *
 * Fetches one obituary URL (or every URL from the portrait audit backlog) and
 * emits compact JSON. This intentionally avoids Playwright so it can be used as
 * a cheap first pass; callers can send only failures to a browser extractor.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/extract-obituary.ts --source obituaries/OBIT_Name.md
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/extract-obituary.ts --url https://...
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/extract-obituary.ts --all-missing --limit 10
 */

import { existsSync, readFileSync } from 'fs';
import { extname, resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');

const args = process.argv.slice(2);

interface ImageCandidate {
  url: string;
  kindGuess: 'portrait' | 'gravestone' | 'news' | 'document' | 'group' | 'unknown';
  confidence: 'high' | 'moderate' | 'low';
  alt?: string;
  caption?: string;
  sourceContext: string;
}

interface ExtractResult {
  sourceFile?: string;
  url: string;
  site: 'findagrave' | 'wichmann' | 'tukios' | 'legacy' | 'generic';
  title: string;
  decedent: string;
  obituaryText: string;
  images: ImageCandidate[];
  textSource: string;
  notes: string[];
}

interface SourceTarget {
  sourceFile?: string;
  url: string;
  title?: string;
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

function absoluteUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(match?.[2] || match?.[3] || match?.[4] || '');
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return '';
}

function titleFromHtml(html: string): string {
  return metaContent(html, 'og:title')
    || metaContent(html, 'twitter:title')
    || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');
}

function classifyImage(url: string, context: string, site: ExtractResult['site']): ImageCandidate['kindGuess'] {
  const lower = `${url} ${context}`.toLowerCase();
  if (lower.includes('gravestone') || lower.includes('headstone') || lower.includes('cemetery') || lower.includes('/cem_')) return 'gravestone';
  if (lower.includes('newspaper') || lower.includes('obituary clipping') || lower.includes('/news_')) return 'news';
  if (lower.includes('document') || lower.includes('certificate') || lower.includes('/doc_')) return 'document';
  if (lower.includes('group') || lower.includes('family plot') || lower.includes('/grp_')) return 'group';
  if (lower.includes('portrait') || lower.includes('profile') || lower.includes('decedent') || lower.includes('/por_')) return 'portrait';
  if (site === 'wichmann' || site === 'tukios' || site === 'legacy') return 'portrait';
  return 'unknown';
}

function imageConfidence(kindGuess: ImageCandidate['kindGuess'], context: string, site: ExtractResult['site']): ImageCandidate['confidence'] {
  const lower = context.toLowerCase();
  if (kindGuess === 'portrait' && (lower.includes('og:image') || lower.includes('profile') || lower.includes('hero'))) return 'high';
  if (kindGuess === 'portrait' && (site === 'wichmann' || site === 'tukios' || site === 'legacy')) return 'moderate';
  if (kindGuess === 'unknown') return 'low';
  return 'moderate';
}

function pushImage(images: ImageCandidate[], url: string | null, context: string, site: ExtractResult['site'], alt?: string, caption?: string): void {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) return;
  if (images.some((image) => image.url === url)) return;

  const ext = extname(new URL(url).pathname).toLowerCase();
  if (['.svg', '.ico'].includes(ext)) return;
  if (/logo|favicon|sprite|placeholder|default-image|social-share|flower[_-]|\/flowers\/|card-cta|tree-cta|sympathy card|memorial trees/i.test(`${url} ${alt || ''} ${caption || ''}`)) return;
  if (/cover for .* obituary/i.test(alt || '') && /\/05a9c72d-0dcb-45b7-baf9-eeb9fbe50c38\//i.test(url)) return;

  const kindGuess = classifyImage(url, `${context} ${alt || ''} ${caption || ''}`, site);
  images.push({
    url,
    kindGuess,
    confidence: imageConfidence(kindGuess, context, site),
    alt: alt || undefined,
    caption: caption || undefined,
    sourceContext: context,
  });
}

function extractImages(html: string, baseUrl: string, site: ExtractResult['site']): ImageCandidate[] {
  const images: ImageCandidate[] = [];
  pushImage(images, absoluteUrl(metaContent(html, 'og:image'), baseUrl), 'og:image', site);
  pushImage(images, absoluteUrl(metaContent(html, 'twitter:image'), baseUrl), 'twitter:image', site);

  const imgRegex = /<img\b[^>]*>/gi;
  for (const match of html.matchAll(imgRegex)) {
    const tag = match[0];
    const src = attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-lazy-src');
    const alt = attr(tag, 'alt') || attr(tag, 'aria-label');
    const className = attr(tag, 'class');
    pushImage(images, absoluteUrl(src, baseUrl), `img${className ? `.${className}` : ''}`, site, alt);
  }

  return images;
}

function siteFor(url: string): ExtractResult['site'] {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'findagrave.com') return 'findagrave';
  if (host === 'wichmannfuneralhomes.com') return 'wichmann';
  if (host.includes('legacy.com')) return 'legacy';
  if (['oconnellfh.com', 'clinehansonfuneralhome.com', 'valleyfh.com', 'muehlboettcher.com'].some((domain) => host.endsWith(domain))) return 'tukios';
  return 'generic';
}

function decedentFromTitle(title: string): string {
  return title
    .replace(/\s*\|\s*.*$/, '')
    .replace(/\s+Obituary.*$/i, '')
    .replace(/^Obituary of\s+/i, '')
    .replace(/^Obituary:\s*/i, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .trim();
}

function extractJsonLdText(html: string): string {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = decodeEntities(match[1] || '').trim();
    try {
      const parsed = JSON.parse(raw) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        const text = asString(obj.articleBody) || asString(obj.description);
        if (text.length > 120) return text.trim();
      }
    } catch {
      // Some sites emit invalid JSON-LD. Fall through to HTML extraction.
    }
  }
  return '';
}

function extractText(html: string, site: ExtractResult['site']): { text: string; source: string } {
  const jsonLd = extractJsonLdText(html);
  if (jsonLd) return { text: jsonLd, source: 'json-ld articleBody/description' };

  const selectors: Array<[string, RegExp]> = [
    ['article', /<article\b[^>]*>([\s\S]*?)<\/article>/i],
    ['obituary container', /<div\b[^>]+class=["'][^"']*(?:obituary|tribute|life-story|main-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i],
    ['main', /<main\b[^>]*>([\s\S]*?)<\/main>/i],
  ];
  for (const [label, pattern] of selectors) {
    const match = html.match(pattern);
    const text = match?.[1] ? stripTags(match[1]) : '';
    if (text.length > 120) return { text, source: label };
  }

  return { text: stripTags(html).slice(0, 12000), source: 'body fallback' };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'accept': 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 genealogy-obituary-extractor/1.0',
    },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function extract(target: SourceTarget): Promise<ExtractResult> {
  const html = await fetchHtml(target.url);
  const site = siteFor(target.url);
  const title = titleFromHtml(html) || target.title || '';
  const textResult = extractText(html, site);
  const images = extractImages(html, target.url, site);
  const notes: string[] = [];

  if (site === 'findagrave' && images.length === 0) {
    notes.push('static fetch found no FindAGrave images; use browser-context photo extractor fallback');
  }
  if (textResult.source === 'body fallback') notes.push('text came from broad body fallback; review before import');
  if (images.length === 0) notes.push('no image candidates found');

  return {
    sourceFile: target.sourceFile,
    url: target.url,
    site,
    title,
    decedent: decedentFromTitle(title || target.title || ''),
    obituaryText: textResult.text,
    images,
    textSource: textResult.source,
    notes,
  };
}

async function missingTargets(limit: number): Promise<SourceTarget[]> {
  const files = await glob('obituaries/*.md', { cwd: SOURCES_DIR });
  const targets: SourceTarget[] = [];

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(SOURCES_DIR, file), 'utf-8');
    const { data: fm } = matter(raw);
    if (fm.type !== 'source' || fm.source_type !== 'obituary') continue;
    const url = asString(fm.url);
    const media = asStringArray(fm.media);
    const hasSourcePortrait = media.some((item) => item.startsWith('portraits/') || item.includes('/POR_'));
    if (url && !hasSourcePortrait) {
      targets.push({ sourceFile: file, url, title: asString(fm.title) });
    }
  }

  return limit > 0 ? targets.slice(0, limit) : targets;
}

async function targetsFromArgs(): Promise<SourceTarget[]> {
  const url = argValue('--url');
  if (url) return [{ url }];

  const source = argValue('--source');
  if (source) {
    const sourcePath = resolve(SOURCES_DIR, source);
    if (!existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);
    const { data: fm } = matter(readFileSync(sourcePath, 'utf-8'));
    const sourceUrl = asString(fm.url);
    if (!sourceUrl) throw new Error(`Source has no url: ${source}`);
    return [{ sourceFile: source, url: sourceUrl, title: asString(fm.title) }];
  }

  if (args.includes('--all-missing')) {
    return missingTargets(Number(argValue('--limit') || '0'));
  }

  throw new Error('Specify --url, --source, or --all-missing');
}

async function main(): Promise<void> {
  const targets = await targetsFromArgs();
  const results: ExtractResult[] = [];
  for (const target of targets) {
    try {
      results.push(await extract(target));
    } catch (error) {
      results.push({
        sourceFile: target.sourceFile,
        url: target.url,
        site: siteFor(target.url),
        title: target.title || '',
        decedent: decedentFromTitle(target.title || ''),
        obituaryText: '',
        images: [],
        textSource: '',
        notes: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
