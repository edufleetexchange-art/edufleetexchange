import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { create, patch, list, get } from '../controllers/interviewController.js';

const router = express.Router();
router.use(authenticate);
router.get('/', list);
router.post('/', create);
router.get('/:id', get);
router.patch('/:id', patch);

export default router;
