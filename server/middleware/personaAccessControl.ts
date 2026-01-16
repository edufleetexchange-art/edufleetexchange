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
import User from '../models/User.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

export interface PersonaAccessResult {
  allowed: boolean;
  reason?: string;
  limitReached?: boolean;
  remaining?: number;
  requiresUpgrade?: boolean;
  suggestedAction?: string;
}

/**
 * Check if user can create a vehicle listing (Institute only)
 */
export async function checkVehicleListingAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    // Only institutes can create vehicle listings
    if (user.role !== 'institute') {
      return {
        allowed: false,
        reason: 'Only institutes can create vehicle listings',
        suggestedAction: 'Switch to an institute account to list vehicles',
      };
    }

    // Check if user has active subscription
    if (!user.subscription || user.subscription.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to create vehicle listings',
      };
    }

    const plan = user.subscription.planId as any;
    const maxListings = plan?.features?.maxVehicleListings || user.subscription.listingsLimit || 0;
    const usedListings = user.subscription.listingsUsed || 0;
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

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking vehicle listing access:', error);
    return {
      allowed: false,
      reason: 'Error checking access permissions',
    };
  }
}

/**
 * Check if user can create a job post (Institute only)
 */
export async function checkJobPostAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    // Only institutes can create job posts
    if (user.role !== 'institute') {
      return {
        allowed: false,
        reason: 'Only institutes can create job posts',
        suggestedAction: 'Switch to an institute account to post jobs',
      };
    }

    // Check if user has active subscription
    if (!user.subscription || user.subscription.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to post jobs',
      };
    }

    const plan = user.subscription.planId as any;
    const maxJobPosts = plan?.features?.maxJobPosts || user.subscription.jobPostsLimit || 0;
    const usedJobPosts = user.subscription.jobPostsUsed || 0;
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

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking job post access:', error);
    return {
      allowed: false,
      reason: 'Error checking access permissions',
    };
  }
}

/**
 * Check if user can apply to a job (Teacher only)
 */
export async function checkJobApplicationAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    // Only teachers can apply to jobs
    if (user.role !== 'teacher') {
      return {
        allowed: false,
        reason: 'Only teachers can apply to jobs',
        suggestedAction: 'Switch to a teacher account to apply for jobs',
      };
    }

    // Check if user has active subscription
    if (!user.subscription || user.subscription.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to apply for jobs',
      };
    }

    const plan = user.subscription.planId as any;
    const maxApplications = plan?.features?.maxJobApplications || 5; // Default 5
    
    // Note: We would need to track application count in the user model
    // For now, we'll assume they can apply if they have an active subscription
    const canAccessJobBoard = plan?.features?.canAccessJobBoard !== false;
    
    if (!canAccessJobBoard) {
      return {
        allowed: false,
        reason: 'Your plan does not include job board access',
        requiresUpgrade: true,
        suggestedAction: 'Upgrade your plan to access the job board',
      };
    }

    return {
      allowed: true,
      remaining: maxApplications, // Would need to calculate actual remaining
    };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking job application access:', error);
    return {
      allowed: false,
      reason: 'Error checking access permissions',
    };
  }
}

/**
 * Check if user can create a product listing (Vendor only)
 */
export async function checkProductListingAccess(
  userId: string
): Promise<PersonaAccessResult> {
  try {
    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    // Only vendors can create product listings
    if (user.role !== 'vendor') {
      return {
        allowed: false,
        reason: 'Only vendors can create product listings',
        suggestedAction: 'Switch to a vendor account to list products',
      };
    }

    // Check if user has active subscription
    if (!user.subscription || user.subscription.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active subscription',
        requiresUpgrade: true,
        suggestedAction: 'Subscribe to a plan to create product listings',
      };
    }

    const plan = user.subscription.planId as any;
    const maxListings = plan?.features?.maxProductListings || user.subscription.listingsLimit || 0;
    const usedListings = user.subscription.listingsUsed || 0;
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

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error('[PersonaAccessControl] Error checking product listing access:', error);
    return {
      allowed: false,
      reason: 'Error checking access permissions',
    };
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
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const accessResult = await checkVehicleListingAccess(userId);
  
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }

  // Attach access info to request
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
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const accessResult = await checkJobPostAccess(userId);
  
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }

  // Attach access info to request
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
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const accessResult = await checkJobApplicationAccess(userId);
  
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }

  // Attach access info to request
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
  const userId = req.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const accessResult = await checkProductListingAccess(userId);
  
  if (!accessResult.allowed) {
    return res.status(403).json({
      error: accessResult.reason,
      limitReached: accessResult.limitReached,
      requiresUpgrade: accessResult.requiresUpgrade,
      suggestedAction: accessResult.suggestedAction,
    });
  }

  // Attach access info to request
  (req as any).accessInfo = accessResult;
  next();
}

/**
 * Get comprehensive access control for a user
 */
export async function getPersonaAccessControl(userId: string) {
  try {
    const user = await User.findById(userId).populate('subscription.planId');
    
    if (!user) {
      throw new Error('User not found');
    }

    const plan = user.subscription?.planId as any;
    const persona = user.role as 'teacher' | 'institute' | 'vendor';

    // Base response
    const accessControl: any = {
      persona,
      subscription: user.subscription ? {
        status: user.subscription.status,
        planName: plan?.displayName || 'Unknown',
        endDate: user.subscription.endDate,
      } : null,
    };

    // Add persona-specific access
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

    // Common features
    accessControl.canBrowse = user.subscription?.status === 'active';
    accessControl.remainingBrowses = user.subscription
      ? Math.max(0, (user.subscription.browseCountLimit || 0) - (user.subscription.browseCount || 0))
      : 0;

    return accessControl;
  } catch (error) {
    console.error('[PersonaAccessControl] Error getting access control:', error);
    throw error;
  }
}
