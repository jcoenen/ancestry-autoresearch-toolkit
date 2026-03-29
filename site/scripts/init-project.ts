/**
 * Interactive project initialization wizard.
 *
 * Run from the parent project directory (the one containing toolkit/ as a submodule):
 *   npx tsx toolkit/site/scripts/init-project.ts
 *
 * Or from toolkit/site/:
 *   npm run init -- --project-root=../..
 */

import { input, confirm } from '@inquirer/prompts';
import {
  mkdirSync, writeFileSync, existsSync, readFileSync,
} from 'fs';
import { resolve, join, dirname } from 'path';
import { execSync } from 'child_process';

// ── Types ──────────────────────────────────────────────────

interface PersonEntry {
  fullName: string;
  givenName: string;
  surname: string;
  birthYear: string;
  birthPlace: string;
  deathYear: string;
  deathPlace: string;
  maidenName: string; // birth surname for women (used for filing)
  gender: 'M' | 'F' | '';
  gedcomId: string;
  role: string; // e.g. "root", "father", "paternal grandmother", etc.
  fatherId: string;  // gedcom ID of father if entered
  motherId: string;  // gedcom ID of mother if entered
  spouseId: string;  // gedcom ID of spouse if entered
  childIds: string[]; // gedcom IDs of children
}

interface ProjectConfig {
  familySurname: string;
  researcher: string;
  countries: string[];
  researchGoals: string;
  people: PersonEntry[];
  surnames: string[];
  generationsTraced: number;
  gedcomFile: string;
}

// ── Helpers ────────────────────────────────────────────────

function parseName(fullName: string): { given: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], surname: parts[0] };
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return { given, surname };
}

function toFilename(surname: string, given: string): string {
  // Surname_Given — use first given name only, strip non-alpha
  const cleanSurname = surname.replace(/[^a-zA-Z-]/g, '');
  const cleanGiven = given.split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '');
  return `${cleanSurname}_${cleanGiven}`;
}

function birthSurname(person: PersonEntry): string {
  return person.maidenName || person.surname;
}

function toWikilink(person: PersonEntry): string {
  const filing = birthSurname(person);
  const filename = toFilename(filing, person.givenName);
  return `[[people/${filing}/${filename}.md]]`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Prompt Helpers ─────────────────────────────────────────

async function promptPerson(
  label: string,
  gedcomId: string,
  gender: 'M' | 'F' | '',
  required: boolean,
): Promise<PersonEntry | null> {
  console.log(`\n── ${label} ──`);

  const fullName = await input({
    message: `${label} — full name${required ? '' : ' (enter to skip)'}:`,
    validate: (v) => {
      if (required && !v.trim()) return 'Name is required';
      return true;
    },
  });

  if (!fullName.trim()) return null;

  const { given, surname } = parseName(fullName);

  let maidenName = '';
  if (gender === 'F') {
    maidenName = (await input({
      message: '  Birth surname / maiden name, last name only (enter to skip):',
    })).trim();
  }

  const birthYear = await input({
    message: '  Birth year (enter to skip):',
    validate: (v) => {
      if (v && !/^\d{4}$/.test(v.trim())) return 'Enter a 4-digit year';
      return true;
    },
  });

  const birthPlace = await input({
    message: '  Birth place (enter to skip):',
  });

  const deathYear = await input({
    message: '  Death year (enter to skip):',
    validate: (v) => {
      if (v && !/^\d{4}$/.test(v.trim())) return 'Enter a 4-digit year';
      return true;
    },
  });

  const deathPlace = await input({
    message: '  Death place (enter to skip):',
  });

  return {
    fullName: fullName.trim(),
    givenName: given,
    surname,
    maidenName,
    birthYear: birthYear.trim(),
    birthPlace: birthPlace.trim(),
    deathYear: deathYear.trim(),
    deathPlace: deathPlace.trim(),
    gender,
    gedcomId,
    role: label,
    fatherId: '',
    motherId: '',
    spouseId: '',
    childIds: [],
  };
}

async function promptSpouse(
  partnerName: string,
  gedcomId: string,
  gender: 'M' | 'F' | '',
): Promise<PersonEntry | null> {
  const fullName = await input({
    message: `  ${partnerName}'s spouse full name (enter to skip):`,
  });

  if (!fullName.trim()) return null;

  const { given, surname } = parseName(fullName);

  let maidenName = '';
  if (gender === 'F') {
    maidenName = (await input({
      message: '  Birth surname / maiden name, last name only (enter to skip):',
    })).trim();
  }

  return {
    fullName: fullName.trim(),
    givenName: given,
    surname,
    maidenName,
    birthYear: '',
    birthPlace: '',
    deathYear: '',
    deathPlace: '',
    gender,
    gedcomId,
    role: `Spouse of ${partnerName}`,
    fatherId: '',
    motherId: '',
    spouseId: '',
    childIds: [],
  };
}

// ── Person File Generation ─────────────────────────────────

function generatePersonFile(person: PersonEntry, allPeople: PersonEntry[]): string {
  const father = allPeople.find((p) => p.gedcomId === person.fatherId);
  const mother = allPeople.find((p) => p.gedcomId === person.motherId);
  const spouse = allPeople.find((p) => p.gedcomId === person.spouseId);
  const children = allPeople.filter((p) => person.childIds.includes(p.gedcomId));

  // Build frontmatter
  const sources: string[] = [];
  const fm = [
    '---',
    'type: person',
    `name: "${person.fullName}"`,
    person.birthYear ? `born: ${person.birthYear}` : 'born: ""',
    person.deathYear ? `died: ${person.deathYear}` : 'died: ""',
    `family: "${birthSurname(person)}"`,
    person.gender ? `gender: ${person.gender}` : 'gender: ""',
    `gedcom_id: "${person.gedcomId}"`,
    'privacy: false',
    'confidence: stub',
    `sources: [${sources.map((s) => `"${s}"`).join(', ')}]`,
    'media: []',
    `created: ${today()}`,
    `tags: [genealogy, ${birthSurname(person)}, person]`,
    '---',
  ];

  // Build vital information table
  const vitals: [string, string][] = [];
  vitals.push(['Full Name', person.fullName]);
  if (person.birthYear) vitals.push(['Born', person.birthYear]);
  if (person.birthPlace) vitals.push(['Birthplace', person.birthPlace]);
  if (person.deathYear) vitals.push(['Died', person.deathYear]);
  if (person.deathPlace) vitals.push(['Death Place', person.deathPlace]);
  if (father) vitals.push(['Father', toWikilink(father)]);
  if (mother) vitals.push(['Mother', toWikilink(mother)]);
  if (spouse) vitals.push(['Spouse', toWikilink(spouse)]);
  if (children.length > 0) {
    vitals.push(['Children', children.map((c) => toWikilink(c)).join(', ')]);
  }

  const vitalRows = vitals.map(([field, value]) => `| ${field} | ${value} | |`).join('\n');

  return `${fm.join('\n')}

# ${person.fullName}

## Vital Information

| Field | Value | Source |
|---|---|---|
${vitalRows}

## Biography

No biography yet — begin researching!

## Sources

| Source ID | Type | Title | File |
|---|---|---|---|

## Notes

`;
}

// ── Vault-Level Doc Generation ─────────────────────────────

function generateFamilyTree(config: ProjectConfig): string {
  const { familySurname, people, surnames, countries } = config;
  const root = people.find((p) => p.role === 'Root person');

  // Build a simple pedigree chart
  const lines: string[] = [];
  const byId = new Map(people.map((p) => [p.gedcomId, p]));

  function addPerson(id: string, indent: number): void {
    const p = byId.get(id);
    if (!p) return;
    const prefix = '  '.repeat(indent);
    const years = [p.birthYear, p.deathYear].filter(Boolean).join('–');
    const yearStr = years ? ` (${years})` : '';
    lines.push(`${prefix}- **${p.fullName}**${yearStr}`);
    if (p.fatherId && byId.has(p.fatherId)) addPerson(p.fatherId, indent + 1);
    if (p.motherId && byId.has(p.motherId)) addPerson(p.motherId, indent + 1);
  }

  if (root) addPerson(root.gedcomId, 0);

  return `# ${familySurname} Family Tree

## Overview

- **Primary surname:** ${familySurname}
- **All surnames:** ${surnames.join(', ')}
- **Countries/regions:** ${countries.length > 0 ? countries.join(', ') : 'Unknown'}
- **Root person:** ${root?.fullName ?? 'Unknown'}

## Pedigree

${lines.join('\n')}

## Surname Lines

### ${familySurname}

The primary line being researched.

${surnames.filter((s) => s !== familySurname).map((s) => `### ${s}\n\n`).join('')}
`;
}

function generateOpenQuestions(config: ProjectConfig): string {
  const { people, researchGoals } = config;

  // Auto-generate gaps from missing data
  const gaps: string[] = [];
  for (const p of people) {
    if (!p.birthYear) gaps.push(`- [ ] Find birth year for ${p.fullName}`);
    if (!p.birthPlace) gaps.push(`- [ ] Find birthplace for ${p.fullName}`);
    if (!p.deathYear && p.role !== 'Root person') gaps.push(`- [ ] Find death year for ${p.fullName}`);
  }

  return `# Open Questions

## Unresolved

${gaps.length > 0 ? gaps.join('\n') : '- [ ] (none yet)'}

## Research Goals

${researchGoals || '(none specified)'}

## Leads to Follow

- [ ] Search FamilySearch for known ancestors
- [ ] Check FindAGrave for cemetery records
- [ ] Look for census records

## Dead Ends

(none yet)
`;
}

function generateResearchLog(config: ProjectConfig): string {
  const { familySurname, people, researchGoals } = config;
  const root = people.find((p) => p.role === 'Root person');

  return `# Research Log

## ${today()} — Project Initialized

- Created ${familySurname} genealogy project
- Root person: ${root?.fullName ?? 'Unknown'}
- ${people.length} people entered during setup
${researchGoals ? `- Research goals: ${researchGoals}` : ''}

---
`;
}

function generateResearchStrategy(config: ProjectConfig): string {
  const { familySurname, surnames, countries, researchGoals } = config;

  return `# Research Strategy

## Surname Lines

${surnames.map((s) => `- **${s}**`).join('\n')}

## Geographic Focus

${countries.length > 0 ? countries.map((c) => `- ${c}`).join('\n') : '- (not yet determined)'}

## Research Priorities

${researchGoals || '(to be determined)'}

## Methodology

All research follows the rules in \`toolkit/METHODOLOGY.md\`. Key principles:

1. Every fact must be sourced — no unsourced claims in person files
2. Sources are transcribed in full with extracted facts
3. Cross-linking is bidirectional (person ↔ source, parent ↔ child)
4. Confidence levels reflect source quality: high (primary source), moderate (named in relative's source), low (FamilySearch only), stub (minimal data)

## Key Resources

- FamilySearch.org
- FindAGrave.com
- Newspapers.com / NewspaperArchive.com
- Local church and civil records
`;
}

function generateSummaryReport(config: ProjectConfig): string {
  const { familySurname, researcher } = config;

  return `# ${familySurname} Family — Summary Report

**Researcher:** ${researcher}
**Last updated:** ${today()}

## Overview

(To be written as research progresses.)

## Key Findings

(To be written as research progresses.)

## Immigration Story

(To be written as research progresses.)

## Sources Summary

| Type | Count | Notes |
|------|-------|-------|
| Obituaries | 0 | |
| Cemetery/Gravestone | 0 | |
| Census Records | 0 | |
| Church Records | 0 | |
| Other | 0 | |
`;
}

function generateMediaIndex(): string {
  return `# Media Index

| File | Type | Person | Description | Source URL |
|------|------|--------|-------------|-----------|
`;
}

// ── Root Project Files ─────────────────────────────────────

function generatePackageJson(familySurname: string, vaultDir: string): string {
  return JSON.stringify({
    private: true,
    scripts: {
      dev: `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run dev`,
      'build:data': `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run build:data`,
      build: `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run build`,
      validate: `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run validate`,
      'export:gedcom': `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run export:gedcom`,
      'import:gedcom': `cd toolkit/site && VAULT_ROOT=../../${vaultDir} npm run import:gedcom`,
      test: 'cd toolkit/site && npm test',
      setup: 'cd toolkit/site && npm install',
    },
  }, null, 2) + '\n';
}

function generateGitignore(vaultDir: string): string {
  return `.env
*.sqlite
node_modules/
database-backups/
${vaultDir}/media/*
!${vaultDir}/media/_Media_Index.md
`;
}

function generateClaudeMd(familySurname: string, vaultDir: string): string {
  return `# ${familySurname} Genealogy Project

## Project Overview

Genealogy research project for the ${familySurname} family. Uses the ancestry-autoresearch-toolkit as a git submodule in \`toolkit/\`.

The vault (single source of truth) is in \`${vaultDir}/\`.
The site code, validation, and methodology live in \`toolkit/\`.

**Read \`toolkit/METHODOLOGY.md\` for all vault format rules.**

## Vault Rules

All rules are in \`toolkit/METHODOLOGY.md\`. Do not duplicate them here.

## Commands

- \`npm run dev\` — start dev server
- \`npm run validate\` — check vault integrity
- \`npm run build\` — full production build
- \`npm run export:gedcom\` — export GEDCOM 5.5.1
- \`npm run import:gedcom\` — import GEDCOM file

## Gold Standard Files

(Add paths to well-formatted person and source files here as references.)
`;
}

function generateSiteConfig(config: ProjectConfig): string {
  const { familySurname, researcher, countries, people, generationsTraced } = config;
  const root = people.find((p) => p.role === 'Root person');
  const oldestYear = people
    .map((p) => p.birthYear)
    .filter(Boolean)
    .sort()[0] || '';

  const subtitle = countries.length > 0
    ? `Tracing the ${familySurname} family from ${countries.join(', ')}.`
    : `Tracing the ${familySurname} family history.`;

  const footerTagline = countries.length > 0
    ? `${generationsTraced} Generation${generationsTraced !== 1 ? 's' : ''} · ${countries.join(', ')}`
    : `${generationsTraced} Generation${generationsTraced !== 1 ? 's' : ''}`;

  return JSON.stringify({
    familyName: familySurname,
    siteTitle: `${familySurname} Family Ancestry`,
    heroSubtitle: subtitle,
    researcher,
    footerTagline,
    oldestRecord: oldestYear,
    generationsTraced,
    rootPersonId: root?.gedcomId ?? 'I1',
  }, null, 2) + '\n';
}

// ── Main ───────────────────────────────────────────────────

async function main(): Promise<void> {
  // Resolve project root
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  let projectRoot: string;

  const projectRootArg = process.argv.find((a) => a.startsWith('--project-root='));
  if (projectRootArg) {
    projectRoot = resolve(process.cwd(), projectRootArg.split('=')[1]);
  } else {
    // Default: assume run from project root, or 2 dirs up from site/scripts/
    const cwd = process.cwd();
    if (existsSync(join(cwd, 'toolkit', 'site'))) {
      projectRoot = cwd;
    } else {
      projectRoot = resolve(scriptDir, '..', '..');
    }
  }

  // Pre-flight: verify toolkit exists
  if (!existsSync(join(projectRoot, 'toolkit', 'site'))) {
    // Maybe we ARE the toolkit — check if we're inside it
    const upTwo = resolve(scriptDir, '..', '..');
    if (existsSync(join(upTwo, 'site', 'scripts', 'init-project.ts'))) {
      // We're inside toolkit/site/scripts — project root is 2 more levels up
      projectRoot = resolve(upTwo, '..', '..');
    }
    if (!existsSync(join(projectRoot, 'toolkit', 'site'))) {
      console.error(
        '\n❌ Could not find toolkit/site/ directory.\n' +
        'Run this from your project root (the directory containing the toolkit/ submodule).\n' +
        'Or pass --project-root=<path>\n',
      );
      process.exit(1);
    }
  }

  console.log('\n🌳 Ancestry Autoresearch Toolkit — Project Setup\n');
  console.log(`Project root: ${projectRoot}\n`);

  // ── Phase 1: Project Basics ──────────────────────────────

  const familySurname = await input({
    message: 'Family surname:',
    validate: (v) => {
      if (!v.trim()) return 'Surname is required';
      if (!/^[a-zA-Z-]+$/.test(v.trim())) return 'Letters and hyphens only';
      return true;
    },
    transformer: (v) => v.trim(),
  });

  const vaultDir = `${familySurname}_Genealogy`;

  // Check if vault already exists
  if (existsSync(join(projectRoot, vaultDir))) {
    console.error(`\n❌ ${vaultDir}/ already exists. Aborting to prevent overwriting.\n`);
    process.exit(1);
  }

  const researcher = await input({
    message: 'Your name (researcher):',
    validate: (v) => v.trim() ? true : 'Name is required',
  });

  const countriesRaw = await input({
    message: 'Where did your ancestors come from? Countries/regions (comma-separated, enter to skip):',
  });
  const countries = countriesRaw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  const researchGoals = await input({
    message: 'Research goals (enter to skip):',
  });

  // ── Phase 2: Family Tree Walkthrough ─────────────────────

  console.log('\n🌲 Family Tree — enter what you know (all fields except name are optional)\n');

  const people: PersonEntry[] = [];
  let nextId = 1;
  const getId = () => `I${nextId++}`;

  // Root person
  const rootGender = await input({
    message: 'Root person — gender (M/F, enter to skip):',
    validate: (v) => {
      if (v && !['M', 'F', 'm', 'f'].includes(v.trim())) return 'Enter M or F';
      return true;
    },
  });

  const root = await promptPerson(
    'Root person',
    getId(),
    (rootGender.trim().toUpperCase() as 'M' | 'F') || '',
    true,
  );
  if (!root) { process.exit(1); }
  people.push(root);

  // Root's spouse
  const rootSpouseGender: 'M' | 'F' | '' = root.gender === 'M' ? 'F' : root.gender === 'F' ? 'M' : '';
  const rootSpouse = await promptSpouse(root.fullName, getId(), rootSpouseGender);
  if (rootSpouse) {
    rootSpouse.spouseId = root.gedcomId;
    root.spouseId = rootSpouse.gedcomId;
    people.push(rootSpouse);
  }

  // Father
  const father = await promptPerson(
    `${root.givenName}'s father`,
    getId(),
    'M',
    false,
  );
  if (father) {
    people.push(father);
    root.fatherId = father.gedcomId;
    father.childIds.push(root.gedcomId);

    // Father's spouse (root's mother)
    const mother = await promptPerson(
      `${root.givenName}'s mother`,
      getId(),
      'F',
      false,
    );
    if (mother) {
      people.push(mother);
      root.motherId = mother.gedcomId;
      mother.childIds.push(root.gedcomId);
      father.spouseId = mother.gedcomId;
      mother.spouseId = father.gedcomId;
    }

    // Paternal grandfather
    const pgf = await promptPerson(
      `${father.givenName}'s father (paternal grandfather)`,
      getId(),
      'M',
      false,
    );
    if (pgf) {
      people.push(pgf);
      father.fatherId = pgf.gedcomId;
      pgf.childIds.push(father.gedcomId);
    }

    // Paternal grandmother
    const pgm = await promptPerson(
      `${father.givenName}'s mother (paternal grandmother)`,
      getId(),
      'F',
      false,
    );
    if (pgm) {
      people.push(pgm);
      father.motherId = pgm.gedcomId;
      pgm.childIds.push(father.gedcomId);
      if (pgf) {
        pgf.spouseId = pgm.gedcomId;
        pgm.spouseId = pgf.gedcomId;
      }
    }
  } else {
    // No father — still ask about mother
    const mother = await promptPerson(
      `${root.givenName}'s mother`,
      getId(),
      'F',
      false,
    );
    if (mother) {
      people.push(mother);
      root.motherId = mother.gedcomId;
      mother.childIds.push(root.gedcomId);
    }
  }

  // If mother was entered, ask for maternal grandparents
  const motherEntry = people.find(
    (p) => p.gedcomId === root.motherId,
  );
  if (motherEntry) {
    const mgf = await promptPerson(
      `${motherEntry.givenName}'s father (maternal grandfather)`,
      getId(),
      'M',
      false,
    );
    if (mgf) {
      people.push(mgf);
      motherEntry.fatherId = mgf.gedcomId;
      mgf.childIds.push(motherEntry.gedcomId);
    }

    const mgm = await promptPerson(
      `${motherEntry.givenName}'s mother (maternal grandmother)`,
      getId(),
      'F',
      false,
    );
    if (mgm) {
      people.push(mgm);
      motherEntry.motherId = mgm.gedcomId;
      mgm.childIds.push(motherEntry.gedcomId);
      if (mgf) {
        mgf.spouseId = mgm.gedcomId;
        mgm.spouseId = mgf.gedcomId;
      }
    }
  }

  // ── Phase 3: Additional Surnames + GEDCOM ────────────────

  // Collect all unique surnames from entered people
  const autoSurnames = [...new Set(people.map((p) => birthSurname(p)))].sort();
  console.log(`\n📋 Surnames captured: ${autoSurnames.join(', ')}`);

  const moreSurnamesRaw = await input({
    message: 'Any other surnames to research? (comma-separated, enter to skip):',
  });
  const moreSurnames = moreSurnamesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allSurnames = [...new Set([...autoSurnames, ...moreSurnames])].sort();

  // Calculate generations
  let maxGen = 1;
  const fatherEntry = people.find((p) => p.gedcomId === root.fatherId);
  if (fatherEntry || motherEntry) maxGen = 2;
  if (fatherEntry?.fatherId || fatherEntry?.motherId || motherEntry?.fatherId || motherEntry?.motherId) maxGen = 3;

  // GEDCOM import
  let gedcomFile = '';
  const hasGedcom = await confirm({
    message: 'Do you have a GEDCOM file to import?',
    default: false,
  });
  if (hasGedcom) {
    gedcomFile = await input({
      message: 'Path to GEDCOM file:',
      validate: (v) => {
        if (!v.trim()) return 'Path is required';
        const p = resolve(projectRoot, v.trim());
        if (!existsSync(p)) return `File not found: ${p}`;
        if (!v.trim().toLowerCase().endsWith('.ged')) return 'File must have .ged extension';
        return true;
      },
    });
  }

  // ── Confirmation ─────────────────────────────────────────

  const config: ProjectConfig = {
    familySurname,
    researcher,
    countries,
    researchGoals: researchGoals.trim(),
    people,
    surnames: allSurnames,
    generationsTraced: maxGen,
    gedcomFile: gedcomFile.trim(),
  };

  console.log('\n════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('════════════════════════════════════════════════');
  console.log(`  Vault directory:  ${vaultDir}/`);
  console.log(`  Researcher:       ${researcher}`);
  console.log(`  Surnames:         ${allSurnames.join(', ')}`);
  console.log(`  Countries:        ${countries.length > 0 ? countries.join(', ') : '(none)'}`);
  console.log(`  People:           ${people.length}`);
  console.log(`  Generations:      ${maxGen}`);
  if (gedcomFile) console.log(`  GEDCOM import:    ${gedcomFile}`);
  console.log('');
  console.log('  Files to create:');
  console.log(`    ${vaultDir}/site-config.json`);
  console.log(`    ${vaultDir}/Family_Tree.md`);
  console.log(`    ${vaultDir}/Open_Questions.md`);
  console.log(`    ${vaultDir}/Research_Log.md`);
  console.log(`    ${vaultDir}/Research_Strategy.md`);
  console.log(`    ${vaultDir}/Summary_Report.md`);
  console.log(`    ${vaultDir}/media/_Media_Index.md`);
  for (const p of people) {
    const filing = birthSurname(p);
    const fn = toFilename(filing, p.givenName);
    console.log(`    ${vaultDir}/people/${filing}/${fn}.md`);
  }
  console.log('    package.json');
  console.log('    .gitignore');
  console.log('    CLAUDE.md');
  console.log('════════════════════════════════════════════════\n');

  const proceed = await confirm({
    message: 'Create these files?',
    default: true,
  });

  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  // ── Create Everything ────────────────────────────────────

  const vaultRoot = join(projectRoot, vaultDir);

  // Directories
  const dirs = [
    'people',
    'sources/obituaries',
    'sources/cemetery',
    'sources/census',
    'sources/church',
    'media/gravestones',
    'media/portraits',
    'media/newspapers',
    'media/documents',
    'dna',
  ];

  // Add surname directories for people
  const surnameDirs = [...new Set(people.map((p) => `people/${birthSurname(p)}`))];
  dirs.push(...surnameDirs);

  for (const dir of dirs) {
    mkdirSync(join(vaultRoot, dir), { recursive: true });
  }

  // Person files
  for (const person of people) {
    const filing = birthSurname(person);
    const filename = toFilename(filing, person.givenName);
    const filePath = join(vaultRoot, 'people', filing, `${filename}.md`);
    writeFileSync(filePath, generatePersonFile(person, people));
  }

  // Vault-level docs
  writeFileSync(join(vaultRoot, 'site-config.json'), generateSiteConfig(config));
  writeFileSync(join(vaultRoot, 'Family_Tree.md'), generateFamilyTree(config));
  writeFileSync(join(vaultRoot, 'Open_Questions.md'), generateOpenQuestions(config));
  writeFileSync(join(vaultRoot, 'Research_Log.md'), generateResearchLog(config));
  writeFileSync(join(vaultRoot, 'Research_Strategy.md'), generateResearchStrategy(config));
  writeFileSync(join(vaultRoot, 'Summary_Report.md'), generateSummaryReport(config));
  writeFileSync(join(vaultRoot, 'media', '_Media_Index.md'), generateMediaIndex());

  // Root project files
  writeFileSync(join(projectRoot, 'package.json'), generatePackageJson(familySurname, vaultDir));
  writeFileSync(join(projectRoot, '.gitignore'), generateGitignore(vaultDir));
  writeFileSync(join(projectRoot, 'CLAUDE.md'), generateClaudeMd(familySurname, vaultDir));

  console.log('\n✅ Project scaffolded!\n');

  // GEDCOM import
  if (gedcomFile) {
    console.log('📥 Importing GEDCOM file...\n');
    try {
      const gedPath = resolve(projectRoot, gedcomFile);
      const importScript = join(projectRoot, 'toolkit', 'site', 'scripts', 'import-gedcom.ts');
      execSync(
        `npx tsx "${importScript}" "${gedPath}" --out-dir "${join(vaultRoot, 'people')}"`,
        { cwd: join(projectRoot, 'toolkit', 'site'), stdio: 'inherit' },
      );
      console.log('\n✅ GEDCOM import complete!\n');
    } catch {
      console.error('\n⚠️  GEDCOM import failed. You can retry manually:\n');
      console.error(`  npm run import:gedcom -- "${gedcomFile}"\n`);
    }
  }

  // Install dependencies
  console.log('📦 Installing dependencies...\n');
  try {
    execSync('npm run setup', { cwd: projectRoot, stdio: 'inherit' });
    console.log('\n✅ Dependencies installed!\n');
  } catch {
    console.error('\n⚠️  npm install failed. Run manually: npm run setup\n');
  }

  // Next steps
  console.log('════════════════════════════════════════════════');
  console.log('  Next Steps');
  console.log('════════════════════════════════════════════════');
  console.log('');
  console.log('  1. npm run dev          — Start the dev server');
  console.log('  2. npm run validate     — Check vault integrity');
  console.log('  3. Start researching!   — Add sources, update person files');
  console.log('');
  console.log(`  Vault rules:  toolkit/METHODOLOGY.md`);
  console.log(`  Templates:    toolkit/templates/`);
  console.log('');
  console.log('════════════════════════════════════════════════\n');
}

main().catch((err) => {
  if (err.name === 'ExitPromptError') {
    console.log('\nAborted.');
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
