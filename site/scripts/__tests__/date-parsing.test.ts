import { describe, it, expect } from 'vitest';
import { parseFullDate, parseMarriageDate, parseDateFromText } from '../../src/onThisDayEvents.js';

// ── parseFullDate — previously only handled ISO ──

describe('parseFullDate', () => {
  it('parses ISO date', () => {
    expect(parseFullDate('1920-03-15')).toEqual({ year: 1920, month: 3, day: 15 });
  });

  it('parses "Month DD, YYYY"', () => {
    expect(parseFullDate('March 15, 1920')).toEqual({ year: 1920, month: 3, day: 15 });
  });

  it('parses "Month DD YYYY" (no comma)', () => {
    expect(parseFullDate('June 1 1945')).toEqual({ year: 1945, month: 6, day: 1 });
  });

  it('parses abbreviated "Mon DD, YYYY"', () => {
    expect(parseFullDate('Jun 1, 1945')).toEqual({ year: 1945, month: 6, day: 1 });
  });

  it('parses "DD Month YYYY"', () => {
    expect(parseFullDate('15 March 1920')).toEqual({ year: 1920, month: 3, day: 15 });
    expect(parseFullDate('1 Jun 1945')).toEqual({ year: 1945, month: 6, day: 1 });
  });

  it('returns null for approximate dates', () => {
    expect(parseFullDate('~1920')).toBeNull();
  });

  it('returns null for Unknown', () => {
    expect(parseFullDate('Unknown')).toBeNull();
  });

  it('returns null for em dash', () => {
    expect(parseFullDate('\u2014')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseFullDate('')).toBeNull();
  });

  it('returns null for year-only', () => {
    expect(parseFullDate('1920')).toBeNull();
  });
});

// ── parseMarriageDate — previously only handled "Month DD, YYYY" ──

describe('parseMarriageDate', () => {
  it('parses "Month DD, YYYY"', () => {
    expect(parseMarriageDate('Jun 1, 1945')).toEqual({ month: 6, day: 1, year: 1945, location: '' });
  });

  it('parses "Month DD, YYYY" with location', () => {
    const result = parseMarriageDate('June 1, 1945, Green Bay, WI');
    expect(result).toEqual({ month: 6, day: 1, year: 1945, location: 'Green Bay, WI' });
  });

  it('parses ISO date', () => {
    expect(parseMarriageDate('1945-06-01')).toEqual({ month: 6, day: 1, year: 1945, location: '' });
  });

  it('parses ISO date with location', () => {
    const result = parseMarriageDate('1945-06-01, Green Bay, WI');
    expect(result).toEqual({ month: 6, day: 1, year: 1945, location: 'Green Bay, WI' });
  });

  it('parses "DD Month YYYY"', () => {
    expect(parseMarriageDate('1 June 1945')).toEqual({ month: 6, day: 1, year: 1945, location: '' });
  });

  it('parses "DD Month YYYY" with location', () => {
    const result = parseMarriageDate('15 March 1920, Milwaukee, WI');
    expect(result).toEqual({ month: 3, day: 15, year: 1920, location: 'Milwaukee, WI' });
  });

  it('returns null for approximate dates', () => {
    expect(parseMarriageDate('~1920')).toBeNull();
  });

  it('returns null for wikilinks', () => {
    expect(parseMarriageDate('[[people/Doe.md]]')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMarriageDate('')).toBeNull();
  });

  it('strips trailing parens from location', () => {
    const result = parseMarriageDate('Jun 1, 1945, Green Bay)');
    expect(result!.location).toBe('Green Bay');
  });
});

// ── parseDateFromText — already supported all 3 formats, verify it still works ──

describe('parseDateFromText', () => {
  it('parses ISO from freeform text', () => {
    const result = parseDateFromText('1920-03-15, Kewaunee, WI');
    expect(result).toEqual({ year: 1920, month: 3, day: 15, remainder: 'Kewaunee, WI' });
  });

  it('parses "Month DD, YYYY" from text', () => {
    const result = parseDateFromText('March 15, 1920 in Wisconsin');
    expect(result).toEqual({ year: 1920, month: 3, day: 15, remainder: 'in Wisconsin' });
  });

  it('parses "DD Month YYYY" from text', () => {
    const result = parseDateFromText('15 March 1920, Kewaunee');
    expect(result).toEqual({ year: 1920, month: 3, day: 15, remainder: 'Kewaunee' });
  });

  it('returns null for approximate', () => {
    expect(parseDateFromText('~1920')).toBeNull();
  });

  it('returns null for empty', () => {
    expect(parseDateFromText('')).toBeNull();
  });
});
