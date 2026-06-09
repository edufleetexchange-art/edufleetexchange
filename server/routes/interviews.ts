import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { create, patch, list, get } from '../controllers/interviewController.js';

const router = express.Router();
router.use(authenticate);

// Anyone in the chain can read/list interviews they're a participant of
// (object-level filter happens in the controller).
router.get('/', list);
router.get('/:id', get);

// Only the institute, the consultant, or an admin can schedule or mutate an
// interview. The teacher (applicant) is read-only — they receive a notification
// and respond out-of-band.
router.post('/', requireRole(['institute', 'consultant', 'admin']), create);
router.patch('/:id', requireRole(['institute', 'consultant', 'admin']), patch);

export default router;
