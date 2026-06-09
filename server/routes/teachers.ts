import express from 'express';
import { listTeachers, getTeacher, patchConsultantConsent } from '../controllers/teacherController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Listing teachers reveals personal contact data — must be authenticated.
// Anonymous visitors can still see jobs and aggregated stats; they cannot
// enumerate the teacher directory.
router.get('/', authenticate, listTeachers);
router.patch('/me/consultant-consent', authenticate, patchConsultantConsent);
router.get('/:id', authenticate, getTeacher);
export default router;
