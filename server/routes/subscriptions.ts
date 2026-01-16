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
  checkListingVisibility,
  checkNotificationPermission,
  createSubscriptionRequest,
  getAllSubscriptionRequests,
  updateSubscriptionRequest,
  getUserSubscriptionRequests,
} from '../controllers/subscriptionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Subscription Plan Routes
router.get('/plans', authenticate, authorize('admin'), getAllPlans);
router.get('/plans/active', getActivePlans); // Public route for landing page
router.get('/plans/:id', authenticate, getPlanById);
router.post('/plans', authenticate, authorize('admin'), createPlan);
router.put('/plans/:id', authenticate, authorize('admin'), updatePlan);
router.put('/plans/:id/toggle-status', authenticate, authorize('admin'), togglePlanStatus);

// User Subscription Routes
router.get('/user', authenticate, authorize('admin'), getAllUserSubscriptions);
router.get('/user/:userId', authenticate, getUserSubscription);
router.post('/assign', authenticate, authorize('admin'), assignSubscription);
router.put('/continue', authenticate, continueOwnSubscription); // User can continue their own subscription
router.put('/:id/extend', authenticate, authorize('admin'), extendSubscription);
router.put('/:id/change-plan', authenticate, authorize('admin'), changePlan);
router.put('/:id/reset-browse', authenticate, authorize('admin'), resetBrowseCount);
router.put('/:id/suspend', authenticate, authorize('admin'), suspendSubscription);
router.put('/:id/reactivate', authenticate, authorize('admin'), reactivateSubscription);
router.delete('/:id', authenticate, authorize('admin'), cancelSubscription);

// Stats & Analytics Routes
router.get('/user/:userId/usage', authenticate, getUsageStats);
router.get('/stats', authenticate, authorize('admin'), getGlobalStats);
router.get('/plan-stats', authenticate, authorize('admin'), getPlanStats);
router.get('/filtered', authenticate, authorize('admin'), getFilteredSubscriptions);

// Subscription Requests Routes
router.post('/requests', authenticate, createSubscriptionRequest);
router.get('/requests', authenticate, authorize('admin'), getAllSubscriptionRequests);
router.get('/requests/my', authenticate, getUserSubscriptionRequests);
router.put('/requests/:id', authenticate, authorize('admin'), updateSubscriptionRequest);

// Subscription Enforcement Routes
router.get('/check/browse-limit', authenticate, checkBrowseLimit);
router.post('/increment/browse-count', authenticate, incrementBrowseCount);
router.get('/check/listing-limit', authenticate, checkListingLimit);
router.post('/increment/listing-count', authenticate, incrementListingCount);
router.post('/decrement/listing-count', authenticate, decrementListingCount);
router.get('/check/job-post-limit', authenticate, checkJobPostLimit);
router.post('/increment/job-post-count', authenticate, incrementJobPostCount);
router.post('/check/listing-visibility', checkListingVisibility); // No auth - can be checked by anyone
router.get('/check/notification-permission', authenticate, checkNotificationPermission);

export default router;