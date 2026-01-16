import express from 'express';
import {
  signup,
  login,
  logout,
  getCurrentUser,
  validateToken,
  refreshToken,
} from '../controllers/authController.js';
import { updateUserProfile, getUserProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentUser);
router.put('/me', authenticate, updateUserProfile);
router.get('/profile', authenticate, getUserProfile);
router.put('/profile', authenticate, updateUserProfile);
router.patch('/profile', authenticate, updateUserProfile);
router.get('/validate', validateToken);
router.post('/refresh', authenticate, refreshToken);

export default router;