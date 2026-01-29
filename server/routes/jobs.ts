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
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public routes - specific routes before :id
router.get('/featured', getAllJobs); // Alias for featured jobs
router.get('/', getAllJobs);

// Protected specific routes MUST come before :id
router.get('/my/listings', protect, restrictTo('institute', 'admin', 'marketing'), getInstituteJobs);
router.get('/applications/list', protect, restrictTo('teacher', 'institute', 'admin', 'marketing'), getApplications);
router.get('/applications/my', protect, restrictTo('teacher'), getApplications); // Alias for teacher's own applications

// Public dynamic route
router.get('/:id', getJobById);

// Protected CRUD operations
router.post('/', protect, restrictTo('institute', 'admin', 'marketing'), createJob);
router.put('/:id', protect, restrictTo('institute', 'admin', 'marketing'), updateJob);
router.delete('/:id', protect, restrictTo('institute', 'admin', 'marketing'), deleteJob);

// Teacher routes
router.post('/:id/apply', protect, restrictTo('teacher'), applyToJob);

// Application status update
router.put('/applications/:id/status', protect, restrictTo('institute', 'admin', 'marketing'), updateApplicationStatus);

// Interview reschedule
router.put('/applications/:id/reschedule', protect, restrictTo('institute', 'admin', 'marketing'), rescheduleInterview);

export default router;