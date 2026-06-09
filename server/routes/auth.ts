import express from 'express';
import {
  signupInstitute,
  signupTeacher,
  signupVendor,
  signupConsultant,
  login,
  logout,
  me,
  validateToken,
  refreshToken,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { loginLimiter, forgotPasswordLimiter, signupLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/institute/signup', signupLimiter, signupInstitute);
router.post('/teacher/signup', signupLimiter, signupTeacher);
router.post('/vendor/signup', signupLimiter, signupVendor);
router.post('/consultant/signup', signupLimiter, signupConsultant);
router.post('/login', loginLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.get('/validate', loginLimiter, validateToken);
router.post('/refresh', authenticate, refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', loginLimiter, resetPassword);

export default router;
