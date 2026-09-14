import Database from 'better-sqlite3';

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  created_at: string;
}

export function getAllBooks(db: Database.Database): Book[] {
  return db.prepare('SELECT * FROM books ORDER BY title').all() as Book[];
}

export function getBookById(db: Database.Database, id: number): Book | undefined {
  return db.prepare('SELECT * FROM books WHERE id = ?').get(id) as Book | undefined;
}

export function searchBooks(db: Database.Database, query: string): Book[] {
  const pattern = `%${query}%`;
  return db.prepare(
    'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title'
  ).all(pattern, pattern) as Book[];
}

export function createBook(
  db: Database.Database,
  data: Omit<Book, 'id' | 'created_at'>
): Book {
  const stmt = db.prepare(`
    INSERT INTO books (title, author, isbn, cover_url, description, published_year)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.title,
    data.author,
    data.isbn,
    data.cover_url,
    data.description,
    data.published_year
  );
  return getBookById(db, result.lastInsertRowid as number)!;
}

export function updateBook(
  db: Database.Database,
  id: number,
  data: Partial<Omit<Book, 'id' | 'created_at'>>
): Book | undefined {
  const existing = getBookById(db, id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.author !== undefined) {
    updates.push('author = ?');
    values.push(data.author);
  }
  if (data.isbn !== undefined) {
    updates.push('isbn = ?');
    values.push(data.isbn);
  }
  if (data.cover_url !== undefined) {
    updates.push('cover_url = ?');
    values.push(data.cover_url);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (data.published_year !== undefined) {
    updates.push('published_year = ?');
    values.push(data.published_year);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getBookById(db, id);
}

export function deleteBook(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  return result.changes > 0;
}
