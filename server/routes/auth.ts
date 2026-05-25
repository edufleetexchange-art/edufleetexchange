import express from 'express';
import {
  signupInstitute,
  signupTeacher,
  signupVendor,
  login,
  logout,
  me,
  validateToken,
  refreshToken,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/institute/signup', signupInstitute);
router.post('/teacher/signup', signupTeacher);
router.post('/vendor/signup', signupVendor);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.get('/validate', validateToken);
router.post('/refresh', authenticate, refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
