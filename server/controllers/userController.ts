import { Response } from 'express';
import User from '../models/User.js';
import { AuthRequest } from '../middleware/auth.js';
import { ISubscriptionPlan } from '../models/SubscriptionPlan.js';

// Helper to get teacher data delay date
const getTeacherDataDelayDate = (user: any): Date | null => {
  if (!user || user.role === 'admin') return null;

  const plan = user.subscription?.planId as unknown as ISubscriptionPlan;
  const delayDays = plan?.features?.teacherDataDelayDays ?? 15; // Default to 15 days if guest or no plan

  if (delayDays === 0) return null;

  const delayDate = new Date();
  delayDate.setDate(delayDate.getDate() - delayDays);
  return delayDate;
};

// @desc    Get all users with optional filters (for teachers search)
// @route   GET /api/users
// @access  Public
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      role,
      searchTerm,
      location,
      experienceMin,
      experienceMax,
      isAvailable,
      subjects,
      page = 1,
      pageSize = 12,
    } = req.query;

    // Build query
    const query: any = {};

    // Filter by role (e.g., 'teacher')
    if (role) {
      query.role = role;
      
      // Apply delay if searching for teachers
      if (role === 'teacher') {
        const delayDate = getTeacherDataDelayDate(req.user);
        if (delayDate) {
          query.createdAt = { $lte: delayDate };
        }
      }
    }

    // Search by name or email
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Filter by location
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by experience
    if (experienceMin || experienceMax) {
      query.experience = {};
      if (experienceMin) query.experience.$gte = Number(experienceMin);
      if (experienceMax) query.experience.$lte = Number(experienceMax);
    }

    // Filter by availability (searchable by institutes)
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }
       // Filter by instituteSearchability (only show teachers who opted in)
    if (role === 'teacher') {
      query.instituteSearchability = true;
    }

    // Filter by subjects
    if (subjects) {
      const subjectsArray = typeof subjects === 'string' ? subjects.split(',') : subjects;
      query.subjects = { $in: subjectsArray };
    }

    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSizeNum)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: users,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        hasMore: skip + users.length < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
      .select('-password')
      .populate('subscription.planId')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Check visibility based on delay if not admin and user is a teacher
    if (user.role === 'teacher' && (!req.user || req.user.role !== 'admin')) {
      const delayDate = getTeacherDataDelayDate(req.user);
      if (delayDate && new Date(user.createdAt) > delayDate) {
        res.status(403).json({
          success: false,
          error: 'Access restricted: This teacher profile is only available for premium subscribers at the moment.',
          code: 'SUBSCRIPTION_REQUIRED',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId)
      .select('-password')
      .populate('subscription.planId')
      .lean();

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      code: 'FETCH_ERROR',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const updates = req.body;

    // List of allowed fields to update
    const allowedUpdates = [
      'name',
      'instituteName',
      'contactPerson',
      'phone',
      'location',
      'experience',
      'qualifications',
      'subjects',
      'bio',
      'isAvailable',
      'instituteSearchability',
      'avatar',
      'instituteCode'
    ];

    // Filter updates
    const filteredUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid update fields provided',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('subscription.planId');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'UPDATE_ERROR',
    });
  }
};