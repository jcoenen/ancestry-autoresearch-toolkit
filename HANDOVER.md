# Handover — 2026-03-29

## What Was Done

### Session 5: Complete Privacy Redaction (#5)

Implemented full privacy redaction so `privacy: true` people have their personal details stripped from `site-data.json` at build time, while preserving their name and family structure in the tree.

#### Design

- **Always visible:** name, gender, family, confidence, slug, father/mother links, spouse links (names/IDs), children links
- **Redacted from published JSON:** all dates, places, vitals, biography, birth date analysis, sources, media, marriage dates
- **Cross-spouse protection:** marriage dates blanked on public people married to private people
- **Global media filtering:** media items exclusively associated with private people excluded from published media array

#### Build Pipeline (`build-data.ts`)

- Blanked 6 previously leaking fields: `religion`, `occupation`, `nickname`, `education`, `residence`, `familySearchId`
- Blanked `sources` (was shipping full array) and `_mediaRefs` (was resolving media) for private people
- Added marriage date blanking on private people's own spouse records
- Added `redactCrossSpouseMarriageDates()` post-processing pass
- Filtered global media array — private-only media excluded, shared media kept
- Stats use filtered media count

#### GEDCOM Export (`export-gedcom.ts`)

- Private people now get minimal INDI records (name + sex + `RESN confidential` + FAMC/FAMS links) instead of being skipped entirely — fixes GEDCOM validity for downstream software
- Marriage/divorce events suppressed on FAM records where either spouse is private
- INDI count now includes all people

#### UI Defense-in-Depth (`PersonPage.tsx`, `HomePage.tsx`)

- Privacy notice banner on PersonPage for private people
- Explicit `!person.privacy` guards on biography, birth date analysis, sources, and media sections
- HomePage birthplace display guarded

#### Testable Helpers (`build-helpers.ts`)

- Extracted `applyPrivacyRedaction()` — blanks all personal detail fields, sources, media, marriage dates
- Extracted `redactCrossSpouseMarriageDates()` — cross-spouse marriage date blanking
- 9 new tests in `privacy-redaction.test.ts`

### Session 4: GEDCOM Import (#6) + Date Parsing Fix (#14)

#### GEDCOM Import

Created `site/scripts/import-gedcom.ts` — a full GEDCOM 5.5.1 parser that generates person markdown files matching the vault template format.

**Features:**
- Parses INDI, FAM records with full field coverage
- Generates frontmatter (name, born, died, family, gender, gedcom_id, confidence: stub)
- Builds vital info tables with wikilinked parents, spouses (with marriage dates/places), children
- Handles all 20+ vital fields: burial, cremation, baptism, christening, immigration, emigration, naturalization, military, occupation, education, religion, residence, nickname, FamilySearch ID, cause of death, divorce
- Reassembles CONT/CONC biography text from NOTE records
- Multiple spouses with ordinal labels (1st, 2nd, etc.) and per-marriage children groups
- Skips existing files (safe to re-run)
- `--dry-run` flag to preview without writing
- `--out-dir` flag to override output directory
- Run: `npm run import:gedcom <file.ged>`

#### Date Parsing Consistency (#14)

All date parsers now support 3 formats consistently: ISO (`YYYY-MM-DD`), `"Month DD, YYYY"`, `"DD Month YYYY"`.

| Function | Before | After |
|---|---|---|
| `parseFullDate()` | ISO only | All 3 formats |
| `parseMarriageDate()` | "Month DD, YYYY" only | All 3 formats + location extraction |
| `toGedcomDate()` | ISO + "Month DD, YYYY" | All 3 formats |
| Marriage date regex in FAM export | "Month DD, YYYY" only | All 3 formats |

### Session 3: Batch Improvements (#3, #4, #6, #7, #8, #10) + GEDCOM Field Expansion

Completed 6 items from the improvements backlog, then expanded GEDCOM coverage with 8 additional fields.

#### Backlog Items Completed

| # | Item | What Changed |
|---|---|---|
| 3 | React error boundaries | Created `ErrorBoundary` class component. Top-level boundary wraps all routes; page-level on PersonPage and TreeView with custom fallback titles. |
| 4 | Orphaned sources → errors | `crossReferenceCheck` now emits errors. `validate_vault.ts` counts toward `totalErrors` and exits(1). Matches METHODOLOGY.md. Updated test. |
| 6 | GEDCOM export | New `scripts/export-gedcom.ts` — GEDCOM 5.5.1 with INDI, FAM, SOUR, OBJE records. Run via `npm run export:gedcom`. |
| 7 | Explicit gender field | Added `gender: M \| F` to person template, types, build-data. `buildGenderMap()` prefers explicit gender over structural inference. |
| 8 | On This Day expanded | 11 event types (was 3). New `parseDateFromText()` for freeform vital fields. Each type has distinct color and emoji. |
| 10 | Atomic writes | Build writes to `.site-data.json.tmp` then `renameSync()` to final path. |

#### GEDCOM Field Expansion

Promoted 6 supplemental vital fields to parsed + added 2 new ones:

| Field | Person property | GEDCOM tag |
|---|---|---|
| Baptized | `baptized` | `BAPM` |
| Christened | `christened` | `CHR` |
| Nickname / Also Known As | `nickname` | `NICK` |
| Education | `education` | `EDUC` |
| Residence | `residence` | `RESI` |
| FamilySearch ID | `familySearchId` | `REFN` (type: FamilySearch) |
| Divorce | `divorce` | `DIV` (on FAM record) |
| Cremation | `cremation` | `CREM` |

## Files Modified/Created (Session 5)

**New files:**
- `site/scripts/__tests__/privacy-redaction.test.ts` — 9 tests for privacy redaction helpers

**Modified files:**
- `site/scripts/build-data.ts` — Complete build-time privacy redaction + media filtering
- `site/scripts/export-gedcom.ts` — Minimal INDI for private people, FAM privacy suppression
- `site/scripts/lib/build-helpers.ts` — `applyPrivacyRedaction()` and `redactCrossSpouseMarriageDates()`
- `site/src/pages/PersonPage.tsx` — Privacy notice banner + section guards
- `site/src/pages/HomePage.tsx` — Birthplace privacy guard

## Commits

- `7c08029` — Complete privacy redaction for private people across build pipeline, GEDCOM export, and UI
- `69cfd67` — Add GEDCOM import and fix date parsing consistency across all parsers
- `918169c` — Add error boundaries, GEDCOM export, gender field, expanded On This Day, atomic writes, and orphaned source enforcement

## Improvements Backlog Status

**Done:** #1, #2, #3, #4, #5, #6 (export + import), #7, #8, #10, #14
**Remaining:** #9 (media upload pipeline), #11 (incremental builds), #12 (actionable research gaps), #13 (full-text search), #15 (translation workflow), #16 (cross-vault linking), #17 (onboarding/init)

## State

- All 177 tests passing
- TypeScript type-checks clean
- Pushed to `master`
