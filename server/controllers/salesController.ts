import { Response } from 'express';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import SubscriptionRequest from '../models/SubscriptionRequest.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
import Supplier from '../models/Supplier.js';
import Lead from '../models/Lead.js';
import VendorProfile from '../models/VendorProfile.js';
import { AuthRequest } from '../middleware/auth.js';
import { logAction } from '../utils/auditLogger.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import * as authService from '../services/authService.js';

/** Generate a strong temp password that the rep can pass to the user once.
 *  The user is expected to reset it on first login; we don't ship a hardcoded shared value. */
function generateTempPassword(): string {
  // ~104 bits of entropy in base64url; safe for "one-time, change-on-login" use.
  return crypto.randomBytes(18).toString('base64url') + '!Aa9';
}

/**
 * @desc    Get sales dashboard stats
 * @route   GET /api/sales/stats
 * @access  Private (Sales/Admin)
 */
export const getSalesStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const userId = req.account!.id;

    // Stats for subscription requests and leads (excluding marketing-only leads)
    const [totalRequests, pendingRequests, approvedRequests, rejectedRequests, totalLeads, newLeads] = await Promise.all([
      SubscriptionRequest.countDocuments({}), // Sales can see all requests
      SubscriptionRequest.countDocuments({ status: 'pending' }),
      SubscriptionRequest.countDocuments({ status: 'approved' }),
      SubscriptionRequest.countDocuments({ status: 'rejected' }),
      Lead.countDocuments({ isMarketingOnly: { $ne: true } }),
      Lead.countDocuments({ status: 'new', isMarketingOnly: { $ne: true } }),
    ]);

    // Financial stats (sum of prices of approved requests)
    // This is a simplified version
    const approvedSubs = await SubscriptionRequest.find({ status: 'approved' })
      .populate('requestedPlanId', 'price')
      .lean();

    const totalRevenue = approvedSubs.reduce((acc, curr: any) => acc + (curr.requestedPlanId?.price || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        totalRevenue,
        totalLeads,
        newLeads
      }
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Get all subscription requests
 * @route   GET /api/sales/requests
 * @access  Private (Sales/Admin)
 */
export const getSubscriptionRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const { status, page = 1, pageSize = 10 } = req.query;
    const query: any = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Number(page);
    const limit = Number(pageSize);
    const skip = (pageNum - 1) * limit;

    const [items, total] = await Promise.all([
      SubscriptionRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email instituteName phone')
        .populate('currentPlanId', 'displayName price')
        .populate('requestedPlanId', 'displayName price')
        .lean(),
      SubscriptionRequest.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        pageSize: limit,
        hasMore: skip + items.length < total,
      }
    });
  } catch (error) {
    console.error('Get subscription requests error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Update subscription request status (Close Deal)
 * @route   PUT /api/sales/requests/:id
 * @access  Private (Sales/Admin)
 */
export const updateRequestStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const request = await SubscriptionRequest.findById(id);
    if (!request) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    request.status = status;
    request.adminNotes = adminNotes || request.adminNotes;
    await request.save();

    // Log the action
    await logAction({
      user: req.account as any,
      action: status === 'approved' ? 'CLOSE_DEAL' : 'REJECT_DEAL',
      targetId: request._id.toString(),
      targetType: 'SubscriptionRequest',
      details: `${status === 'approved' ? 'Approved' : 'Rejected'} subscription request for user ${request.userId}. Notes: ${adminNotes || 'None'}`,
      req
    });

    // If approved, update user subscription
    if (status === 'approved') {
      const planId = request.requestedPlanId;
      const plan = await SubscriptionPlan.findById(planId);

      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.duration || 30));

        const subData = {
          planId: plan._id,
          status: 'active' as const,
          paymentStatus: 'completed' as const,
          startDate,
          endDate,
          listingsUsed: 0,
          listingsLimit: plan.features.maxVehicleListings || 0,
          jobPostsUsed: 0,
          jobPostsLimit: plan.features.maxJobPosts || 0,
          browseCount: 0,
          browseCountLimit: plan.features.maxBrowsesPerMonth,
          lastBrowseReset: startDate,
          notes: `Approved by Sales: ${req.account!.name}`,
        };

        await Subscription.findOneAndUpdate(
          { accountId: request.userId },
          subData,
          { upsert: true, new: true }
        );
      }
    }

    res.status(200).json({
      success: true,
      data: request,
      message: `Request ${status} successfully`
    });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Get all leads (generated by marketing)
 * @route   GET /api/sales/leads
 * @access  Private (Sales/Admin)
 */
export const getAllLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const { status, page = 1, pageSize = 10 } = req.query;
    const query: any = { isMarketingOnly: { $ne: true } };

    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Number(page);
    const limit = Number(pageSize);
    const skip = (pageNum - 1) * limit;

    const [items, total] = await Promise.all([
      Lead.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('generatedBy', 'name email employeeId')
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        pageSize: limit,
        hasMore: skip + items.length < total,
      }
    });
  } catch (error) {
    console.error('Get all leads error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Update lead status (Close Marketing Lead)
 * @route   PUT /api/sales/leads/:id
 * @access  Private (Sales/Admin)
 */
export const updateLeadStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const lead = await Lead.findOne({ _id: id, isMarketingOnly: { $ne: true } });
    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found or inaccessible' });
      return;
    }

    lead.status = status;
    lead.notes = notes || lead.notes;
    if (status === 'closed') {
      lead.closedBy = req.account!.id;
    }
    await lead.save();

    await logAction({
      user: req.account as any,
      action: status === 'closed' ? 'CLOSE_LEAD' : 'UPDATE_LEAD',
      targetId: lead._id.toString(),
      targetType: 'Lead',
      details: `Updated lead ${lead.email} status to ${status}`,
      req
    });

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Create a user account (Institute/Teacher)
 * @route   POST /api/sales/users
 * @access  Private (Sales/Admin)
 */
export const createSalesUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const {
      name, email, password, role,
      instituteName, contactPerson, phone, planId,
      experience, qualifications, subjects, bio, location, preferredLocation, isAvailable,
      address,
    } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const effectiveRole: string = role || 'institute';

    let bundle: authService.Bundle;

    switch (effectiveRole) {
      case 'institute':
        bundle = await authService.adminCreateInstitute({
          name,
          email,
          password,
          phone,
          instituteName: instituteName || name,
          contactPerson,
          address: address || { street: 'N/A', city: 'N/A', state: 'N/A', pincode: '000000', country: 'India' },
          planId,
          isVerified: true,
        });
        break;
      case 'teacher':
        bundle = await authService.adminCreateTeacher({
          name,
          email,
          password,
          phone,
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
      default:
        res.status(400).json({ success: false, error: `Unsupported role for sales user creation: ${effectiveRole}`, code: 'VALIDATION_ERROR' });
        return;
    }

    await logAction({
      user: req.account as any,
      action: 'CREATE_USER',
      targetId: bundle.account._id || bundle.account.id,
      targetType: 'User',
      details: `Created ${effectiveRole} user: ${email}`,
      req
    });

    res.status(201).json({ success: true, data: bundle });
  } catch (error: any) {
    console.error('Create sales user error:', error);
    if (error.code === 11000) {
      res.status(409).json({ success: false, error: 'User already exists with this email', code: 'DUPLICATE_ERROR' });
      return;
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Create a listing for an institute
 * @route   POST /api/sales/listings
 * @access  Private (Sales/Admin)
 */
export const createSalesListing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const { sellerId, type, ...data } = req.body;
    const seller = await Account.findById(sellerId);
    if (!seller) {
      res.status(404).json({ success: false, error: 'Institute not found' });
      return;
    }

    let listing;
    if (type === 'vehicle') {
      listing = await Vehicle.create({
        ...data,
        sellerId: seller._id,
        sellerName: (seller as any).instituteName || seller.name,
        sellerEmail: seller.email,
        sellerPhone: seller.phone,
        status: 'approved' // Sales created listings are pre-approved
      });
    } else if (type === 'job') {
      listing = await Job.create({
        ...data,
        instituteId: seller._id,
        status: 'active'
      });
    } else {
      res.status(400).json({ success: false, error: 'Invalid listing type' });
      return;
    }

    await logAction({
      user: req.account as any,
      action: 'CREATE_LISTING',
      targetId: listing._id.toString(),
      targetType: type === 'vehicle' ? 'Vehicle' : 'Job',
      details: `Created ${type} listing for ${seller.email}`,
      req
    });

    res.status(201).json({ success: true, data: listing });
  } catch (error) {
    console.error('Create sales listing error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    List vendor and assign subscription
 * @route   POST /api/sales/vendors
 * @access  Private (Sales/Admin)
 */
export const createSalesVendor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || (req.account.role !== 'sales' && req.account.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Not authorized', code: 'FORBIDDEN' });
      return;
    }

    const {
      name, email, companyName, phone, planId,
      // Supplier-specific fields (from SupplierForm)
      category, description, services, contactPerson, address,
      website, certifications, yearsInBusiness, clientCount
    } = req.body;

    // Step 1: Find or create the vendor Account + VendorProfile + Subscription atomically
    let accountId: mongoose.Types.ObjectId;

    let existingAccount = await Account.findOne({ email });
    if (existingAccount) {
      // Upsert path: account already exists — ensure VendorProfile is present (backfill)
      accountId = existingAccount._id as mongoose.Types.ObjectId;
      const existingProfile = await VendorProfile.findOne({ accountId });
      if (!existingProfile) {
        await VendorProfile.create({
          accountId,
          businessName: companyName || name || email,
          contactPerson: contactPerson || name,
          phone,
          website,
          address,
        });
      }
    } else {
      // New vendor: create Account + VendorProfile + Subscription in a transaction.
      // The temp password is one-time only — surface it to the rep, never ship a constant.
      const tempPassword = generateTempPassword();
      const bundle = await authService.adminCreateVendor({
        name: contactPerson || name,
        email,
        password: tempPassword,
        phone,
        businessName: companyName || name,
        contactPerson,
        website,
        address,
        planId,
        // Sales-provisioned accounts must clear an admin verification step before
        // they're trusted — do not auto-verify here.
        isVerified: false,
      });
      (bundle as any).tempPassword = tempPassword;
      accountId = bundle.account._id || bundle.account.id;
      existingAccount = await Account.findById(accountId);
    }

    // Step 2: Create Supplier marketplace listing (separate from VendorProfile identity)
    const supplier = await Supplier.create({
      name: companyName || name,
      category: category || 'other',
      description: description || `Vendor profile for ${companyName || name}`,
      services: services && services.length > 0 ? services : ['General Services'],
      contactPerson: contactPerson || name,
      email,
      phone,
      website,
      address: address || {
        street: 'Not Provided',
        city: 'Not Provided',
        state: 'Not Provided',
        pincode: '000000',
        country: 'India'
      },
      certifications,
      yearsInBusiness,
      clientCount,
      createdBy: accountId,
      status: 'approved',
    });

    // Step 3: Assign/update subscription for existing accounts (new accounts already get one from adminCreateVendor)
    if (planId && existingAccount) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.duration || 30));

        await Subscription.findOneAndUpdate(
          { accountId },
          {
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
            browseCountLimit: plan.features.maxBrowsesPerMonth,
            lastBrowseReset: startDate,
            notes: `Vendor Setup by Sales: ${req.account!.name}`,
          },
          { upsert: true, new: true }
        );
      }
    }

    await logAction({
      user: req.account as any,
      action: 'CREATE_VENDOR',
      targetId: supplier._id.toString(),
      targetType: 'Supplier',
      details: `Created vendor profile for ${email}`,
      req
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (error: any) {
    console.error('Create sales vendor error:', error);
    if (error.code === 11000) {
      res.status(409).json({ success: false, error: 'Vendor account already exists', code: 'DUPLICATE_ERROR' });
      return;
    }
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
