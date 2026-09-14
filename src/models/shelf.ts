import Database from 'better-sqlite3';

export interface Shelf {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

export interface ShelfWithBooks extends Shelf {
  username: string;
  books: ShelfBook[];
}

export interface ShelfBook {
  book_id: number;
  added_at: string;
  title: string;
  author: string;
}

export function getShelvesByUserId(db: Database.Database, userId: number): Shelf[] {
  return db.prepare(
    'SELECT * FROM shelves WHERE user_id = ? ORDER BY name'
  ).all(userId) as Shelf[];
}

export function getShelfById(db: Database.Database, id: number): Shelf | undefined {
  return db.prepare('SELECT * FROM shelves WHERE id = ?').get(id) as Shelf | undefined;
}

export function getShelfWithBooks(db: Database.Database, shelfId: number): ShelfWithBooks | undefined {
  const shelf = db.prepare(`
    SELECT s.*, u.username
    FROM shelves s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(shelfId) as (Shelf & { username: string }) | undefined;

  if (!shelf) return undefined;

  const books = db.prepare(`
    SELECT sb.book_id, sb.added_at, b.title, b.author
    FROM shelf_books sb
    JOIN books b ON sb.book_id = b.id
    WHERE sb.shelf_id = ?
    ORDER BY b.title
  `).all(shelfId) as ShelfBook[];

  return { ...shelf, books };
}

export function createShelf(db: Database.Database, userId: number, name: string): Shelf {
  const stmt = db.prepare('INSERT INTO shelves (user_id, name) VALUES (?, ?)');
  const result = stmt.run(userId, name);
  return getShelfById(db, result.lastInsertRowid as number)!;
}

export function deleteShelf(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM shelves WHERE id = ?').run(id);
  return result.changes > 0;
}

export function addBookToShelf(db: Database.Database, shelfId: number, bookId: number): boolean {
  const existing = db.prepare(
    'SELECT 1 FROM shelf_books WHERE shelf_id = ? AND book_id = ?'
  ).get(shelfId, bookId);

  if (existing) return false;

  db.prepare(
    'INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)'
  ).run(shelfId, bookId);
  return true;
}

export function removeBookFromShelf(db: Database.Database, shelfId: number, bookId: number): boolean {
  const result = db.prepare(
    'DELETE FROM shelf_books WHERE shelf_id = ? AND book_id = ?'
  ).run(shelfId, bookId);
  return result.changes > 0;
}

export function getShelvesForBook(db: Database.Database, userId: number, bookId: number): Shelf[] {
  return db.prepare(`
    SELECT s.*
    FROM shelves s
    JOIN shelf_books sb ON s.id = sb.shelf_id
    WHERE s.user_id = ? AND sb.book_id = ?
    ORDER BY s.name
  `).all(userId, bookId) as Shelf[];
}
