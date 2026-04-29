# Genealogy Vault Methodology

Shared rules and processes for all genealogy vault projects using the genealogy-toolkit. These rules are referenced by each project's CLAUDE.md and enforced by the validation scripts.

## Source File Rules (CRITICAL)

Every source file in `sources/` (excluding `_Source_Index.md`) MUST have these YAML frontmatter fields:

### Required Frontmatter

```yaml
---
source_id: SRC-{TYPE}-{NNN}
type: source
source_type: obituary
title: "Obituary of [Person Name]"
date_of_document: 2000-03-28
date_accessed: 2026-03-19
url: "https://..."
publisher: "Newspaper Name, City State"
persons:                        # Every genealogically relevant person: family
                                # members, spouses, children, siblings, in-laws.
                                # Exclude incidental names (officiants, pallbearers,
                                # funeral directors) UNLESS they are also family.
                                # Display/extracted text only; not a relational key.
  - Person One
  - Person Two
subject_person_ids:             # Primary subject(s) of this source. Required for obituaries.
  - "I1"                        # Must also appear in person_ids.
person_ids:                     # Relational links to every genealogically relevant person.
  - "I1"                        # Use GEDCOM IDs, never fuzzy/name matching.
  - "I2"
families:
  - Surname1
  - Surname2
reliability: high
media:
  - "gravestones/CEM_Surname_Given_FaG12345.jpg"
  - "newspapers/NEWS_Surname_Given_Paper_2000.jpg"
created: 2026-03-23
tags: [genealogy, source, obituary, Surname1, Surname2]
---
```

- `source_id`: format is `SRC-{TYPE}-{NNN}` (e.g., SRC-OBIT-024, SRC-CEM-017)
- `type`: always `source`
- `source_type`: see Allowed Values below
- `reliability`: `high`, `moderate`, or `low`
- `media`: list EVERY image/scan associated with this source

### Optional Frontmatter Fields

- `language`: document language if not English (e.g., `"German"`). When set with no `translation_slug`, the source appears in "Untranslated Sources" on the Research Gaps page. Run `npm run translations` to create translation stubs.
- `translation_slug`: slug of the `*_ENGLISH.md` translation file
- `ocr_verified`: `false` until OCR'd text manually reviewed (default `true`)
- `memorial_id`: FindAGrave memorial number

### Allowed `source_type` Values

`obituary`, `cemetery_memorial`, `church_record`, `secondary`, `ship_manifest`, `military`, `census`, `family_knowledge`, `certificate`

### Required Body Sections

- `## Full Text` — blockquoted (`>`) original text
- `## Extracted Facts` — markdown table with Fact/Value/Confidence columns
- `## Notes` — research notes and cross-references

### Source ID Assignment

Next available IDs are determined by scanning existing source files:

```bash
npm run next:source-id
```

For one source type, run:

```bash
npm run next:source-id -- --type OBIT
```

Use the reported `Next source ID` value. Do not assign source IDs by hand from `_Source_Index.md` or handoff notes.

### Mandatory Cross-Linking (CRITICAL)

**Every source file MUST be referenced by at least one person file.** When creating a new source file:

1. Create the source file with all extracted facts
2. **IMMEDIATELY** update every person file mentioned in the source:
   - Add the `source_id` to the person's `sources:` YAML array
   - Update any vital information fields that the source provides (birth date, death date, birthplace, etc.) with the source_id as the citation
   - Update the biography section with new information
3. Add every genealogically relevant linked person to the source file's `person_ids:` array
4. Add the primary subject(s) of the source to `subject_person_ids:`. For obituary sources, this is required and drives "has obituary" data-completeness logic.
   - Add the person's `gedcom_id` to the source file's `person_ids:` array when the source has a `persons:` list
3. Run `npm run validate` to verify zero orphaned sources

When adding or importing sources with populated `persons:` arrays, also run:

```bash
npm run validate -- --strict-source-person-ids
```

Legacy vaults may still have historical `persons:` entries without `person_ids:`, but new extractor/import work should treat missing `person_ids:` as incomplete until each genealogically relevant person either has a person file or is removed from `persons:` as incidental.

**A source file without at least one person file referencing it is an incomplete operation.** The validation script catches these as "orphaned sources" — treat orphaned sources as errors, not warnings.

This rule applies to ALL source types: obituaries, census records, certificates, church records, etc.

## Person File Rules

### Required Frontmatter

```yaml
---
type: person
name: "Given Middle Surname"
born: 1942-11-06
died: 2016-04-22
family: "Surname"
gedcom_id: "I2"
privacy: false
confidence: high               # high, moderate, low, stub — see Confidence Rules below
sources:
  - "SRC-OBIT-004"
  - "SRC-OBIT-001"
media: []
created: 2026-03-23
tags: [genealogy, Surname, person]
---
```

### GEDCOM ID Assignment

Do not copy a "next GEDCOM ID" from handoff notes or other manually maintained documents. Person files are the source of truth. Before creating a new person file, run:

```bash
npm run next:gedcom-id
```

### Structured Military Service

Use the Vital Information `Military` row for a readable summary, and use `military_service:` frontmatter for machine-readable branch/conflict/rank/unit data. GEDCOM 5.5.1 does not provide standard branch or conflict subfields, so the toolkit exports each structured entry as a generic `EVEN` with `TYPE Military Service` and preserves the structured details in notes.

```yaml
military_service:
  - branch: "U.S. Army"
    conflict: "World War II"
    role: "Military police"
    rank: ""
    unit: ""
    dates: "1943-1946"
    place: ""
    source: "SRC-OBIT-063"
    confidence: high
    notes: ""
```

Required fields: `branch`, `source`, and `confidence`. Leave unknown optional fields blank rather than guessing. Use `Unknown` only when the source explicitly confirms military service but does not identify the branch or conflict.

Allowed branches are: `U.S. Army`, `U.S. Army Air Forces`, `U.S. Navy`, `U.S. Marine Corps`, `U.S. Air Force`, `U.S. Coast Guard`, `U.S. National Guard`, `U.S. Army Reserve`, `U.S. Navy Reserve`, `U.S. Marine Corps Reserve`, `U.S. Air Force Reserve`, `Union Army`, `Confederate Army`, `Wisconsin State Guard`, `Unknown`.

Allowed conflicts are: `American Revolution`, `War of 1812`, `U.S. Civil War`, `Spanish-American War`, `World War I`, `World War II`, `Korean War`, `Vietnam War`, `Persian Gulf War`, `War in Afghanistan`, `Iraq War`, `Peacetime service`, `Unknown`.

Confidence levels:

- `high`: the source explicitly states the branch/conflict/rank/unit/role.
- `moderate`: a record type or military marker strongly implies the field, but the text is incomplete.
- `low`: the field is a lead that needs direct confirmation. Avoid writing low-confidence branch/conflict facts unless the uncertainty is clearly useful.

Use the reported `Next GEDCOM ID` value. The command scans `people/**/*.md`, reports the highest current ID, and flags duplicate or malformed `gedcom_id` values.

### When to Create a Person File (CRITICAL)

**If a person is named in a source that's already in the vault, they get a person file.** The confidence level reflects how much we know — it is NOT a threshold for whether the person deserves a file. Specifically:

- **Named in a primary source** (obituary, census, cemetery memorial, church record) → Create file immediately. Even if they're a lateral relative and we have no independent records of their own, the source that names them IS their source. Use the appropriate confidence level below.
- **Named in FamilySearch World Tree only** with no vault source corroborating → Do NOT create a file yet. This is a research lead, not a confirmed person. Note them in Open_Questions.md or Research_Log.md.
- **Pre-1800 with only a first name** from a church/parish record → Create a stub file. They're real people with a real source.
- **Laterals** (siblings' spouses, siblings' children, etc.) → Create the file with what we know from the mentioning source. Do NOT deep-dive research — just record what's in hand.

### Family Unit Completeness (CRITICAL)

When a source lists someone's children, **ALL named children get person files** with proper `Father`/`Mother` wikilinks back to the parent(s). No exceptions. This is the most commonly skipped step.

- **Biological children** → person file with `Father`/`Mother` wikilinks
- **Stepchildren** → person file; note the step-parent relationship in the biography, not as `Father`/`Mother`
- **Children from multiple marriages** → each child links to their biological parents; the parent's file uses `Children (1st marriage)` / `Children (2nd marriage)` field names

**Do not skip children because they seem "too lateral."** Half-siblings, step-siblings, and out-of-bloodline children are one source discovery away from being genealogically critical. If the source names them, they get a file.

### Public Scope Rules

Projects may enable `publicScope` in `site-config.json` to keep the published site focused on the researcher's family graph:

```json
{
  "rootPersonId": "I1",
  "publicScope": {
    "enabled": true,
    "mode": "warn",
    "rootPersonId": "I1",
    "includeSpousesOfBloodRelatives": true,
    "excludeOutOfScopeFromSite": true,
    "allowPersonIds": []
  }
}
```

When enabled, the toolkit calculates blood relatives by walking parent/child links from the configured root person. Publishable people are those blood relatives plus spouses of blood relatives. This includes siblings, half-siblings, cousins, ancestors, descendants, and spouses of any of those people. It does **not** automatically include a spouse's parents, siblings, other spouses, or children from relationships outside the blood line.

For evidence integrity, the vault may still contain source-only or research-lead people who are not publishable under this rule. The site builder omits them from public data when `excludeOutOfScopeFromSite` is true, and validation reports them according to `mode` (`warn` or `error`). Use `allowPersonIds` sparingly for intentional exceptions such as adopted/foster family members, household members treated as family, or a non-blood bridge person needed to explain a documented relationship.

### Confidence Rules (CRITICAL)

Confidence level is based on the **quality and directness of sources**, not just whether data exists:

- **`high`** = Has their OWN primary source on file (their census record, their death certificate, their obituary, their gravestone). The actual document must be saved locally or have a verifiable URL.
- **`moderate`** = Named in SOMEONE ELSE'S primary source (mentioned in a relative's obituary, listed in a parent's census record, named on a family gravestone). The source is reliable but the person has no independent records of their own in the vault yet.
- **`low`** = Only a secondary/collaborative source like FamilySearch World Tree. Treat as a research lead, not a confirmed fact. Person file should still be created if at least one vault source mentions them.
- **`stub`** = Minimal data: pre-1800 first-name-only, placeholder names ("Mrs. John Caldwell"), or known to exist but almost nothing recorded. Do NOT create person files for medieval ancestors (pre-1500) unless backed by published county histories or actual parish records.

**Key distinction:** A person mentioned by name in a relative's obituary has `moderate` confidence — the obituary is a primary source and the information is almost certainly correct. A person found only in FamilySearch World Tree with no vault corroboration has `low` confidence — it could be completely wrong. These are NOT the same situation.

**FamilySearch World Tree alone is NEVER sufficient for `high` confidence.** It is a collaborative user-contributed database where anyone can add/edit entries. Every FamilySearch claim should note what primary source could verify it.

### Filing Convention

Person files are filed by **birth surname** in `people/{Surname}/`. Living persons MUST have `privacy: true`.

### Required Body Sections

- `## Vital Information` — table with Field/Value/Source columns
- `## Biography` — narrative text with source citations

### Vital Information Field Names (CRITICAL)

The `## Vital Information` table Field column MUST use these exact names. The website build script parses them by exact match — non-standard names silently break the site.

| Field Name | When to Use |
|---|---|
| `Full Name` | Full name including married surnames |
| `Born` | Birth date and place |
| `Died` | Death date and place |
| `Birthplace` | If separate from Born |
| `Death Place` | If separate from Died |
| `Burial` | Burial location |
| `Gravestone` | Gravestone inscription |
| `Father` | Father (use wikilink if person file exists) |
| `Mother` | Mother (use wikilink if person file exists) |
| `Spouse` | Single spouse |
| `Spouse (1st)` | First spouse when multiple marriages |
| `Spouse (2nd)` | Second spouse |
| `Spouse (3rd)` | Third spouse (and so on) |
| `Children` | Children from single marriage or all children combined |
| `Children (1st marriage)` | Children from first marriage when split by marriage |
| `Children (2nd marriage)` | Children from second marriage (and so on) |
| `Married` | Marriage date/place (when listed separately from Spouse) |
| `Siblings` | Siblings |
| `Religion` | Religious affiliation |
| `Occupation` | Occupation |
| `Nickname` | Common name or familiar name — maps to GEDCOM `NICK` |
| `Married Name` | Full name after marriage, e.g. `Mary Coenen` — **required for all non-stub married females**; maps to GEDCOM `NAME TYPE married`. Comma-separate multiple values if remarried: `Mary Coenen, Mary Smith` |
| `Also Known As` | Alternate spellings, anglicizations, or name-change variants, comma-separated — maps to GEDCOM `NAME TYPE aka`. Example: `Castonguay, Castongia` |

**DO NOT use:** `Marriage 1/2/3` (use `Spouse (1st/2nd/3rd)`), `Children (w/ Name)` (use `Children` or `Children (Nth marriage)`), or any other invented field names.

### Name Variants and GEDCOM Mapping

The vault stores all name variants in the `## Vital Information` table. These map to GEDCOM name records:

| Vault field | GEDCOM tag | Notes |
|---|---|---|
| `name` (frontmatter) | `1 NAME / 2 TYPE birth` | Primary name — maiden name for women |
| `Nickname` | `2 NICK` (subordinate to NAME) | Optional |
| `Married Name` | `1 NAME / 2 TYPE married` | Required for non-stub married females |
| `Also Known As` | `1 NAME / 2 TYPE aka` | Optional; covers anglicizations and spelling variants |

All name variant fields are indexed by the search engine so persons can be found by any name they were known by.

## Media Rules

### Storage

Images are stored locally in `media/` (gitignored). Source URLs are tracked in `_Media_Index.md` (in git). Every downloaded image MUST have a source URL for re-download.

### Naming Convention

`TYPE_Surname_Given_Description.ext` where TYPE is:
- `CEM` — gravestone photo
- `POR` — portrait
- `NEWS` — newspaper clipping
- `DOC` — document or certificate
- `GRP` — group photo
- `MISC` — miscellaneous

### _Media_Index.md Format

Every table row must have all 5 columns filled:
| Local Path | Person | Source URL | Date Downloaded | Description |

### Linking (CRITICAL) — Images require THREE entries to appear on the site

An image is only visible on the published site if it appears in **all three** of:
1. The **source file** `media:` frontmatter array (the source the image came from)
2. The **person file** `media:` frontmatter array (for every person depicted or primarily associated with the image)
3. `_Media_Index.md` (the global manifest with source URL for re-download)

Missing any one of the three means the image will not render. After any media changes, run `npm run build:data` before checking results.

## Source Acquisition Protocol (CRITICAL)

Applies to ALL web sources — FindAGrave, funeral homes, newspaper archives, historical societies, etc.

1. Fetch the source page and save the full text in a source file
2. **Download ALL images** on the page — gravestones, portraits, newspaper clippings, documents, group photos
3. Categorize and name each image per the Media Naming Convention above
4. For NEWS images: OCR immediately; combine multi-part clippings from same publication/date/page
5. For DOC images: OCR and extract structured data
6. Create source file with ALL required frontmatter — **including `media:` listing every downloaded image path**
7. Add each image to the `media:` array of **every depicted person's file** AND to `_Media_Index.md`
8. List EVERY genealogically relevant person in `persons:` and mine the text for relationships, dates, locations
9. **Create or update a person file for every person in `persons:`** — add source_id to YAML sources list, update vital info, update biography. NOT optional.
10. Run validation — **zero orphaned sources required before commit**

**FindAGrave-specific:** Download ALL photos from the memorial (not just gravestones). Categorize as CEM/POR/NEWS/DOC.

## Multi-Part Newspaper Clipping Assembly

When multiple photos are from the same newspaper/date/page: OCR each separately, order by content continuity, combine into a single text in the source file. Name files with `_p1`, `_p2` suffixes.

## OCR Quality and Manual Review

**Automated OCR on narrow-column newspaper clippings is unreliable.** The agent OCR has been observed to:
- Misread ages ("81" read as "47")
- Misread dates ("1856" read as "1890")
- Confuse relationships (sisters-in-law identified as sisters)
- Garble names in narrow-column formats
- Invent names that don't appear in the image

**MANDATORY**: After every automated OCR of a newspaper clipping:
1. Add `ocr_verified: false` to the source file YAML frontmatter
2. The validation script flags `ocr_verified: false` files as warnings
3. A human must visually compare the OCR'd text against the source image
4. After manual verification, change to `ocr_verified: true`
5. Do NOT update person files or Family_Tree.md with OCR'd data until verified

**For small or poor-quality images**: Use the Read tool to view the image directly (Claude can read images). This is more reliable than Tesseract for handwritten text, small fonts, and partial images. Always prefer direct image reading over automated OCR when quality is questionable.

## Change Routing (CRITICAL)

This toolkit is shared across multiple genealogy projects via git submodule.

- **toolkit/ changes** (validation, build scripts, site code, templates, METHODOLOGY.md) → commit to the toolkit repo
- **Vault content** (person files, source files, media, site-config.json, HANDOVER.md) → commit to the project repo

**If you're editing a file inside toolkit/ from a project repo, STOP. The toolkit is a submodule — changes must be committed to the toolkit repo separately.**

## Validation

From the project root (with toolkit as submodule):
```bash
npm run validate     # Must pass with zero errors before committing
npm run build:data   # Verify site picks up all sources
```

### Source Person IDs

`persons:` is human-readable extracted text. It is not a key and must not be validated with fuzzy or normalized name matching. `person_ids:` is the broad relational link from a source to every genealogically relevant person file mentioned or covered by the source. `subject_person_ids:` identifies the primary subject(s) of the source, such as whose obituary it is. Validation checks every `person_ids:` and `subject_person_ids:` entry for a valid existing GEDCOM ID. Use `npm run validate -- --strict-source-person-ids` for new import/extractor work where every source with `persons:` must also have `person_ids:`.

## R2 Media Sync

After every push, sync local media to Cloudflare R2 so production images stay current:
```bash
npm run upload-media
```

The R2 bucket name and Cloudflare account ID are read from `site-config.json`. The `CLOUDFLARE_API_TOKEN` must be set as an env var.
