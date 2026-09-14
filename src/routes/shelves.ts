import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import * as Shelf from '../models/shelf.js';
import * as User from '../models/user.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const users = User.getAllUsers(db);
  res.render('shelves/index', { users });
});

router.get('/user/:userId', (req: Request, res: Response) => {
  const db = getDb();
  const userId = parseInt(req.params.userId, 10);
  const user = User.getUserById(db, userId);

  if (!user) {
    return res.status(404).render('error', { message: 'User not found' });
  }

  const shelves = Shelf.getShelvesByUserId(db, userId);
  const shelvesWithBooks = shelves.map(shelf => Shelf.getShelfWithBooks(db, shelf.id)!);

  res.render('shelves/user', { user, shelves: shelvesWithBooks });
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const shelfId = parseInt(req.params.id, 10);
  const shelf = Shelf.getShelfWithBooks(db, shelfId);

  if (!shelf) {
    return res.status(404).render('error', { message: 'Shelf not found' });
  }

  res.render('shelves/show', { shelf });
});

export default router;
