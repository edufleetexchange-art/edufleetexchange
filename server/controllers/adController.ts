import { Request, Response } from 'express';
import { Ad, AdRequest, IAd, IAdRequest } from '../models/Ad.js';

// ============ AD MANAGEMENT (Admin) ============

// Get all ads (Admin)
export const getAllAds = async (req: Request, res: Response) => {
  try {
    const { status, placement, page = 1, limit = 20 } = req.query;
    
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (placement) filter.placement = placement;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [ads, total] = await Promise.all([
      Ad.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Ad.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: ads,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching ads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ads',
      message: error.message,
    });
  }
};

// Get single ad
export const getAdById = async (req: Request, res: Response) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }
    
    res.json({
      success: true,
      data: ad,
    });
  } catch (error: any) {
    console.error('Error fetching ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ad',
      message: error.message,
    });
  }
};

// Create new ad (Admin)
export const createAd = async (req: Request, res: Response) => {
  try {
    const adData = req.body;
    
    const ad = new Ad({
      ...adData,
      impressions: 0,
      clicks: 0,
    });
    
    await ad.save();
    
    res.status(201).json({
      success: true,
      data: ad,
      message: 'Ad created successfully',
    });
  } catch (error: any) {
    console.error('Error creating ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ad',
      message: error.message,
    });
  }
};

// Update ad (Admin)
export const updateAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const ad = await Ad.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }
    
    res.json({
      success: true,
      data: ad,
      message: 'Ad updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ad',
      message: error.message,
    });
  }
};

// Delete ad (Admin)
export const deleteAd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ad = await Ad.findByIdAndDelete(id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Ad deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting ad:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ad',
      message: error.message,
    });
  }
};

// ============ PUBLIC AD ENDPOINTS ============

// Get active ads by placement (Public)
export const getAdsByPlacement = async (req: Request, res: Response) => {
  try {
    const { placement } = req.params;
    const now = new Date();
    
    const ads = await Ad.find({
      placement,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .sort({ priority: -1 })
      .limit(5);
    
    res.json({
      success: true,
      data: ads,
    });
  } catch (error: any) {
    console.error('Error fetching ads by placement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ads',
      message: error.message,
    });
  }
};

// Record impression (Public)
export const recordImpression = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await Ad.findByIdAndUpdate(id, {
      $inc: { impressions: 1 },
    });
    
    res.json({
      success: true,
      message: 'Impression recorded',
    });
  } catch (error: any) {
    console.error('Error recording impression:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record impression',
    });
  }
};

// Record click (Public)
export const recordClick = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await Ad.findByIdAndUpdate(id, {
      $inc: { clicks: 1 },
    });
    
    res.json({
      success: true,
      message: 'Click recorded',
    });
  } catch (error: any) {
    console.error('Error recording click:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record click',
    });
  }
};

// Get ad analytics (Admin)
export const getAdAnalytics = async (req: Request, res: Response) => {
  try {
    const ads = await Ad.find().select('title impressions clicks status placement budget');
    
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const activeAds = ads.filter(ad => ad.status === 'active').length;
    const totalBudget = ads.reduce((sum, ad) => sum + ad.budget, 0);
    
    res.json({
      success: true,
      data: {
        totalAds: ads.length,
        activeAds,
        totalImpressions,
        totalClicks,
        ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0,
        totalBudget,
        ads,
      },
    });
  } catch (error: any) {
    console.error('Error fetching ad analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message,
    });
  }
};

// ============ AD REQUEST MANAGEMENT ============

// Submit ad request (Public)
export const submitAdRequest = async (req: Request, res: Response) => {
  try {
    const { name, email, company, phone, adType, message } = req.body;
    
    if (!name || !email || !company || !adType) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, company, and ad type are required',
      });
    }
    
    const adRequest = new AdRequest({
      name,
      email,
      company,
      phone,
      adType,
      message,
      status: 'pending',
    });
    
    await adRequest.save();
    
    res.status(201).json({
      success: true,
      data: adRequest,
      message: 'Ad request submitted successfully',
    });
  } catch (error: any) {
    console.error('Error submitting ad request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit ad request',
      message: error.message,
    });
  }
};

// Get all ad requests (Admin)
export const getAllAdRequests = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [requests, total] = await Promise.all([
      AdRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AdRequest.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching ad requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ad requests',
      message: error.message,
    });
  }
};

// Update ad request status (Admin)
export const updateAdRequestStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'contacted', 'converted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
      });
    }
    
    const adRequest = await AdRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!adRequest) {
      return res.status(404).json({
        success: false,
        error: 'Ad request not found',
      });
    }
    
    res.json({
      success: true,
      data: adRequest,
      message: 'Ad request status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating ad request status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ad request status',
      message: error.message,
    });
  }
};

// Delete ad request (Admin)
export const deleteAdRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const adRequest = await AdRequest.findByIdAndDelete(id);
    
    if (!adRequest) {
      return res.status(404).json({
        success: false,
        error: 'Ad request not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Ad request deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting ad request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ad request',
      message: error.message,
    });
  }
};
