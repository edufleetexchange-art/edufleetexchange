import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { createAlert, listMyAlerts, patchAlert, deleteAlert } from '../controllers/alertController.js';

const router = express.Router();

// Demand alerts are a buyer-side feature: institutes (and consultants/admins
// acting on their behalf) set "notify me when X is available". Teachers/vendors
// don't subscribe to demand here.
router.use(authenticate, requireRole(['institute', 'consultant', 'admin']));

router.post('/', createAlert);
router.get('/mine', listMyAlerts);
router.patch('/:id', patchAlert);
router.delete('/:id', deleteAlert);

export default router;
