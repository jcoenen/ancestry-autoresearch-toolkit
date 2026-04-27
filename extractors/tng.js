/**
 * TNG Genealogy Site Extractor
 *
 * Browser-context JavaScript for TNG (The Next Generation of Genealogy
 * Sitebuilding) person pages, including Little Chute History. TNG sites may be
 * behind Cloudflare or otherwise return challenge pages to curl/fetch, so use a
 * browser-rendered page before concluding that a profile lacks media.
 *
 * Usage:
 *   1. Navigate to a TNG person page, e.g.
 *      https://littlechutehistory.org/genealogy/getperson.php?personID=I171251&tree=lc
 *   2. Run extractPerson() via browser_evaluate.
 *   3. Review media[]. Use only clear, attached person portraits as portraits.
 *      Ignore template chrome, gender icons, search icons, and other UI assets.
 */

// =============================================================================
// FUNCTION: extractPerson
// Run on: a TNG getperson.php page
// Returns: structured person data and non-template media candidates
// =============================================================================

/*
() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const absoluteUrl = (value) => {
    if (!value) return null;
    try {
      return new URL(String(value).trim(), window.location.href).toString();
    } catch {
      return null;
    }
  };

  const rejectMedia = (url, alt, context) => {
    const lower = `${url} ${alt} ${context}`.toLowerCase();
    return [
      '/templates/',
      '/img/tng_',
      'book.png',
      'spacer',
      'favicon',
      'button',
      'search_small',
      'gender',
      'male.gif',
      'female.gif',
      'unknown.gif'
    ].some((needle) => lower.includes(needle));
  };

  const labelValueRows = [];
  for (const row of document.querySelectorAll('tr')) {
    const cells = Array.from(row.querySelectorAll('th,td')).map((cell) => clean(cell.innerText));
    if (cells.length >= 2 && cells[0] && cells[1]) {
      labelValueRows.push({ label: cells[0], value: cells.slice(1).join(' | ') });
    }
  }

  const media = [];
  const seen = new Set();
  for (const img of document.querySelectorAll('img')) {
    const src = absoluteUrl(img.currentSrc || img.src || img.getAttribute('data-src'));
    if (!src || seen.has(src)) continue;
    const alt = clean(img.alt || img.getAttribute('title') || '');
    const context = clean(img.closest('a,figure,td,div')?.innerText || '');
    if (rejectMedia(src, alt, context)) continue;
    seen.add(src);
    media.push({
      url: src,
      alt: alt || null,
      context: context || null,
      width: img.naturalWidth || null,
      height: img.naturalHeight || null
    });
  }

  return {
    site: 'tng',
    url: window.location.href,
    title: clean(document.title),
    name: clean(document.querySelector('h1, h2')?.innerText) || null,
    personId: new URL(window.location.href).searchParams.get('personID'),
    tree: new URL(window.location.href).searchParams.get('tree'),
    facts: labelValueRows,
    media,
    notes: media.length === 0
      ? ['No non-template media candidates found on the browser-rendered TNG page.']
      : []
  };
}
*/
