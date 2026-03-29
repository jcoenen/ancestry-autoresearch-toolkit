# Handover — 2026-03-29

## What Was Done

### Added 6 New Core Vital Info Fields

Expanded the vital information system with fields commonly found in genealogical records. All 6 are now core parsed fields — extracted from markdown vital tables, included in site-data.json, displayed on PersonPage, and (where appropriate) charted on StatsPage.

**New core fields:**
| Field | Display Position | StatsPage |
|---|---|---|
| Military | After Occupation | Bar chart with count |
| Immigration | After Military | Bar chart with count |
| Emigration | After Immigration | — |
| Naturalization | After Emigration | — |
| Cause of Death | After Death Place, before Burial | — |
| Confirmation | After Religion | — |

**Files modified (7):**
- `scripts/lib/validate-helpers.ts` — Added Military, Immigration, Emigration, Naturalization, Cause of Death, Confirmation to core recognized fields; promoted Immigration and Cause of Death from supplemental
- `src/types.ts` — Added 6 fields to Person interface
- `scripts/build-data.ts` — Added 6 fields to PersonData interface + extraction from vitals (all privacy-respecting)
- `src/pages/PersonPage.tsx` — Added VitalRow entries grouped logically (death info, religion, life, migration)
- `src/pages/StatsPage.tsx` — Added Immigration and Military Service bar chart sections
- `scripts/__tests__/build-helpers.test.ts` — Added vital table parsing tests for all new fields
- `scripts/__tests__/validate-helpers.test.ts` — Updated recognized field tests

All fields are free-text and privacy-respecting (redacted when `privacy: true`).

## Commits

- `6d16093` — Add 6 new core vital info fields: Military, Immigration, Emigration, Naturalization, Cause of Death, Confirmation

## Improvements Backlog Status

Backlog item #6 (explicit gender YAML field) was discussed but deferred — it touches YAML frontmatter and the relationship calculator rather than the vital info table, making it a separate piece of work.

## State

- All 104 tests passing
- TypeScript type-checks clean
- Pushed to `master`
