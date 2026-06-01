import express from 'express';
import { submitRequest, myRequest, listAdmin, reviewAdmin } from '../controllers/verificationController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, submitRequest);
router.get('/me', authenticate, myRequest);
router.get('/admin', authenticate, requireRole('admin'), listAdmin);
router.patch('/admin/:id', authenticate, requireRole('admin'), reviewAdmin);

export default router;
