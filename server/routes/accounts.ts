import express from 'express';
import { patchMe, listAccounts } from '../controllers/accountController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.patch('/me', authenticate, patchMe);
// The UI's authService sends PUT for the same partial-update semantics —
// PATCH-only made every profile update 404.
router.put('/me', authenticate, patchMe);
router.get('/', authenticate, requireRole('admin'), listAccounts);
export default router;
