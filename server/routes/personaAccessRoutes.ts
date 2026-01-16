/**
 * Persona Access Control Routes
 * 
 * Routes for checking persona-based access permissions
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getMyAccessControl,
  checkVehicleListingPermission,
  checkJobPostPermission,
  checkJobApplicationPermission,
  checkProductListingPermission,
} from '../controllers/personaAccessController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/access/me
 * Get comprehensive access control for authenticated user
 */
router.get('/me', getMyAccessControl);

/**
 * GET /api/access/vehicle-listing
 * Check if user can create vehicle listings (Institute only)
 */
router.get('/vehicle-listing', checkVehicleListingPermission);

/**
 * GET /api/access/job-post
 * Check if user can create job posts (Institute only)
 */
router.get('/job-post', checkJobPostPermission);

/**
 * GET /api/access/job-application
 * Check if user can apply to jobs (Teacher only)
 */
router.get('/job-application', checkJobApplicationPermission);

/**
 * GET /api/access/product-listing
 * Check if user can create product listings (Vendor only)
 */
router.get('/product-listing', checkProductListingPermission);

export default router;
