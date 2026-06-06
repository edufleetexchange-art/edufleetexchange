import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createRoster, listRoster, patchRoster, archiveRoster } from '../controllers/rosterController.js';

const router = express.Router();

router.use(authenticate, requireRole('consultant'));
router.get('/', listRoster);
router.post('/', createRoster);
router.patch('/:id', patchRoster);
router.delete('/:id', archiveRoster);

export default router;
