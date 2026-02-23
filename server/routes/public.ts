import express from 'express';
import Category from '../models/Category.js';
import SystemConfig from '../models/SystemConfig.js';

const router = express.Router();

/**
 * @desc    Get all active categories
 * @route   GET /api/public/categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const { type } = req.query;
    const filter: any = { isActive: true };
    if (type) filter.type = type;

    const categories = await Category.find(filter)
      .sort({ type: 1, order: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: categories,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Public get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      code: 'FETCH_ERROR',
    });
  }
});

/**
 * @desc    Get public system configurations
 * @route   GET /api/public/settings
 * @access  Public
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await SystemConfig.find({ isPublic: true })
      .sort({ group: 1, key: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Public get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      code: 'FETCH_ERROR',
    });
  }
});

export default router;
