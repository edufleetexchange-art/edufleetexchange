import express from 'express';
import { recommendJobs, recommendTeachers } from '../controllers/recommendationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.get('/jobs', authenticate, recommendJobs);
router.get('/teachers', authenticate, recommendTeachers);
export default router;
