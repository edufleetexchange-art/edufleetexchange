import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  createPlacementHandler,
  listPlacements,
  patchPlacement,
  placementTimeline,
} from '../controllers/placementController.js';

const router = express.Router();
router.use(authenticate, requireRole('consultant'));
router.get('/', listPlacements);
router.post('/', createPlacementHandler);
router.patch('/:id', patchPlacement);
router.get('/:id/timeline', placementTimeline);

export default router;
