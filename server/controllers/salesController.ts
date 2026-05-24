import { Response } from 'express';
import Account from '../models/Account.js';
import Subscription from '../models/Subscription.js';
import SubscriptionRequest from '../models/SubscriptionRequest.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
import Supplier from '../models/Supplier.js';
import Lead from '../models/Lead.js';
import { AuthRequest } from '../middleware/auth.js';
import { logAction } from '../utils/auditLogger.js';
import mongoose from 'mongoose';

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

    const { name, email, password, role, instituteName, contactPerson, phone, planId } = req.body;

    // Check if user exists
    const existingUser = await Account.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, error: 'User already exists' });
      return;
    }

    const user = await Account.create({
      name,
      email,
      password,
      role: role || 'institute',
      phone,
      isVerified: true,
    });

    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.duration || 30));

        await Subscription.create({
          accountId: user._id,
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
          notes: `Created by Sales: ${req.account!.name}`,
        });
      }
    }

    await logAction({
      user: req.account as any,
      action: 'CREATE_USER',
      targetId: user._id.toString(),
      targetType: 'User',
      details: `Created ${role} user: ${email}`,
      req
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('Create sales user error:', error);
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

    // First create or find vendor user
    let user = await Account.findOne({ email });
    if (!user) {
      user = await Account.create({
        name: contactPerson || name,
        email,
        password: 'ChangeMe123!',
        role: 'vendor',
        phone,
        isVerified: true,
      });
    }

    // Create supplier listing with all required fields
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
      createdBy: user._id,
      status: 'approved',
    });

    // Assign subscription if provided
    if (planId) {
      const plan = await SubscriptionPlan.findById(planId);
      if (plan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.duration || 30));

        await Subscription.findOneAndUpdate(
          { accountId: user._id },
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
  } catch (error) {
    console.error('Create sales vendor error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
