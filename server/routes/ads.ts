import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  // Ad management (Admin)
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
  getAdAnalytics,
  // Public ad endpoints
  getAdsByPlacement,
  recordImpression,
  recordClick,
  // Ad request management
  submitAdRequest,
  getAllAdRequests,
  updateAdRequestStatus,
  deleteAdRequest,
} from '../controllers/adController.js';

const router = express.Router();

// ============ PUBLIC ROUTES ============

// Get ads by placement (for displaying ads on frontend)
router.get('/placement/:placement', getAdsByPlacement);

// Record impression/click (analytics)
router.post('/:id/impression', recordImpression);
router.post('/:id/click', recordClick);

// Submit ad request (contact form)
router.post('/requests', submitAdRequest);

// ============ ADMIN ROUTES ============

// Ad management
router.get('/', authenticate, requireRole('admin'), getAllAds);
router.get('/analytics', authenticate, requireRole('admin'), getAdAnalytics);
router.get('/:id', authenticate, requireRole('admin'), getAdById);
router.post('/', authenticate, requireRole('admin'), createAd);
router.put('/:id', authenticate, requireRole('admin'), updateAd);
router.delete('/:id', authenticate, requireRole('admin'), deleteAd);

// Ad request management
router.get('/requests/all', authenticate, requireRole('admin'), getAllAdRequests);
router.put('/requests/:id/status', authenticate, requireRole('admin'), updateAdRequestStatus);
router.delete('/requests/:id', authenticate, requireRole('admin'), deleteAdRequest);

export default router;
