import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getLeadActivities,
  createActivity,
  getMyTasks,
  createTask,
  updateTaskStatus
} from '../controllers/crmController.js';

const router = express.Router();

// CRM data (leads, tasks, activities) belongs to the sales / marketing org.
// Any other authenticated account (teachers, vendors, etc.) must not be able
// to read or write this surface.
router.use(authenticate, requireRole(['admin', 'marketing', 'sales']));

router.get('/leads/:leadId/activities', getLeadActivities);
router.post('/activities', createActivity);

router.get('/tasks', getMyTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTaskStatus);

export default router;
