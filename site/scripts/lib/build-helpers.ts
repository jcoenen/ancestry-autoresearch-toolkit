/**
 * Pure parsing/utility functions used by build-data.ts.
 * Extracted for testability — no filesystem or side effects.
 */

export function formatDate(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) {
    // gray-matter parses YAML dates as UTC midnight, use toISOString to get YYYY-MM-DD
    return val.toISOString().split('T')[0];
  }
  return String(val);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractIdFromParens(text: string): string {
  const match = text.match(/\(I(\d+)[),]/);
  if (match) return `I${match[1]}`;
  const match2 = text.match(/\(I(\d+)\)/);
  return match2 ? `I${match2[1]}` : '';
}

export function extractWikilink(text: string): string {
  const match = text.match(/\[\[([^\]]+)\]\]/);
  return match ? match[1] : '';
}

export function extractNameFromWikilink(wikilink: string): string {
  // Filename format: Surname_First_Middle.md -> extract and reorder
  const filename = wikilink.split('/').pop() || '';
  const base = filename.replace(/\.md$/, '');
  const parts = base.split('_');
  if (parts.length >= 2) {
    // First part is surname, rest are given names: "Coenen_Roger_Francis" -> "Roger Francis Coenen"
    const surname = parts[0];
    const given = parts.slice(1).join(' ');
    return `${given} ${surname}`;
  }
  return base.replace(/_/g, ' ');
}

export function extractNameFromText(text: string): string {
  // Remove wikilinks, IDs in parens, marriage info
  const name = text
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/\(I\d+\)/g, '')
    .replace(/,\s*m\.\s*.*/g, '')
    .trim();
  return name || '';
}

export function parseVitalTable(content: string): Record<string, string> {
  const table: Record<string, string> = {};
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
      const pipePlaceholder = '__ESCAPED_PIPE__';
      const safe = line.replace(/\\\|/g, pipePlaceholder);
      const parts = safe.split('|').map(p => p.replaceAll(pipePlaceholder, '|').trim()).filter(Boolean);
      if (parts.length >= 2) {
        table[parts[0]] = parts[1];
      }
    }
  }

  return table;
}

export function extractBiography(content: string): string {
  const lines = content.split('\n');
  let inBio = false;
  const bioLines: string[] = [];

  for (const line of lines) {
    if (line.includes('## Biography')) {
      inBio = true;
      continue;
    }
    if (inBio && line.startsWith('## ')) {
      break;
    }
    if (inBio && line.trim()) {
      bioLines.push(line.trim());
    }
  }

  return bioLines.join('\n\n');
}

export function parseChildren(childrenStr: string): { name: string; id: string; link: string; spouseIndex?: number }[] {
  if (!childrenStr || childrenStr === '—' || childrenStr.toLowerCase() === 'unknown') return [];

  const children: { name: string; id: string; link: string; spouseIndex?: number }[] = [];
  // Split by comma, but be careful about commas inside wikilinks
  const segments: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of childrenStr) {
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

  for (const seg of segments) {
    const id = extractIdFromParens(seg);
    const wikilink = extractWikilink(seg);

    if (wikilink) {
      const name = extractNameFromWikilink(wikilink);
      children.push({ name, id, link: wikilink });
    } else if (id) {
      // Plain text name with ID — strip numbering, ID in parens, and trailing info
      const name = seg.replace(/^\d+\.\s*/, '').replace(/\(I\d+[^)]*\)/g, '').replace(/,\s*(twin|b\.).*$/i, '').trim();
      children.push({ name, id, link: '' });
    } else {
      // Plain text name without wikilink or GEDCOM ID — still include it
      const name = seg.replace(/^\d+\.\s*/, '').replace(/\([^)]*\)/g, '').trim();
      if (name && name !== '—') {
        children.push({ name, id: '', link: '' });
      }
    }
  }

  return children;
}

export function parseSpouse(spouseStr: string): { name: string; id: string; marriageDate: string; link: string } | null {
  if (!spouseStr || spouseStr === '—') return null;

  const id = extractIdFromParens(spouseStr);
  const wikilink = extractWikilink(spouseStr);
  const marriageMatch = spouseStr.match(/m\.\s*(.+?)(?:\s*\||\s*$)/);
  const marriageDate = marriageMatch ? marriageMatch[1].trim() : '';

  let name: string;
  if (wikilink) {
    name = extractNameFromWikilink(wikilink);
  } else {
    name = spouseStr
      .replace(/\[\[[^\]]+\]\]/g, '')
      .replace(/\(I\d+\)/g, '')
      .replace(/,\s*m\.\s*.*/g, '')
      .trim();
  }

  return { name, id, marriageDate, link: wikilink };
}

export function parseParent(parentStr: string): { id: string; name: string; link: string } {
  if (!parentStr || parentStr === '—') return { id: '', name: '', link: '' };

  const id = extractIdFromParens(parentStr);
  const wikilink = extractWikilink(parentStr);

  let name: string;
  if (wikilink) {
    name = extractNameFromWikilink(wikilink);
  } else {
    name = parentStr
      .replace(/\[\[[^\]]+\]\]/g, '')
      .replace(/\(I\d+\)/g, '')
      .trim();
  }

  return { id, name, link: wikilink };
}

export function inferMediaType(path: string): string {
  if (path.startsWith('gravestones/')) return 'gravestone';
  if (path.startsWith('portraits/')) return 'portrait';
  if (path.startsWith('documents/')) return 'document';
  if (path.startsWith('newspapers/')) return 'newspaper';
  if (path.startsWith('group_photos/') || path.startsWith('group/')) return 'group_photo';
  if (path.startsWith('scans/')) return 'scan';
  return 'other';
}

export function extractSection(content: string, heading: string): string {
  const lines = content.split('\n');
  let inSection = false;
  const result: string[] = [];
  for (const line of lines) {
    if (line.match(new RegExp(`^##\\s+${heading}`, 'i'))) {
      inSection = true;
      continue;
    }
    if (inSection && line.match(/^## /)) break;
    if (inSection) result.push(line);
  }
  return result.join('\n').trim();
}

export function extractFullText(content: string): string {
  // Prefer blockquoted transcription text when present.
  const lines = content.split('\n');
  const quoted: string[] = [];
  let inFullText = false;
  for (const line of lines) {
    if (line.match(/^##\s+Full Text/i)) { inFullText = true; continue; }
    if (inFullText && line.match(/^## /)) break;
    if (inFullText && line.startsWith('>')) {
      quoted.push(line.replace(/^>\s?/, ''));
    }
  }
  if (quoted.length > 0) return quoted.join('\n');

  // Some source files store plain text, tables, or field lists directly under
  // the Full Text heading. Index that content too so keyword search can find it.
  const rawFullText = extractSection(content, 'Full Text');
  if (rawFullText) return rawFullText;

  // Fallback: look for any blockquote in the content
  const allQuoted: string[] = [];
  for (const line of lines) {
    if (line.startsWith('>')) allQuoted.push(line.replace(/^>\s?/, ''));
  }
  return allQuoted.join('\n');
}

// ── Privacy redaction ──

/** Fields blanked to '' for private people */
const PRIVACY_STRING_FIELDS = [
  'born', 'died', 'biography', 'birthDateAnalysis', 'birthplace', 'deathPlace',
  'burial', 'religion', 'occupation', 'military', 'immigration', 'emigration',
  'naturalization', 'causeOfDeath', 'confirmation', 'baptized', 'christened',
  'nickname', 'education', 'residence', 'familySearchId', 'divorce', 'cremation',
];

interface PersonLike {
  privacy: boolean;
  sources: string[];
  media: unknown[];
  _mediaRefs?: string[];
  spouses: { id: string; marriageDate: string; [k: string]: unknown }[];
  [key: string]: unknown;
}

/**
 * Apply privacy redaction to a single person record.
 * Strips personal details but preserves name, family structure, and tree position.
 */
export function applyPrivacyRedaction<T extends PersonLike>(person: T): T {
  if (!person.privacy) return person;

  for (const field of PRIVACY_STRING_FIELDS) {
    if (field in person) {
      (person as Record<string, unknown>)[field] = '';
    }
  }

  person.sources = [];
  person.media = [];
  if ('_mediaRefs' in person) {
    person._mediaRefs = [];
  }

  for (const sp of person.spouses) {
    sp.marriageDate = '';
  }

  return person;
}

/**
 * Post-processing pass: blank marriage dates on non-private people
 * whose spouse is private (prevents leaking the private person's marriage date
 * from the other side of the relationship).
 */
export function redactCrossSpouseMarriageDates<T extends PersonLike>(people: T[]): void {
  const privateIds = new Set(people.filter(p => p.privacy).map(p => (p as Record<string, unknown>).id as string));
  for (const person of people) {
    for (const sp of person.spouses) {
      if (privateIds.has(sp.id)) {
        sp.marriageDate = '';
      }
    }
  }
}
