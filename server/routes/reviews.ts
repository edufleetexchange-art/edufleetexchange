import express from 'express';
import { createReview, updateReview, deleteReview, listReviews, getReviewStats } from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.get('/', listReviews);
router.get('/stats', getReviewStats);
router.post('/', authenticate, createReview);
router.patch('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);
export default router;
