# Handover — 2026-03-29

## What Was Done

### Added Vitest Unit Test Suite (102 tests)

Identified that the toolkit had zero test coverage despite complex parsing logic in `build-data.ts` (640 lines) and `validate_vault.ts` (888 lines). Set up Vitest and wrote comprehensive tests.

**Setup:**
- Installed `vitest` as dev dependency
- Created `site/vitest.config.ts`
- Added `npm run test` (single run) and `npm run test:watch` (watch mode) scripts

**Refactored for testability:**
- Extracted 14 pure functions from `build-data.ts` into `site/scripts/lib/build-helpers.ts`
- Extracted constants, 3 helper functions, and 3 validation checkers from `validate_vault.ts` into `site/scripts/lib/validate-helpers.ts`
- Both original scripts now import from these modules (no behavior change)

**Test coverage (102 tests across 2 files):**
- `site/scripts/__tests__/build-helpers.test.ts` — formatDate, slugify, extractIdFromParens, extractWikilink, extractNameFromWikilink, extractNameFromText, parseVitalTable, extractBiography, parseChildren, parseSpouse, parseParent, inferMediaType, extractSection, extractFullText
- `site/scripts/__tests__/validate-helpers.test.ts` — SOURCE_ID_PATTERN, GEDCOM_ID_PATTERN, isRecognizedVitalField, parseVitalTableTuples, splitByComma, checkBidirectionalRelationships, crossReferenceCheck, checkUnprocessedMedia

**Also fixed 3 pre-existing type errors in build-data.ts:**
- `SourceEntry` interface missing `ocrVerified`, `media`, `_mediaRefs` fields
- `PersonData` interface missing `_mediaRefs` field
- `parseChildren` return type missing `spouseIndex`
- Removed unsafe `as any` casts in favor of proper typed access

## Commits

- `6b84109` — Add Vitest unit tests for build and validation parsing logic

## Improvements Backlog

A prioritized list of 15 improvements was identified and saved to Claude memory. Item #1 (this session's work) is complete. Next highest priorities:
- #2: Add React error boundaries
- #3: Fix orphaned sources being warnings instead of errors (contradicts METHODOLOGY.md)
- #4: Complete privacy redaction

## State

- All 102 tests passing
- TypeScript type-checks clean on all scripts
- Pushed to `master`
