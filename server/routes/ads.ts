import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { adAnalyticsLimiter, adRequestLimiter } from '../middleware/adAnalyticsLimit.js';
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

// Record impression/click (analytics) — heavily rate-limited per-IP+ad so
// counters can't be pumped to defraud advertisers.
router.post('/:id/impression', adAnalyticsLimiter, recordImpression);
router.post('/:id/click', adAnalyticsLimiter, recordClick);

// Submit ad request (contact form) — rate-limited per-IP because this is a
// public lead inbox that emails internally.
router.post('/requests', adRequestLimiter, submitAdRequest);

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
