import { Response } from 'express';
import Vehicle from '../models/Vehicle.js';
import Notification from '../models/Notification.js';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import { logAction } from '../utils/auditLogger.js';
import { AuthRequest } from '../middleware/auth.js';
import { ISubscriptionPlan } from '../models/SubscriptionPlan.js';

// Helper to get data delay date
const getDataDelayDate = (user: any): Date | null => {
  if (!user || user.role === 'admin') return null;

  const plan = user.subscription?.planId as unknown as ISubscriptionPlan;
  const delayDays = plan?.features?.dataDelayDays ?? 10; // Default to 10 days if guest or no plan

  if (delayDays === 0) return null;

  const delayDate = new Date();
  delayDate.setDate(delayDate.getDate() - delayDays);
  return delayDate;
};

// @desc    Get all vehicles with filters
// @route   GET /api/vehicles
// @access  Public
export const getVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Restrict access for vendors
    if (req.account && req.account.role === 'vendor') {
      res.status(403).json({
        success: false,
        error: 'Vehicle browsing is not applicable for vendors',
        code: 'ACCESS_DENIED',
      });
      return;
    }

    const {
      searchTerm,
      type,
      manufacturer,
      year,
      condition,
      status,
      isPriority,
      page = 1,
      pageSize = 12,
    } = req.query;

    // Build query
    const query: any = {};

    // Visibility logic
    if (status && status !== 'all') {
      // If specific status requested (e.g. from admin or owner filters)
      if (status === 'approved') {
        // For 'approved' filter, also include owned/assisted pending/rejected listings for logged-in users
        if (req.account && req.account.role !== 'admin') {
          query.$or = [
            { status: 'approved' },
            { sellerId: req.account.id },
            { assistedBy: req.account.id }
          ];
        } else {
          query.status = 'approved';
        }
      } else {
        query.status = status;
      }
    } else if (!req.account || req.account.role !== 'admin') {
      // Default visibility for non-admins: approved listings OR owned/assisted listings
      if (req.account) {
        query.$or = [
          { status: 'approved' },
          { sellerId: req.account.id },
          { assistedBy: req.account.id }
        ];
      } else {
        query.status = 'approved';
      }
    }

    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { manufacturer: { $regex: searchTerm, $options: 'i' } },
        { vehicleModel: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (type) query.type = type;
    if (manufacturer) query.manufacturer = manufacturer;
    if (year) query.year = Number(year);
    if (condition) query.condition = condition;
    if (isPriority !== undefined) query.isPriority = isPriority === 'true';

    // Pagination
    const pageNum = Number(page);
    const limit = Number(pageSize);
    const skip = (pageNum - 1) * limit;

    // Execute query
    const [vehicles, total] = await Promise.all([
      Vehicle.find(query)
        .sort({ isPriority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: vehicles,
        total,
        page: pageNum,
        pageSize: limit,
        hasMore: skip + vehicles.length < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicles',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
export const getVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Restrict access for vendors
    if (req.account && req.account.role === 'vendor') {
      res.status(403).json({
        success: false,
        error: 'Vehicle browsing is not applicable for vendors',
        code: 'ACCESS_DENIED',
      });
      return;
    }

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Check visibility based on delay if not admin/owner
    if (!req.account || (req.account.role !== 'admin' && req.account.id !== vehicle.sellerId.toString())) {
      // Removed delay check to allow visibility
    }

    // Only show approved vehicles to non-admin/non-owner/non-assistant users
    if (
      vehicle.status !== 'approved' &&
      (!req.account || (
        req.account.role !== 'admin' &&
        req.account.id !== vehicle.sellerId.toString() &&
        (!vehicle.assistedBy || req.account.id !== vehicle.assistedBy.toString())
      ))
    ) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Increment views
    vehicle.views += 1;
    await vehicle.save();

    res.status(200).json({
      success: true,
      data: vehicle,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Create vehicle listing
// @route   POST /api/vehicles
// @access  Private (Institute)
export const createVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Check subscription permissions for vehicle advertising
    if (req.account.role !== 'admin' && req.account.role !== 'sales') {
      const plan = req.subscription?.planId as unknown as ISubscriptionPlan;

      if (plan && !plan.features.canAdvertiseVehicles) {
        res.status(403).json({
          success: false,
          error: 'Your current plan does not allow advertising vehicles. Please upgrade to a Professional or higher plan.',
          code: 'SUBSCRIPTION_RESTRICTED',
        });
        return;
      }

      // Check listing limit
      const maxListings = plan?.features?.maxListings ?? 0;
      const listingsUsed = req.subscription?.listingsUsed ?? 0;

      if (maxListings !== -1 && listingsUsed >= maxListings) {
        res.status(403).json({
          success: false,
          error: `You have reached your listing limit (${maxListings}). Please upgrade your plan.`,
          code: 'LIMIT_REACHED',
        });
        return;
      }
    }

    let sellerId = req.account.id;
    let sellerName = req.profile?.instituteName || req.account.name;
    let sellerEmail = req.account.email;
    let sellerPhone = req.account.phone;
    let actualSeller: any = null;

    // If sales or admin, allow providing seller details (listing on behalf of school)
    if ((req.account.role === 'admin' || req.account.role === 'sales') && req.body.sellerId) {
      actualSeller = await Account.findById(req.body.sellerId);
      if (actualSeller) {
        sellerId = actualSeller._id;
        sellerName = (actualSeller as any).instituteName || actualSeller.name;
        sellerEmail = actualSeller.email;
        sellerPhone = actualSeller.phone;
      }
    }

    const vehicleData = {
      ...req.body,
      sellerId,
      sellerName,
      sellerEmail,
      sellerPhone,
      status: (req.account.role === 'admin' || req.account.role === 'sales') ? 'approved' : 'pending',
    };

    const vehicle = await Vehicle.create(vehicleData);

    // Log action if staff member assisted
    if (req.account.role === 'sales' || req.account.role === 'admin') {
      await logAction({
        user: req.account as any,
        action: 'ASSISTED_VEHICLE_LISTING',
        targetId: vehicle._id.toString(),
        targetType: 'Vehicle',
        details: `Assisted in listing vehicle "${vehicle.title}" for seller ${sellerName} (${sellerId})`,
        req
      });
    }

    // Update listingsUsed counter for the actual seller (Institute)
    if (actualSeller) {
      await Subscription.findOneAndUpdate(
        { accountId: actualSeller._id, status: 'active' },
        { $inc: { listingsUsed: 1 } }
      );
    } else if (req.subscription && req.account.role !== 'sales') {
      // Normal flow (Institute creating for themselves) — update their Subscription document
      await Subscription.findOneAndUpdate(
        { accountId: req.account.id, status: 'active' },
        { $inc: { listingsUsed: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      data: vehicle,
      message: 'Vehicle listing created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create vehicle listing',
      code: 'CREATE_ERROR',
    });
  }
};

// @desc    Update vehicle listing
// @route   PUT /api/vehicles/:id
// @access  Private (Owner)
export const updateVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Check ownership or assistant (if pending)
    const isOwner = vehicle.sellerId.toString() === req.account.id;
    const isAssistant = vehicle.assistedBy?.toString() === req.account.id;
    const isAdmin = req.account.role === 'admin';

    if (!isOwner && !isAdmin && (!isAssistant || vehicle.status !== 'pending')) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this vehicle',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Update vehicle
    Object.assign(vehicle, req.body);
    await vehicle.save();

    res.status(200).json({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle',
      code: 'UPDATE_ERROR',
    });
  }
};

// @desc    Delete vehicle listing
// @route   DELETE /api/vehicles/:id
// @access  Private (Owner)
export const deleteVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Check ownership, admin, or assistant (if pending)
    const isOwner = vehicle.sellerId.toString() === req.account.id;
    const isAssistant = vehicle.assistedBy?.toString() === req.account.id;
    const isAdmin = req.account.role === 'admin';

    if (!isOwner && !isAdmin && (!isAssistant || vehicle.status !== 'pending')) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to delete this vehicle',
        code: 'FORBIDDEN',
      });
      return;
    }

    await vehicle.deleteOne();

    res.status(200).json({
      success: true,
      data: { deleted: true },
      message: 'Vehicle deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vehicle',
      code: 'DELETE_ERROR',
    });
  }
};

// @desc    Get priority listings
// @route   GET /api/vehicles/priority
// @access  Public
export const getPriorityListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Restrict for vendors
    if (req.account && req.account.role === 'vendor') {
      res.status(200).json({ success: true, data: [], timestamp: new Date().toISOString() });
      return;
    }

    const query: any = {
      status: 'approved',
      isPriority: true,
    };

    // Removed delay logic
    
    const vehicles = await Vehicle.find(query)
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    res.status(200).json({
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get priority listings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch priority listings',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get recent listings
// @route   GET /api/vehicles/recent
// @access  Public
export const getRecentListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Restrict for vendors
    if (req.account && req.account.role === 'vendor') {
      res.status(200).json({ success: true, data: [], timestamp: new Date().toISOString() });
      return;
    }

    const query: any = {
      status: 'approved',
    };

    // Removed delay logic

    const vehicles = await Vehicle.find(query)
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.status(200).json({
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get recent listings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent listings',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get my listings
// @route   GET /api/vehicles/my-listings
// @access  Private (Institute)
export const getMyListings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const vehicles = await Vehicle.find({
      sellerId: req.account.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listings',
      code: 'FETCH_ERROR',
    });
  }
};
