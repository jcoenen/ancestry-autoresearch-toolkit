/**
 * FindAGrave Memorial Extractor
 *
 * Browser-context JavaScript functions for extracting structured data from
 * FindAGrave memorial pages via Playwright's browser_evaluate.
 *
 * Usage (from Claude Code):
 *   1. Navigate to memorial page
 *   2. Run extractMemorial() via browser_evaluate
 *   3. Navigate to /photo tab
 *   4. Run extractPhotos() via browser_evaluate
 *
 * These replace full-page snapshots, reducing token usage by ~95% per memorial.
 *
 * Tested against:
 *   - #122484917 (Adolph Castonia) — long bio, Read More, inscription, veteran, 13 family links
 *   - #32699800 (Henry Marple Fannin) — short bio, no inscription, Plot field, 14 family links
 *   - #68039322 (Rosina Prill Stolzmann) — no bio, no inscription, parents+siblings+children
 */

// =============================================================================
// FUNCTION 1: extractMemorial
// Run on: https://www.findagrave.com/memorial/{id}/{slug}
// Returns: structured JSON with all memorial data
// =============================================================================

/*
() => {
  // Click "Read More" if present to expand full biography
  const readMoreBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Read More');
  if (readMoreBtn) readMoreBtn.click();

  // --- Name ---
  // h1 contains the name plus an optional veteran badge (rendered as "V\nVETERAN").
  // Use innerText (not textContent) to get visual spacing, then strip the badge.
  const h1 = document.querySelector('h1');
  const isVeteran = h1?.textContent?.includes('Veteran') || false;
  let name = h1?.innerText?.trim() || null;
  if (name && isVeteran) {
    name = name.replace(/\s*V\n\s*VETERAN\s*$/i, '').trim();
    name = name.replace(/\s+V\s*$/i, '').replace(/\s+VETERAN\s*$/i, '').trim();
  }
  if (name) name = name.replace(/\s+/g, ' ').trim();

  // --- Vitals (Birth / Death / Burial / Plot) ---
  // FaG uses real DT/DD elements inside a DL.mem-events
  const vitals = {};
  const dts = document.querySelectorAll('dl.mem-events dt');
  for (const dt of dts) {
    const key = dt.textContent.trim().toLowerCase();
    const dd = dt.nextElementSibling;
    if (!dd || dd.tagName !== 'DD') continue;

    const timeEl = dd.querySelector('time');
    const link = dd.querySelector('a[href*="/cemetery/"]');
    const fullText = dd.innerText?.trim();
    const lines = fullText?.split('\n').map(l => l.trim()).filter(Boolean);

    if (key === 'birth') {
      vitals.birth_date = timeEl?.textContent?.trim() || null;
      vitals.birth_place = lines?.length > 1 ? lines[1] : null;
    } else if (key === 'death') {
      vitals.death_date = lines?.[0] || null;
      vitals.death_place = lines?.length > 1 ? lines[1] : null;
    } else if (key === 'burial') {
      vitals.cemetery = link?.textContent?.trim() || null;
      vitals.cemetery_url = link?.getAttribute('href') || null;
      const locLine = lines?.find(l => l.includes(',') && !l.includes('Add to Map'));
      vitals.burial_location = locLine || null;
    } else if (key === 'plot') {
      vitals.plot = fullText || null;
    } else if (key === 'memorial id') {
      vitals.memorial_id = fullText?.match(/(\d+)/)?.[1] || null;
    }
  }

  // --- Biography ---
  // Long bios use #bio-overflow; short bios may use "Gravesite Details" heading
  const bioEl = document.getElementById('bio-overflow');
  const bioParent = bioEl?.closest('div');
  let biography = bioParent?.innerText || '';
  biography = biography.replace(/Read More/g, '').replace(/Read Less/g, '').trim();
  if (!biography) {
    const gravesiteH2 = Array.from(document.querySelectorAll('h2'))
      .find(h => h.textContent.includes('Gravesite Details'));
    if (gravesiteH2) {
      const nextP = gravesiteH2.nextElementSibling;
      biography = nextP?.innerText?.trim() || null;
    }
  }
  if (!biography) biography = null;

  // --- Inscription ---
  // Present as a blockquote when the memorial has one; null otherwise.
  // Note: gravestone text visible only in photos is NOT captured here.
  let inscription = null;
  const blockquotes = document.querySelectorAll('blockquote');
  if (blockquotes.length > 0) {
    inscription = blockquotes[0].innerText?.trim() || null;
  }

  // --- Family Members ---
  // Family links contain an h3 (name) and p (dates) inside an <a> with /memorial/ href.
  // Group label (Parents/Spouse/Siblings/Children/Half Siblings) is the text of the
  // element immediately before each list.
  const familyLinks = Array.from(document.querySelectorAll('a[href*="/memorial/"]'))
    .filter(a => a.querySelector('h3'))
    .map(a => {
      const h3 = a.querySelector('h3');
      const p = a.querySelector('p');
      const href = a.getAttribute('href') || '';
      const memMatch = href.match(/\/memorial\/(\d+)/);
      const listItem = a.closest('li') || a.parentElement;
      const list = listItem?.parentElement;
      const groupLabel = list?.previousElementSibling?.textContent?.trim();
      return {
        name: h3?.textContent?.replace(/\s+/g, ' ').trim(),
        dates: p?.textContent?.replace(/\s+/g, ' ').trim() || null,
        memorial_id: memMatch?.[1] || null,
        group: groupLabel || 'Unknown'
      };
    });

  const family = {};
  for (const link of familyLinks) {
    if (!family[link.group]) family[link.group] = [];
    family[link.group].push({
      name: link.name,
      dates: link.dates,
      memorial_id: link.memorial_id
    });
  }

  // --- Photo count (from tab) ---
  const photoTab = Array.from(document.querySelectorAll('a'))
    .find(a => a.href?.includes('/photo'));
  const photoCountEl = photoTab?.querySelector('div, span');
  const photoCount = photoCountEl?.textContent?.replace(/"/g, '').trim() || '0';

  // --- Metadata ---
  const bodyText = document.body.innerText;
  const createdBy = bodyText.match(/Created by:\s*(.+)/)?.[1]?.trim() || null;
  const dateAdded = bodyText.match(/Added:\s*(.+)/)?.[1]?.trim() || null;

  return {
    name,
    isVeteran,
    vitals,
    biography,
    inscription,
    family,
    photoCount: parseInt(photoCount) || 0,
    createdBy,
    dateAdded,
    url: window.location.href
  };
}
*/

// =============================================================================
// FUNCTION 2: extractPhotos
// Run on: https://www.findagrave.com/memorial/{id}/{slug}/photo
// Returns: array of photo objects with download URLs + cookies for curl
// =============================================================================

/*
() => {
  // Collect all FaG-hosted images, dedup by base URL
  const seen = new Set();
  const photos = [];

  for (const img of document.querySelectorAll('img')) {
    const src = img.src || '';
    if (!src.includes('images.findagrave.com') || src.includes('default-image')) continue;

    // Strip size parameter to get base URL (for full-size download)
    const baseUrl = src.replace(/\?size=\w+/, '');
    if (seen.has(baseUrl)) continue;
    seen.add(baseUrl);

    // Photo ID from button alt text
    const btn = img.closest('button');
    const altText = img.alt || btn?.getAttribute('aria-label') || '';
    const photoId = altText.match(/(\d+)/)?.[1] || null;

    // "Added by" metadata from nearby paragraph
    const container = img.closest('div')?.parentElement;
    const p = container?.querySelector('p');
    const addedBy = p?.textContent?.replace(/\s+/g, ' ').trim() || null;

    photos.push({
      url: baseUrl,
      photo_id: photoId,
      added_by: addedBy
    });
  }

  return {
    photos,
    cookies: document.cookie
  };
}
*/
