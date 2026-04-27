# Genealogy Toolkit

A complete toolkit for building and maintaining markdown-based genealogy vaults with AI-assisted research. Includes a full-featured React website, vault validation, data build pipeline, structured templates, media sync, and relational cleanup tools. It works well with coding agents such as [Claude Code](https://claude.ai/claude-code), Codex, or a human maintainer using the same scripts directly.

## What This Is

This toolkit powers a workflow where:

1. **You research** using FindAGrave, FamilySearch, census records, church registers, newspapers, DNA results — any source
2. **An assistant or maintainer helps** by downloading images, OCR'ing documents, creating structured person/source files with proper cross-linking, and enforcing data quality rules
3. **The vault** (plain markdown + YAML frontmatter) is the single source of truth — human-readable, version-controlled, Obsidian-compatible
4. **The site** is auto-generated from the vault — a fast, browseable family tree website you can deploy anywhere

One toolkit, multiple family projects. Each family gets its own repo with this toolkit as a git submodule.

## Features

### Website (React + Vite + TypeScript + Tailwind)

- **Interactive family tree** — vertical expanding ancestors, full pedigree (dagre top-to-bottom), navigator (click-to-explore context window), and descendant views. Person selector with search. All views work for any person
- **Person pages** — biography, vital information, source citations, media gallery per person
- **Data completeness cards** — show biography and key-document status using relational source IDs (`person_ids`) so obituary/certificate coverage follows actual source links, not fuzzy name matching
- **Source browser** — searchable/filterable table of all sources with full text and extracted facts
- **Media gallery** — gravestones, portraits, newspaper clippings, documents
- **Family Map** — full-screen interactive map showing family events geographically. Marker clustering from world to street level. Birth, death, marriage, burial, residence, immigration, and emigration events with color-coded markers. Migration path arcs connecting birthplace to death place. Time period slider, decade-by-decade animation, heat map mode. Family line and event type filters. Build-time geocoding via Nominatim with editable cache
- **Timeline** — chronological events across all people
- **On This Day** — daily family history highlights (births, deaths, marriages, immigration, military, baptisms, and more)
- **Statistics** — people count, source count, generations traced, family lines
- **Global search** — fuzzy full-text search across people and sources (name, biography, birthplace, occupation, source text, notes) with highlighted snippets. Cmd+K shortcut
- **Research gaps** — auto-detected stubs, missing sources, broken links, untranslated sources. Per-category research suggestions ("Where to look"). Priority targets ranked by gap count. Export/Copy research plan as markdown checklist
- **Immigration stories** — narrative page rendered from vault markdown
- **Family filter** — dropdown to filter any view by surname
- **Privacy controls** — `privacy: true` people keep their name and family position in the tree but all personal details (dates, places, vitals, biography, sources, media) are stripped from the published site at build time. GEDCOM export emits minimal records with `RESN confidential`
- **Print stylesheet** — clean print output for sharing
- **Mobile responsive** — works on phones and tablets
- **Fully configurable** — family name, hero text, surname origin story, footer all driven by `site-config.json`

### Vault Validation

The validation script (`npm run validate`) enforces:

- Required YAML frontmatter fields on all person and source files
- Source ID format (`SRC-TYPE-NNN`) and uniqueness
- Confidence levels (`high`, `moderate`, `low`, `stub`) with defined criteria
- Bidirectional relationship integrity (parent lists child ↔ child lists parent)
- Orphaned source detection (every source must be referenced by at least one person — treated as errors)
- Broken wikilink detection
- Vital Information field name validation (non-standard names break the site build)
- Media index completeness (all 5 columns required)
- Newspaper/document media linked to source files
- Person media linkage checks so registered images are actually visible on relevant person pages
- Source `person_ids` validation, including optional strict mode for source-person coverage
- OCR verification status tracking (`ocr_verified: false` flagged as warning)
- Spouse-children marriage grouping consistency

### Templates

Ready-to-use markdown templates for:

- **Person files** — vitals table (25+ recognized fields including gender, baptism, education, residence, military, immigration, divorce), biography, source citations, data discrepancies
- **Source files** — certificate, transcription (with OCR quality tracking)
- **Surname files** — etymology, distribution, family line history
- **Research files** — hypothesis tracking, region deep-dives
- **Correspondence** — draft letters to archives, postcard transcriptions

### Methodology

`METHODOLOGY.md` documents the complete research methodology:

- Source file and person file format rules
- Confidence level definitions with clear criteria
- FindAGrave memorial mining protocol (10-step process)
- Multi-part newspaper clipping assembly
- OCR quality rules and manual verification workflow
- Media naming conventions and index format
- Cross-linking requirements
- Change routing rules for multi-project setups

### Data Quality Tools

These scripts are built for recurring cleanup and audit work across projects. Run them from `toolkit/site` with `VAULT_ROOT=/path/to/vault`, or expose them as wrapper scripts in a family project.

| Script | Purpose |
|---|---|
| `npm run next:gedcom-id` | Finds the next available `I###` person/GEDCOM ID without relying on a hand-maintained document |
| `npm run next:source-id -- --type obituary` | Finds the next available source ID for a source type or prefix |
| `npm run audit:source-person-links` | Audits source `person_ids` against person files and source references |
| `npm run backfill:source-person-ids -- --dry-run` | Adds source `person_ids` from existing person source lists; uses existing IDs, not name matching |
| `npm run backfill:person-media -- --dry-run` | Adds safe person `media:` refs from source media when a source has one clear primary person |
| `npm run backfill:vital-links -- --dry-run` | Rewrites Vital Information spouse/child rows from existing frontmatter GEDCOM IDs |
| `npm run audit:obituary-portraits` | Finds obituary sources with likely missing portrait images |
| `npm run extract:obituary` | Extracts structured obituary text and candidate image URLs from supported obituary pages |
| `npm run import:obituary-portrait` | Downloads a reviewed obituary portrait and wires it into media index, source, and person files |

The cleanup tools intentionally prefer relational data already present in the vault. They do not invent authoritative links from fuzzy name matches. Use `--dry-run` first, review the proposed edits, then run without `--dry-run` when the changes are safe.

## Quick Start

### 1. Create your family project repo

```bash
mkdir ancestry-yourfamily && cd ancestry-yourfamily
git init
```

### 2. Add the toolkit as a submodule

```bash
git submodule add https://github.com/jcoenen/ancestry-autoresearch-toolkit.git toolkit
```

### 3. Run the init wizard

```bash
cd toolkit/site && npm install && cd ../..
npx tsx toolkit/site/scripts/init-project.ts
```

The wizard walks you through:
- Family surname and researcher name
- Building your family tree (root person → parents → grandparents) with whatever you know
- Countries of origin and research goals
- Optional GEDCOM import from an existing tree

It creates the vault directory structure, person files, site config, vault-level docs, wrapper scripts, `.gitignore`, and Claude Code instructions. Codex users can add an `AGENTS.md` at the family-project root with the same project-specific guidance.

### 4. Start the dev server

```bash
npm run dev
```

<details>
<summary>Manual setup (without the wizard)</summary>

### Create your vault structure

```bash
mkdir -p YourFamily_Genealogy/{people,sources/{obituaries,cemetery,census,church},media/{gravestones,portraits,newspapers,documents},dna}
```

### Create your site config

Create `YourFamily_Genealogy/site-config.json`:

```json
{
  "familyName": "YourFamily",
  "siteTitle": "YourFamily Family Ancestry",
  "heroSubtitle": "Tracing the YourFamily family from...",
  "researcher": "Your Name",
  "footerTagline": "N Generations · Origin to Destination",
  "oldestRecord": "1800",
  "generationsTraced": 5,
  "rootPersonId": "I1"
}
```

### Create a root package.json

```json
{
  "private": true,
  "scripts": {
    "dev": "cd toolkit/site && VAULT_ROOT=../../YourFamily_Genealogy npm run dev",
    "build:data": "cd toolkit/site && VAULT_ROOT=../../YourFamily_Genealogy npm run build:data",
    "build": "cd toolkit/site && VAULT_ROOT=../../YourFamily_Genealogy npm run build",
    "validate": "cd toolkit/site && VAULT_ROOT=../../YourFamily_Genealogy npm run validate",
    "test": "cd toolkit/site && npm test",
    "setup": "cd toolkit/site && npm install"
  }
}
```

### Install and run

```bash
npm run setup    # Install dependencies
npm run dev      # Start dev server
```

</details>

## Project Structure

```
your-project/
├── toolkit/                    ← This repo (git submodule)
│   ├── site/                   ← React website + build/validation scripts
│   ├── templates/              ← Markdown file templates
│   └── METHODOLOGY.md          ← Shared vault rules
├── YourFamily_Genealogy/       ← Your vault (single source of truth)
│   ├── people/                 ← Person files by birth surname
│   │   └── Smith/
│   │       └── Smith_John.md
│   ├── sources/                ← Source documents
│   │   ├── obituaries/
│   │   ├── cemetery/
│   │   └── census/
│   ├── media/                  ← Images (gitignored, synced to CDN)
│   │   └── _Media_Index.md     ← Media manifest (tracked in git)
│   └── site-config.json        ← Your site configuration
├── package.json                ← Wrapper scripts
└── AGENTS.md / CLAUDE.md       ← Agent instructions for your project
```

## Using With Coding Agents

This toolkit is designed to work with agent-assisted research, including Claude Code and Codex. Put project-specific instructions in the file your agent reads, such as `AGENTS.md` for Codex or `CLAUDE.md` for Claude Code. Keep those files short and point them back to the shared methodology:

```markdown
# YourFamily Genealogy Project

## Project Overview
[Brief description of your family research]

The site code, validation, and methodology live in `toolkit/`.
**Read `toolkit/METHODOLOGY.md` for all vault format rules.**

## Vault Rules
All rules are in `toolkit/METHODOLOGY.md`. Do not duplicate them here.

## Gold Standard Files
- `sources/obituaries/OBIT_Smith_John_2020.md`
- `people/Smith/Smith_John.md`
```

The agent should follow the methodology when creating files, cross-linking sources, downloading images, and running validation. For data integrity, prefer GEDCOM IDs, source IDs, and `person_ids` over name matching. If an agent creates toolkit changes, commit them in the toolkit repo first, then update the family project's submodule pointer.

## Site Configuration

The `site-config.json` in your vault root controls all family-specific site content:

| Field | Description |
|---|---|
| `familyName` | Primary surname — shown in nav bar |
| `siteTitle` | Full title — shown in hero and browser tab |
| `heroSubtitle` | Description paragraph on homepage |
| `researcher` | Your name — shown in footer |
| `footerTagline` | Short tagline for footer |
| `oldestRecord` | Year of oldest record — shown in stats |
| `generationsTraced` | Number of generations — shown in stats |
| `rootPersonId` | GEDCOM ID of root person (e.g. `"I1"`) — used for tree navigation |
| `surnameOrigin` | Optional — `{ title, markdown }` for a surname origin section on homepage |
| `media` | Optional — `{ r2Bucket, r2PublicUrl, cloudflareAccountId }` for Cloudflare R2 media hosting |

## Deploying

### Full deploy (recommended)

```bash
npm run deploy
```

Runs the complete pipeline: build data from vault → upload media to R2 → Vite production build. Output goes to `toolkit/site/dist/`. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

### Media hosting

Images are stored locally and gitignored. For production, configure the `media` section in `site-config.json` and set `CLOUDFLARE_API_TOKEN`:

```bash
CLOUDFLARE_API_TOKEN=xxx npm run deploy
```

The smart media uploader (`npm run upload:media`) tracks SHA-256 hashes in `.media-manifest.json` and only uploads new or changed files. Flags:

- `--force` — re-upload everything regardless of manifest
- `--dry-run` — preview what would change without uploading
- `--delete` — remove R2 objects for locally deleted files

Set `VITE_MEDIA_BASE_URL` at build time if not using the R2 public URL from site-config:

```bash
VITE_MEDIA_BASE_URL="https://your-r2-bucket.r2.dev/" npm run build
```

## Tech Stack

- **Vault**: Markdown + YAML frontmatter (Obsidian-compatible)
- **Site**: React 19 + Vite 8 + TypeScript + Tailwind CSS 4
- **Tree visualization**: React Flow
- **Maps**: Leaflet + react-leaflet + leaflet.markercluster + leaflet.heat
- **Markdown rendering**: react-markdown + remark-gfm
- **Build scripts**: tsx (TypeScript execution)
- **Validation**: Custom TypeScript validator
- **Cleanup tooling**: Source/person ID audit, safe media backfill, vital-link backfill, next-ID helpers
- **GEDCOM export**: Full GEDCOM 5.5.1 export (`npm run export:gedcom`)
- **GEDCOM import**: Import GEDCOM 5.5.1 files as person markdown (`npm run import:gedcom <file.ged>`)
- **Search**: fuse.js (client-side fuzzy search)
- **Translation management**: `npm run translations` — scans for untranslated non-English sources, creates translation stubs
- **Testing**: Vitest (194 unit tests for build/validation/import/translation/research-plan logic)
- **Media CDN**: Cloudflare R2 (optional)

## License

MIT
