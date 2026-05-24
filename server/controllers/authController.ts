import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import * as authService from '../services/authService.js';
import { AuthRequest } from '../middleware/auth.js';

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
