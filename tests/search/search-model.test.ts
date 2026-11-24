import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';
import fs from 'fs';

const TMP_FILE = '/tmp/test-search-model.db';

beforeEach(async () => {
  await initDb(TMP_FILE);
});

afterEach(() => {
  closeDb();
  try {
    fs.unlinkSync(TMP_FILE);
  } catch (e) {
    // ignore
  }
});

const search = (q: any): any[] => (Book as any).searchBooks(q);

function expectValidation(fn: () => unknown, message: string) {
  let err: any;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeDefined();
  const Cls = (Book as any).SearchValidationError;
  expect(typeof Cls).toBe('function');
  expect(err).toBeInstanceOf(Cls);
  expect(err.message).toBe(message);
}

describe('Book.searchBooks', () => {
  it('AC1 matches title partial case-insensitive', () => {
    expect(search('prag').map((b) => b.title)).toContain('The Pragmatic Programmer');
    expect(search('PRAG').map((b) => b.title)).toContain('The Pragmatic Programmer');
  });

  it('AC1 matches author partial case-insensitive', () => {
    const res = search('HUNT');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((b) => /hunt/i.test(b.author))).toBe(true);
    expect(res.map((b) => b.title)).toContain('The Pragmatic Programmer');
  });

  it('AC1 orwell finds 1984', () => {
    expect(search('orwell').map((b) => b.title)).toContain('1984');
  });

  it('AC1 results are Book rows ordered by title', () => {
    const res = search('an');
    expect(res.length).toBeGreaterThan(1);
    const titles = res.map((b) => b.title);
    expect(titles).toEqual([...titles].sort());
    for (const k of ['id', 'title', 'author', 'isbn', 'cover_url', 'description', 'published_year', 'created_at']) {
      expect(res[0]).toHaveProperty(k);
    }
  });

  it('AC2 empty query returns all 50 books ordered by title', () => {
    const res = search('');
    expect(res).toHaveLength(50);
    expect(res[0].title).toBe('1984');
    expect(res.map((b) => b.title)).toEqual(Book.getAllBooks().map((b) => b.title));
  });

  it('AC2 whitespace-only query returns all books', () => {
    expect(search('   ')).toHaveLength(50);
    expect(search('\t \n')).toHaveLength(50);
  });

  it('AC3 trims input before matching', () => {
    const a = search('  dune  ');
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(search('dune'));
  });

  it('AC3 length check happens after trim', () => {
    expect(search('  ' + 'a'.repeat(100) + '  ')).toEqual([]);
    expectValidation(() => search('  ' + 'a'.repeat(101) + '  '), 'Search query must be 100 characters or fewer');
  });

  it('AC4 exactly 100 characters is allowed', () => {
    expect(search('a'.repeat(100))).toEqual([]);
  });

  it('AC4 101 characters throws SearchValidationError', () => {
    expectValidation(() => search('a'.repeat(101)), 'Search query must be 100 characters or fewer');
  });

  it('AC5 percent is matched literally', () => {
    expect(search('%')).toEqual([]);
  });

  it('AC5 underscore and backslash are matched literally', () => {
    expect(search('_')).toEqual([]);
    expect(search('\\')).toEqual([]);
    expect(search('d_ne')).toEqual([]);
  });

  it('AC5 SQL-looking input is plain text and books are unchanged', () => {
    expect(search("' OR 1=1 --")).toEqual([]);
    expect(search("'; DELETE FROM books; --")).toEqual([]);
    expect(Book.getAllBooks()).toHaveLength(50);
  });

  it('AC6 non-string query throws SearchValidationError', () => {
    expectValidation(() => search(['a', 'b']), 'Search query must be a single string');
  });

  it('AC7 no match returns empty array', () => {
    expect(search('zzzz')).toEqual([]);
  });
});
