import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import * as authService from '../services/authService.js';
import { AuthRequest } from '../middleware/auth.js';
import { createResetToken, consumeResetToken } from '../services/passwordResetService.js';
import { sendPasswordResetEmail } from '../utils/email.js';

function setAuthCookie(res: Response, accountId: string, role: string) {
  const token = jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
  res.cookie('token', token, JWT_CONFIG.cookieOptions);
  return token;
}

function handleErr(res: Response, err: any, fallback = 500) {
  const msg = err instanceof Error ? err.message : 'Request failed';
  // Mongoose duplicate-key errors include code 11000
  const isDuplicate = (err && (err.code === 11000 || /duplicate|already exists/i.test(msg)));
  const status =
    isDuplicate ? 409 :
    /Invalid credentials|inactive/i.test(msg) ? 401 :
    fallback;
  res.status(status).json({ success: false, error: msg, code: 'AUTH_ERROR' });
}

export const signupInstitute = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupInstitute(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Institute registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const signupTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupTeacher(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Teacher registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const signupVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const bundle = await authService.signupVendor(req.body);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(201).json({ success: true, data: bundle, message: 'Vendor registered', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required', code: 'MISSING_FIELDS' });
      return;
    }
    const bundle = await authService.login(email, password);
    setAuthCookie(res, bundle.account.id, bundle.account.role);
    res.status(200).json({ success: true, data: bundle, message: 'Login successful', timestamp: new Date().toISOString() });
  } catch (e) { handleErr(res, e); }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token');
  res.status(200).json({ success: true, data: { loggedOut: true }, message: 'Logged out', timestamp: new Date().toISOString() });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const bundle = await authService.loadBundle(String(req.account.id));
  res.status(200).json({ success: true, data: bundle, timestamp: new Date().toISOString() });
};

export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || (req as any).cookies?.token;
    if (!token) {
      res.status(200).json({ success: true, data: { valid: false }, timestamp: new Date().toISOString() });
      return;
    }
    jwt.verify(token, JWT_CONFIG.secret);
    res.status(200).json({ success: true, data: { valid: true }, timestamp: new Date().toISOString() });
  } catch {
    res.status(200).json({ success: true, data: { valid: false }, timestamp: new Date().toISOString() });
  }
};

export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const token = setAuthCookie(res, String(req.account.id), req.account.role);
  res.status(200).json({ success: true, data: { token }, message: 'Token refreshed', timestamp: new Date().toISOString() });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body || {};
  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required', code: 'MISSING_EMAIL' });
    return;
  }
  try {
    const result = await createResetToken(email);
    if (result) {
      const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';
      const resetUrl = `${clientUrl}/reset-password?token=${result.rawToken}`;
      await sendPasswordResetEmail(result.account.email, resetUrl);
    }
    // Always return 200 to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[forgotPassword]', err);
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
      timestamp: new Date().toISOString(),
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    res.status(400).json({ success: false, error: 'token and newPassword required', code: 'MISSING_FIELDS' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: 'Password must be at least 6 characters', code: 'PASSWORD_TOO_SHORT' });
    return;
  }
  const result = await consumeResetToken(token, newPassword);
  if (!result.ok) {
    const status = result.reason === 'token_not_found' || result.reason === 'token_already_used' || result.reason === 'token_expired' ? 400 : 500;
    res.status(status).json({ success: false, error: result.reason, code: result.reason.toUpperCase() });
    return;
  }
  res.status(200).json({ success: true, message: 'Password reset successfully', timestamp: new Date().toISOString() });
};
