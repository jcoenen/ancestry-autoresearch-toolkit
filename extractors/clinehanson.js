/**
 * Cline Hanson / Tukios Obituary Extractor
 *
 * Browser-context JavaScript functions for extracting structured obituary data
 * and portrait image URLs from Cline Hanson Funeral Home and related Tukios
 * obituary pages via Playwright's browser_evaluate.
 *
 * Usage:
 *   1. Navigate to the obituary page, e.g.
 *      https://www.clinehansonfuneralhome.com/obituary/4784382
 *   2. Run extractObituary() via browser_evaluate.
 *   3. If redirectedToListing is true, the requested old obituary URL did not
 *      resolve to the target obituary. Search the site/archives by name instead.
 *   4. Review images[]. Use only clear decedent portraits as profile portraits.
 *   5. Download selected images from their returned URL, then wire them into the
 *      vault with the media index/source/person-file workflow.
 *
 * Older numeric URLs can redirect to /obits. In that case:
 *   1. Navigate to https://www.clinehansonfuneralhome.com/obits
 *   2. Run getWidgetConfig() via browser_evaluate to capture the Tukios bearer
 *      token and organization ID from the page's .tukios_widget element.
 *   3. Query the widget API in the same browser or with those headers:
 *      GET https://websites.tukios.com/api/widget/obituary?per_page=100&page=1&q=Fannin
 *      Authorization: Bearer <data-token>
 *      X-Organization-Id: <data-organization-id>
 *   4. Match by external_id, display_name, and dates. A repeated dove/default
 *      image is a placeholder, not a portrait.
 *
 * Why this exists:
 *   Static fetches are not sufficient for Cline Hanson/Tukios research. Some
 *   pages block bots, lazy-load assets, use CDN-hosted image URLs, or expose the
 *   portrait only after client-side scripts run. Do not mark an obituary as
 *   lacking a portrait based only on curl/fetch failures.
 *
 * Selector strategy:
 *   Tukios funeral-home pages vary by deployment and age. This extractor uses
 *   structural signals and URL/content heuristics instead of fragile CSS class
 *   names. It collects OpenGraph/Twitter images, real <img> tags, lazy-load
 *   attributes, srcsets, and inline style background images, then filters out
 *   logos/placeholders/flower graphics.
 */

// =============================================================================
// FUNCTION: extractObituary
// Run on: a Cline Hanson / Tukios obituary page
// Returns: structured JSON with obituary text and image candidates
// =============================================================================

/*
() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const absoluteUrl = (value) => {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
    try {
      return new URL(trimmed, window.location.href).toString();
    } catch {
      return null;
    }
  };

  const meta = (key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selectors = [
      `meta[property="${escaped}"]`,
      `meta[name="${escaped}"]`
    ];
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content');
      if (value) return clean(value);
    }
    return '';
  };

  const rejectImage = (url, context) => {
    const lower = `${url} ${context}`.toLowerCase();
    return [
      'logo',
      'favicon',
      'sprite',
      'placeholder',
      'default-image',
      'share_img',
      'share-image',
      'premium/share',
      'flower',
      'flowers/',
      'sympathy',
      'tree-cta',
      'card-cta',
      'avatar-default',
      'blank.gif'
    ].some((needle) => lower.includes(needle));
  };

  const classifyImage = (url, context) => {
    const lower = `${url} ${context}`.toLowerCase();
    if (lower.includes('gravestone') || lower.includes('headstone') || lower.includes('cemetery')) return 'gravestone';
    if (lower.includes('newspaper') || lower.includes('clipping')) return 'news';
    if (lower.includes('document') || lower.includes('certificate')) return 'document';
    if (lower.includes('group') || lower.includes('family photo')) return 'group';
    if (
      lower.includes('/images/obituaries/') ||
      lower.includes('obituary-photo') ||
      lower.includes('decedent') ||
      lower.includes('portrait') ||
      lower.includes('profile') ||
      lower.includes('og:image')
    ) return 'portrait';
    return 'unknown';
  };

  const images = [];
  const seen = new Set();
  const addImage = (url, context, alt = '', caption = '') => {
    const absolute = absoluteUrl(url);
    if (!absolute || seen.has(absolute)) return;
    if (rejectImage(absolute, `${context} ${alt} ${caption}`)) return;
    seen.add(absolute);
    const kindGuess = classifyImage(absolute, `${context} ${alt} ${caption}`);
    images.push({
      url: absolute,
      kindGuess,
      confidence: kindGuess === 'portrait' ? 'moderate' : 'low',
      alt: alt || null,
      caption: caption || null,
      sourceContext: context
    });
  };

  addImage(meta('og:image'), 'og:image');
  addImage(meta('twitter:image'), 'twitter:image');

  for (const img of document.querySelectorAll('img')) {
    const candidates = [
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.getAttribute('data-lazy-src'),
      img.getAttribute('data-original')
    ];

    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    for (const part of srcset.split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      if (candidate) candidates.push(candidate);
    }

    const alt = clean(img.getAttribute('alt') || img.getAttribute('aria-label') || '');
    const figcaption = clean(img.closest('figure')?.querySelector('figcaption')?.innerText || '');
    const className = clean(img.getAttribute('class') || '');
    for (const candidate of candidates) {
      addImage(candidate, `img${className ? `.${className}` : ''}`, alt, figcaption);
    }
  }

  for (const el of document.querySelectorAll('[style*="background"]')) {
    const style = el.getAttribute('style') || '';
    for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
      addImage(match[2], 'inline background-image', clean(el.innerText || ''));
    }
  }

  const title = clean(meta('og:title') || document.querySelector('h1')?.innerText || document.title);
  const description = clean(meta('description') || meta('og:description'));
  const isObitsListing =
    /\/obits\/?$/.test(window.location.pathname) ||
    /^recent obituaries\b/i.test(title) ||
    document.body.innerText.includes('Showing 1 to 10 of');

  if (isObitsListing) {
    return {
      site: 'clinehanson-tukios',
      url: window.location.href,
      obituaryId: null,
      title,
      description,
      obituaryText: '',
      images: [],
      redirectedToListing: true,
      notes: [
        'Browser landed on the obituary listing page, not an individual obituary. Do not use listing-page images as evidence for the target person.'
      ]
    };
  }

  const article =
    document.querySelector('article') ||
    Array.from(document.querySelectorAll('main, [role="main"], div, section'))
      .find((el) => /obituary|tribute|life story|life-story/i.test(el.getAttribute('class') || '') && clean(el.innerText).length > 200);
  const obituaryText = clean(article?.innerText || document.body.innerText);

  const obituaryId =
    window.location.pathname.match(/\/obituary\/([^/?#]+)/)?.[1] ||
    window.location.href.match(/user_id=(\d+)/)?.[1] ||
    null;

  return {
    site: 'clinehanson-tukios',
    url: window.location.href,
    obituaryId,
    title,
    description,
    obituaryText,
    images,
    notes: images.length === 0
      ? ['No image candidates found in browser-rendered page. Review page visually before marking no portrait.']
      : []
  };
}
*/

// =============================================================================
// FUNCTION: getWidgetConfig
// Run on: https://www.clinehansonfuneralhome.com/obits
// Returns: Tukios API config needed for older redirected obituary URLs
// =============================================================================

/*
() => {
  const widget = document.querySelector('.tukios_widget');
  if (!widget) {
    return {
      error: 'widget_not_found',
      url: window.location.href
    };
  }
  return {
    token: widget.getAttribute('data-token') || null,
    organizationId: widget.getAttribute('data-organization-id') || null,
    format: widget.getAttribute('data-format') || null,
    apiExample: 'https://websites.tukios.com/api/widget/obituary?per_page=100&page=1&q=Fannin',
    requiredHeaders: [
      'Authorization: Bearer <token>',
      'X-Organization-Id: <organizationId>'
    ],
    url: window.location.href
  };
}
*/
