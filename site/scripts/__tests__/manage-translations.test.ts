import { describe, it, expect } from 'vitest';
import {
  translationFilename,
  filenameToSlug,
  isNonEnglish,
  generateTranslationStub,
} from '../manage-translations.js';

// ── translationFilename ──

describe('translationFilename', () => {
  it('converts source ID and language into a filename', () => {
    expect(translationFilename('SRC-OBIT-024', 'German')).toBe('SRC-OBIT-024_GERMAN_to_ENGLISH.md');
  });

  it('handles IDs with unusual characters', () => {
    expect(translationFilename('SRC.NEWS.001', 'Dutch')).toBe('SRC_NEWS_001_DUTCH_to_ENGLISH.md');
  });

  it('strips non-alpha from language', () => {
    expect(translationFilename('SRC-CERT-001', 'Old French')).toBe('SRC-CERT-001_OLDFRENCH_to_ENGLISH.md');
  });
});

// ── filenameToSlug ──

describe('filenameToSlug', () => {
  it('converts filename to slug matching build-data.ts convention', () => {
    expect(filenameToSlug('SRC-OBIT-024_GERMAN_to_ENGLISH.md')).toBe('src-obit-024-german-to-english');
  });

  it('lowercases and replaces underscores with hyphens', () => {
    expect(filenameToSlug('My_Document_ENGLISH.md')).toBe('my-document-english');
  });
});

// ── isNonEnglish ──

describe('isNonEnglish', () => {
  it('returns false for undefined/empty', () => {
    expect(isNonEnglish(undefined)).toBe(false);
    expect(isNonEnglish('')).toBe(false);
    expect(isNonEnglish('  ')).toBe(false);
  });

  it('returns false for English variants', () => {
    expect(isNonEnglish('English')).toBe(false);
    expect(isNonEnglish('english')).toBe(false);
    expect(isNonEnglish('en')).toBe(false);
    expect(isNonEnglish('EN')).toBe(false);
  });

  it('returns true for non-English languages', () => {
    expect(isNonEnglish('German')).toBe(true);
    expect(isNonEnglish('Dutch')).toBe(true);
    expect(isNonEnglish('French')).toBe(true);
    expect(isNonEnglish('Polish')).toBe(true);
  });
});

// ── generateTranslationStub ──

describe('generateTranslationStub', () => {
  it('generates a stub with source info', () => {
    const stub = generateTranslationStub({
      file: 'obituaries/OBIT_Mueller_1920.md',
      sourceId: 'SRC-OBIT-024',
      title: 'Obituary of Hans Mueller',
      language: 'German',
      translationSlug: '',
      sourceType: 'obituary',
    });

    expect(stub).toContain('English Translation — Obituary of Hans Mueller');
    expect(stub).toContain('SRC-OBIT-024');
    expect(stub).toContain('German');
    expect(stub).toContain('## Translation');
    expect(stub).toContain('## Translation Notes');
  });

  it('includes translation status as pending', () => {
    const stub = generateTranslationStub({
      file: 'test.md',
      sourceId: 'SRC-TEST-001',
      title: 'Test',
      language: 'Dutch',
      translationSlug: '',
      sourceType: 'certificate',
    });

    expect(stub).toContain('Pending');
  });
});
