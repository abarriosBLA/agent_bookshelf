import Database from 'better-sqlite3';

export interface Review {
  id: number;
  user_id: number;
  book_id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface ReviewWithDetails extends Review {
  username: string;
  display_name: string;
  book_title: string;
  book_author: string;
}

export function getReviewsByBookId(db: Database.Database, bookId: number): ReviewWithDetails[] {
  return db.prepare(`
    SELECT r.*, u.username, u.display_name, b.title as book_title, b.author as book_author
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(bookId) as ReviewWithDetails[];
}

export function getReviewsByUserId(db: Database.Database, userId: number): ReviewWithDetails[] {
  return db.prepare(`
    SELECT r.*, u.username, u.display_name, b.title as book_title, b.author as book_author
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(userId) as ReviewWithDetails[];
}

export function getReviewById(db: Database.Database, id: number): ReviewWithDetails | undefined {
  return db.prepare(`
    SELECT r.*, u.username, u.display_name, b.title as book_title, b.author as book_author
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN books b ON r.book_id = b.id
    WHERE r.id = ?
  `).get(id) as ReviewWithDetails | undefined;
}

export function getReviewByUserAndBook(
  db: Database.Database,
  userId: number,
  bookId: number
): Review | undefined {
  return db.prepare(
    'SELECT * FROM reviews WHERE user_id = ? AND book_id = ?'
  ).get(userId, bookId) as Review | undefined;
}

export function createReview(
  db: Database.Database,
  userId: number,
  bookId: number,
  rating: number,
  reviewText?: string
): Review {
  const stmt = db.prepare(`
    INSERT INTO reviews (user_id, book_id, rating, review_text)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(userId, bookId, rating, reviewText || null);
  return getReviewById(db, result.lastInsertRowid as number)!;
}

export function updateReview(
  db: Database.Database,
  id: number,
  data: { rating?: number; reviewText?: string }
): Review | undefined {
  const existing = getReviewById(db, id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.rating !== undefined) {
    updates.push('rating = ?');
    values.push(data.rating);
  }
  if (data.reviewText !== undefined) {
    updates.push('review_text = ?');
    values.push(data.reviewText);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getReviewById(db, id);
}

export function deleteReview(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getAverageRating(db: Database.Database, bookId: number): number | null {
  const result = db.prepare(
    'SELECT AVG(rating) as avg_rating FROM reviews WHERE book_id = ?'
  ).get(bookId) as { avg_rating: number | null };
  return result.avg_rating;
}
