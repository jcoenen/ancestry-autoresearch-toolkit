# Handover — 2026-03-29

## What Was Done

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

GEDCOM export also includes: `causeOfDeath` (CAUS), `confirmation` (CONF), source records (SOUR with TITL/PUBL/DATE/QUAY), media objects (OBJE with FORM/FILE/TITL), biography (NOTE with CONT/CONC line splitting).

### Files Modified/Created

**New files:**
- `site/scripts/export-gedcom.ts` — GEDCOM 5.5.1 export script
- `site/src/components/ErrorBoundary.tsx` — React error boundary component

**Modified files (11):**
- `site/package.json` — Added `export:gedcom` script
- `site/scripts/build-data.ts` — Gender + 8 new fields parsing, atomic writes
- `site/scripts/lib/validate-helpers.ts` — Promoted supplemental fields to core, added Divorce/Cremation, orphaned sources → errors
- `site/scripts/validate_vault.ts` — Cross-reference section uses errors
- `site/scripts/__tests__/validate-helpers.test.ts` — Updated orphaned source test
- `site/src/types.ts` — 9 new fields on Person (gender + 8 vital)
- `site/src/App.tsx` — ErrorBoundary wrapping
- `site/src/onThisDayEvents.ts` — 11 event types, parseDateFromText, full month names
- `site/src/pages/OnThisDayPage.tsx` — Icons for all event types
- `site/src/pages/TreeView.tsx` — buildGenderMap prefers explicit gender
- `templates/person.md` — Gender in frontmatter, all vital fields in table

## Commits

- `918169c` — Add error boundaries, GEDCOM export, gender field, expanded On This Day, atomic writes, and orphaned source enforcement

## Improvements Backlog Status

**Done:** #1, #2, #3, #4, #6 (export only), #7, #8, #10
**Remaining:** #5 (privacy redaction), #6 (GEDCOM import), #9 (media upload pipeline), #11-17

## State

- All 104 tests passing
- TypeScript type-checks clean
- Pushed to `master`
