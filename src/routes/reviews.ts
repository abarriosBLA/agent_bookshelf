import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import * as Review from '../models/review.js';

const router = Router();

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const reviewId = parseInt(req.params.id, 10);
  const review = Review.getReviewById(db, reviewId);

  if (!review) {
    return res.status(404).render('error', { message: 'Review not found' });
  }

  res.render('reviews/show', { review });
});

export default router;
