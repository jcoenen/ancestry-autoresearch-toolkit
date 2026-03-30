# Handover — 2026-03-30

## What Was Done

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

Compact `VCard` component (190px default) with:
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
