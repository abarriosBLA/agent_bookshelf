import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb, getDb } from '../src/db/index.js';
import Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = initDb('/tmp/test-bookshelf.db');
});

afterEach(() => {
  closeDb();
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/test-bookshelf.db');
  } catch (e) {
    // ignore
  }
});

describe('Database', () => {
  it('initializes with seed data', () => {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    expect(users.count).toBe(3);
  });

  it('seeds 50 books', () => {
    const books = db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number };
    expect(books.count).toBe(50);
  });

  it('creates shelves for each user', () => {
    const shelves = db.prepare('SELECT COUNT(*) as count FROM shelves').get() as { count: number };
    expect(shelves.count).toBe(9); // 3 users × 3 shelves each
  });

  it('seeds sample reviews', () => {
    const reviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get() as { count: number };
    expect(reviews.count).toBeGreaterThan(0);
  });
});
