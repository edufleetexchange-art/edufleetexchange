import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { me, patchMe, getById } from '../controllers/consultantController.js';

const router = express.Router();
router.get('/me', authenticate, me);
router.patch('/me', authenticate, patchMe);
router.get('/:id', authenticate, getById);

export default router;
