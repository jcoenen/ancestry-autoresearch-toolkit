/**
 * Standalone geocoding script — run once to populate geocode-cache.json.
 * Build never hits the network; this script does all the API work.
 *
 * Usage:
 *   npm run geocode
 *
 * Reads all unique location strings from the vault, geocodes any not yet in
 * the cache via Nominatim (free, no key required), and writes the cache.
 * Safe to re-run — skips already-cached entries.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import { parseVitalTable } from './lib/build-helpers.js';

const ROOT = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(import.meta.dirname, '..', '..');

const PEOPLE_DIR = resolve(ROOT, 'people');
const GEOCODE_CACHE = resolve(import.meta.dirname, '..', 'src', 'data', 'geocode-cache.json');

// Strings that look like partial dates, not places
const DATE_RE = /^-?\d{1,4}(-\d{2}(-\d{2})?)?$/;

function collectLocations(): Set<string> {
  const locations = new Set<string>();
  const files = glob.sync('**/*.md', { cwd: PEOPLE_DIR, absolute: true });

  for (const file of files) {
    const raw = readFileSync(file, 'utf-8');
    const { content } = matter(raw);
    const vitals = parseVitalTable(content);

    for (const key of ['birthplace', 'death_place', 'burial', 'residence', 'immigration', 'emigration']) {
      const val = vitals[key];
      if (val && typeof val === 'string' && val.trim() && !DATE_RE.test(val.trim())) {
        locations.add(val.trim());
      }
    }
  }

  return locations;
}

async function geocode(loc: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ancestry-toolkit/1.0 (personal genealogy project)' },
  });

  if (!res.ok) {
    console.warn(`  ${loc} -> HTTP ${res.status}`);
    return null;
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    console.warn(`  ${loc} -> non-JSON response (${ct})`);
    return null;
  }

  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  }
  return null;
}

async function main() {
  console.log(`Vault: ${ROOT}`);

  // Load existing cache
  let cache: Record<string, [number, number] | null> = {};
  try {
    cache = JSON.parse(readFileSync(GEOCODE_CACHE, 'utf-8'));
    console.log(`Loaded cache: ${Object.keys(cache).length} entries`);
  } catch {
    console.log('No existing cache — starting fresh');
  }

  const locations = collectLocations();
  const uncached = Array.from(locations).filter(loc => !(loc in cache));

  console.log(`\nLocations in vault: ${locations.size}`);
  console.log(`Already cached:     ${locations.size - uncached.length}`);
  console.log(`To geocode:         ${uncached.length}`);

  if (uncached.length === 0) {
    console.log('\nAll locations cached. Nothing to do.');
    return;
  }

  console.log(`\nGeocoding ${uncached.length} locations (Nominatim, 1 req/sec)...\n`);

  let found = 0;
  let notFound = 0;

  for (let i = 0; i < uncached.length; i++) {
    const loc = uncached[i];
    const coords = await geocode(loc);
    cache[loc] = coords;

    if (coords) {
      found++;
      console.log(`  [${i + 1}/${uncached.length}] ${loc} -> [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}]`);
    } else {
      notFound++;
      // warning already printed in geocode()
    }

    // Nominatim policy: max 1 request per second
    if (i < uncached.length - 1) {
      await new Promise(r => setTimeout(r, 1100));
    }
  }

  writeFileSync(GEOCODE_CACHE, JSON.stringify(cache, null, 2));
  console.log(`\nDone. Found: ${found}, not found: ${notFound}`);
  console.log(`Cache written: ${relative(process.cwd(), GEOCODE_CACHE)}`);
  console.log('\nCommit geocode-cache.json to git so builds stay fast.');
}

main().catch(err => {
  console.error('Geocode failed:', err);
  process.exit(1);
});
