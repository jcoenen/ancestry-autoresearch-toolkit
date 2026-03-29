# Ancestry Autoresearch Toolkit

A complete toolkit for building and maintaining markdown-based genealogy vaults with AI-assisted research. Includes a full-featured React website, vault validation, data build pipeline, and structured templates — all designed to work with [Claude Code](https://claude.ai/claude-code) for automated genealogy research sessions.

## What This Is

This toolkit powers a workflow where:

1. **You research** using FindAGrave, FamilySearch, census records, church registers, newspapers, DNA results — any source
2. **Claude Code assists** by downloading images, OCR'ing documents, creating structured person/source files with proper cross-linking, and enforcing data quality rules
3. **The vault** (plain markdown + YAML frontmatter) is the single source of truth — human-readable, version-controlled, Obsidian-compatible
4. **The site** is auto-generated from the vault — a fast, browseable family tree website you can deploy anywhere

One toolkit, multiple family projects. Each family gets its own repo with this toolkit as a git submodule.

## Features

### Website (React + Vite + TypeScript + Tailwind)

- **Interactive family tree** — landscape, pedigree, and descendant views with click-to-navigate
- **Person pages** — biography, vital information, source citations, media gallery per person
- **Source browser** — searchable/filterable table of all sources with full text and extracted facts
- **Media gallery** — gravestones, portraits, newspaper clippings, documents
- **Timeline** — chronological events across all people
- **On This Day** — daily family history highlights (births, deaths, marriages, immigration, military, baptisms, and more)
- **Statistics** — people count, source count, generations traced, family lines
- **Research gaps** — auto-detected stubs, missing sources, broken links
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

### 3. Create your vault structure

```bash
mkdir -p YourFamily_Genealogy/{people,sources/{obituaries,cemetery,census,church},media/{gravestones,portraits,newspapers,documents},dna}
```

### 4. Create your site config

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

### 5. Create a root package.json

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

### 6. Install and run

```bash
npm run setup    # Install dependencies
npm run dev      # Start dev server
```

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
└── CLAUDE.md                   ← Claude Code instructions for your project
```

## Using with Claude Code

This toolkit is designed to work with [Claude Code](https://claude.ai/claude-code) for AI-assisted genealogy research. Your project's `CLAUDE.md` file tells Claude the rules:

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

Claude will then follow the methodology when creating files, cross-linking sources, downloading images, and running validation — enforcing data quality automatically.

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

### Build for production

```bash
npm run build
```

Output goes to `toolkit/site/dist/`. Deploy to any static host (Vercel, Netlify, Cloudflare Pages, etc.).

### Media hosting

Images are stored locally and gitignored. For production, upload to Cloudflare R2 (or any CDN) and set `VITE_MEDIA_BASE_URL` at build time:

```bash
VITE_MEDIA_BASE_URL="https://your-r2-bucket.r2.dev/" npm run build
```

The included `upload-media.sh` script handles R2 uploads if you configure the `media` section in `site-config.json`.

## Tech Stack

- **Vault**: Markdown + YAML frontmatter (Obsidian-compatible)
- **Site**: React 19 + Vite 8 + TypeScript + Tailwind CSS 4
- **Tree visualization**: React Flow
- **Markdown rendering**: react-markdown + remark-gfm
- **Build scripts**: tsx (TypeScript execution)
- **Validation**: Custom TypeScript validator
- **GEDCOM export**: Full GEDCOM 5.5.1 export (`npm run export:gedcom`)
- **GEDCOM import**: Import GEDCOM 5.5.1 files as person markdown (`npm run import:gedcom <file.ged>`)
- **Testing**: Vitest (168 unit tests for build/validation/import parsing logic)
- **Media CDN**: Cloudflare R2 (optional)

## License

MIT
