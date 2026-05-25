import { Request, Response } from 'express';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import SubscriptionRequest from '../models/SubscriptionRequest.js';
import { AuthRequest } from '../middleware/auth.js';

// ==========================================
//SUBSCRIPTION PLAN CRUD
// ==========================================

export const getAllPlans = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ createdAt: -1 });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch subscription plans' });
  }
};

export const getActivePlans = async (req: Request, res: Response) => {
  try {
    // Extract planType from query parameter (teacher, institute, vendor)
    const { planType } = req.query;
    
    // Build query - filter by isActive and optionally by planType
    const query: any = { isActive: true };
    
    if (planType && ['teacher', 'institute', 'vendor'].includes(planType as string)) {
      query.planType = planType;
    }
    
    const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch active plans' });
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch subscription plan' });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    await plan.save();
    
    res.status(201).json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create subscription plan' });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    res.json(plan);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update subscription plan' });
  }
};

export const togglePlanStatus = async (req: Request, res: Response) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    plan.isActive = !plan.isActive;
    plan.updatedAt = new Date();
    await plan.save();
    
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to toggle plan status' });
  }
};

// ==========================================
// USER SUBSCRIPTION MANAGEMENT
// ==========================================

export const getUserSubscription = async (req: Request, res: Response) => {
  try {
    const account = await Account.findById(req.params.userId);

    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Skip lazy initialization for company users
    if (isCompanyUser(account.role)) {
      return res.json({
        planName: 'Company Bypass',
        status: 'active',
        paymentStatus: 'completed',
        listingsUsed: 0,
        listingsLimit: 999999,
        jobPostsUsed: 0,
        jobPostsLimit: 999999,
        browseCount: 0,
        browseCountLimit: 999999,
        notes: 'Admin/Sales/Marketing bypass',
      });
    }

    let sub = await Subscription.findOne({ accountId: req.params.userId }).populate('planId');

    // Lazy initialization: If no subscription, try to assign default free plan
    if (!sub) {
      const roleStr = account.role as string;
      let planType = 'institute';
      if (roleStr === 'teacher') planType = 'teacher';
      else if (roleStr === 'supplier' || roleStr === 'vendor') planType = 'vendor';

      const freePlan = await SubscriptionPlan.findOne({ planType, price: 0, isActive: true });

      if (freePlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + freePlan.duration);

        sub = await Subscription.create({
          accountId: req.params.userId,
          planId: freePlan._id,
          status: 'active',
          paymentStatus: 'completed',
          startDate,
          endDate,
          listingsUsed: 0,
          listingsLimit: freePlan.features.maxVehicleListings || 0,
          jobPostsUsed: 0,
          jobPostsLimit: freePlan.features.maxJobPosts || 0,
          browseCount: 0,
          browseCountLimit: freePlan.features.maxBrowsesPerMonth || 0,
          lastBrowseReset: startDate,
          notes: 'Free plan assigned automatically',
        });
        await sub.populate('planId');
      }
    }

    if (!sub) return res.json(null);

    const plan = sub.planId as any;

    res.json({
      planId: sub.planId,
      status: sub.status,
      paymentStatus: sub.paymentStatus,
      transactionId: sub.transactionId,
      startDate: sub.startDate,
      endDate: sub.endDate,
      listingsUsed: sub.listingsUsed,
      listingsLimit: sub.listingsLimit,
      jobPostsUsed: sub.jobPostsUsed,
      jobPostsLimit: sub.jobPostsLimit,
      browseCount: sub.browseCount,
      browseCountLimit: sub.browseCountLimit,
      lastBrowseReset: sub.lastBrowseReset,
      notes: sub.notes,
      planName: plan?.displayName || plan?.name || 'Unknown Plan',
      subscriptionPlanId: plan?._id || sub.planId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user subscription' });
  }
};

export const getAllUserSubscriptions = async (req: Request, res: Response) => {
  try {
    const subs = await Subscription.find({ planId: { $exists: true } })
      .populate('planId')
      .populate('accountId', 'name email role')
      .sort({ startDate: -1 });

    const subscriptions = subs.map((sub: any) => ({
      id: sub.accountId?._id || sub.accountId,
      userId: sub.accountId?._id || sub.accountId,
      userName: sub.accountId?.name,
      userEmail: sub.accountId?.email,
      userRole: sub.accountId?.role,
      planId: (sub.planId as any)?._id || sub.planId,
      planName: (sub.planId as any)?.displayName || 'Unknown Plan',
      status: sub.status,
      paymentStatus: sub.paymentStatus,
      startDate: sub.startDate,
      endDate: sub.endDate,
      listingsLimit: sub.listingsLimit,
      listingsUsed: sub.listingsUsed,
      browseCountLimit: sub.browseCountLimit,
      browseCountUsed: sub.browseCount,
      notes: sub.notes,
      createdAt: sub.startDate,
      updatedAt: sub.lastBrowseReset,
    }));

    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user subscriptions' });
  }
};

export const assignSubscription = async (req: Request, res: Response) => {
  try {
    const { userId, planId, duration, customListingsLimit, customBrowseLimit, notes } = req.body;

    const plan = await SubscriptionPlan.findById(planId);
    const accountExists = await Account.findById(userId);

    if (!accountExists) return res.status(404).json({ error: 'User not found' });
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found' });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);

    const sub = await Subscription.findOneAndUpdate(
      { accountId: userId },
      {
        accountId: userId,
        planId,
        status: 'active',
        paymentStatus: plan.price > 0 ? 'pending' : 'completed',
        startDate,
        endDate,
        listingsLimit: customListingsLimit || plan.features.maxVehicleListings || 0,
        listingsUsed: 0,
        jobPostsUsed: 0,
        jobPostsLimit: plan.features.maxJobPosts || 0,
        browseCount: 0,
        browseCountLimit: customBrowseLimit || plan.features.maxBrowsesPerMonth || 0,
        lastBrowseReset: startDate,
        notes: notes || '',
      },
      { upsert: true, new: true }
    );

    await sub.populate('planId');
    res.status(201).json(sub);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign subscription' });
  }
};

export const extendSubscription = async (req: Request, res: Response) => {
  try {
    const { newEndDate, notes, paymentStatus } = req.body;
    const userId = req.params.id;

    const sub = await Subscription.findOne({ accountId: userId });
    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    if (newEndDate) sub.endDate = new Date(newEndDate);
    sub.status = 'active';
    if (paymentStatus) sub.paymentStatus = paymentStatus;
    if (notes) sub.notes = notes;

    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to extend subscription' });
  }
};

export const changePlan = async (req: Request, res: Response) => {
  try {
    const { planId, notes } = req.body;
    const userId = req.params.id;

    const sub = await Subscription.findOne({ accountId: userId });
    const plan = await SubscriptionPlan.findById(planId);

    if (!sub) return res.status(404).json({ error: 'User or subscription not found' });
    if (!plan) return res.status(404).json({ error: 'Subscription plan not found' });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);

    sub.planId = plan._id as any;
    sub.status = 'active';
    sub.paymentStatus = plan.price > 0 ? 'pending' : 'completed';
    sub.startDate = startDate;
    sub.endDate = endDate;
    sub.listingsLimit = plan.features.maxVehicleListings || 0;
    sub.jobPostsLimit = plan.features.maxJobPosts || 0;
    sub.browseCountLimit = plan.features.maxBrowsesPerMonth || 0;
    sub.notes = notes || `Plan changed by admin to ${plan.displayName}`;

    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to change plan' });
  }
};

export const resetBrowseCount = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    sub.browseCount = 0;
    sub.lastBrowseReset = new Date();

    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset browse count' });
  }
};

export const suspendSubscription = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const userId = req.params.id;

    const sub = await Subscription.findOne({ accountId: userId });
    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    sub.status = 'suspended';
    if (reason) sub.notes = reason;

    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to suspend subscription' });
  }
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    const now = new Date();
    const endDate = new Date(sub.endDate);

    if (now > endDate) {
      return res.status(400).json({
        error: 'Cannot reactivate expired subscription. Please extend the subscription first.',
      });
    }

    sub.status = 'active';
    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    await Subscription.findByIdAndDelete(sub._id);

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
};

export const continueOwnSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const { newEndDate, notes } = req.body;
    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub) return res.status(404).json({ error: 'User subscription not found' });

    sub.endDate = newEndDate;
    sub.status = 'active';
    if (notes) sub.notes = notes;

    await sub.save();
    await sub.populate('planId');

    res.json(sub);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to continue subscription' });
  }
};

// ==========================================
// STATS & ANALYTICS
// ==========================================

export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const sub = await Subscription.findOne({ accountId: req.params.userId }).populate('planId');

    if (!sub) {
      return res.json({
        planName: 'None',
        status: 'none',
        paymentStatus: 'none',
        daysRemaining: 0,
        browseCount: { used: 0, allowed: 0, remaining: 0, percentage: 0 },
        listingCount: { used: 0, allowed: 0, remaining: 0, percentage: 0 },
        jobPostsCount: { used: 0, allowed: 0, remaining: 0, percentage: 0 },
        startDate: null,
        endDate: null,
        lastBrowseReset: null,
        isExpired: true,
        isExpiringSoon: false,
      });
    }

    const now = new Date();
    const endDate = new Date(sub.endDate || now);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const plan = sub.planId as any;
    const listingsLimit = sub.listingsLimit || plan?.features?.maxListings || 0;
    const browseCountLimit = sub.browseCountLimit || plan?.features?.maxBrowsesPerMonth || 0;
    const jobPostsLimit = sub.jobPostsLimit || plan?.features?.maxJobPosts || 0;

    res.json({
      planName: plan?.displayName || plan?.name || 'Unknown',
      status: sub.status,
      paymentStatus: sub.paymentStatus,
      daysRemaining,
      browseCount: {
        used: sub.browseCount || 0,
        allowed: browseCountLimit,
        remaining: Math.max(0, browseCountLimit - (sub.browseCount || 0)),
        percentage: browseCountLimit > 0 ? (sub.browseCount / browseCountLimit) * 100 : 0,
      },
      listingCount: {
        used: sub.listingsUsed || 0,
        allowed: listingsLimit,
        remaining: Math.max(0, listingsLimit - (sub.listingsUsed || 0)),
        percentage: listingsLimit > 0 ? (sub.listingsUsed / listingsLimit) * 100 : 0,
      },
      jobPostsCount: {
        used: sub.jobPostsUsed || 0,
        allowed: jobPostsLimit,
        remaining: Math.max(0, jobPostsLimit - (sub.jobPostsUsed || 0)),
        percentage: jobPostsLimit > 0 ? (sub.jobPostsUsed / jobPostsLimit) * 100 : 0,
      },
      startDate: sub.startDate,
      endDate: sub.endDate,
      lastBrowseReset: sub.lastBrowseReset,
      isExpired: now > endDate,
      isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch usage stats' });
  }
};

export const getGlobalStats = async (req: Request, res: Response) => {
  try {
    const allSubs = await Subscription.find({ planId: { $exists: true } }).populate('planId');

    const totalSubscriptions = allSubs.length;
    const activeSubscriptions = allSubs.filter(s => s.status === 'active').length;
    const expiredSubscriptions = allSubs.filter(s => s.status === 'expired').length;
    const suspendedSubscriptions = allSubs.filter(s => s.status === 'suspended').length;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = allSubs.filter(s => {
      if (!s.endDate) return false;
      const endDate = new Date(s.endDate);
      return endDate > now && endDate <= sevenDaysFromNow;
    }).length;

    const plans = await SubscriptionPlan.find();
    const totalPlans = plans.length;
    const activePlans = plans.filter(p => p.isActive).length;

    const totalRevenue = allSubs.reduce((sum, s) => {
      const plan = plans.find(p => p._id.toString() === s.planId?.toString());
      return sum + (plan?.price || 0);
    }, 0);

    res.json({
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        suspended: suspendedSubscriptions,
        expiringSoon,
      },
      plans: { total: totalPlans, active: activePlans },
      revenue: { total: totalRevenue },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch global stats' });
  }
};

export const getPlanStats = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find();
    const allSubs = await Subscription.find({ planId: { $exists: true } });

    const planStats = plans.map(plan => {
      const activeSubs = allSubs.filter(s =>
        s.planId?.toString() === plan._id.toString() && s.status === 'active'
      ).length;

      const totalSubs = allSubs.filter(s =>
        s.planId?.toString() === plan._id.toString()
      ).length;

      return {
        planId: plan._id,
        planName: plan.name,
        price: plan.price,
        activeSubscriptions: activeSubs,
        totalSubscriptions: totalSubs,
        revenue: totalSubs * plan.price,
        isActive: plan.isActive,
      };
    });

    res.json(planStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch plan stats' });
  }
};

export const getFilteredSubscriptions = async (req: Request, res: Response) => {
  try {
    const { status, planId, search, sortBy = 'startDate', sortOrder = 'desc', page = 1, pageSize = 20 } = req.query;

    const subQuery: any = { planId: { $exists: true } };
    if (status) subQuery.status = status;
    if (planId) subQuery.planId = planId;

    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    // If search is needed, we join via accountId
    if (search) {
      const searchFilter: any = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      };
      const matchingAccounts = await Account.find(searchFilter).select('_id');
      const accountIds = matchingAccounts.map(a => a._id);
      subQuery.accountId = { $in: accountIds };
    }

    const [subs, total] = await Promise.all([
      Subscription.find(subQuery)
        .populate('planId')
        .populate('accountId', 'name email role')
        .sort({ [sortBy as string]: sortDirection })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(subQuery),
    ]);

    const subscriptions = subs.map((sub: any) => ({
      id: sub.accountId?._id || sub.accountId,
      userId: sub.accountId?._id || sub.accountId,
      userName: sub.accountId?.name,
      userEmail: sub.accountId?.email,
      userRole: sub.accountId?.role,
      planId: (sub.planId as any)?._id || sub.planId,
      planName: (sub.planId as any)?.displayName || 'Unknown Plan',
      status: sub.status,
      paymentStatus: sub.paymentStatus,
      startDate: sub.startDate,
      endDate: sub.endDate,
      listingsLimit: sub.listingsLimit,
      listingsUsed: sub.listingsUsed,
      browseCountLimit: sub.browseCountLimit,
      browseCountUsed: sub.browseCount,
      notes: sub.notes,
      createdAt: sub.startDate,
      updatedAt: sub.lastBrowseReset,
    }));

    res.json({
      items: subscriptions,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch filtered subscriptions' });
  }
};

// ==========================================
// SUBSCRIPTION REQUESTS
// ==========================================

export const createSubscriptionRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { requestedPlanId, requestType, userNotes } = req.body;

    const account = await Account.findById(userId);
    const requestedPlan = await SubscriptionPlan.findById(requestedPlanId);

    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!requestedPlan) {
      return res.status(404).json({ error: 'Requested subscription plan not found' });
    }

    // Check if there's already a pending request
    const existingPending = await SubscriptionRequest.findOne({
      userId,
      status: 'pending',
    });

    if (existingPending) {
      return res.status(400).json({ error: 'You already have a pending subscription request' });
    }

    // Handle both with and without existing subscription
    const existingSub = await Subscription.findOne({ accountId: userId });
    const currentPlanId = existingSub?.planId || null;
    
    const request = new SubscriptionRequest({
      userId,
      currentPlanId: currentPlanId || requestedPlanId, // Use requested as current if no existing
      requestedPlanId,
      requestType,
      userNotes,
      status: 'pending',
    });

    await request.save();

    res.status(201).json(request);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create subscription request' });
  }
};

export const getAllSubscriptionRequests = async (req: Request, res: Response) => {
  try {
    const { status, userId } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;

    const requests = await SubscriptionRequest.find(query)
      .populate('userId', 'name email role')
      .populate('currentPlanId', 'displayName name')
      .populate('requestedPlanId', 'displayName name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch subscription requests' });
  }
};

export const updateSubscriptionRequest = async (req: Request, res: Response) => {
  try {
    const { status, adminNotes } = req.body;
    const { id } = req.params;

    const request = await SubscriptionRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Subscription request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    request.status = status;
    request.adminNotes = adminNotes;
    request.updatedAt = new Date();

    if (status === 'approved') {
      const plan = await SubscriptionPlan.findById(request.requestedPlanId);

      if (plan) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.duration);

        await Subscription.findOneAndUpdate(
          { accountId: request.userId },
          {
            planId: plan._id,
            listingsLimit: plan.features.maxVehicleListings || 0,
            browseCountLimit: plan.features.maxBrowsesPerMonth || 0,
            jobPostsLimit: plan.features.maxJobPosts || 0,
            listingsUsed: 0,
            browseCount: 0,
            jobPostsUsed: 0,
            status: 'active',
            paymentStatus: plan.price > 0 ? 'pending' : 'completed',
            startDate,
            endDate,
            notes: `Plan changed via request: ${request.requestType}. ${adminNotes || ''}`,
            lastBrowseReset: startDate,
          },
          { upsert: true, new: true }
        );
      }
    }

    await request.save();
    res.json(request);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update subscription request' });
  }
};

export const getUserSubscriptionRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const requests = await SubscriptionRequest.find({ userId })
      .populate('currentPlanId', 'displayName name')
      .populate('requestedPlanId', 'displayName name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user requests' });
  }
};

// ==========================================
// SUBSCRIPTION ENFORCEMENT ENDPOINTS
// ==========================================

// Helper function to check if subscription needs billing reset
const checkAndResetBillingPeriod = async (sub: any) => {
  if (!sub || !sub.lastBrowseReset) return false;

  const now = new Date();
  const lastReset = new Date(sub.lastBrowseReset);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceReset >= 30) {
    sub.browseCount = 0;
    sub.lastBrowseReset = now;
    await sub.save();
    return true;
  }
  return false;
};

const isCompanyUser = (role: string) => {
  return ['admin', 'sales', 'marketing'].includes(role);
};

// Check browse limit
export const checkBrowseLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const account = await Account.findById(userId);
    if (!account) return res.status(404).json({ error: 'User not found' });

    if (isCompanyUser(account.role)) {
      return res.json({ allowed: true, remaining: 999999, limitReached: false, subscription: null, message: 'Company user bypass' });
    }

    const sub = await Subscription.findOne({ accountId: userId }).populate('planId');

    await checkAndResetBillingPeriod(sub);

    if (!sub || !sub.planId) {
      return res.json({ allowed: true, remaining: 10, limitReached: false, subscription: null, message: 'Using free plan limits' });
    }

    if (sub.status !== 'active') {
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: `Subscription is ${sub.status}` });
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    if (now > endDate) {
      sub.status = 'expired';
      await sub.save();
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: 'Subscription has expired' });
    }

    const plan = sub.planId as any;
    const maxBrowses = plan?.features?.maxBrowsesPerMonth || 0;
    const browseCountUsed = sub.browseCount || 0;
    const remaining = Math.max(0, maxBrowses - browseCountUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: sub,
      message: limitReached ? `Browse limit reached (${maxBrowses})` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check browse limit' });
  }
};

// Increment browse count
export const incrementBrowseCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const sub = await Subscription.findOne({ accountId: userId });
    if (!sub) return res.status(404).json({ error: 'User not found' });

    await checkAndResetBillingPeriod(sub);

    if (sub.status !== 'active') {
      return res.json({ success: false, message: 'No active subscription' });
    }

    sub.browseCount = (sub.browseCount || 0) + 1;
    await sub.save();

    res.json({ success: true, browseCount: sub.browseCount, message: 'Browse count incremented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to increment browse count' });
  }
};

// Check listing limit
export const checkListingLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const account = await Account.findById(userId);
    if (!account) return res.status(404).json({ error: 'User not found' });

    if (isCompanyUser(account.role)) {
      return res.json({ allowed: true, remaining: 999999, limitReached: false, subscription: null, message: 'Company user bypass' });
    }

    const sub = await Subscription.findOne({ accountId: userId }).populate('planId');

    if (!sub || !sub.planId) {
      return res.json({ allowed: false, remaining: 2, limitReached: true, subscription: null, message: 'No active subscription. Listing creation not allowed.' });
    }

    if (sub.status !== 'active') {
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: `Subscription is ${sub.status}. Cannot create listings.` });
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    if (now > endDate) {
      sub.status = 'expired';
      await sub.save();
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: 'Subscription has expired. Cannot create listings.' });
    }

    const plan = sub.planId as any;
    const maxListings = plan?.features?.maxListings || 0;
    const listingsUsed = sub.listingsUsed || 0;
    const remaining = Math.max(0, maxListings - listingsUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: sub,
      message: limitReached ? `Listing limit reached (${maxListings}). Please upgrade.` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check listing limit' });
  }
};

// Increment listing count
export const incrementListingCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const account = await Account.findById(userId);
    if (!account) return res.status(404).json({ error: 'User not found' });

    if (isCompanyUser(account.role)) {
      return res.json({ success: true, listingsUsed: 0, message: 'Company user bypass - count not tracked' });
    }

    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub || sub.status !== 'active') {
      return res.json({ success: false, message: 'No active subscription' });
    }

    sub.listingsUsed = (sub.listingsUsed || 0) + 1;
    await sub.save();

    res.json({ success: true, listingsUsed: sub.listingsUsed, message: 'Listing count incremented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to increment listing count' });
  }
};

// Decrement listing count
export const decrementListingCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub) return res.json({ success: false, message: 'No subscription found' });

    if ((sub.listingsUsed || 0) > 0) {
      sub.listingsUsed = (sub.listingsUsed || 0) - 1;
      await sub.save();
    }

    res.json({ success: true, listingsUsed: sub.listingsUsed, message: 'Listing count decremented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to decrement listing count' });
  }
};

// Check job post limit
export const checkJobPostLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const account = await Account.findById(userId);
    if (!account) return res.status(404).json({ error: 'User not found' });

    if (isCompanyUser(account.role)) {
      return res.json({ allowed: true, remaining: 999999, limitReached: false, subscription: null, message: 'Company user bypass' });
    }

    const sub = await Subscription.findOne({ accountId: userId }).populate('planId');

    if (!sub || !sub.planId) {
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: null, message: 'No active subscription. Job posting not allowed.' });
    }

    if (sub.status !== 'active') {
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: `Subscription is ${sub.status}. Cannot post jobs.` });
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    if (now > endDate) {
      sub.status = 'expired';
      await sub.save();
      return res.json({ allowed: false, remaining: 0, limitReached: true, subscription: sub, message: 'Subscription has expired. Cannot post jobs.' });
    }

    const plan = sub.planId as any;
    const maxJobPosts = plan?.features?.maxJobPosts || 0;
    const jobPostsUsed = sub.jobPostsUsed || 0;
    const remaining = Math.max(0, maxJobPosts - jobPostsUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: sub,
      message: limitReached ? `Job post limit reached (${maxJobPosts}). Please upgrade.` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check job post limit' });
  }
};

// Increment job post count
export const incrementJobPostCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const account = await Account.findById(userId);
    if (!account) return res.status(404).json({ error: 'User not found' });

    if (isCompanyUser(account.role)) {
      return res.json({ success: true, jobPostsUsed: 0, message: 'Company user bypass - count not tracked' });
    }

    const sub = await Subscription.findOne({ accountId: userId });

    if (!sub || sub.status !== 'active') {
      return res.json({ success: false, message: 'No active subscription' });
    }

    sub.jobPostsUsed = (sub.jobPostsUsed || 0) + 1;
    await sub.save();

    res.json({ success: true, jobPostsUsed: sub.jobPostsUsed, message: 'Job post count incremented' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to increment job post count' });
  }
};

// Check listing visibility
export const checkListingVisibility = async (req: Request, res: Response) => {
  try {
    const { listingCreatedAt, userId } = req.body;

    if (!listingCreatedAt || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const sub = await Subscription.findOne({ accountId: userId }).populate('planId');

    let delayHours = 168; // Default 7 days for no subscription

    if (!sub || !sub.planId) {
      const createdTime = new Date(listingCreatedAt).getTime();
      const availableTime = createdTime + (delayHours * 60 * 60 * 1000);
      const now = Date.now();
      return res.json({
        visible: now >= availableTime,
        delayHours,
        availableAt: new Date(availableTime).toISOString(),
        subscription: null,
      });
    }

    if (sub.status !== 'active') {
      return res.json({
        visible: false,
        delayHours: 168,
        availableAt: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString(),
        subscription: sub,
      });
    }

    const plan = sub.planId as any;
    delayHours = plan?.features?.dataDelayDays ? plan.features.dataDelayDays * 24 : 0;

    const createdTime = new Date(listingCreatedAt).getTime();
    const availableTime = createdTime + (delayHours * 60 * 60 * 1000);
    const now = Date.now();

    res.json({
      visible: now >= availableTime,
      delayHours,
      availableAt: new Date(availableTime).toISOString(),
      subscription: sub,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check listing visibility' });
  }
};

// Check notification permission
export const checkNotificationPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.account?.id;
    if (!userId) return res.status(401).json({ error: 'User ID not found' });

    const sub = await Subscription.findOne({ accountId: userId }).populate('planId');

    if (!sub || sub.status !== 'active') {
      return res.json({ allowed: false, subscription: sub || null });
    }

    const plan = sub.planId as any;
    const notificationsEnabled = plan?.features?.instantVehicleAlerts || plan?.features?.instantJobAlerts || false;

    res.json({ allowed: notificationsEnabled, subscription: sub });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check notification permission' });
  }
};