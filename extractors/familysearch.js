/**
 * FamilySearch Record & Search Extractors
 *
 * Browser-context JavaScript functions for extracting structured data from
 * FamilySearch pages via Playwright's browser_evaluate.
 *
 * Usage (from Claude Code):
 *   1. Navigate to a FamilySearch record or search page
 *   2. Copy the appropriate function below into browser_evaluate
 *
 * Replaces full-page snapshots, reducing token usage by ~90% per page.
 *
 * Selector strategy:
 *   All selectors use structural/content detection (table shape, child count,
 *   TH/TD patterns, data-testid attributes) rather than CSS class names, which
 *   are CSS-in-JS hashes that change on deploys. CSS classes are used only as
 *   an optimization hint, never as the sole selector.
 *
 * Tested against:
 *   - /ark:/61903/1:1:N3F1-44Q (MI marriage — Parcfic Lemieux, 5 related, mentionedIn)
 *   - /ark:/61903/1:1:MS98-K42 (1900 Census — Percelie Lamere, 11 household, expanded details)
 *   - Search results page (61 results, 20/page, date/place edge cases)
 */

// =============================================================================
// FUNCTION: extractRecord
// Run on: https://www.familysearch.org/ark:/61903/1:1:XXXX
// Returns: structured JSON with all record data including expanded details
// =============================================================================

/*
() => {
  // --- Session check ---
  if (window.location.hostname === 'ident.familysearch.org' ||
      document.title.includes('Sign-in') ||
      document.title === 'Page Not Found') {
    return { error: document.title.includes('Sign-in') ? 'login_required' : 'page_not_found', url: window.location.href };
  }

  // --- Person name (H1) ---
  const name = document.querySelector('h1')?.innerText?.trim() || null;

  // --- Record context (H2s) ---
  const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
  let mentionedIn = null, eventType = null, collection = null;
  for (const h2 of h2s) {
    if (h2.startsWith('Mentioned in the Record of')) {
      mentionedIn = h2.replace('Mentioned in the Record of ', '');
    }
    // Handle bullet variants: •, ·, middle dot, etc.
    const dotMatch = h2.match(/^(.+?)\s+[•·\u2022\u00b7\u2027]\s+(.+)$/);
    if (dotMatch) { eventType = dotMatch[1]; collection = dotMatch[2]; }
  }

  // --- Helper: find key-value detail tables ---
  // A detail table has ALL rows with exactly 2 children (TH + TD).
  // Excludes the "Document Information" table (first TH = "Digital Folder Number").
  function findDetailTables() {
    return Array.from(document.querySelectorAll('table')).filter(t => {
      const rows = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
      if (rows.length === 0) return false;
      const allKv = rows.every(tr => {
        const ch = tr.children;
        return ch.length === 2 && ch[0]?.tagName === 'TH' && ch[1]?.tagName === 'TD';
      });
      if (!allKv) return false;
      // Exclude document info table and nested expanded-detail tables
      const firstTh = rows[0]?.children[0]?.innerText?.trim();
      if (firstTh === 'Digital Folder Number') return false;
      // Exclude tables inside colspan="6" expanded rows
      if (t.closest('th[colspan]')) return false;
      return true;
    });
  }

  // --- Main person details (all top-level detail tables) ---
  const details = {};
  for (const table of findDetailTables()) {
    for (const tr of table.querySelectorAll(':scope > tbody > tr, :scope > tr')) {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (th && td) {
        // Use innerText to avoid hidden responsive duplicates
        details[th.innerText.trim()] = td.innerText.trim();
      }
    }
  }

  // --- Helper: find expandable people tables ---
  // These have summary rows with exactly 6 direct children (TH + 5 TDs)
  // and contain person name links to ARK URLs.
  function findExpandableTables() {
    return Array.from(document.querySelectorAll('table')).filter(t => {
      // Must not be inside an expanded row
      if (t.closest('th[colspan]')) return false;
      const rows = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
      return rows.some(tr =>
        tr.children.length === 6 &&
        tr.children[0]?.tagName === 'TH' &&
        tr.children[0]?.querySelector('a[href*="/ark:"]')
      );
    });
  }

  // --- Click "Open All" to expand detail rows ---
  const openAllBtns = Array.from(document.querySelectorAll('button'))
    .filter(b => b.textContent.trim() === 'Open All');
  for (const btn of openAllBtns) btn.click();

  // --- Related people with full expanded details ---
  const relatedPeople = [];
  for (const table of findExpandableTables()) {
    // Find section heading by walking up parent chain
    let section = null;
    let container = table;
    for (let i = 0; i < 6; i++) {
      container = container.parentElement;
      if (!container) break;
      let prev = container.previousElementSibling;
      while (prev) {
        const h3 = prev.tagName === 'H3' ? prev : prev.querySelector?.('h3');
        if (h3) { section = h3.innerText.trim(); break; }
        prev = prev.previousElementSibling;
      }
      if (section) break;
    }

    const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const children = Array.from(row.children);

      // Summary row: exactly 6 children, first is TH with ark link
      if (children.length !== 6 || children[0].tagName !== 'TH') continue;
      const link = children[0].querySelector('a[href*="/ark:"]');
      if (!link) continue;

      const person = {
        name: link.innerText.trim(),
        ark: link.getAttribute('href')?.replace(/\?.*$/, '') || null,
        section,
        relationship: children[1]?.innerText?.trim() || null,
        sex: children[2]?.innerText?.trim() || null,
        age: children[3]?.innerText?.trim() || null,
        birthplace: children[4]?.innerText?.trim() || null,
        details: null
      };

      // Check next row for expanded details (single TH with colspan="6")
      const nextRow = rows[ri + 1];
      if (nextRow) {
        const nextCh = nextRow.children;
        if (nextCh.length === 1 && nextCh[0]?.tagName === 'TH' && nextCh[0].getAttribute('colspan')) {
          const nestedTable = nextCh[0].querySelector('table');
          if (nestedTable) {
            const expanded = {};
            for (const tr of nestedTable.querySelectorAll(':scope > tbody > tr, :scope > tr')) {
              const th = tr.querySelector('th');
              const td = tr.querySelector('td');
              if (th && td) expanded[th.innerText.trim()] = td.innerText.trim();
            }
            // Only include if it has meaningful data beyond what summary has
            if (Object.keys(expanded).length > 0) person.details = expanded;
          }
        }
      }

      relatedPeople.push(person);
    }
  }

  // --- Tree attachments (stable data-testid selectors) ---
  const seenPids = new Set();
  const treePersons = Array.from(document.querySelectorAll('[data-testid="person"]'))
    .map(el => ({
      fullName: el.querySelector('[data-testid="fullName"]')?.innerText?.trim() || null,
      lifespan: el.querySelector('[data-testid="lifespan"]')?.innerText?.trim() || null,
      pid: el.querySelector('[data-testid="pid"]')?.innerText?.trim() || null,
      treeUrl: el.querySelector('[data-testid="nameLink"]')?.getAttribute('href') || null
    }))
    .filter(p => {
      if (!p.pid || seenPids.has(p.pid)) return false;
      seenPids.add(p.pid);
      return true;
    });

  // --- Citation ---
  const citation = document.querySelector('[data-testid="documentInformationCitation"]')?.innerText?.trim() || null;

  // --- View Original Document link ---
  const viewOriginal = document.querySelector('[data-testid="viewOriginalDocument-Button"]')?.getAttribute('href') || null;

  // --- ARK ---
  const ark = window.location.pathname.replace(/\?.*$/, '');

  // --- Self-diagnostic: detect extraction failure ---
  // If we're on a record page but got nothing, the DOM probably changed.
  // Return a clear signal so the caller falls back to browser_snapshot.
  const detailCount = Object.keys(details).length;
  const isRecordPage = ark.includes('/ark:/');
  if (isRecordPage && !name && detailCount === 0) {
    return {
      error: 'extraction_failed',
      reason: 'On a record page but extracted no name or details. DOM structure likely changed.',
      fallback: 'Use browser_snapshot instead of this extractor.',
      url: window.location.href,
      ark,
      // Include raw page info for debugging
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      tableCount: document.querySelectorAll('table').length
    };
  }

  return {
    name, eventType, collection, mentionedIn,
    details, relatedPeople, treePersons,
    citation, viewOriginal, ark,
    url: window.location.href
  };
}
*/

// =============================================================================
// FUNCTION: downloadCurrentImage
// Run on: any FamilySearch image viewer page (after navigating to the record
//         and clicking "View Original Document" or arriving at the viewer URL)
//
// Usage:
//   1. Navigate to the image viewer page
//   2. Paste this function into browser_evaluate — it clicks Download, selects
//      JPG Only, and triggers the download
//   3. File lands at: .playwright-mcp/image.jpg
//   4. Move it: Bash → mv .playwright-mcp/image.jpg <targetPath>
//
// Returns: { status: 'downloading' | 'button_not_found' | 'dialog_not_found' }
// =============================================================================

/*
async () => {
  // 1. Click the Download button (identified by aria-label, not CSS class)
  const downloadBtn = document.querySelector('button[aria-label="Download"]');
  if (!downloadBtn) return { status: 'button_not_found', url: window.location.href };
  downloadBtn.click();

  // 2. Wait briefly for dialog to render
  await new Promise(r => setTimeout(r, 600));

  // 3. Select "JPG Only" radio
  const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
  const jpgRadio = radios.find(r => r.value === 'JPG Only');
  if (!jpgRadio) return { status: 'dialog_not_found', radios: radios.map(r => r.value) };
  jpgRadio.click();

  // 4. Click the DOWNLOAD confirm button
  await new Promise(r => setTimeout(r, 200));
  const confirmBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.innerText?.trim() === 'DOWNLOAD');
  if (!confirmBtn) return { status: 'confirm_button_not_found' };
  confirmBtn.click();

  return { status: 'downloading', note: 'File will appear at .playwright-mcp/image.jpg — mv it to your target path' };
}
*/

// =============================================================================
// FUNCTION: extractSearchResults
// Run on: https://www.familysearch.org/search/record/results?...
// Returns: structured search results with parsed events
//
// DOM structure per result row (5 TDs):
//   TD[0]: "More" button
//   TD[1]: Name cell — strong>a for name+ARK, role text, collection name
//   TD[2]: Events — each event is a div with <strong>Type</strong> + spans;
//          <br> separates date from place; no-br uses digit detection
//   TD[3]: Relationships — "Parents ...\nSpouses ..."
//   TD[4]: Links — image viewer, record, linker links
// =============================================================================

/*
() => {
  // --- Session check ---
  if (window.location.hostname === 'ident.familysearch.org' ||
      document.title.includes('Sign-in')) {
    return { error: 'login_required', url: window.location.href };
  }

  // --- Find the results table ---
  // Structural detection: a table whose first row has a TH or TD containing "Name"
  // and result rows with exactly 5 TDs including ARK links.
  let table = null;
  for (const t of document.querySelectorAll('table')) {
    if (t.closest('th[colspan]')) continue; // skip nested
    const rows = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
    const hasResultRow = rows.some(r => {
      const ch = r.children;
      return ch.length === 5 && r.querySelector('a[href*="/ark:"][href*="1:1:"]');
    });
    if (hasResultRow) { table = t; break; }
  }
  if (!table) return { count: 0, totalResults: null, results: [], url: window.location.href };

  const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));
  const results = [];

  for (const row of rows) {
    const cells = Array.from(row.children);
    if (cells.length !== 5) continue;

    const nameCell = cells[1];
    const nameLink = nameCell?.querySelector('a[href*="/ark:"][href*="1:1:"]');
    if (!nameLink) continue;

    // Name and ARK
    const name = nameLink.querySelector('strong')?.innerText?.trim() || nameLink.innerText?.trim();
    const ark = nameLink.getAttribute('href')?.replace(/\?.*$/, '') || null;

    // Role and collection from name cell text lines
    const nameLines = nameCell.innerText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const roles = ['Principal', 'Groom', 'Bride', 'Child', 'Father', 'Mother', 'Spouse', 'Other', 'Husband', 'Wife'];
    const role = nameLines.find(l => roles.includes(l)) || null;
    const collection = nameLines.find(l => l.includes(',') && l !== name) || null;

    // Events — each div with <strong> is one event
    const eventsCell = cells[2];
    const events = [];
    if (eventsCell) {
      const eventDivs = eventsCell.querySelectorAll(':scope > div:not([aria-hidden])');
      for (const div of eventDivs) {
        const strong = div.querySelector('strong');
        if (!strong) continue;
        const type = strong.textContent.trim();
        const hasBr = !!div.querySelector('br');
        const spans = Array.from(div.querySelectorAll('span'))
          .map(s => s.textContent.replace(/\u00a0/g, '').trim())
          .filter(Boolean);
        let date = null, place = null;
        if (hasBr) {
          const brEl = div.querySelector('br');
          const beforeSpans = [], afterSpans = [];
          for (const span of div.querySelectorAll('span')) {
            const text = span.textContent.replace(/\u00a0/g, '').trim();
            if (!text) continue;
            if (span.compareDocumentPosition(brEl) & Node.DOCUMENT_POSITION_FOLLOWING) {
              beforeSpans.push(text);
            } else {
              afterSpans.push(text);
            }
          }
          date = beforeSpans.join(' ').trim() || null;
          place = afterSpans.join(' ').trim() || null;
        } else {
          const dateSpans = [], placeSpans = [];
          for (const s of spans) {
            if (/\d/.test(s)) dateSpans.push(s);
            else placeSpans.push(s);
          }
          date = dateSpans.join(' ').trim() || null;
          place = placeSpans.join(' ').trim() || null;
        }
        events.push({ type, date, place });
      }
    }

    // Relationships
    const relText = cells[3]?.innerText?.trim() || null;

    results.push({ name, ark, role, collection, events, relationships: relText });
  }

  // Total results and pagination
  const totalMatch = document.body.innerText.match(/Historical Record Search Results \(([,\d]+)\)/);
  const totalResults = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : null;

  // Current page from URL
  const urlParams = new URLSearchParams(window.location.search);
  const offset = parseInt(urlParams.get('offset')) || 0;
  const count = parseInt(urlParams.get('count')) || 20;
  const currentPage = Math.floor(offset / count) + 1;
  const totalPages = totalResults ? Math.ceil(totalResults / count) : null;

  // --- Self-diagnostic: detect extraction failure ---
  // If totalResults says there are results but we extracted zero, DOM changed.
  const isSearchPage = window.location.pathname.includes('/search/');
  if (isSearchPage && results.length === 0 && (totalResults > 0 || document.querySelectorAll('table').length > 0)) {
    return {
      error: 'extraction_failed',
      reason: 'On a search page with tables/results but extracted zero rows. DOM structure likely changed.',
      fallback: 'Use browser_snapshot instead of this extractor.',
      url: window.location.href,
      title: document.title,
      tableCount: document.querySelectorAll('table').length,
      totalResults
    };
  }

  return {
    count: results.length,
    totalResults,
    currentPage,
    totalPages,
    results,
    url: window.location.href
  };
}
*/
