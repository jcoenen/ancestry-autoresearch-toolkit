/**
 * Geni Profile Extractor
 *
 * Browser-context JavaScript functions for extracting structured data from
 * Geni.com person profile pages via Playwright's browser_evaluate.
 *
 * Usage (from Claude Code):
 *   1. Navigate to a Geni profile URL
 *   2. If hCaptcha appears, click the "I am human" checkbox via browser_click
 *   3. Run extractProfile() via browser_evaluate — gets vitals, full About text,
 *      family members, projects, discussions count
 *   4. To get wills/documents: run expandFamilyAndGetAll() to click "view all"
 *      and return every family member link
 *   5. For discussion content: navigate to the discussions URL returned by
 *      extractProfile(), then run extractDiscussions()
 *   6. Chain to related people using the href values from familyLinks
 *
 * Reliability notes:
 *   - Geni is crowd-sourced — treat as a RESEARCH LEAD, not a primary source
 *   - Profiles are often MERGED (two different people conflated — check dates)
 *   - The About section frequently contains transcribed wills, census records,
 *     and source citations added by serious researchers — high value for leads
 *   - Always verify Geni claims against FaG, FamilySearch, or county records
 *   - "Last Updated" date indicates how recently a curator touched the profile
 *
 * Selector strategy:
 *   Geni renders profiles as a <table> layout. Vitals use <td class="quiet nowrap">
 *   or <th> for labels with the value in the sibling <td> — NOT <dt>/<dd>.
 *   Family member links are embedded WITHIN the family summary <p> element
 *   (not in separate labeled cards), so individual relationship labels are not
 *   available from the DOM. Use familySummary to understand who is who.
 *   About section is in <h2>/<h3>-delimited content; uses structural siblings.
 *   Stable class: td.quiet.nowrap (Geni table label style — stable as of 2026).
 *
 * Tested against:
 *   - William Adkins Jr (6000000003650540698) — vitals, occupation, about/will,
 *     28 family links, 5 discussions, Related Projects (2026-04-06)
 *   - Jesse Adkins (6000000007538561850) — multiple wives, 43 family members,
 *     conflated profile (two Jesse Adkinses merged)
 */

// =============================================================================
// FUNCTION 1: extractProfile
// Run on: https://www.geni.com/people/{slug}/{profile-id}
// Returns: full structured profile — vitals, about text, family, projects
// =============================================================================

/*
() => {
  // --- Session / captcha check ---
  if (document.body.innerText.includes('Request unsuccessful') ||
      document.querySelector('iframe[title*="hCaptcha"]')) {
    return { error: 'captcha_required', url: window.location.href };
  }

  // --- Profile ID from URL ---
  const profileId = window.location.pathname.match(/(\d{10,})/)?.[1] || null;

  // --- Name ---
  // Geni renders the name in an H1. Strip any trailing date range if present.
  const rawName = document.querySelector('h1')?.innerText?.trim() || null;
  const name = rawName?.replace(/\s*\(\d{4}.*\)\s*$/, '').trim() || rawName;

  // --- Vital fields ---
  // Geni uses a <table> layout. Labels are in <td class="quiet nowrap"> or <th>,
  // followed immediately by a sibling <td> with the value. NOT <dt>/<dd>.
  // Skip "Immediate Family" (captured separately as familySummary).
  const vitals = {};
  const vitalSkip = ['Immediate Family', 'Managed by', 'Last Updated', 'About'];
  document.querySelectorAll('td.quiet.nowrap, th').forEach(label => {
    const key = label.innerText?.trim().replace(/:$/, '').trim();
    const valTd = label.nextElementSibling;
    if (key && valTd?.tagName === 'TD' && !vitalSkip.some(s => key.includes(s))) {
      vitals[key] = valTd.innerText?.trim() || '';
    }
  });

  // --- Immediate Family summary text ---
  // Geni shows a compact summary: "Son of X and Y. Husband of Z. Father of A, B..."
  // This is in a block-level element that contains "Son of" / "Husband of" etc.
  const summaryEl = Array.from(document.querySelectorAll('p, div'))
    .find(el => {
      const t = el.innerText?.trim() || '';
      return (t.startsWith('Son of') || t.startsWith('Daughter of') ||
              t.startsWith('Husband of') || t.startsWith('Wife of') ||
              t.startsWith('Father of') || t.startsWith('Mother of')) &&
             t.length < 2000;
    });
  const familySummary = summaryEl?.innerText?.trim() || null;

  // --- About section (FULL text — no character limit) ---
  // The About section follows an H2/H3 whose text starts with "About ".
  // Collect all sibling content until the next H2/H3.
  let about = null;
  const headings = Array.from(document.querySelectorAll('h2, h3'));
  const aboutH = headings.find(h => h.innerText.trim().startsWith('About '));
  if (aboutH) {
    const parts = [];
    let el = aboutH.nextElementSibling;
    while (el) {
      if (['H2', 'H3'].includes(el.tagName)) break;
      const text = el.innerText?.trim();
      if (text) parts.push(text);
      el = el.nextElementSibling;
    }
    about = parts.join('\n\n') || null;
  }
  // Fallback: some profiles put About content in a div with no heading sibling
  if (!about) {
    const aboutDiv = document.evaluate(
      '//*[contains(text(),"About ")]',
      document, null,
      XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue?.parentElement;
    if (aboutDiv) {
      about = aboutDiv.nextElementSibling?.innerText?.trim() || null;
    }
  }

  // --- Family member links (all /people/ hrefs) ---
  // Geni family member cards each have an <a href="/people/..."> containing
  // the person's name. We also try to extract the relationship label which
  // appears as adjacent text (e.g. "wife", "son", "daughter").
  const familyLinks = [];
  const seen = new Set();

  // First pass: structured family section — look for labeled items
  // (the "Immediate Family" section renders as a list of anchor + relationship text)
  document.querySelectorAll('a[href*="/people/"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href === window.location.pathname) return;
    const fullHref = href.startsWith('http') ? href : 'https://www.geni.com' + href;
    if (seen.has(fullHref)) return;

    const personName = a.innerText.trim().replace(/\s+/g, ' ');
    if (!personName || personName.length < 2) return;
    // Filter out nav/footer links
    if (['Back to', 'Directory', 'People', 'Geni'].some(s => personName.includes(s))) return;

    // Relationship: look in the closest list item or div for a label
    const container = a.closest('li') || a.closest('div') || a.parentElement;
    const containerText = container?.innerText?.trim() || '';
    const relKeywords = ['wife', 'husband', 'son', 'daughter', 'father', 'mother',
                         'brother', 'sister', 'child', 'parent', 'sibling', 'spouse'];
    // Exact-match only — Geni relationship labels are single words ("wife", "son",
    // "daughter"). The family summary paragraph ("Husband of Lydia Adkins", etc.)
    // is a sibling in the same container and would false-match on startsWith().
    const relMatch = containerText.split('\n')
      .map(l => l.trim().toLowerCase())
      .find(l => relKeywords.some(r => l === r));
    const relationship = relMatch || null;

    // Extract Geni profile ID from href
    const geniId = fullHref.match(/(\d{10,})/)?.[1] || null;

    seen.add(fullHref);
    familyLinks.push({ name: personName, href: fullHref, geniId, relationship });
  });

  // --- "View all N" count ---
  const viewAllMatch = document.body.innerText.match(/view all (\d+)/i);
  const totalFamilyCount = viewAllMatch ? parseInt(viewAllMatch[1]) : familyLinks.length;

  // --- Related Projects ---
  const projects = Array.from(document.querySelectorAll('a[href*="/projects/"]'))
    .map(a => a.innerText.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedup

  // --- Discussions ---
  const discussionsMatch = document.body.innerText.match(/(\d+)\s+[Dd]iscussion/);
  const discussionsCount = discussionsMatch ? parseInt(discussionsMatch[1]) : 0;
  // Discussions tab link — prefer a link whose href actually contains "discussion";
  // Geni tabs often render as <a href="...#discussion"> or <a href="?discussions">.
  // Fallback: if only a bare # anchor is found, construct from the profile URL.
  const discussionAnchor = Array.from(document.querySelectorAll('a'))
    .find(a => a.href?.includes('discussion') && a.href !== window.location.href);
  const discussionsLink = discussionAnchor?.href ||
    (discussionsCount > 0 ? window.location.href.split('#')[0] + '#discussion' : null);

  // --- Managed by / Last Updated ---
  const bodyText = document.body.innerText;
  const managedBy = bodyText.match(/Managed by:\s*([^\n]+)/)?.[1]?.trim() || null;
  const lastUpdated = bodyText.match(/Last Updated:\s*([^\n]+)/)?.[1]?.trim() || null;

  // --- Self-diagnostic ---
  if (!name && Object.keys(vitals).length === 0) {
    return {
      error: 'extraction_failed',
      reason: 'No name or vitals extracted — captcha or DOM change likely',
      title: document.title,
      url: window.location.href
    };
  }

  return {
    name, profileId, vitals, familySummary, about,
    familyLinks,
    totalFamilyCount,
    projects,
    discussionsCount, discussionsLink,
    managedBy, lastUpdated,
    url: window.location.href
  };
}
*/

// =============================================================================
// FUNCTION 2: expandFamilyAndGetAll
// Run on the same profile page AFTER extractProfile if totalFamilyCount >
// familyLinks.length (i.e. "view all N" was shown).
// Clicks the "view all" button/link, waits for the expanded list, then
// returns ALL family member links with relationship labels.
// NOTE: This modifies the page. Run extractProfile first, then this.
// =============================================================================

/*
async () => {
  // Click "view all" links to expand truncated family lists
  const viewAllLinks = Array.from(document.querySelectorAll('a, button'))
    .filter(el => /view all/i.test(el.innerText?.trim()));
  for (const el of viewAllLinks) {
    try { el.click(); } catch (e) {}
  }

  // Wait briefly for the DOM to update
  await new Promise(r => setTimeout(r, 1500));

  // Now extract all family member links
  const familyLinks = [];
  const seen = new Set();

  document.querySelectorAll('a[href*="/people/"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href === window.location.pathname) return;
    const fullHref = href.startsWith('http') ? href : 'https://www.geni.com' + href;
    if (seen.has(fullHref)) return;

    const personName = a.innerText.trim().replace(/\s+/g, ' ');
    if (!personName || personName.length < 2) return;
    if (['Back to', 'Directory', 'People', 'Geni'].some(s => personName.includes(s))) return;

    const container = a.closest('li') || a.closest('div') || a.parentElement;
    const containerText = container?.innerText?.trim() || '';
    const relKeywords = ['wife', 'husband', 'son', 'daughter', 'father', 'mother',
                         'brother', 'sister', 'child', 'parent', 'sibling', 'spouse'];
    const relMatch = containerText.split('\n')
      .map(l => l.trim().toLowerCase())
      .find(l => l.length < 25 && relKeywords.some(r => l === r || l.startsWith(r)));

    const geniId = fullHref.match(/(\d{10,})/)?.[1] || null;
    seen.add(fullHref);
    familyLinks.push({
      name: personName,
      href: fullHref,
      geniId,
      relationship: relMatch || null
    });
  });

  return { familyLinks, count: familyLinks.length, url: window.location.href };
}
*/

// =============================================================================
// FUNCTION 3: extractDiscussions
// Run on: https://www.geni.com/discussions/with/{profile-id}
// (the discussionsLink returned by extractProfile() points here)
// Returns: the discussion INDEX — titles, authors, message counts, thread URLs.
// These discussions often reference merges, source debates, will citations.
//
// NOTE: This returns the INDEX only. To read a thread's content, navigate
// to the individual thread URL and use browser_snapshot or extractDiscussionThread.
//
// Geni discussions page structure (as of 2026):
//   Each discussion is a div row with 9 children:
//   Author | spacer | Topic (link) | spacer | MessageCount | spacer | LastMessage...
//   Discussion links: a[href*="/discussions/"]:not([href*="/with/"])
// =============================================================================

/*
() => {
  // --- Session check ---
  if (document.body.innerText.includes('Request unsuccessful')) {
    return { error: 'captcha_required', url: window.location.href };
  }

  // Find all discussion thread links (not the index page link itself)
  const threadLinks = Array.from(document.querySelectorAll('a[href*="/discussions/"]'))
    .filter(a => !a.href.includes('/with/') && a.innerText?.trim().length > 3);

  const discussions = threadLinks.map(a => {
    // Walk up to the row container (has author + message count as siblings)
    let row = a.parentElement;
    while (row && row.children.length < 5) row = row.parentElement;

    // Parse the row text: "Author\n \nTopic\n \nMessageCount\n \nLastMessage..."
    const parts = (row?.innerText || '').split(/\s*\n\s*\n\s*/);
    const author = parts[0]?.trim() || null;
    const messageCount = parts[2] ? parseInt(parts[2].trim()) || null : null;
    const lastMessage = parts[3]?.trim() || null;

    return {
      title: a.innerText.trim(),
      url: a.href,
      author,
      messageCount,
      lastMessage
    };
  });

  if (discussions.length === 0) {
    // Fallback: page may have changed structure
    return {
      discussions: [],
      raw: document.body.innerText.trim().substring(0, 2000),
      note: 'No discussion links found — check if page structure changed.',
      url: window.location.href
    };
  }

  return { discussions, count: discussions.length, url: window.location.href };
}
*/

// =============================================================================
// FUNCTION 4: extractFamilyNavigator
// Lightweight version of extractProfile — ONLY returns family member links.
// Use this when you just need to hop between related profiles efficiently
// without extracting the full profile data.
// Run on any Geni profile page.
// =============================================================================

/*
() => {
  const name = document.querySelector('h1')?.innerText?.trim()
    ?.replace(/\s*\(\d{4}.*\)\s*$/, '').trim() || document.title;

  const profileId = window.location.pathname.match(/(\d{10,})/)?.[1] || null;

  // Click "view all" to expand truncated lists before collecting
  Array.from(document.querySelectorAll('a, button'))
    .filter(el => /view all/i.test(el.innerText?.trim()))
    .forEach(el => { try { el.click(); } catch(e) {} });

  const familyLinks = [];
  const seen = new Set();
  const relKeywords = ['wife', 'husband', 'son', 'daughter', 'father', 'mother',
                       'brother', 'sister', 'child', 'parent', 'sibling', 'spouse'];

  document.querySelectorAll('a[href*="/people/"]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href === window.location.pathname) return;
    const fullHref = href.startsWith('http') ? href : 'https://www.geni.com' + href;
    if (seen.has(fullHref)) return;

    const personName = a.innerText.trim().replace(/\s+/g, ' ');
    if (!personName || personName.length < 2) return;
    if (['Back to', 'Directory', 'People', 'Geni', 'Join'].some(s => personName.includes(s))) return;

    const container = a.closest('li') || a.closest('div') || a.parentElement;
    const relMatch = (container?.innerText || '').split('\n')
      .map(l => l.trim().toLowerCase())
      .find(l => l.length < 25 && relKeywords.some(r => l === r || l.startsWith(r)));

    const geniId = fullHref.match(/(\d{10,})/)?.[1] || null;
    seen.add(fullHref);
    familyLinks.push({ name: personName, href: fullHref, geniId, relationship: relMatch || null });
  });

  return { name, profileId, familyLinks, count: familyLinks.length, url: window.location.href };
}
*/
