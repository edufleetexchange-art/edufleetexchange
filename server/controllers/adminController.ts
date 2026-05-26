import { Response } from 'express';
import Vehicle from '../models/Vehicle.js';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import Job from '../models/Job.js';
import Supplier from '../models/Supplier.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Category from '../models/Category.js';
import SystemConfig from '../models/SystemConfig.js';
import { logAction } from '../utils/auditLogger.js';
import { AuthRequest } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

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
      totalUsers,
      totalTeachers,
      totalJobs,
      totalSuppliers,
    ] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'pending' }),
      Vehicle.countDocuments({ status: 'approved' }),
      Vehicle.countDocuments({ status: 'rejected' }),
      Account.countDocuments({ role: 'institute' }),
      Account.countDocuments({ role: 'teacher' }),
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
        },
        users: totalUsers,
        teachers: totalTeachers,
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
    const users = await Account.find({ role: { $ne: 'admin' } })
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

    const user = await Account.findById(userId);

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

    // Log the action for auditing
    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'UPDATE_USER_STATUS',
        targetId: user._id.toString(),
        targetType: 'User',
        details: `Updated user ${user.email} status. Active: ${isActive}, Plan: ${planId || 'unchanged'}`,
        req
      });
    }

    // If planId provided, update subscription
    if (planId) {
      // Check if user role allows subscription
      const internalRoles = ['admin', 'marketing', 'sales'];
      if (internalRoles.includes(user.role)) {
        res.status(400).json({
          success: false,
          error: `Cannot assign a subscription plan to an internal ${user.role} account`,
          code: 'INVALID_ROLE_FOR_SUBSCRIPTION',
        });
        return;
      }

      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration);

        const existingSub = await Subscription.findOne({ accountId: userId });
        if (existingSub) {
          existingSub.planId = plan._id as any;
          existingSub.status = 'active';
          existingSub.paymentStatus = 'completed';
          existingSub.startDate = startDate;
          existingSub.endDate = endDate;
          existingSub.listingsLimit = plan.features.maxVehicleListings || 0;
          existingSub.jobPostsLimit = plan.features.maxJobPosts || 0;
          existingSub.browseCountLimit = plan.features.maxBrowsesPerMonth || 0;
          existingSub.notes = notes || `Plan updated by admin to ${plan.displayName}`;
          await existingSub.save();
        } else {
          await Subscription.create({
            accountId: userId,
            planId: plan._id,
            status: 'active',
            paymentStatus: 'completed',
            startDate,
            endDate,
            listingsUsed: 0,
            listingsLimit: plan.features.maxVehicleListings || 0,
            jobPostsUsed: 0,
            jobPostsLimit: plan.features.maxJobPosts || 0,
            browseCount: 0,
            browseCountLimit: plan.features.maxBrowsesPerMonth || 0,
            lastBrowseReset: startDate,
            notes: notes || `Plan updated by admin to ${plan.displayName}`,
          });
        }
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

// @desc    Create a new user
// @route   POST /api/admin/users
// @access  Private (Admin)
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, email, password, role,
      instituteName, contactPerson, phone, employeeId, department, permissions,
      experience, qualifications, subjects, bio, location, preferredLocation, isAvailable,
      businessName, website, address,
      planId,
    } = req.body;

    console.log('Creating user with data:', { name, email, role, planId });

    // Validate required fields
    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        error: 'Name, email, password, and role are required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Validate role
    const validRoles = ['institute', 'admin', 'teacher', 'vendor', 'marketing', 'sales'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Restrict marketing/sales role from creating admins or other staff users
    if ((req.account?.role === 'marketing' || req.account?.role === 'sales') && (role === 'admin' || role === 'marketing' || role === 'sales')) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to create this role',
        code: 'FORBIDDEN',
      });
      return;
    }

    let bundle: authService.Bundle;

    switch (role) {
      case 'institute':
        bundle = await authService.adminCreateInstitute({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          phone: phone?.trim(),
          instituteName: instituteName || name.trim(),
          contactPerson,
          address: address || { street: 'N/A', city: 'N/A', state: 'N/A', pincode: '000000', country: 'India' },
          planId,
          isVerified: true,
        });
        break;
      case 'teacher':
        bundle = await authService.adminCreateTeacher({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          phone: phone?.trim(),
          experience: experience ?? 0,
          qualifications: qualifications ?? [],
          subjects: subjects ?? [],
          bio,
          location,
          preferredLocation,
          isAvailable,
          planId,
          isVerified: true,
        });
        break;
      case 'vendor':
        bundle = await authService.adminCreateVendor({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          phone: phone?.trim(),
          businessName: businessName || name.trim(),
          contactPerson,
          website,
          address,
          planId,
          isVerified: true,
        });
        break;
      case 'admin':
      case 'marketing':
      case 'sales':
        bundle = await authService.adminCreateStaff({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          phone: phone?.trim(),
          role,
          employeeId: employeeId?.trim() || undefined,
          department,
          permissions,
          isVerified: true,
        });
        break;
      default:
        res.status(400).json({ success: false, error: `Invalid role: ${role}`, code: 'VALIDATION_ERROR' });
        return;
    }

    console.log('User created successfully:', bundle.account._id);

    // Log the action for auditing
    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'CREATE_USER',
        targetId: bundle.account._id || bundle.account.id,
        targetType: 'User',
        details: `Created new user with role ${role} and email ${email}. Name: ${name}`,
        req
      });
    }

    res.status(201).json({
      success: true,
      data: bundle,
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Create user error:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      const keyValue = error.keyValue || {};
      const field = Object.keys(keyPattern)[0] || 'field';
      const value = keyValue[field] || 'unknown';
      res.status(409).json({
        success: false,
        error: `A user with this ${field} (${value}) already exists`,
        code: 'DUPLICATE_ERROR',
        field,
      });
      return;
    }

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        error: messages.join(', '),
        code: 'VALIDATION_ERROR',
        details: messages,
      });
      return;
    }

    // Handle CastError (invalid ObjectId format, etc.)
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        error: `Invalid ${error.path}: ${error.value}`,
        code: 'CAST_ERROR',
      });
      return;
    }

    // Handle password hashing errors
    if (error.message === 'Failed to hash password') {
      res.status(500).json({
        success: false,
        error: 'Server error during password processing. Please try again.',
        code: 'PASSWORD_HASH_ERROR',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user',
      code: 'CREATE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;

    const user = await Account.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (user.role === 'admin') {
      res.status(403).json({
        success: false,
        error: 'Cannot delete admin user',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Delete related data if necessary (listings, etc.)
    await Account.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      code: 'DELETE_ERROR',
    });
  }
};

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, action, employeeId, startDate, endDate } = req.query;
    const query: any = {};

    if (role) query.userRole = role;
    if (action) query.action = action;
    if (employeeId) query.employeeId = employeeId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    // If role is sales, restrict audit logs related to marketing-only leads
    if (req.account?.role === 'sales') {
      // This is a bit tricky because audit logs store targetId, not the lead's properties.
      // However, we can at least filter by action types if needed.
      // For now, let's assume sales can see audit logs but the leads themselves are protected.
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private (Admin)
export const getCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    const filter: any = {};
    if (type) filter.type = type;

    const categories = await Category.find(filter).sort({ type: 1, order: 1, name: 1 }).lean();

    res.status(200).json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private (Admin)
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, type, description, order } = req.body;

    const finalSlug = (slug || name.toLowerCase().replace(/\s+/g, '-')).toLowerCase().trim();

    // Check for existing category with same slug + type before inserting
    const existing = await Category.findOne({ slug: finalSlug, type });
    if (existing) {
      res.status(400).json({
        success: false,
        error: `A ${type} category with slug "${finalSlug}" already exists. Please use a different name or slug.`,
        code: 'DUPLICATE_CATEGORY',
      });
      return;
    }

    const category = await Category.create({
      name,
      slug: finalSlug,
      type,
      description,
      order: order || 0,
    });

    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'CREATE_CATEGORY',
        targetId: category._id.toString(),
        targetType: 'Category',
        details: `Created category ${name} of type ${type}`,
        req
      });
    }

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Create category error:', error);

    // Handle MongoDB duplicate key error as fallback
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        error: 'A category with this slug and type already exists. Please use a different name or slug.',
        code: 'DUPLICATE_CATEGORY',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create category',
      code: 'CREATE_ERROR',
    });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private (Admin)
export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, description, order, isActive } = req.body;
    const { id } = req.params;

    // If slug is being changed, check for duplicates
    if (slug) {
      const finalSlug = slug.toLowerCase().trim();
      const existingCategory = await Category.findById(id);
      if (existingCategory && finalSlug !== existingCategory.slug) {
        const duplicate = await Category.findOne({ slug: finalSlug, type: existingCategory.type, _id: { $ne: id } });
        if (duplicate) {
          res.status(400).json({
            success: false,
            error: `A ${existingCategory.type} category with slug "${finalSlug}" already exists.`,
            code: 'DUPLICATE_CATEGORY',
          });
          return;
        }
      }
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { name, slug: slug?.toLowerCase().trim(), description, order, isActive },
      { new: true, runValidators: true }
    );

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'UPDATE_CATEGORY',
        targetId: category._id.toString(),
        targetType: 'Category',
        details: `Updated category ${category.name}`,
        req
      });
    }

    res.status(200).json({
      success: true,
      data: category,
      message: 'Category updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Update category error:', error);

    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        error: 'A category with this slug and type already exists.',
        code: 'DUPLICATE_CATEGORY',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update category',
      code: 'UPDATE_ERROR',
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private (Admin)
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'DELETE_CATEGORY',
        targetId: id,
        targetType: 'Category',
        details: `Deleted category ${category.name}`,
        req
      });
    }

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category',
      code: 'DELETE_ERROR',
    });
  }
};

// @desc    Get all system configurations
// @route   GET /api/admin/settings
// @access  Private (Admin)
export const getSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SystemConfig.find().sort({ group: 1, key: 1 }).lean();

    res.status(200).json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Update system configuration
// @route   PUT /api/admin/settings/:key
// @access  Private (Admin)
export const updateSetting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { value, description, group, isPublic } = req.body;
    const { key } = req.params;

    const setting = await SystemConfig.findOneAndUpdate(
      { key },
      { 
        value, 
        description, 
        group, 
        isPublic,
        updatedBy: req.account?.id
      },
      { new: true, upsert: true, runValidators: true }
    );

    if (req.account) {
      await logAction({
        user: req.account as any,
        action: 'UPDATE_SETTING',
        targetId: setting._id.toString(),
        targetType: 'SystemConfig',
        details: `Updated setting ${key}`,
        req
      });
    }

    res.status(200).json({
      success: true,
      data: setting,
      message: 'Setting updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Update setting error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update setting',
      code: 'UPDATE_ERROR',
    });
  }
};