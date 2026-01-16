import { Request, Response } from 'express';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import User from '../models/User.js';
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
    const user = await User.findById(req.params.userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Lazy initialization: If no subscription, try to assign default free plan
    if (!user.subscription || !user.subscription.planId) {
      let planType = 'institute';
      const roleStr = user.role as string;
      if (roleStr === 'teacher') {
        planType = 'teacher';
      } else if (roleStr === 'supplier' || roleStr === 'vendor') {
        planType = 'vendor';
      }

      const freePlan = await SubscriptionPlan.findOne({
        planType,
        price: 0,
        isActive: true
      });

      if (freePlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + freePlan.duration);

        user.subscription = {
          planId: freePlan._id as any,
          status: 'active',
          paymentStatus: 'completed',
          startDate,
          endDate,
          listingsUsed: 0,
          listingsLimit: freePlan.features.maxListings,
          jobPostsUsed: 0,
          jobPostsLimit: freePlan.features.maxJobPosts,
          browseCount: 0,
          browseCountLimit: freePlan.features.maxBrowsesPerMonth,
          lastBrowseReset: startDate,
          notes: 'Free plan assigned automatically'
        };

        await user.save();
        await user.populate('subscription.planId');
      }
    }

    if (!user.subscription) {
      return res.json(null);
    }

    const plan = user.subscription.planId as any;
    
    // Convert subscription subdocument to plain object
    const subscriptionData = user.subscription ? {
      planId: user.subscription.planId,
      status: user.subscription.status,
      paymentStatus: user.subscription.paymentStatus,
      transactionId: user.subscription.transactionId,
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate,
      listingsUsed: user.subscription.listingsUsed,
      listingsLimit: user.subscription.listingsLimit,
      jobPostsUsed: user.subscription.jobPostsUsed,
      jobPostsLimit: user.subscription.jobPostsLimit,
      browseCount: user.subscription.browseCount,
      browseCountLimit: user.subscription.browseCountLimit,
      lastBrowseReset: user.subscription.lastBrowseReset,
      notes: user.subscription.notes,
    } : null;
    
    res.json({
      ...subscriptionData,
      planName: plan?.displayName || plan?.name || 'Unknown Plan',
      planId: plan?._id || user.subscription.planId,
      subscriptionPlanId: plan?._id || user.subscription.planId, // Map for frontend compatibility
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user subscription' });
  }
};

export const getAllUserSubscriptions = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ 'subscription.planId': { $exists: true } })
      .populate('subscription.planId')
      .select('name email subscription role')
      .sort({ 'subscription.startDate': -1 });
    
    const subscriptions = users.map(user => ({
      id: user._id, // Use userId as the ID for simpler management
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      planId: (user.subscription?.planId as any)?._id || user.subscription?.planId,
      planName: (user.subscription?.planId as any)?.displayName || 'Unknown Plan',
      status: user.subscription?.status,
      paymentStatus: user.subscription?.paymentStatus,
      startDate: user.subscription?.startDate,
      endDate: user.subscription?.endDate,
      listingsLimit: user.subscription?.listingsLimit,
      listingsUsed: user.subscription?.listingsUsed,
      browseCountLimit: user.subscription?.browseCountLimit,
      browseCountUsed: user.subscription?.browseCount,
      notes: user.subscription?.notes,
      createdAt: user.subscription?.startDate,
      updatedAt: user.subscription?.lastBrowseReset,
    }));
    
    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user subscriptions' });
  }
};

export const assignSubscription = async (req: Request, res: Response) => {
  try {
    const { userId, planId, duration, customListingsLimit, customBrowseLimit, notes } = req.body;
    
    const user = await User.findById(userId);
    const plan = await SubscriptionPlan.findById(planId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);
    
    user.subscription = {
      planId,
      status: 'active',
      paymentStatus: plan.price > 0 ? 'pending' : 'completed',
      startDate: startDate,
      endDate: endDate,
      listingsLimit: customListingsLimit || plan.features.maxListings,
      listingsUsed: 0,
      jobPostsUsed: 0,
      jobPostsLimit: plan.features.maxJobPosts,
      browseCount: 0,
      browseCountLimit: customBrowseLimit || plan.features.maxBrowsesPerMonth,
      lastBrowseReset: startDate,
      notes: notes || '',
    };
    
    await user.save();
    
    await user.populate('subscription.planId');
    
    res.status(201).json(user.subscription);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign subscription' });
  }
};

export const extendSubscription = async (req: Request, res: Response) => {
  try {
    const { newEndDate, notes, paymentStatus } = req.body;
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }
    
    if (newEndDate) user.subscription.endDate = new Date(newEndDate);
    user.subscription.status = 'active';
    if (paymentStatus) user.subscription.paymentStatus = paymentStatus;
    if (notes) user.subscription.notes = notes;
    // Note: updatedAt is handled by mongoose timestamps on the user document
    
    await user.save();
    await user.populate('subscription.planId');
    
    res.json(user.subscription);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to extend subscription' });
  }
};

export const changePlan = async (req: Request, res: Response) => {
  try {
    const { planId, notes } = req.body;
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    const plan = await SubscriptionPlan.findById(planId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User or subscription not found' });
    }
    
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);
    
    user.subscription.planId = plan._id as any;
    user.subscription.status = 'active';
    user.subscription.paymentStatus = plan.price > 0 ? 'pending' : 'completed';
    user.subscription.startDate = startDate;
    user.subscription.endDate = endDate;
    user.subscription.listingsLimit = plan.features.maxListings;
    user.subscription.jobPostsLimit = plan.features.maxJobPosts;
    user.subscription.browseCountLimit = plan.features.maxBrowsesPerMonth;
    user.subscription.notes = notes || `Plan changed by admin to ${plan.displayName}`;
    // Note: updatedAt is handled by mongoose timestamps on the user document
    
    await user.save();
    await user.populate('subscription.planId');
    
    res.json(user.subscription);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to change plan' });
  }
};

export const resetBrowseCount = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }
    
    user.subscription.browseCount = 0;
    user.subscription.lastBrowseReset = new Date();
    
    await user.save();
    await user.populate('subscription.planId');
    
    res.json(user.subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset browse count' });
  }
};

export const suspendSubscription = async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }
    
    user.subscription.status = 'suspended';
    user.subscription.notes = reason || user.subscription.notes;
    
    await user.save();
    await user.populate('subscription.planId');
    
    res.json(user.subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to suspend subscription' });
  }
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }
    
    // Check if subscription has expired
    const now = new Date();
    const endDate = new Date(user.subscription.endDate!);
    
    if (now > endDate) {
      return res.status(400).json({ 
        error: 'Cannot reactivate expired subscription. Please extend the subscription first.' 
      });
    }
    
    user.subscription.status = 'active';
    
    await user.save();
    await user.populate('subscription.planId');
    
    res.json(user.subscription);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }
    
    user.subscription = undefined;
    await user.save();
    
    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
};

export const continueOwnSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { newEndDate, notes } = req.body;
    const user = await User.findById(userId);

    if (!user || !user.subscription) {
      return res.status(404).json({ error: 'User subscription not found' });
    }

    user.subscription.endDate = newEndDate;
    user.subscription.status = 'active';
    if (notes) user.subscription.notes = notes;
    // Note: updatedAt is handled by mongoose timestamps on the user document

    await user.save();
    await user.populate('subscription.planId');

    res.json(user.subscription);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to continue subscription' });
  }
};

// ==========================================
// STATS & ANALYTICS
// ==========================================

export const getUsageStats = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Default empty stats if no subscription
    if (!user.subscription) {
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
    const endDate = new Date(user.subscription.endDate || now);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    const plan = user.subscription.planId as any;
    const listingsLimit = user.subscription.listingsLimit || plan?.features?.maxListings || 0;
    const browseCountLimit = user.subscription.browseCountLimit || plan?.features?.maxBrowsesPerMonth || 0;
    const jobPostsLimit = user.subscription.jobPostsLimit || plan?.features?.maxJobPosts || 0;
    
    const stats = {
      planName: plan?.displayName || plan?.name || 'Unknown',
      status: user.subscription.status,
      paymentStatus: user.subscription.paymentStatus,
      daysRemaining,
      browseCount: {
        used: user.subscription.browseCount || 0,
        allowed: browseCountLimit,
        remaining: Math.max(0, browseCountLimit - (user.subscription.browseCount || 0)),
        percentage: browseCountLimit > 0 ? (user.subscription.browseCount / browseCountLimit) * 100 : 0,
      },
      listingCount: {
        used: user.subscription.listingsUsed || 0,
        allowed: listingsLimit,
        remaining: Math.max(0, listingsLimit - (user.subscription.listingsUsed || 0)),
        percentage: listingsLimit > 0 ? (user.subscription.listingsUsed / listingsLimit) * 100 : 0,
      },
      jobPostsCount: {
        used: user.subscription.jobPostsUsed || 0,
        allowed: jobPostsLimit,
        remaining: Math.max(0, jobPostsLimit - (user.subscription.jobPostsUsed || 0)),
        percentage: jobPostsLimit > 0 ? (user.subscription.jobPostsUsed / jobPostsLimit) * 100 : 0,
      },
      startDate: user.subscription.startDate,
      endDate: user.subscription.endDate,
      lastBrowseReset: user.subscription.lastBrowseReset,
      isExpired: now > endDate,
      isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
    };
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch usage stats' });
  }
};

export const getGlobalStats = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ 'subscription.planId': { $exists: true } });
    
    const totalSubscriptions = users.length;
    const activeSubscriptions = users.filter(u => u.subscription?.status === 'active').length;
    const expiredSubscriptions = users.filter(u => u.subscription?.status === 'expired').length;
    const suspendedSubscriptions = users.filter(u => u.subscription?.status === 'suspended').length;
    
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = users.filter(u => {
      if (!u.subscription?.endDate) return false;
      const endDate = new Date(u.subscription.endDate);
      return endDate > now && endDate <= sevenDaysFromNow;
    }).length;
    
    const plans = await SubscriptionPlan.find();
    const totalPlans = plans.length;
    const activePlans = plans.filter(p => p.isActive).length;
    
    const totalRevenue = users.reduce((sum, u) => {
      if (u.subscription?.planId) {
        const plan = plans.find(p => p._id.toString() === u.subscription?.planId?.toString());
        return sum + (plan?.price || 0);
      }
      return sum;
    }, 0);
    
    const stats = {
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        suspended: suspendedSubscriptions,
        expiringSoon,
      },
      plans: {
        total: totalPlans,
        active: activePlans,
      },
      revenue: {
        total: totalRevenue,
      },
    };
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch global stats' });
  }
};

export const getPlanStats = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find();
    const users = await User.find({ 'subscription.planId': { $exists: true } });
    
    const planStats = plans.map(plan => {
      const activeSubs = users.filter(u => 
        u.subscription?.planId?.toString() === plan._id.toString() &&
        u.subscription?.status === 'active'
      ).length;
      
      const totalSubs = users.filter(u => 
        u.subscription?.planId?.toString() === plan._id.toString()
      ).length;
      
      const revenue = totalSubs * plan.price;
      
      return {
        planId: plan._id,
        planName: plan.name,
        price: plan.price,
        activeSubscriptions: activeSubs,
        totalSubscriptions: totalSubs,
        revenue,
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
    
    const query: any = { 'subscription.planId': { $exists: true } };
    
    if (status) {
      query['subscription.status'] = status;
    }
    
    if (planId) {
      query['subscription.planId'] = planId;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortField = `subscription.${sortBy}`;
    
    const skip = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);
    
    const users = await User.find(query)
      .populate('subscription.planId')
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments(query);
    
    const subscriptions = users.map(user => ({
      id: user._id, // Use userId as the ID for simpler management
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      planId: (user.subscription?.planId as any)?._id || user.subscription?.planId,
      planName: (user.subscription?.planId as any)?.displayName || 'Unknown Plan',
      status: user.subscription?.status,
      paymentStatus: user.subscription?.paymentStatus,
      startDate: user.subscription?.startDate,
      endDate: user.subscription?.endDate,
      listingsLimit: user.subscription?.listingsLimit,
      listingsUsed: user.subscription?.listingsUsed,
      browseCountLimit: user.subscription?.browseCountLimit,
      browseCountUsed: user.subscription?.browseCount,
      notes: user.subscription?.notes,
      createdAt: user.subscription?.startDate,
      updatedAt: user.subscription?.lastBrowseReset,
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
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const { requestedPlanId, requestType, userNotes } = req.body;

    const user = await User.findById(userId);
    const requestedPlan = await SubscriptionPlan.findById(requestedPlanId);
    
    if (!user) {
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
    const currentPlanId = user.subscription?.planId || null;
    
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
      const user = await User.findById(request.userId);
      const plan = await SubscriptionPlan.findById(request.requestedPlanId);

      if (user && plan) {
        // Apply the new plan
        if (user.subscription) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + plan.duration);

          user.subscription.planId = plan._id as any;
          user.subscription.listingsLimit = plan.features.maxListings;
          user.subscription.browseCountLimit = plan.features.maxBrowsesPerMonth;
          user.subscription.jobPostsLimit = plan.features.maxJobPosts;
          
          // Reset usage if it's a renewal or upgrade
          // This gives them a fresh start with the new plan
          user.subscription.listingsUsed = 0;
          user.subscription.browseCount = 0;
          user.subscription.jobPostsUsed = 0;

          user.subscription.status = 'active';
          // If it's a paid plan, set to pending until admin verifies payment
          // If it's free, mark as completed
          user.subscription.paymentStatus = plan.price > 0 ? 'pending' : 'completed';
          user.subscription.startDate = startDate;
          user.subscription.endDate = endDate;
          user.subscription.notes = `Plan changed via request: ${request.requestType}. ${adminNotes || ''}`;
          // Note: updatedAt is handled by mongoose timestamps on the user document
          
          // Force reset of browse count reset date to now
          user.subscription.lastBrowseReset = startDate;
          
          await user.save();
        }
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
    const userId = req.userId;
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
const checkAndResetBillingPeriod = async (user: any) => {
  if (!user.subscription || !user.subscription.lastBrowseReset) {
    return false;
  }

  const now = new Date();
  const lastReset = new Date(user.subscription.lastBrowseReset);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

  // Reset if 30 days have passed
  if (daysSinceReset >= 30) {
    user.subscription.browseCount = 0;
    user.subscription.lastBrowseReset = now;
    await user.save();
    return true;
  }

  return false;
};

// Check browse limit
export const checkBrowseLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset billing period if needed
    await checkAndResetBillingPeriod(user);

    // No subscription - return default free limits
    if (!user.subscription || !user.subscription.planId) {
      return res.json({
        allowed: true,
        remaining: 10,
        limitReached: false,
        subscription: null,
        message: 'Using free plan limits',
      });
    }

    // Check subscription status
    if (user.subscription.status !== 'active') {
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: `Subscription is ${user.subscription.status}`,
      });
    }

    // Check if subscription expired
    const now = new Date();
    const endDate = new Date(user.subscription.endDate || now);
    if (now > endDate) {
      user.subscription.status = 'expired';
      await user.save();
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: 'Subscription has expired',
      });
    }

    const plan = user.subscription.planId as any;
    const maxBrowses = plan?.features?.maxBrowsesPerMonth || 0;
    const browseCountUsed = user.subscription.browseCount || 0;
    const remaining = Math.max(0, maxBrowses - browseCountUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: user.subscription,
      message: limitReached ? `Browse limit reached (${maxBrowses})` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check browse limit' });
  }
};

// Increment browse count
export const incrementBrowseCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check and reset billing period if needed
    await checkAndResetBillingPeriod(user);

    if (!user.subscription || user.subscription.status !== 'active') {
      return res.json({
        success: false,
        message: 'No active subscription',
      });
    }

    // Increment browse count
    user.subscription.browseCount = (user.subscription.browseCount || 0) + 1;
    await user.save();

    res.json({
      success: true,
      browseCount: user.subscription.browseCount,
      message: 'Browse count incremented',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to increment browse count' });
  }
};

// Check listing limit
export const checkListingLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // No subscription - use free plan limits (2 listings)
    if (!user.subscription || !user.subscription.planId) {
      return res.json({
        allowed: false,
        remaining: 2,
        limitReached: true,
        subscription: null,
        message: 'No active subscription. Listing creation not allowed.',
      });
    }

    // Check subscription status
    if (user.subscription.status !== 'active') {
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: `Subscription is ${user.subscription.status}. Cannot create listings.`,
      });
    }

    // Check if expired
    const now = new Date();
    const endDate = new Date(user.subscription.endDate || now);
    if (now > endDate) {
      user.subscription.status = 'expired';
      await user.save();
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: 'Subscription has expired. Cannot create listings.',
      });
    }

    const plan = user.subscription.planId as any;
    const maxListings = plan?.features?.maxListings || 0;
    const listingsUsed = user.subscription.listingsUsed || 0;
    const remaining = Math.max(0, maxListings - listingsUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: user.subscription,
      message: limitReached ? `Listing limit reached (${maxListings}). Please upgrade.` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check listing limit' });
  }
};

// Increment listing count
export const incrementListingCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subscription || user.subscription.status !== 'active') {
      return res.json({
        success: false,
        message: 'No active subscription',
      });
    }

    // Increment listing count
    user.subscription.listingsUsed = (user.subscription.listingsUsed || 0) + 1;
    await user.save();

    res.json({
      success: true,
      listingsUsed: user.subscription.listingsUsed,
      message: 'Listing count incremented',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to increment listing count' });
  }
};

// Decrement listing count
export const decrementListingCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subscription) {
      return res.json({
        success: false,
        message: 'No subscription found',
      });
    }

    // Decrement listing count
    if ((user.subscription.listingsUsed || 0) > 0) {
      user.subscription.listingsUsed = (user.subscription.listingsUsed || 0) - 1;
      await user.save();
    }

    res.json({
      success: true,
      listingsUsed: user.subscription.listingsUsed,
      message: 'Listing count decremented',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to decrement listing count' });
  }
};

// Check job post limit
export const checkJobPostLimit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // No subscription
    if (!user.subscription || !user.subscription.planId) {
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: null,
        message: 'No active subscription. Job posting not allowed.',
      });
    }

    // Check subscription status
    if (user.subscription.status !== 'active') {
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: `Subscription is ${user.subscription.status}. Cannot post jobs.`,
      });
    }

    // Check if expired
    const now = new Date();
    const endDate = new Date(user.subscription.endDate || now);
    if (now > endDate) {
      user.subscription.status = 'expired';
      await user.save();
      return res.json({
        allowed: false,
        remaining: 0,
        limitReached: true,
        subscription: user.subscription,
        message: 'Subscription has expired. Cannot post jobs.',
      });
    }

    const plan = user.subscription.planId as any;
    const maxJobPosts = plan?.features?.maxJobPosts || 0;
    const jobPostsUsed = user.subscription.jobPostsUsed || 0;
    const remaining = Math.max(0, maxJobPosts - jobPostsUsed);
    const limitReached = remaining <= 0;

    res.json({
      allowed: !limitReached,
      remaining,
      limitReached,
      subscription: user.subscription,
      message: limitReached ? `Job post limit reached (${maxJobPosts}). Please upgrade.` : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check job post limit' });
  }
};

// Increment job post count
export const incrementJobPostCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subscription || user.subscription.status !== 'active') {
      return res.json({
        success: false,
        message: 'No active subscription',
      });
    }

    // Increment job post count
    user.subscription.jobPostsUsed = (user.subscription.jobPostsUsed || 0) + 1;
    await user.save();

    res.json({
      success: true,
      jobPostsUsed: user.subscription.jobPostsUsed,
      message: 'Job post count incremented',
    });
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

    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Default delay for free plan (168 hours = 7 days)
    let delayHours = 168;

    // No subscription - use free plan delay
    if (!user.subscription || !user.subscription.planId) {
      const createdTime = new Date(listingCreatedAt).getTime();
      const availableTime = createdTime + (delayHours * 60 * 60 * 1000);
      const now = Date.now();
      const visible = now >= availableTime;

      return res.json({
        visible,
        delayHours,
        availableAt: new Date(availableTime).toISOString(),
        subscription: null,
      });
    }

    // Inactive subscription - use highest delay
    if (user.subscription.status !== 'active') {
      return res.json({
        visible: false,
        delayHours: 168,
        availableAt: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString(),
        subscription: user.subscription,
      });
    }

    const plan = user.subscription.planId as any;
    delayHours = plan?.features?.dataDelayDays ? plan.features.dataDelayDays * 24 : 0;

    const createdTime = new Date(listingCreatedAt).getTime();
    const availableTime = createdTime + (delayHours * 60 * 60 * 1000);
    const now = Date.now();
    const visible = now >= availableTime;

    res.json({
      visible,
      delayHours,
      availableAt: new Date(availableTime).toISOString(),
      subscription: user.subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check listing visibility' });
  }
};

// Check notification permission
export const checkNotificationPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.subscription || user.subscription.status !== 'active') {
      return res.json({
        allowed: false,
        subscription: user.subscription || null,
      });
    }

    const plan = user.subscription.planId as any;
    const notificationsEnabled = plan?.features?.instantVehicleAlerts || plan?.features?.instantJobAlerts || false;

    res.json({
      allowed: notificationsEnabled,
      subscription: user.subscription,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check notification permission' });
  }
};