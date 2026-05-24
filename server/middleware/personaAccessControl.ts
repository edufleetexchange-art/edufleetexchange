/**
 * Persona-Based Access Control Middleware
 *
 * Validates user access based on:
 * 1. User persona (Teacher, Institute, Vendor)
 * 2. Active subscription status
 * 3. Feature limits and permissions
 *
 * Each persona has specific features they can access:
 * - Institute: vehicle listings, job posts
 * - Vendor: product/service listings (no job creation)
 * - Teacher: job applications, profile visibility (no listing creation)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';

export interface PersonaAccessResult {
  allowed: boolean;
  reason?: string;
  limitReached?: boolean;
  remaining?: number;
  requiresUpgrade?: boolean;
  suggestedAction?: string;
}

/** Fetch account + active subscription for a userId */
async function getAccountWithSub(userId: string) {
  const account = await Account.findById(userId);
  if (!account) return { account: null, sub: null };
  const sub = await Subscription.findOne({ accountId: userId, status: 'active' })
    .populate('planId');
  return { account, sub };
}

/**
 * Check if user can create a vehicle listing (Institute only)
 */
export async function checkVehicleListingAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const { account, sub } = await getAccountWithSub(userId);

    if (!account) {
      return { allowed: false, reason: 'User not found' };
    }

    if (account.role !== 'institute') {
      return {
        allowed: false,
        reason: 'Only institutes can create vehicle listings',
        suggestedAction: 'Switch to an institute account to list vehicles',
      };
    }

    if (!sub) {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to create vehicle listings',
      };
    }

    const plan = sub.planId as any;
    const maxListings = plan?.features?.maxVehicleListings || sub.listingsLimit || 0;
    const usedListings = sub.listingsUsed || 0;
    const remaining = Math.max(0, maxListings - usedListings);

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: 'Vehicle listing limit reached',
        limitReached: true,
        remaining: 0,
        requiresUpgrade: true,
        suggestedAction: 'Upgrade your plan to create more vehicle listings',
      };
    }

    return { allowed: true, remaining };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking vehicle listing access:', error);
    return { allowed: false, reason: 'Error checking access permissions' };
  }
}

/**
 * Check if user can create a job post (Institute only)
 */
export async function checkJobPostAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const { account, sub } = await getAccountWithSub(userId);

    if (!account) {
      return { allowed: false, reason: 'User not found' };
    }

    if (account.role !== 'institute') {
      return {
        allowed: false,
        reason: 'Only institutes can create job posts',
        suggestedAction: 'Switch to an institute account to post jobs',
      };
    }

    if (!sub) {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to post jobs',
      };
    }

    const plan = sub.planId as any;
    const maxJobPosts = plan?.features?.maxJobPosts || sub.jobPostsLimit || 0;
    const usedJobPosts = sub.jobPostsUsed || 0;
    const remaining = Math.max(0, maxJobPosts - usedJobPosts);

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: 'Job post limit reached',
        limitReached: true,
        remaining: 0,
        requiresUpgrade: true,
        suggestedAction: 'Upgrade your plan to post more jobs',
      };
    }

    return { allowed: true, remaining };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking job post access:', error);
    return { allowed: false, reason: 'Error checking access permissions' };
  }
}

/**
 * Check if user can apply to a job (Teacher only)
 */
export async function checkJobApplicationAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const { account, sub } = await getAccountWithSub(userId);

    if (!account) {
      return { allowed: false, reason: 'User not found' };
    }

    if (account.role !== 'teacher') {
      return {
        allowed: false,
        reason: 'Only teachers can apply to jobs',
        suggestedAction: 'Switch to a teacher account to apply for jobs',
      };
    }

    if (!sub) {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to apply for jobs',
      };
    }

    const plan = sub.planId as any;
    const maxApplications = plan?.features?.maxJobApplications || 5;
    const canAccessJobBoard = plan?.features?.canAccessJobBoard !== false;

    if (!canAccessJobBoard) {
      return {
        allowed: false,
        reason: 'Your plan does not include job board access',
        requiresUpgrade: true,
        suggestedAction: 'Upgrade your plan to access the job board',
      };
    }

    return { allowed: true, remaining: maxApplications };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking job application access:', error);
    return { allowed: false, reason: 'Error checking access permissions' };
  }
}

/**
 * Check if user can create a product listing (Vendor only)
 */
export async function checkProductListingAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const { account, sub } = await getAccountWithSub(userId);

    if (!account) {
      return { allowed: false, reason: 'User not found' };
    }

    if (account.role !== 'vendor') {
      return {
        allowed: false,
        reason: 'Only vendors can create product listings',
        suggestedAction: 'Switch to a vendor account to list products',
      };
    }

    if (!sub) {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to create product listings',
      };
    }

    const plan = sub.planId as any;
    const maxListings = plan?.features?.maxProductListings || sub.listingsLimit || 0;
    const usedListings = sub.listingsUsed || 0;
    const remaining = Math.max(0, maxListings - usedListings);

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: 'Product listing limit reached',
        limitReached: true,
        remaining: 0,
        requiresUpgrade: true,
        suggestedAction: 'Upgrade your plan to create more product listings',
      };
    }

    return { allowed: true, remaining };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking product listing access:', error);
    return { allowed: false, reason: 'Error checking access permissions' };
  }
}

/**
 * Middleware: Require vehicle listing permission (Institute only)
 */
export async function requireVehicleListingAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.account?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const accessResult = await checkVehicleListingAccess(userId);
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }
  (req as any).accessInfo = accessResult;
  next();
}

/**
 * Middleware: Require job post permission (Institute only)
 */
export async function requireJobPostAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.account?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const accessResult = await checkJobPostAccess(userId);
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }
  (req as any).accessInfo = accessResult;
  next();
}

/**
 * Middleware: Require job application permission (Teacher only)
 */
export async function requireJobApplicationAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.account?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const accessResult = await checkJobApplicationAccess(userId);
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }
  (req as any).accessInfo = accessResult;
  next();
}

/**
 * Middleware: Require product listing permission (Vendor only)
 */
export async function requireProductListingAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.account?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const accessResult = await checkProductListingAccess(userId);
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }
  (req as any).accessInfo = accessResult;
  next();
}

/**
 * Get comprehensive access control for a user
 */
export async function getPersonaAccessControl(userId: string) {
  try {
    const { account, sub } = await getAccountWithSub(userId);

    if (!account) throw new Error('User not found');

    const plan = sub?.planId as any;
    const persona = account.role as 'teacher' | 'institute' | 'vendor';

    const accessControl: any = {
      persona,
      subscription: sub ? {
        status: sub.status,
        planName: plan?.displayName || 'Unknown',
        endDate: sub.endDate,
      } : null,
    };

    if (persona === 'institute') {
      const vehicleAccess = await checkVehicleListingAccess(userId);
      const jobPostAccess = await checkJobPostAccess(userId);
      accessControl.canCreateVehicleListing = vehicleAccess.allowed;
      accessControl.canCreateJobPost = jobPostAccess.allowed;
      accessControl.remainingVehicleListings = vehicleAccess.remaining || 0;
      accessControl.remainingJobPosts = jobPostAccess.remaining || 0;
    } else if (persona === 'vendor') {
      const productAccess = await checkProductListingAccess(userId);
      accessControl.canCreateProductListing = productAccess.allowed;
      accessControl.remainingProductListings = productAccess.remaining || 0;
    } else if (persona === 'teacher') {
      const jobAppAccess = await checkJobApplicationAccess(userId);
      accessControl.canApplyToJob = jobAppAccess.allowed;
      accessControl.remainingJobApplications = jobAppAccess.remaining || 0;
      accessControl.profileVisibility = plan?.features?.profileVisibility || 'basic';
    }

    accessControl.canBrowse = sub?.status === 'active';
    accessControl.remainingBrowses = sub
      ? Math.max(0, (sub.browseCountLimit || 0) - (sub.browseCount || 0))
      : 0;

    return accessControl;
  } catch (error) {
    console.error('[PersonaAccessControl] Error getting access control:', error);
    throw error;
  }
}
