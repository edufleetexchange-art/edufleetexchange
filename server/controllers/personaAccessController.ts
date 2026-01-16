/**
 * Persona Access Control Controller
 * 
 * Exposes endpoints for checking persona-based access permissions
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  getPersonaAccessControl,
  checkVehicleListingAccess,
  checkJobPostAccess,
  checkJobApplicationAccess,
  checkProductListingAccess,
} from '../middleware/personaAccessControl.js';

/**
 * GET /api/access/me
 * Get comprehensive access control for authenticated user
 */
export const getMyAccessControl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const accessControl = await getPersonaAccessControl(userId);
    res.json(accessControl);
  } catch (error: any) {
    console.error('[PersonaAccessController] Error getting access control:', error);
    res.status(500).json({ error: error.message || 'Failed to get access control' });
  }
};

/**
 * GET /api/access/vehicle-listing
 * Check if user can create vehicle listings
 */
export const checkVehicleListingPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await checkVehicleListingAccess(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[PersonaAccessController] Error checking vehicle listing access:', error);
    res.status(500).json({ error: error.message || 'Failed to check access' });
  }
};

/**
 * GET /api/access/job-post
 * Check if user can create job posts
 */
export const checkJobPostPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await checkJobPostAccess(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[PersonaAccessController] Error checking job post access:', error);
    res.status(500).json({ error: error.message || 'Failed to check access' });
  }
};

/**
 * GET /api/access/job-application
 * Check if user can apply to jobs
 */
export const checkJobApplicationPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await checkJobApplicationAccess(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[PersonaAccessController] Error checking job application access:', error);
    res.status(500).json({ error: error.message || 'Failed to check access' });
  }
};

/**
 * GET /api/access/product-listing
 * Check if user can create product listings
 */
export const checkProductListingPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const result = await checkProductListingAccess(userId);
    res.json(result);
  } catch (error: any) {
    console.error('[PersonaAccessController] Error checking product listing access:', error);
    res.status(500).json({ error: error.message || 'Failed to check access' });
  }
};
