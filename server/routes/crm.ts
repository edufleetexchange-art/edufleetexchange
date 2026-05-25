import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getLeadActivities,
  createActivity,
  getMyTasks,
  createTask,
  updateTaskStatus
} from '../controllers/crmController.js';

const router = express.Router();

router.use(authenticate);

router.get('/leads/:leadId/activities', getLeadActivities);
router.post('/activities', createActivity);

router.get('/tasks', getMyTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTaskStatus);

export default router;
