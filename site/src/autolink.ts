import type { Person, SourceEntry } from './types'

/**
 * Auto-link person names and source IDs in markdown text.
 * Replaces recognized names with markdown links to /people/:slug
 * and SRC-* IDs with links to /sources/:slug.
 */
export function autolinkMarkdown(
  markdown: string,
  people: Person[],
  sources: SourceEntry[],
): string {
  // Sort by name length descending — match longer names first to avoid partial matches
  const sortedPeople = people
    .filter(p => !p.privacy && p.name && p.slug && p.name.length >= 5)
    .sort((a, b) => b.name.length - a.name.length)

  // Build source lookup: SRC-OBIT-033 → slug
  const sourceMap = new Map<string, string>()
  for (const s of sources) {
    if (s.id && s.slug) sourceMap.set(s.id, s.slug)
  }

  return markdown.split('\n').map(line => {
    // Skip headings and blockquotes
    if (line.startsWith('#') || line.startsWith('>')) return line

    let result = line

    // Link source IDs (SRC-*) — do this first so person linking doesn't break them
    if (!result.includes('](')) {
      result = result.replace(/\bSRC-[A-Z]+-\d{3}\b/g, (match) => {
        const slug = sourceMap.get(match)
        if (slug) return `[${match}](/sources/${slug})`
        return match
      })
    }

    // Skip person linking if line already contains markdown links
    if (result.includes('](')) return result

    for (const p of sortedPeople) {
      const escaped = p.name.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), `[${p.name}](/people/${p.slug})`)
    }
    return result
  }).join('\n')
}
