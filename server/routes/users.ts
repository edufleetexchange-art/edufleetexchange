import express from 'express';
import {
  getUsers,
  getUserById,
  getUserProfile,
  updateUserProfile,
} from '../controllers/userController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getUsers);

// Protected routes
router.get('/profile', authenticate, getUserProfile);
router.get('/:id', optionalAuth, getUserById);
router.put('/profile', authenticate, updateUserProfile);
router.patch('/profile', authenticate, updateUserProfile);

export default router;
