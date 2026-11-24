import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';

const TMP_FILE = '/tmp/test-search-routes.db';

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

const get = (q?: string) =>
  request(app).get('/api/books/search').query(q === undefined ? {} : { q });

describe('GET /api/books/search', () => {
  it('AC1 matches title partial case-insensitive', async () => {
    const res = await get('prag');
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.title)).toContain('The Pragmatic Programmer');
  });

  it('AC1 matches author case-insensitive', async () => {
    const res = await get('HUNT');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((b: any) => /hunt/i.test(b.author))).toBe(true);
    const o = await get('orwell');
    expect(o.body.map((b: any) => b.title)).toContain('1984');
  });

  it('AC1 results have Book shape and are ordered by title', async () => {
    const res = await get('an');
    expect(res.status).toBe(200);
    const titles = res.body.map((b: any) => b.title);
    expect(titles).toEqual([...titles].sort());
    for (const k of ['id', 'title', 'author', 'isbn', 'cover_url', 'description', 'published_year', 'created_at']) {
      expect(res.body[0]).toHaveProperty(k);
    }
  });

  it('AC2 missing q returns all 50 books', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
    expect(res.body[0].title).toBe('1984');
  });

  it('AC2 empty q= returns all books', async () => {
    const res = await request(app).get('/api/books/search?q=');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('AC2 whitespace-only q returns all books', async () => {
    const res = await request(app).get('/api/books/search?q=%20%20%20');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('AC3 trims input', async () => {
    const a = await get('  dune  ');
    const b = await get('dune');
    expect(a.status).toBe(200);
    expect(a.body.length).toBeGreaterThan(0);
    expect(a.body).toEqual(b.body);
  });

  it('AC4 exactly 100 characters returns 200 []', async () => {
    const res = await get('a'.repeat(100));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('AC4 101 characters returns 400 with message', async () => {
    const res = await get('a'.repeat(101));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search query must be 100 characters or fewer' });
  });

  it('AC5 percent matches literally', async () => {
    const res = await get('%');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('AC5 underscore and backslash match literally', async () => {
    const u = await get('_');
    expect(u.status).toBe(200);
    expect(u.body).toEqual([]);
    const b = await get('\\');
    expect(b.status).toBe(200);
    expect(b.body).toEqual([]);
  });

  it('AC5 SQL injection input is text and books unchanged', async () => {
    const res = await get("' OR 1=1 --");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    const other = await get("'; DELETE FROM books; --");
    expect(other.status).toBe(200);
    expect((await request(app).get('/api/books')).body).toHaveLength(50);
  });

  it('AC6 repeated q returns 400', async () => {
    const res = await request(app).get('/api/books/search?q=a&q=b');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search query must be a single string' });
  });

  it('AC6 object-style q returns 400', async () => {
    const res = await request(app).get('/api/books/search?q[x]=a');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Search query must be a single string' });
  });

  it('AC7 no match returns 200 []', async () => {
    const res = await get('zzzz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /books/search (HTML)', () => {
  const html = (q?: string) =>
    request(app).get('/books/search').query(q === undefined ? {} : { q });

  it('AC1 returns book-grid with matching books', async () => {
    const res = await html('PRAG');
    expect(res.status).toBe(200);
    expect(res.text).toContain('book-grid');
    expect(res.text).toContain('The Pragmatic Programmer');
    expect(res.text).not.toContain('Dune');
  });

  it('AC1 matches author case-insensitively', async () => {
    const res = await html('orwell');
    expect(res.status).toBe(200);
    expect(res.text).toContain('1984');
  });

  it('AC2 empty and missing q return all books', async () => {
    for (const r of [await html(), await html(''), await html('   ')]) {
      expect(r.status).toBe(200);
      expect(r.text).toContain('book-grid');
      expect(r.text).toContain('Dune');
      expect(r.text).toContain('The Pragmatic Programmer');
    }
  });

  it('AC3 trims input', async () => {
    const res = await html('  dune  ');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dune');
    expect(res.text).not.toContain('The Pragmatic Programmer');
  });

  it('AC4 100 characters is 200 no results, 101 is 400', async () => {
    const ok = await html('a'.repeat(100));
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('<p class="no-results">No books found</p>');
    const bad = await html('a'.repeat(101));
    expect(bad.status).toBe(400);
    expect(bad.text).toContain('<p class="error">Search query must be 100 characters or fewer</p>');
  });

  it('AC5 special characters are literal', async () => {
    for (const q of ['%', '_', '\\', "' OR 1=1 --"]) {
      const res = await html(q);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<p class="no-results">No books found</p>');
    }
  });

  it('AC6 repeated q returns 400 error paragraph', async () => {
    const res = await request(app).get('/books/search?q=a&q=b');
    expect(res.status).toBe(400);
    expect(res.text).toContain('<p class="error">Search query must be a single string</p>');
  });

  it('AC7 no match returns 200 with No books found', async () => {
    const res = await html('zzzz');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<p class="no-results">No books found</p>');
  });
});
