import { Request, Response } from 'express';
import Supplier from '../models/Supplier.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { AuthRequest } from '../middleware/auth.js';

// Create a new supplier
export const createSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const supplierData = {
      ...req.body,
      createdBy: userId,
      status: 'pending', // Requires admin approval
    };

    const supplier = await Supplier.create(supplierData);

    res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully. Pending admin approval.',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create supplier',
      code: 'CREATE_SUPPLIER_FAILED',
    });
  }
};

// Get all suppliers with filters
export const getAllSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      category,
      city,
      state,
      isVerified,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 20,
      status, // Extract status from query
    } = req.query;

    const query: any = {};

    // Only allow non-approved status for admins
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'approved';
    } else if (status) {
      query.status = status;
    } else {
      // Default to approved if no status specified for admin, or maybe allow all?
      // If admin and no status specified, show all?
      // Consistent with vehicles: if status not specified, show all (implied) or filtered?
      // In vehicleController:
      // if (!admin) query.status = 'approved'
      // else if (status) query.status = status
      // This implies if admin and no status, no status filter applied (so all).
      // Let's do the same here.
    }

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (city) {
      query['address.city'] = new RegExp(city as string, 'i');
    }

    if (state) {
      query['address.state'] = new RegExp(state as string, 'i');
    }

    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search as string, 'i') },
        { description: new RegExp(search as string, 'i') },
        { services: new RegExp(search as string, 'i') },
      ];
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const suppliers = await Supplier.find(query)
      .sort(sort as string)
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'createdBy',
        select: 'name email subscription role',
        populate: {
          path: 'subscription.planId',
          select: 'name features'
        }
      })
      .lean();

    const total = await Supplier.countDocuments(query);

    // Map to include isPaid flag
    const mappedSuppliers = suppliers.map((s: any) => {
      const creator = s.createdBy;
      const isPaid = creator?.subscription?.status === 'active';
      return {
        ...s,
        isPaid
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items: mappedSuppliers,
        total,
        page: pageNum,
        pageSize: limitNum,
        hasMore: skip + mappedSuppliers.length < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suppliers',
      code: 'FETCH_SUPPLIERS_FAILED',
    });
  }
};

// Get single supplier by ID
export const getSupplierById = async (req: AuthRequest, res: Response) => {
  try {
    const supplier = await Supplier.findById(req.params.id).populate({
      path: 'createdBy',
      select: 'name email phone subscription role',
      populate: {
        path: 'subscription.planId',
        select: 'name features'
      }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    // Check if supplier is paid (has active subscription)
    const creator = supplier.createdBy as any;
    const isPaid = creator?.subscription?.status === 'active';

    // If not admin and not owner, check if vendor is paid to show details
    if (!isPaid && (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== creator?._id?.toString()))) {
      return res.status(403).json({
        success: false,
        error: 'Access restricted: Full details are only available for featured vendors. Please contact admin for details.',
        code: 'VENDOR_NOT_PAID',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...supplier.toObject(),
        isPaid
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch supplier',
      code: 'FETCH_SUPPLIER_FAILED',
    });
  }
};

// Update supplier
export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    let supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && supplier.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this supplier',
        code: 'UNAUTHORIZED',
      });
    }

    // If updating from admin, don't reset status
    const updateData = { ...req.body };
    if (userRole !== 'admin') {
      updateData.status = 'pending'; // Re-approval required for user edits
    }

    supplier = await Supplier.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: supplier,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update supplier',
      code: 'UPDATE_SUPPLIER_FAILED',
    });
  }
};

// Delete supplier
export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const supplier = await Supplier.findById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && supplier.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this supplier',
        code: 'UNAUTHORIZED',
      });
    }

    await Supplier.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete supplier',
      code: 'DELETE_SUPPLIER_FAILED',
    });
  }
};

// Get user's suppliers
export const getMySuppliers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const suppliers = await Supplier.find({ createdBy: userId }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: suppliers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suppliers',
      code: 'FETCH_SUPPLIERS_FAILED',
    });
  }
};

// Get supplier stats (admin only)
export const getSupplierStats = async (req: Request, res: Response) => {
  try {
    const totalSuppliers = await Supplier.countDocuments();
    const approvedSuppliers = await Supplier.countDocuments({ status: 'approved' });
    const pendingSuppliers = await Supplier.countDocuments({ status: 'pending' });
    const rejectedSuppliers = await Supplier.countDocuments({ status: 'rejected' });
    const verifiedSuppliers = await Supplier.countDocuments({ isVerified: true });
    
    // Get category breakdown
    const categoryBreakdown = await Supplier.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalSuppliers,
        approved: approvedSuppliers,
        pending: pendingSuppliers,
        rejected: rejectedSuppliers,
        verified: verifiedSuppliers,
        byCategory: categoryBreakdown.reduce((acc, item) => {
          acc[item._id || 'uncategorized'] = item.count;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch supplier stats',
      code: 'FETCH_STATS_FAILED',
    });
  }
};

// Admin: Approve/Reject supplier with optional subscription update
export const approveSupplierStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, planId, notes } = req.body;
    const supplierId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        code: 'INVALID_STATUS',
      });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    supplier.status = status;
    await supplier.save();

    // If approved and planId provided, update user subscription
    if (status === 'approved' && planId) {
      const user = await User.findById(supplier.createdBy);
      const plan = await SubscriptionPlan.findById(planId);

      if (user && plan) {
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
          notes: notes || `Plan upgraded during supplier approval to ${plan.displayName}`,
        };
        await user.save();
      }
    }

    // Create notification
    await Notification.create({
      userId: supplier.createdBy,
      type: status === 'approved' ? 'approval' : 'rejection',
      title: status === 'approved' ? 'Supplier Profile Approved' : 'Supplier Profile Rejected',
      message: status === 'approved'
        ? `Your supplier profile for "${supplier.name}" has been approved. You can now list your products.`
        : `Your supplier profile for "${supplier.name}" was not approved. Please check with admin for details.`,
      link: '/dashboard',
    });

    res.status(200).json({
      success: true,
      data: supplier,
      message: `Supplier ${status} successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update supplier status',
      code: 'APPROVAL_FAILED',
    });
  }
};

// Toggle supplier verification
export const toggleVerification = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const supplierId = req.params.id;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to verify suppliers',
        code: 'UNAUTHORIZED',
      });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    supplier.isVerified = !supplier.isVerified;
    await supplier.save();

    res.status(200).json({
      success: true,
      data: supplier,
      message: `Supplier ${supplier.isVerified ? 'verified' : 'unverified'} successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle verification',
      code: 'TOGGLE_VERIFICATION_FAILED',
    });
  }
};