import express from 'express';
import { 
  getMarketingStats, 
  getGeneratedLeads, 
  createLead,
  getMarketingAuditLogs
} from '../controllers/marketingController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All marketing routes are protected and require marketing role
router.use(authenticate);
router.use(requireRole('marketing'));

router.get('/stats', getMarketingStats);
router.get('/audit-logs', getMarketingAuditLogs);
router.get('/leads', getGeneratedLeads);
router.post('/leads', createLead);

export default router;