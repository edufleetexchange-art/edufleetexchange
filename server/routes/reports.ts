import express from 'express';
import { createReport, listReports, updateReport } from '../controllers/reportController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.post('/', authenticate, createReport);
router.get('/', authenticate, requireRole('admin'), listReports);
router.patch('/:id', authenticate, requireRole('admin'), updateReport);
export default router;
