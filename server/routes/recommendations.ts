import express from 'express';
import { recommendJobs, recommendTeachers, collaborativeJobsForMe } from '../controllers/recommendationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
// NOTE: /jobs/collaborative must be registered before /jobs to avoid route shadowing
router.get('/jobs/collaborative', authenticate, collaborativeJobsForMe);
router.get('/jobs', authenticate, recommendJobs);
router.get('/teachers', authenticate, recommendTeachers);
export default router;
