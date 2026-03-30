# Handover — 2026-03-30

## What Was Done

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
