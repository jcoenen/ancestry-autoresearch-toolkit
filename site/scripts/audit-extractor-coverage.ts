/**
 * Report-only audit for source extractor / browser mining coverage.
 *
 * It classifies source URLs by likely extractor family and looks for evidence
 * that the source was actually mined with the protocol: extractor notes,
 * checked-no-photo/portrait status, media links, or downloaded media refs.
 *
 * Usage:
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-extractor-coverage.ts
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-extractor-coverage.ts --json
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-extractor-coverage.ts --needs-review-only
 *   VAULT_ROOT=/path/to/vault npx tsx scripts/audit-extractor-coverage.ts --fail-on-issues
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');
const SOURCES_DIR = resolve(ROOT, 'sources');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const needsReviewOnly = args.includes('--needs-review-only');
const failOnIssues = args.includes('--fail-on-issues');

type ExtractorFamily =
  | 'findagrave'
  | 'familysearch'
  | 'cline_hanson'
  | 'legacy'
  | 'funeral_home'
  | 'newspaper'
  | 'external_image'
  | 'secondary_web'
  | 'none'
  | 'unknown';

type Status = 'covered' | 'partial' | 'needs_review' | 'not_required';

interface SourceCoverage {
  status: Status;
  file: string;
  id: string;
  title: string;
  sourceType: string;
  url: string;
  domain: string;
  extractorFamily: ExtractorFamily;
  evidence: string[];
  missing: string[];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function domainFor(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function extractorFamilyFor(url: string, sourceType: string, title: string): ExtractorFamily {
  const domain = domainFor(url);
  const haystack = `${domain} ${url} ${sourceType} ${title}`.toLowerCase();
  if (!url) return 'none';
  if (haystack.includes('findagrave.com')) return 'findagrave';
  if (haystack.includes('familysearch.org')) return 'familysearch';
  if (haystack.includes('clinehansonfuneralhome.com')) return 'cline_hanson';
  if (haystack.includes('legacy.com')) return 'legacy';
  if (/\bnewspapers?\.com\b|newspaperarchive|genealogybank|chroniclingamerica/.test(haystack)) return 'newspaper';
  if (/funeral|obituar|tributes|remembering|dignitymemorial|wiclarkcountyhistory|rhodescharapata|borchardtmoder/.test(haystack)) return 'funeral_home';
  if (/\.(jpg|jpeg|png|webp)(?:\?|$)/.test(url.toLowerCase())) return 'external_image';
  if (sourceType === 'secondary') return 'secondary_web';
  return 'unknown';
}

function needsExtractor(family: ExtractorFamily): boolean {
  return !['none', 'secondary_web', 'external_image'].includes(family);
}

function contentEvidence(content: string): string[] {
  const evidence: string[] = [];
  const checks: [RegExp, string][] = [
    [/browser extractor reviewed/i, 'browser extractor reviewed'],
    [/\bextractor\b/i, 'extractor mentioned'],
    [/photo tab/i, 'photo tab checked'],
    [/all (?:photo-tab )?images? (?:were )?(?:downloaded|checked|linked|indexed)/i, 'photos checked/downloaded'],
    [/portrait_status:\s*checked_no_portrait|checked_no_portrait/i, 'checked no portrait'],
    [/portrait_checked/i, 'portrait checked'],
    [/source images? (?:were )?(?:downloaded|checked|linked)/i, 'source images checked'],
    [/authenticated .*familysearch|familysearch credentials|retrieved .*familysearch/i, 'authenticated FamilySearch retrieval'],
  ];
  for (const [pattern, label] of checks) if (pattern.test(content)) evidence.push(label);
  return [...new Set(evidence)];
}

function mediaEvidence(media: string[]): string[] {
  const evidence: string[] = [];
  if (media.length > 0) evidence.push(`${media.length} source media ref${media.length === 1 ? '' : 's'}`);
  if (media.some(path => path.startsWith('portraits/'))) evidence.push('portrait media');
  if (media.some(path => path.startsWith('gravestones/'))) evidence.push('gravestone media');
  if (media.some(path => path.startsWith('documents/') || path.startsWith('newspapers/'))) evidence.push('document/newspaper media');
  if (media.some(path => path.startsWith('group/'))) evidence.push('group media');
  return evidence;
}

function expectedEvidence(family: ExtractorFamily, sourceType: string): string[] {
  if (family === 'findagrave') return ['photo tab checked or media refs', 'memorial text/source metadata captured'];
  if (family === 'familysearch') return ['authenticated/image retrieval note or document media ref'];
  if (family === 'cline_hanson') return ['obituary text captured', 'portrait checked or portrait media/status'];
  if (family === 'legacy' || family === 'funeral_home') return ['obituary text captured', 'portrait checked or portrait media/status'];
  if (family === 'newspaper') return ['newspaper clipping/OCR media or transcript'];
  if (sourceType === 'obituary') return ['obituary text captured', 'portrait checked or portrait media/status'];
  return [];
}

function hasTextCapture(content: string): boolean {
  return /## Full Text[\s\S]{80,}|## Extracted Facts[\s\S]{80,}/i.test(content);
}

async function audit(): Promise<SourceCoverage[]> {
  if (!existsSync(SOURCES_DIR)) throw new Error(`Sources directory not found: ${SOURCES_DIR}`);
  const files = await glob('**/*.md', { cwd: SOURCES_DIR, nodir: true, ignore: ['_Source_Index.md'] });
  const results: SourceCoverage[] = [];

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(SOURCES_DIR, file), 'utf-8');
    const { data: fm, content } = matter(raw);
    if (fm.type !== 'source') continue;

    const id = asString(fm.source_id);
    const title = asString(fm.title);
    const sourceType = asString(fm.source_type);
    const url = asString(fm.url);
    const media = asStringArray(fm.media);
    const extractorFamily = extractorFamilyFor(url, sourceType, title);
    const evidence = [...new Set([...contentEvidence(raw), ...mediaEvidence(media)])];
    if (hasTextCapture(content)) evidence.push('source text captured');

    const expected = expectedEvidence(extractorFamily, sourceType);
    const missing: string[] = [];
    if (needsExtractor(extractorFamily)) {
      if (extractorFamily === 'findagrave') {
        if (!evidence.some(item => /photo tab|media ref|photos checked|checked no portrait/.test(item))) missing.push('photo tab/media coverage evidence');
        if (!hasTextCapture(content)) missing.push('memorial text or extracted facts');
      } else if (extractorFamily === 'familysearch') {
        if (!evidence.some(item => /FamilySearch|document\/newspaper media|source media ref/.test(item))) missing.push('authenticated retrieval or document media evidence');
      } else if (['cline_hanson', 'legacy', 'funeral_home'].includes(extractorFamily)) {
        if (!hasTextCapture(content)) missing.push('obituary text');
        if (!evidence.some(item => /portrait|checked no portrait/.test(item))) missing.push('portrait checked/media status');
      } else if (extractorFamily === 'newspaper') {
        if (!evidence.some(item => /document\/newspaper media|source text captured/.test(item))) missing.push('newspaper media or OCR/transcript evidence');
      } else if (extractorFamily === 'unknown') {
        missing.push('unrecognized source domain; decide whether an extractor/check note is needed');
      } else if (expected.length > 0 && evidence.length === 0) {
        missing.push(...expected);
      }
    }

    const status: Status = !needsExtractor(extractorFamily)
      ? 'not_required'
      : missing.length === 0
        ? 'covered'
        : evidence.length > 0
          ? 'partial'
          : 'needs_review';

    results.push({
      status,
      file,
      id,
      title,
      sourceType,
      url,
      domain: domainFor(url),
      extractorFamily,
      evidence,
      missing,
    });
  }

  return results;
}

const results = await audit();
const report = needsReviewOnly ? results.filter(item => item.status === 'partial' || item.status === 'needs_review') : results;
const counts = results.reduce<Record<string, number>>((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  acc[`extractor:${item.extractorFamily}`] = (acc[`extractor:${item.extractorFamily}`] || 0) + 1;
  return acc;
}, {});

if (jsonOutput) {
  console.log(JSON.stringify({ vaultRoot: ROOT, sourcesChecked: results.length, counts, results }, null, 2));
} else {
  console.log('Extractor coverage audit');
  console.log(`Vault: ${ROOT}`);
  console.log(`Sources checked: ${results.length}`);
  console.log('');
  console.log('| Status | Count |');
  console.log('|---|---:|');
  for (const status of ['covered', 'partial', 'needs_review', 'not_required']) {
    console.log(`| ${status} | ${counts[status] || 0} |`);
  }
  console.log('');
  console.log('| Extractor family | Count |');
  console.log('|---|---:|');
  for (const [key, count] of Object.entries(counts).filter(([key]) => key.startsWith('extractor:')).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`| ${key.replace('extractor:', '')} | ${count} |`);
  }

  console.log('');
  for (const item of report) {
    if (!needsReviewOnly && item.status === 'covered') continue;
    if (!needsReviewOnly && item.status === 'not_required') continue;
    console.log(`${item.status.toUpperCase().padEnd(12)} ${item.extractorFamily.padEnd(14)} ${item.file}`);
    if (item.url) console.log(`  url: ${item.url}`);
    if (item.evidence.length) console.log(`  evidence: ${item.evidence.join('; ')}`);
    if (item.missing.length) console.log(`  missing: ${item.missing.join('; ')}`);
  }
}

if (failOnIssues && results.some(item => item.status === 'partial' || item.status === 'needs_review')) {
  process.exitCode = 1;
}
