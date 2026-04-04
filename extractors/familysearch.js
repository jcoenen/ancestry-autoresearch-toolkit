/**
 * FamilySearch Record Extractor
 *
 * Browser-context JavaScript functions for extracting structured data from
 * FamilySearch record pages via Playwright's browser_evaluate.
 *
 * Usage (from Claude Code):
 *   1. Navigate to a FamilySearch record page (/ark:/61903/1:1:XXXX)
 *   2. Run extractRecord() via browser_evaluate
 *
 * These replace full-page snapshots, reducing token usage by ~90% per record.
 *
 * DOM notes:
 *   - Main person details: first table.tableCss_tobv3gy (TH=field, TD=value)
 *   - Use innerText (not textContent) for TD values — textContent includes
 *     hidden responsive duplicates (e.g., "December 1856Dec 1856")
 *   - Related people: table.tableCss_t1upzggo with expandable rows
 *     Summary rows have exactly 6 direct children: TH(name), TD(relationship),
 *     TD(sex), TD(age), TD(birthplace), TD(empty)
 *   - Section heading for related people: walk up ~2-5 parent levels from
 *     the expandable table, check previousElementSibling for H3
 *   - Tree attachments: [data-testid="person"] elements
 *   - Citation: [data-testid="documentInformationCitation"]
 *   - View Original: [data-testid="viewOriginalDocument-Button"]
 *
 * Tested against:
 *   - /ark:/61903/1:1:N3F1-44Q (Michigan marriage record — Parcfic Lemieux)
 *   - /ark:/61903/1:1:MS98-K42 (1900 US Census — Percelie Lamere, 11 household members)
 */

// =============================================================================
// FUNCTION: extractRecord
// Run on: https://www.familysearch.org/ark:/61903/1:1:XXXX
// Returns: structured JSON with all record data
// =============================================================================

/*
() => {
  // --- Person name (H1) ---
  const name = document.querySelector('h1')?.innerText?.trim() || null;

  // --- Record context (H2s) ---
  // H2 pattern: "Mentioned in the Record of [name]" and/or "EventType . CollectionName"
  const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim());
  let mentionedIn = null;
  let eventType = null;
  let collection = null;
  for (const h2 of h2s) {
    if (h2.startsWith('Mentioned in the Record of')) {
      mentionedIn = h2.replace('Mentioned in the Record of ', '');
    }
    const dotMatch = h2.match(/^(.+?)\s+[•·]\s+(.+)$/);
    if (dotMatch) {
      eventType = dotMatch[1];
      collection = dotMatch[2];
    }
  }

  // --- Main person details (first tobv3gy table) ---
  const detailTable = document.querySelector('table[class*="tobv3gy"]');
  const details = {};
  if (detailTable) {
    for (const tr of detailTable.querySelectorAll('tr')) {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (th && td) {
        details[th.innerText.trim()] = td.innerText.trim();
      }
    }
  }

  // --- Related people (expandable tables) ---
  const expandables = Array.from(document.querySelectorAll('table')).filter(t =>
    t.className.includes('t1upzggo')
  );

  const relatedPeople = [];
  for (const table of expandables) {
    // Find section heading by walking up parent chain
    let section = null;
    let container = table;
    for (let i = 0; i < 5; i++) {
      container = container.parentElement;
      if (!container) break;
      let prev = container.previousElementSibling;
      while (prev) {
        const h3 = prev.tagName === 'H3' ? prev : prev.querySelector?.('h3');
        if (h3) {
          section = h3.innerText.trim();
          break;
        }
        prev = prev.previousElementSibling;
      }
      if (section) break;
    }

    // Extract summary rows (exactly 6 direct children)
    for (const row of table.querySelectorAll('tr')) {
      const children = Array.from(row.children);
      if (children.length !== 6) continue;
      if (children[0].tagName !== 'TH') continue;
      const link = children[0].querySelector('a[href*="/ark:"]');
      if (!link) continue;

      relatedPeople.push({
        name: link.innerText.trim(),
        ark: link.getAttribute('href')?.replace(/\?.*$/, '') || null,
        section: section,
        relationship: children[1]?.innerText?.trim() || null,
        sex: children[2]?.innerText?.trim() || null,
        age: children[3]?.innerText?.trim() || null,
        birthplace: children[4]?.innerText?.trim() || null
      });
    }
  }

  // --- Tree attachments ---
  const treePersons = Array.from(document.querySelectorAll('[data-testid="person"]')).map(el => ({
    fullName: el.querySelector('[data-testid="fullName"]')?.innerText?.trim() || null,
    lifespan: el.querySelector('[data-testid="lifespan"]')?.innerText?.trim() || null,
    pid: el.querySelector('[data-testid="pid"]')?.innerText?.trim() || null,
    treeUrl: el.querySelector('[data-testid="nameLink"]')?.getAttribute('href') || null
  }));
  // Deduplicate tree persons by PID
  const seenPids = new Set();
  const uniqueTreePersons = treePersons.filter(p => {
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

  return {
    name,
    eventType,
    collection,
    mentionedIn,
    details,
    relatedPeople,
    treePersons: uniqueTreePersons,
    citation,
    viewOriginal,
    ark,
    url: window.location.href
  };
}
*/

// =============================================================================
// FUNCTION: extractSearchResults
// Run on: https://www.familysearch.org/search/record/results?q.any=...
// Returns: array of search result objects
//
// DOM structure per result row (5 TDs):
//   TD[0]: "More" button
//   TD[1]: Name cell — strong>a[href*="/ark:"][href*="1:1:"] for name+ARK,
//          then role text (Principal/Groom/Bride/etc.) and collection name
//   TD[2]: Events cell — each event is a div with <strong>Type</strong>,
//          spans for date, <br> + span for place
//   TD[3]: Relationships cell — "Parents ...\nSpouses ..."
//   TD[4]: Links cell — image viewer, record, linker links
// =============================================================================

/*
() => {
  const table = document.querySelector('table[class*="t1upzggo"]');
  if (!table) return { count: 0, results: [], totalResults: null, url: window.location.href };

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

    // Role and collection from name cell text
    const nameLines = nameCell.innerText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const roles = ['Principal', 'Groom', 'Bride', 'Child', 'Father', 'Mother', 'Spouse', 'Other', 'Husband', 'Wife'];
    const role = nameLines.find(l => roles.includes(l)) || null;
    const collection = nameLines.find(l => l.includes(',') && l !== name) || null;

    // Events — parse from DOM structure: each div has <strong>Type</strong> + spans
    const eventsCell = cells[2];
    const events = [];
    if (eventsCell) {
      const eventDivs = eventsCell.querySelectorAll(':scope > div:not([aria-hidden])');
      for (const div of eventDivs) {
        const strong = div.querySelector('strong');
        if (!strong) continue;
        const type = strong.textContent.trim();
        // Spans contain date and place; <br> separates date from place
        const hasBr = !!div.querySelector('br');
        const spans = Array.from(div.querySelectorAll('span'))
          .map(s => s.textContent.replace(/\u00a0/g, '').trim())
          .filter(Boolean);
        let date = null, place = null;
        if (hasBr) {
          // Before <br> = date spans, after <br> = place spans
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
          // No <br>: spans with digits are dates, otherwise places
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

  // Total results count from header
  const totalMatch = document.body.innerText.match(/Historical Record Search Results \((\d+)\)/);
  const totalResults = totalMatch ? parseInt(totalMatch[1]) : null;

  return {
    count: results.length,
    totalResults,
    results,
    url: window.location.href
  };
}
*/
