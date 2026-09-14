import { afterAll, afterEach, beforeEach } from 'vitest';
import { closeDb, initDb } from '../src/db/index.js';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = '/tmp/test-bookshelf.db';

beforeEach(() => {
  initDb(TEST_DB_PATH);
});

afterEach(() => {
  closeDb();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch (e) {
    // ignore
  }
});
