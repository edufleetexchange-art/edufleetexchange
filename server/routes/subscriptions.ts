import express from 'express';
import {
  getAllPlans,
  getActivePlans,
  getPlanById,
  createPlan,
  updatePlan,
  togglePlanStatus,
  getUserSubscription,
  getAllUserSubscriptions,
  assignSubscription,
  extendSubscription,
  changePlan,
  continueOwnSubscription,
  resetBrowseCount,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  getUsageStats,
  getGlobalStats,
  getPlanStats,
  getFilteredSubscriptions,
  checkBrowseLimit,
  incrementBrowseCount,
  checkListingLimit,
  incrementListingCount,
  decrementListingCount,
  checkJobPostLimit,
  incrementJobPostCount,
  decrementJobPostCount,
  checkListingVisibility,
  checkNotificationPermission,
  createSubscriptionRequest,
  getAllSubscriptionRequests,
  updateSubscriptionRequest,
  getUserSubscriptionRequests,
} from '../controllers/subscriptionController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Subscription Plan Routes
router.get('/plans', authenticate, requireRole('admin'), getAllPlans);
router.get('/plans/active', getActivePlans); // Public route for landing page
router.get('/plans/:id', authenticate, getPlanById);
router.post('/plans', authenticate, requireRole('admin'), createPlan);
router.put('/plans/:id', authenticate, requireRole('admin'), updatePlan);
router.put('/plans/:id/toggle-status', authenticate, requireRole('admin'), togglePlanStatus);

// User Subscription Routes
router.get('/user', authenticate, requireRole('admin'), getAllUserSubscriptions);
router.get('/user/:userId', authenticate, getUserSubscription);
router.post('/assign', authenticate, requireRole('admin'), assignSubscription);
router.put('/continue', authenticate, continueOwnSubscription); // User can continue their own subscription
router.put('/:id/extend', authenticate, requireRole('admin'), extendSubscription);
router.put('/:id/change-plan', authenticate, requireRole('admin'), changePlan);
router.put('/:id/reset-browse', authenticate, requireRole('admin'), resetBrowseCount);
router.put('/:id/suspend', authenticate, requireRole('admin'), suspendSubscription);
router.put('/:id/reactivate', authenticate, requireRole('admin'), reactivateSubscription);
router.delete('/:id', authenticate, requireRole('admin'), cancelSubscription);

// Stats & Analytics Routes
router.get('/user/:userId/usage', authenticate, getUsageStats);
router.get('/stats', authenticate, requireRole('admin'), getGlobalStats);
router.get('/plan-stats', authenticate, requireRole('admin'), getPlanStats);
router.get('/filtered', authenticate, requireRole('admin'), getFilteredSubscriptions);

// Subscription Requests Routes
router.post('/requests', authenticate, createSubscriptionRequest);
router.get('/requests', authenticate, requireRole('admin'), getAllSubscriptionRequests);
router.get('/requests/my', authenticate, getUserSubscriptionRequests);
router.put('/requests/:id', authenticate, requireRole('admin'), updateSubscriptionRequest);

// Subscription Enforcement Routes
router.get('/check/browse-limit', authenticate, checkBrowseLimit);
router.post('/increment/browse-count', authenticate, incrementBrowseCount);
router.get('/check/listing-limit', authenticate, checkListingLimit);
router.post('/increment/listing-count', authenticate, incrementListingCount);
router.post('/decrement/listing-count', authenticate, decrementListingCount);
router.get('/check/job-post-limit', authenticate, checkJobPostLimit);
router.post('/increment/job-post-count', authenticate, incrementJobPostCount);
router.post('/decrement/job-post-count', authenticate, decrementJobPostCount);
router.post('/check/listing-visibility', checkListingVisibility); // No auth - can be checked by anyone
router.get('/check/notification-permission', authenticate, checkNotificationPermission);

export default router;