import { Response } from 'express';
import Vehicle from '../models/Vehicle.js';
import Notification from '../models/Notification.js';
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
    if (req.user && req.user.role === 'vendor') {
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

    // Only show approved vehicles to non-admin users
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'approved';
      
      // Removed subscription data delay to ensure logged-in users can see listings
      // The delay logic was incorrectly hiding all recent listings for new users
    } else if (status) {
      query.status = status;
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
    if (req.user && req.user.role === 'vendor') {
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
    if (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== vehicle.sellerId.toString())) {
      // Removed delay check to allow visibility
    }

    // Only show approved vehicles to non-admin/non-owner users
    if (
      vehicle.status !== 'approved' &&
      (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== vehicle.sellerId.toString()))
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
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // Check subscription permissions for vehicle advertising
    if (req.user.role !== 'admin') {
      const plan = req.user.subscription?.planId as unknown as ISubscriptionPlan;
      
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
      const listingsUsed = req.user.subscription?.listingsUsed ?? 0;

      if (maxListings !== -1 && listingsUsed >= maxListings) {
        res.status(403).json({
          success: false,
          error: `You have reached your listing limit (${maxListings}). Please upgrade your plan.`,
          code: 'LIMIT_REACHED',
        });
        return;
      }
    }

    const vehicleData = {
      ...req.body,
      sellerId: req.user._id,
      sellerName: req.user.instituteName || req.user.name,
      sellerEmail: req.user.email,
      sellerPhone: req.user.phone,
      status: 'pending',
    };

    const vehicle = await Vehicle.create(vehicleData);

    // Update listingsUsed counter
    if (req.user.subscription) {
      req.user.subscription.listingsUsed = (req.user.subscription.listingsUsed || 0) + 1;
      await (req.user as any).save();
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
    if (!req.user) {
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

    // Check ownership
    if (vehicle.sellerId.toString() !== req.user._id.toString()) {
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
    if (!req.user) {
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

    // Check ownership or admin
    if (
      vehicle.sellerId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
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
    if (req.user && req.user.role === 'vendor') {
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
    if (req.user && req.user.role === 'vendor') {
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
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const vehicles = await Vehicle.find({
      sellerId: req.user._id,
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