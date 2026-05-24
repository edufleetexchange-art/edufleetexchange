import express from 'express';
import { patchMe, listAccounts } from '../controllers/accountController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.patch('/me', authenticate, patchMe);
router.get('/', authenticate, requireRole('admin'), listAccounts);
export default router;
