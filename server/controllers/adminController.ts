import { Response } from 'express';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Supplier from '../models/Supplier.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Notification from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalVehicles,
      pendingVehicles,
      approvedVehicles,
      rejectedVehicles,
      priorityVehicles,
      totalUsers,
      totalJobs,
      totalSuppliers,
    ] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'pending' }),
      Vehicle.countDocuments({ status: 'approved' }),
      Vehicle.countDocuments({ status: 'rejected' }),
      Vehicle.countDocuments({ isPriority: true, status: 'approved' }),
      User.countDocuments({ role: 'institute' }),
      Job.countDocuments(),
      Supplier.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        vehicles: {
          total: totalVehicles,
          pending: pendingVehicles,
          approved: approvedVehicles,
          rejected: rejectedVehicles,
          priority: priorityVehicles,
        },
        users: totalUsers,
        jobs: totalJobs,
        suppliers: totalSuppliers,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get pending vehicle approvals
// @route   GET /api/admin/pending
// @access  Private (Admin)
export const getPendingVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicles = await Vehicle.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get pending vehicles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending vehicles',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Approve/Reject vehicle
// @route   PUT /api/admin/approve/:id
// @access  Private (Admin)
export const approveVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, reason } = req.body;
    const vehicleId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'Invalid status',
        code: 'INVALID_STATUS',
      });
      return;
    }

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    vehicle.status = status;
    await vehicle.save();

    // Create notification for vehicle owner
    try {
      if (vehicle.sellerId) {
        await Notification.create({
          userId: vehicle.sellerId,
          type: status === 'approved' ? 'approval' : 'rejection',
          title: status === 'approved' ? 'Vehicle Approved' : 'Vehicle Rejected',
          message: status === 'approved'
            ? `Your vehicle listing "${vehicle.title}" has been approved and is now live.`
            : `Your vehicle listing "${vehicle.title}" has been rejected. ${reason || ''}`,
          link: `/vehicle/${vehicle._id}`,
        });
      } else {
        console.warn(`Vehicle ${vehicle._id} has no sellerId, skipping notification`);
      }
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Continue even if notification fails
    }

    res.status(200).json({
      success: true,
      data: vehicle,
      message: `Vehicle ${status} successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Approve vehicle error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle status',
      code: 'UPDATE_ERROR',
    });
  }
};

// @desc    Toggle priority status
// @route   PUT /api/admin/priority/:id
// @access  Private (Admin)
export const togglePriority = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isPriority } = req.body;
    const vehicleId = req.params.id;

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    vehicle.isPriority = isPriority;
    await vehicle.save();

    // Create notification if set to priority
    if (isPriority) {
      await Notification.create({
        userId: vehicle.sellerId,
        type: 'priority',
        title: 'Priority Listing',
        message: `Your vehicle listing "${vehicle.title}" has been marked as a priority listing!`,
        link: `/vehicle/${vehicle._id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
      message: `Priority status updated successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Toggle priority error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update priority status',
      code: 'UPDATE_ERROR',
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: users,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Suspend/Activate user or Update Subscription
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive, planId, notes } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    // If planId provided, update subscription
    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration);

        user.subscription = {
          planId: plan._id,
          status: 'active',
          paymentStatus: 'completed',
          startDate,
          endDate,
          listingsUsed: user.subscription?.listingsUsed || 0,
          listingsLimit: plan.features.maxListings,
          jobPostsUsed: user.subscription?.jobPostsUsed || 0,
          jobPostsLimit: plan.features.maxJobPosts,
          browseCount: user.subscription?.browseCount || 0,
          browseCountLimit: plan.features.maxBrowsesPerMonth,
          lastBrowseReset: user.subscription?.lastBrowseReset || startDate,
          notes: notes || `Plan updated by admin to ${plan.displayName}`,
        };
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user,
      message: `User updated successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      code: 'UPDATE_ERROR',
    });
  }
};