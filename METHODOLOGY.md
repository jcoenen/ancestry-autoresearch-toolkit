# Genealogy Vault Methodology

Shared rules and processes for all genealogy vault projects using the genealogy-toolkit. These rules are referenced by each project's CLAUDE.md and enforced by the validation scripts.

## Vault Architecture

Each project follows this structure:

```
{project-repo}/
├── CLAUDE.md                  ← Project-specific instructions (references this file)
├── HANDOVER.md                ← Session handoff notes
├── toolkit/                   ← git submodule → genealogy-toolkit
│   ├── site/                  ← Website (React + Vite + TypeScript + Tailwind)
│   ├── templates/             ← Markdown templates for new files
│   └── METHODOLOGY.md         ← This file
├── {Family}_Genealogy/        ← The vault (single source of truth)
│   ├── people/                ← Person files, organized by birth surname
│   ├── sources/               ← Source documents
│   ├── media/                 ← Images (gitignored except _Media_Index.md)
│   ├── dna/                   ← DNA analysis
│   ├── site-config.json       ← Per-project site configuration
│   ├── Family_Tree.md
│   ├── Open_Questions.md
│   ├── Research_Log.md
│   └── Timeline.md
```

GEDCOM, the website, and any book output are **generated artifacts** derived from the vault.

## Source File Rules (CRITICAL)

Every source file in `sources/` (excluding `_Source_Index.md`) MUST have these YAML frontmatter fields:

### Required Frontmatter

```yaml
---
source_id: SRC-{TYPE}-{NNN}    # e.g., SRC-OBIT-024, SRC-CEM-017
type: source                    # ALWAYS "source"
source_type: obituary           # see allowed values below
title: "Obituary of [Person Name]"
date_of_document: 2000-03-28
date_accessed: 2026-03-19
url: "https://..."              # original source URL for re-download
publisher: "Newspaper Name, City State"
persons:                        # Every genealogically relevant person: family
                                # members, spouses, children, siblings, in-laws.
                                # Exclude incidental names (officiants, pallbearers,
                                # funeral directors) UNLESS they are also family.
  - Person One
  - Person Two
families:                       # surname groups mentioned
  - Surname1
  - Surname2
reliability: high               # high, moderate, or low
media:                          # EVERY image/scan associated with this source
  - "gravestones/CEM_Surname_Given_FaG12345.jpg"
  - "newspapers/NEWS_Surname_Given_Paper_2000.jpg"
created: 2026-03-23
tags: [genealogy, source, obituary, Surname1, Surname2]
---
```

### Optional Frontmatter Fields

```yaml
language: "German"              # document language if not English
translation_slug: "obit-smith-1920-english"  # slug of *_ENGLISH.md translation file
ocr_verified: true              # false until OCR'd text manually reviewed
memorial_id: "12345"            # FindAGrave memorial number
```

When `language` is set to a non-English value and no `translation_slug` is provided, the source appears in the "Untranslated Sources" gap on the Research Gaps page. Run `npm run translations` to scan for untranslated sources and create translation stubs.

### Allowed `source_type` Values

`obituary`, `cemetery_memorial`, `church_record`, `secondary`, `ship_manifest`, `military`, `census`, `family_knowledge`, `certificate`

### Required Body Sections

- `## Full Text` — blockquoted (`>`) original text
- `## Extracted Facts` — markdown table with Fact/Value/Confidence columns
- `## Notes` — research notes and cross-references

### Source ID Assignment

Next available IDs are determined by scanning existing source files:
```bash
grep -r "source_id:" sources/ | sort
```
Find the highest number per type and increment.

### Mandatory Cross-Linking (CRITICAL)

**Every source file MUST be referenced by at least one person file.** When creating a new source file:

1. Create the source file with all extracted facts
2. **IMMEDIATELY** update every person file mentioned in the source:
   - Add the `source_id` to the person's `sources:` YAML array
   - Update any vital information fields that the source provides (birth date, death date, birthplace, etc.) with the source_id as the citation
   - Update the biography section with new information
3. Run `npm run validate` to verify zero orphaned sources

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

This rule is not new — it is a specific application of "If a person is named in a source, they get a person file" (above). It is called out explicitly because agents consistently rationalize skipping children as "not in the direct bloodline."

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

**DO NOT use:** `Marriage 1/2/3` (use `Spouse (1st/2nd/3rd)`), `Children (w/ Name)` (use `Children` or `Children (Nth marriage)`), or any other invented field names.

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

## FaG Memorial Mining Protocol (CRITICAL)

This is the standard way of working when processing a FindAGrave memorial:

1. Fetch the FaG memorial page
2. Download ALL photos (not just gravestones)
3. Categorize each: CEM (gravestone), POR (portrait), NEWS (newspaper clipping), DOC (document/certificate)
4. For NEWS images: OCR immediately, combine multi-part clippings from same publication/date/page
5. For DOC images: OCR and extract structured data
6. Create source file with ALL required frontmatter fields — **including `media:` listing every downloaded image path**
7. Mine obituary text for every named person, relationship, date, location
8. **Update EVERY person file mentioned in the source** — add source_id to YAML sources list, update vital info fields with new data and citations, update biography. This is NOT optional.
9. Update _Media_Index.md
10. Run validation — **zero orphaned sources required before commit**

## Web Source Acquisition Protocol

When fetching ANY source from a website (funeral home, newspaper archive, historical society, etc.):

1. Save the full source text in the source file
2. **Download ALL images** present on the page — portraits, document scans, newspaper clippings, group photos
3. Categorize and name each image per the Media Naming Convention above
4. Add every image to the source file's `media:` frontmatter array
5. Add every image to `_Media_Index.md` with the source URL for re-download
6. List EVERY genealogically relevant person in the `persons:` frontmatter array (see persons array definition above)
7. **Create or update a person file for every person in the `persons:` array**
8. Run validation — zero orphaned sources required before commit

This applies to ALL web sources, not just FaG. The FaG Mining Protocol above is a specialized version of this for FindAGrave's specific page structure.

## Multi-Part Newspaper Clipping Assembly

When multiple photos from the same FaG memorial are from the same newspaper, same date, same page:
- They are parts of the same article
- OCR each separately
- Order by content continuity (part 1 ends mid-sentence, part 2 continues)
- Combine into single text in the source file
- Name files with `_p1`, `_p2` suffixes

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

This toolkit is shared across multiple genealogy projects via git submodule. Before modifying ANY file, determine where the change belongs:

### Goes in toolkit/ (this repo)
- Validation rules and logic
- Build scripts (build-data.ts, validate_vault.ts)
- Site components, pages, styles
- Templates for person/source/etc files
- This METHODOLOGY.md
- upload-media.sh script

### Goes in the project repo
- Person files, source files, media
- site-config.json (family name, hero text, R2 config)
- Project CLAUDE.md (family-specific instructions, gold standard examples)
- HANDOVER.md
- Research_Log.md, Open_Questions.md, Family_Tree.md
- .env.local, credentials

### Goes in global Claude memory
- Methodology feedback (applies across all genealogy projects)
- Tool usage patterns (Playwright for FaG, etc.)

**If you're editing a file inside toolkit/ from a project repo, STOP. The toolkit is a git submodule — changes must be committed to the toolkit repo separately.**

## Validation

From the project root (with toolkit as submodule):
```bash
npm run validate     # Must pass with zero errors before committing
npm run build:data   # Verify site picks up all sources
```

### Persons Array Resolution

The validation script checks that every name in a source file's `persons:` frontmatter array can be matched to an existing person file in `people/`. Unresolved names are flagged as **warnings** with a message like:

```
sources/obituaries/SRC-OBIT-032.md: "Julie Brandt" in persons array — no matching person file found
```

This catches the most common failure mode: a source is created with a complete persons list but person files are never created for all entries. The `persons:` array is a contract — if you listed someone, they need a person file.

## R2 Media Sync

After every push, sync local media to Cloudflare R2 so production images stay current:
```bash
npm run upload-media
```

The R2 bucket name and Cloudflare account ID are read from `site-config.json`. The `CLOUDFLARE_API_TOKEN` must be set as an env var.

## Commit Rules

- NEVER add `Co-Authored-By` or any AI attribution to commit messages
- NEVER include any indication that AI wrote the code
- Run `npm run validate` before committing — must pass with zero errors
- Run `npm run build:data` to verify the site picks up all changes
- Do not commit `.env`, credentials, media files, or database backups
