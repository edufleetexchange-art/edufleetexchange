import express from 'express';
import { listTeachers, getTeacher, patchConsultantConsent } from '../controllers/teacherController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.get('/', listTeachers);
router.patch('/me/consultant-consent', authenticate, patchConsultantConsent);
router.get('/:id', getTeacher);
export default router;
