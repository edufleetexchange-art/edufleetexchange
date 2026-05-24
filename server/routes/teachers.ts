import express from 'express';
import { listTeachers, getTeacher } from '../controllers/teacherController.js';

const router = express.Router();
router.get('/', listTeachers);
router.get('/:id', getTeacher);
export default router;
