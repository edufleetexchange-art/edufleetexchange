import express from 'express';
import {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getInstituteJobs,
  applyToJob,
  getApplications,
  updateApplicationStatus,
  rescheduleInterview,
} from '../controllers/jobController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public routes - specific routes before :id
router.get('/featured', getAllJobs); // Alias for featured jobs
router.get('/', getAllJobs);

// Protected specific routes MUST come before :id
router.get('/my/listings', authenticate, requireRole(['institute', 'sales', 'admin']), getInstituteJobs);
router.get('/applications/list', authenticate, requireRole(['teacher', 'institute', 'sales', 'admin']), getApplications);
router.get('/applications/my', authenticate, requireRole('teacher'), getApplications); // Alias for teacher's own applications

// Public dynamic route
router.get('/:id', getJobById);

// Protected CRUD operations
router.post('/', authenticate, requireRole(['institute', 'sales', 'admin']), createJob);
router.put('/:id', authenticate, requireRole(['institute', 'sales', 'admin']), updateJob);
router.delete('/:id', authenticate, requireRole(['institute', 'sales', 'admin']), deleteJob);

// Apply (teacher self, or consultant on teacher's behalf)
router.post('/:id/apply', authenticate, requireRole(['teacher', 'consultant']), applyToJob);

// Application status update
router.put('/applications/:id/status', authenticate, requireRole(['institute', 'admin']), updateApplicationStatus);

// Interview reschedule
router.put('/applications/:id/reschedule', authenticate, requireRole(['institute', 'admin']), rescheduleInterview);

export default router;