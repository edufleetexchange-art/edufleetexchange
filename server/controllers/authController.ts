import { Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { JWT_CONFIG } from '../config/jwt.js';
import { AuthRequest } from '../middleware/auth.js';

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn as any,
  });
};

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, instituteName, contactPerson, phone,
      experience, qualifications, subjects, bio, location
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS',
      });
      return;
    }

    // Determine plan type based on role
    // Default to institute if not specified or unrecognized
    let planType = 'institute';
    if (role === 'teacher') {
      planType = 'teacher';
    } else if (role === 'supplier' || role === 'vendor') {
      planType = 'vendor';
    }

    // Find default free plan
    const freePlan = await SubscriptionPlan.findOne({
      planType,
      price: 0,
      isActive: true
    });

    let subscription = undefined;

    if (freePlan) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + freePlan.duration);

      subscription = {
        planId: freePlan._id,
        status: 'active' as const,
        paymentStatus: 'completed' as const,
        startDate,
        endDate,
        listingsUsed: 0,
        listingsLimit: freePlan.features.maxListings,
        jobPostsUsed: 0,
        jobPostsLimit: freePlan.features.maxJobPosts,
        browseCount: 0,
        browseCountLimit: freePlan.features.maxBrowsesPerMonth,
        lastBrowseReset: startDate,
        notes: 'Free plan assigned on signup'
      };
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'institute',
      instituteName,
      contactPerson,
      phone,
      experience,
      qualifications,
      subjects,
      bio,
      location,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      subscription,
    });

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, JWT_CONFIG.cookieOptions);

    // Return user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteName: user.instituteName,
      contactPerson: user.contactPerson,
      avatar: user.avatar,
      phone: user.phone,
      location: user.location,
      experience: user.experience,
      qualifications: user.qualifications,
      subjects: user.subjects,
      bio: user.bio,
      isAvailable: user.isAvailable,
    };

    res.status(201).json({
      success: true,
      data: {
        user: userData,
        token,
      },
      message: 'User registered successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
      code: 'SIGNUP_ERROR',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_FIELDS',
      });
      return;
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie('token', token, JWT_CONFIG.cookieOptions);

    // Return user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteName: user.instituteName,
      contactPerson: user.contactPerson,
      avatar: user.avatar,
      phone: user.phone,
      location: user.location,
      experience: user.experience,
      qualifications: user.qualifications,
      subjects: user.subjects,
      bio: user.bio,
      isAvailable: user.isAvailable,
    };

    res.status(200).json({
      success: true,
      data: {
        user: userData,
        token,
      },
      message: 'Login successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR',
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Clear cookie
    res.clearCookie('token');

    res.status(200).json({
      success: true,
      data: { loggedOut: true },
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Ensure plan is populated even if middleware didn't (though it should have)
    const user = await User.findById(req.user._id)
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

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      instituteName: user.instituteName,
      contactPerson: user.contactPerson,
      avatar: user.avatar,
      phone: user.phone,
      location: user.location,
      experience: user.experience,
      qualifications: user.qualifications,
      subjects: user.subjects,
      bio: user.bio,
      isAvailable: user.isAvailable,
      subscription: user.subscription,
    };

    res.status(200).json({
      success: true,
      data: userData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
      code: 'FETCH_USER_ERROR',
    });
  }
};

// @desc    Validate token
// @route   GET /api/auth/validate
// @access  Public
export const validateToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      res.status(200).json({
        success: true,
        data: { valid: false },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    jwt.verify(token, JWT_CONFIG.secret);

    res.status(200).json({
      success: true,
      data: { valid: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: { valid: false },
      timestamp: new Date().toISOString(),
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Generate new token
    const token = generateToken(req.user._id.toString());

    // Set cookie
    res.cookie('token', token, JWT_CONFIG.cookieOptions);

    res.status(200).json({
      success: true,
      data: { token },
      message: 'Token refreshed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
    });
  }
};