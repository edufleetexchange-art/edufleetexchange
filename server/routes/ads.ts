import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
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
router.get('/', authenticate, requireAdmin, getAllAds);
router.get('/analytics', authenticate, requireAdmin, getAdAnalytics);
router.get('/:id', authenticate, requireAdmin, getAdById);
router.post('/', authenticate, requireAdmin, createAd);
router.put('/:id', authenticate, requireAdmin, updateAd);
router.delete('/:id', authenticate, requireAdmin, deleteAd);

// Ad request management
router.get('/requests/all', authenticate, requireAdmin, getAllAdRequests);
router.put('/requests/:id/status', authenticate, requireAdmin, updateAdRequestStatus);
router.delete('/requests/:id', authenticate, requireAdmin, deleteAdRequest);

export default router;
