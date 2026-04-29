import type { SiteConfig } from './siteConfig'

export interface ChildRef {
  name: string;
  id: string;
  link: string;
  spouseIndex?: number;
}

export interface SpouseRef {
  name: string;
  id: string;
  marriageDate: string;
  link: string;
}

export interface Person {
  id: string;
  name: string;
  gender: string;
  born: string;
  died: string;
  family: string;
  privacy: boolean;
  confidence: string;
  sources: string[];
  media: MediaEntry[];
  filePath: string;
  slug: string;
  father: string;
  fatherName: string;
  mother: string;
  motherName: string;
  spouses: SpouseRef[];
  children: ChildRef[];
  biography: string;
  birthDateAnalysis: string;
  birthplace: string;
  deathPlace: string;
  burial: string;
  religion: string;
  occupation: string;
  military: string;
  immigration: string;
  emigration: string;
  naturalization: string;
  causeOfDeath: string;
  confirmation: string;
  baptized: string;
  christened: string;
  nickname: string;
  marriedName: string[];
  alsoKnownAs: string[];
  education: string;
  residence: string;
  familySearchId: string;
  divorce: string;
  cremation: string;
  created: string;
}

export interface MediaEntry {
  path: string;
  person: string;
  sourceUrl: string;
  dateDownloaded: string;
  description: string;
  type: string;
}

export interface SourceEntry {
  id: string;
  file: string;
  person: string;
  personIds: string[];
  subjectPersonIds: string[];
  date: string;
  publisher: string;
  type: string;
  recordTypes: string[];
  title: string;
  reliability: string;
  fagNumber: string;
  record: string;
  year: string;
  slug: string;
  fullText: string;
  url: string;
  persons: string[];
  families: string[];
  extractedFacts: string;
  notes: string;
  translationSlug: string;
  ocrVerified: boolean | null;
  language: string;
  media: MediaEntry[];
  created: string;
}

export interface Stats {
  totalPeople: number;
  totalSources: number;
  totalMedia: number;
  oldestAncestor: string;
  generationsTraced: number;
  familyLines: string[];
}

export interface SiteData {
  people: Person[];
  media: MediaEntry[];
  sources: SourceEntry[];
  stats: Stats;
  report: string;
  translations: Record<string, string>;
  immigrationStories: string;
  config: SiteConfig;
  geocodedLocations: Record<string, [number, number] | null>;
}
