import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import * as Book from '../models/book.js';
import * as Review from '../models/review.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  // TODO: Implement search functionality
  // The search UI will be added in the views, but the backend search
  // is intentionally left as a homework exercise for agents to implement
  const books = Book.getAllBooks(db);
  res.render('books/index', { books });
});

router.get('/books/:id', (req: Request, res: Response) => {
  const db = getDb();
  const bookId = parseInt(req.params.id, 10);
  const book = Book.getBookById(db, bookId);

  if (!book) {
    return res.status(404).render('error', { message: 'Book not found' });
  }

  const reviews = Review.getReviewsByBookId(db, bookId);
  const averageRating = Review.getAverageRating(db, bookId);

  res.render('books/show', { book, reviews, averageRating });
});

export default router;
