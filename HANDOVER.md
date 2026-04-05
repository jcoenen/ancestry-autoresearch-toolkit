# Handover — 2026-04-04

## What Was Done

### Session 20: Cemetery Browser + FamilyDirectory Advanced Filters

**Cemetery Browser (`site/src/pages/CemeteryBrowserPage.tsx`) — new page at `/cemeteries`:**
- Left panel: all unique burial places from person data, sorted by person count, with count badge. "📍 geocoded" label when coordinates exist in the geocode cache.
- Right panel: all people buried at the selected cemetery, sorted by birth year. Each card shows photo thumbnail (or ✝ cross placeholder if no media), name, birth–death years, family line, and links to profile page.
- "View on map" button links to OpenStreetMap at the geocoded coordinates when available.
- Family filter (`FamilyFilterDropdown`) + cemetery name search input at top.
- Data is aggregated client-side from `site-data.json` — no build changes needed.
- Added to Research nav dropdown (after Immigration Stories).

**FamilyDirectory advanced filters (`site/src/pages/FamilyDirectory.tsx`):**
- Confidence toggle pills: color-coded (emerald = high, amber = moderate/medium, red = low, stone = stub/speculative), dynamically derived from the actual data. Empty selection = show all; selecting pills filters to only those levels. "clear" link resets.
- Birth year range: "Born: [from] – [to]" number inputs. People with unknown birth years always pass the filter regardless of range.
- "X of N shown" count appears in the filter row when any advanced filter is active.
- Existing name+birthplace+family text search and family dropdown unchanged.

**State:** 194 tests passing, TypeScript clean, pushed to `master` as `1676994`

### Session 19: Nav Reorganization + 6 UX Improvements

**Nav restructure (`Nav.tsx`):**
- Replaced the single "Explore" catch-all dropdown with two focused dropdowns
- **Visualize** ▾: Timeline, Family Map, Statistics, On This Day
- **Research** ▾: Sources, Report, Immigration Stories, Research Gaps, What's New, Features Guide
- Top-level links: Home | Family Tree | People | Gallery (removed Report and Sources from top bar)
- Opening one dropdown now auto-closes the other (mutual exclusion)
- Extracted `ChevronIcon` component to avoid duplicating the SVG
- Mobile menu updated with two labeled sections matching the desktop dropdowns

**Stats drill-down (`StatsPage.tsx` + `FamilyDirectory.tsx`):**
- First names, birthplaces, occupations, immigration, and military bars are now clickable links
- Links go to `/people?search=<value>`, pre-populating the directory search
- Confidence level badges (high/moderate/low/stub) link to `/research-gaps`
- `FamilyDirectory.tsx` updated to read `?search=` URL param and pre-fill the search box

**Research Gaps family filter (`ResearchGapsPage.tsx`):**
- Added `FamilyFilterDropdown` in the header toolbar (single-select mode)
- All gap lists, the priority targets table, and the completeness score filter to the selected family

**Timeline: immigration + military events (`TimelinePage.tsx`):**
- Added `'immigration'` (amber) and `'military'` (slate) event types
- Year is extracted from the field string via `extractYear` (same as other date fields)
- Both types are on by default with toggle buttons in the filter bar
- `flex-wrap` added to the filter buttons row to handle the wider set

**Immigration page auto-linking (`ImmigrationPage.tsx`):**
- Added `autolinkPeople()` function that pre-processes the markdown body
- Replaces full person names (≥5 chars) with `[Name](/people/slug)` links
- Matches longest names first to avoid partial matches
- Skips headings, blockquotes, and lines already containing markdown links

**PersonPage: data completeness card + mini tree (`PersonPage.tsx`):**
- `CompletenessCard`: shows 7 fields (born, birthplace, died, father, mother, sources, biography) as green/red chips with an overall % score — hidden when 100% complete; print-hidden
- `MiniTree`: compact visual showing parents → person (amber highlight) → children; all entries are clickable profile links; handles missing parents gracefully; print-hidden
- Both inserted between the header and Vital Information section, non-private people only
- Added `extractYear` to the PersonPage imports

**State:** 194 tests passing, TypeScript clean, pushed to `master` as `3b31d78`

### Session 18: Family Map + Features Guide + Geocoding Pipeline

**Family Map page (`/map`):**
- Full-screen Leaflet map with OpenStreetMap tiles (no API key needed)
- 7 event types: birth (green), death (red), marriage (purple), burial (gray), residence (blue), immigration (amber), emigration (teal) — each with color-coded circle markers
- Marker clustering via `leaflet.markercluster` — world-to-street zoom with spiderfy at max zoom
- Click any marker for popup with person name, event type badge, date, location, and profile link
- Migration path arcs — dashed curved polylines from birthplace to deathPlace, color-coded by family line (22 paths in fixture data). Toggle via checkbox
- Time period slider — dual-range input filtering events by year range (1795-2020)
- Time animation — Play/Pause/Reset advancing through decades at 10-year intervals. Large year indicator overlay. Event counts update live
- Heat map mode via `leaflet.heat` — toggle between marker and heat map views
- Desktop sidebar filter panel (240px) + mobile collapsible filter button
- Family line filter (reuses `FamilyFilterDropdown` component)
- Auto-fit map bounds on filter changes
- `isolate` CSS on MapContainer to scope Leaflet z-indexes (prevents nav dropdown overlap)

**Geocoding pipeline (build-data.ts):**
- New `geocodeLocations()` function collects all unique location strings from person data
- Calls Nominatim API (free, no key) for uncached locations, rate-limited to 1 req/sec
- Results cached in `site/src/data/geocode-cache.json` (committed to git, manually editable for corrections)
- `geocodedLocations: Record<string, [number, number] | null>` added to `SiteData` type and `site-data.json` output
- Fixture data includes hardcoded coordinates for 19 locations (Wisconsin cities, Netherlands regions, Ireland, France, cemeteries)

**Features Guide page (`/features`):**
- Comprehensive documentation of all 12 site features with descriptions and detailed bullet points
- Quick navigation bar at the top to jump to any feature section
- Each feature has an "Open" button linking to that page
- Bold labels on detail items (e.g., **Ancestors** — description)
- Technical Details section with "Built With" and "Data Pipeline" columns
- Links to GitHub and home

**Other changes:**
- README.md updated with Family Map feature description and Leaflet in tech stack
- `.gitignore` updated to exclude `.playwright-mcp/` and `.vite/` directories
- New type declaration `leaflet-heat.d.ts` for the `leaflet.heat` module
- `useGeocodedLocations()` hook added to `useData.ts`
- Nav Explore dropdown: added "Family Map" (after Timeline) and "Features Guide" (at bottom)

**Dependencies added:** `leaflet`, `react-leaflet`, `leaflet.markercluster`, `leaflet.heat`, `@types/leaflet`, `@types/leaflet.markercluster`

Commit: `9191885`

### Session 17: Children Slide-Out for Full Pedigree + Persistent Fixture Data

**Children slide-out on Full Pedigree (Dagre) view:**
- `VCoupleCardNode` in `VerticalTreePrototypes.tsx` now shows a "Children (N)" button at the bottom of each card that has children
- Clicking it opens an absolutely-positioned panel to the right of the card listing all children with tree-line characters, profile links, and birth/death years
- Panel has a close button and doesn't affect the Dagre layout since it's positioned as an overlay

**Persistent fixture data (solves recurring "lost test data" problem):**
- Created `site/src/data/fixture-data.json` (committed to git) with 38 people across 6 generations — Dutch (Coenen, Bakker, Visser, Janssen), German (Schmidt, Weber), and Irish (O'Brien, Connolly) family lines
- Multiple children per couple (2-4 each) to properly exercise tree features
- Root person is Willem Coenen (I1, b.1920), both paternal and maternal lines go back to ~1795
- Added `predev` npm script that auto-copies fixture to `site-data.json` when it's missing — no more manual data recreation each session

**Test fixes (6 pre-existing failures):**
- Updated `ALLOWED_CONFIDENCE` test to include `'speculative'` (added in commit `2541ff1`)
- Fixed `checkBidirectionalRelationships` tests: renamed `fatherLink`/`motherLink`/`childLinks`/`spouseLinks` to `fatherId`/`motherId`/`childIds`/`spouseIds` and switched from file-path values to gedcom IDs to match the current `PersonRelationships` interface

Commit: `133771e`

### Session 16: Gallery Lightbox with Swipe Navigation

Replaced the new-tab image viewing pattern with an in-page lightbox overlay. Previously, clicking any gallery image opened it in a new browser tab — on mobile, navigating back always reset scroll to the top, making it painful to browse through many images.

**New files:**
- `site/src/hooks/useSwipe.ts` — Touch swipe detection hook (left/right, 50px threshold)
- `site/src/hooks/useLightbox.ts` — State management: open/close/prev/next, iOS-safe scroll lock
- `site/src/components/Lightbox.tsx` — Full-screen overlay via React portal with keyboard nav, mobile swipe, metadata bar, adjacent image preloading

**Modified pages (all 3 that display images):**
- `MediaGallery.tsx` — Lightbox operates on the filtered image set (respects type/family filters)
- `PersonPage.tsx` — Lightbox on person's media section
- `SourceDetailPage.tsx` — Lightbox for images only; PDFs/documents still open in new tab

**Features:** Arrow key navigation, Escape to close, click backdrop to close, swipe left/right on mobile, loading spinner, "Open original" link, image counter, person/description/type metadata bar. Zero new dependencies — built with React + Tailwind only.

Also generated sample `site-data.json` + placeholder images in `media/sample/` for local testing (both gitignored).

Commit: `4dc0315`

**Pre-existing test failures:** 5 tests in `validate-helpers.test.ts` fail due to `person.childIds` not being iterable — unrelated to this change, present on clean master.

### Session 15: METHODOLOGY.md Token Optimization

Reduced METHODOLOGY.md from 352 → 275 lines (~22%) to cut per-session token costs. Changes:

- Removed Vault Architecture directory tree (discoverable from filesystem)
- Merged FaG Memorial Mining Protocol + Web Source Acquisition Protocol into single "Source Acquisition Protocol" with FaG-specific note
- Moved YAML inline comments to prose list below the code block (kept `persons:` comment — agents get that wrong)
- Compressed Change Routing from 25-line table to 5-line summary
- Compressed Persons Array Resolution and Multi-Part Clipping Assembly sections
- Removed duplicate Commit Rules (already in global CLAUDE.md)
- Removed Family Unit Completeness meta-commentary paragraph
- **Preserved intact:** Confidence Rules emphasis paragraphs, Vital Information field name table, all CRITICAL-tagged rules

### Session 14: Media Linking Rule Documented

An agent using the toolkit repeatedly linked images only in source files, missing the person file `media:` array, causing images not to render on the site. Added the rule explicitly to METHODOLOGY.md in three places:

1. **New "Linking (CRITICAL)" subsection** under Media Rules — states images need all three entries: source file `media:`, person file `media:`, and `_Media_Index.md`. Notes that `build:data` must run after any media changes.
2. **FaG Mining Protocol step 6** — added inline note to also populate person file `media:` arrays.
3. **Web Source Acquisition Protocol step 4** — merged person file requirement into the existing step.

Commit: `d5906f9`

### Session 13: Footer GitHub Link

Added a link to the GitHub project (`jcoenen/ancestry-autoresearch-toolkit`) in the site footer so visitors can find and use the toolkit themselves. Shows as "Built with ancestry-autoresearch-toolkit" below the researcher credit line.

### Session 12: Methodology Hardening & Persons Array Validation

Driven by real-world agent testing that exposed gaps — an agent skipped 7 of 9 children as "too lateral" and missed a portrait from a funeral home page.

#### METHODOLOGY.md Changes
1. **`persons:` array definition tightened** — Changed from "EVERY person named in the document" to "every genealogically relevant person" with explicit exclusions for incidental names (officiants, pallbearers). Makes the array an enforceable contract.
2. **Family Unit Completeness rule (CRITICAL)** — New subsection explicitly requiring ALL named children get person files with parent wikilinks. Covers biological, step, and multi-marriage children. Called out as the #1 thing agents skip.
3. **Web Source Acquisition Protocol** — New section covering all non-FaG web sources (funeral homes, newspaper archives, historical societies). Requires downloading all images, not just text.
4. **Persons Array Resolution docs** — Documents the new validation check.

#### Validation Script Changes (`validate_vault.ts`)
- New "Persons Array Resolution" check: cross-references every name in every source's `persons:` array against existing person files (case-insensitive match on `name` field)
- Unmatched names flagged as **warnings** (visible but non-blocking)
- Catches the failure mode where a source lists 30 people but only 5 get person files

### Session 11: TypeScript Fixes, Expanding Children, Pre-commit Hook

#### TypeScript Fixes
- Fixed `Fuse.FuseResultMatch` namespace import in `useSearch.ts` — changed to named import `FuseResultMatch` from `fuse.js` (lines 28, 146, 174)
- Fixed unsafe `e.target as Node` cast in `VerticalTreePrototypes.tsx` — replaced with `target instanceof Node` type guard

#### Expanding Children Restored
Added collapsible "Children (N)" accordion section to VCard in the Ancestors tree view:
- Collapsed by default, click to expand list with tree connectors
- Each child links to their profile page
- Works on both the focus card and all ancestor couple cards
- Resolves children from both father/mother back-links in the data

#### Card Width Fix
- Widened VCard from 190px to 220px
- Removed `truncate` CSS from name elements so long names wrap instead of being cut off with "..."
- Applied to both VCard (Ancestors view) and VCoupleCardNode (Full Pedigree dagre view)

#### Pre-commit Hook
- Added `.git/hooks/pre-commit` that runs `tsc --noEmit` before every commit
- Blocks commits with TypeScript errors
- Note: lives in `.git/hooks/` (not tracked by git), local to this machine only

### Session 10: Vertical Tree Redesign

Replaced the entire family tree page with a new vertical tree system. The old horizontal landscape/pedigree/descendant views are gone (still in git history at `528a1d6~1`).

#### New Tree Views (`VerticalTreePrototypes.tsx`)

Four view modes, all accessible via `/tree/:personId?`:

1. **Ancestors** — Vertical expanding tree. Focus person at top, ancestors expand downward on click (chevron buttons). Auto-expands 2 generations. Pure CSS flexbox with natural vertical scrolling. Works well on mobile.

2. **Full Pedigree** — Dagre layout with `rankdir: 'TB'` (top-to-bottom). All ancestors visible at once. React Flow canvas with zoom/pan. Blue edges = paternal, pink = maternal.

3. **Navigator** — Always fits on screen. Shows grandparents, parents, focus person, and children in centered rows. Click any card to re-center the view on that person. Small arrow icon in card corner links to person's profile page.

4. **Descendants** — Collapsible indented tree showing all descendants of the focused person. Auto-expands 3 levels. Works for any person (not just patrilineal root like before).

#### Person Selector

Searchable dropdown in the page header for picking the focus person:
- Shows current person with avatar, years, birthplace
- Click to open dropdown with type-to-search filtering
- Filter by name or family surname
- Enter key selects when one result remains, Escape closes
- "Back to root" button with home icon next to selector

#### Card Design

Compact `VCard` component (220px default) with:
- Gender-colored avatar circles (blue/pink)
- Name + birth-death years
- Spouse shown below divider when present
- Two modes: link mode (name links to profile) and navigation mode (whole card clickable, small profile icon in corner)

#### Connector Lines

Pure CSS vertical tree connectors:
- `VStem` — vertical line segments
- `VFork` — splits into two branches using border-based half-width connectors

#### Files Created
- `site/src/pages/VerticalTreePrototypes.tsx` — all 4 views, person selector, shared components, `buildGenderMap` (moved here)

#### Files Deleted
- `site/src/pages/TreeView.tsx` — old horizontal landscape/pedigree/descendant (1016 lines)
- `site/src/pages/TreeTestPage.tsx` — React Flow test page (422 lines)
- `site/src/pages/FullLandscapePage.tsx` — full landscape test page (36 lines)
- `site/src/pages/FullVerticalPage.tsx` — intermediate prototype (removed during cleanup)

#### Files Modified
- `site/src/App.tsx` — routes cleaned up, `/tree` serves new vertical tree
- `site/src/pages/PersonPage.tsx` — `buildGenderMap` import updated

### Backlog Update

- **#16 (Cross-vault linking)** — DROPPED. Not worth the complexity; just duplicate overlapping people in each vault.
- **All 17 items now done or dropped.** Backlog is fully cleared.

## Commits

- `3989f29` — Reduce METHODOLOGY.md token footprint by 22%
- `2af72e6` — Add GitHub project link to site footer
- `ac1f12a` — Add methodology safeguards and validation for person file completeness
- `b432f8d` — Widen tree cards and allow name wrapping to prevent truncation
- `1b6d610` — Fix TypeScript errors and restore expandable children in ancestor tree
- `528a1d6` — Replace horizontal tree views with vertical tree system

## Previous Sessions

See git history for sessions 1-9. Key prior commits:
- `1cc7890` — Actionable research gaps + translation workflow
- `55fc9ad` — Smart media uploader with SHA-256 diffing
- `577371f` — Interactive project initialization wizard
- `88e6d89` — Global full-text search
- `7c08029` — Complete privacy redaction
- `69cfd67` — GEDCOM import + date parsing consistency
- `918169c` — Error boundaries, GEDCOM export, gender field, On This Day expansion

## State

- 194 tests passing
- TypeScript type-checks clean
- Pushed to `master`
- Dummy `site-data.json` in `site/src/data/` for local dev (gitignored)
