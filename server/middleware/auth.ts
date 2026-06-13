import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import { loadBundle } from '../services/authService.js';
import type { AccountRole } from '../models/Account.js';

export interface AuthRequest extends Request {
  account?: any;
  profile?: any;
  subscription?: any;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      req.header('Authorization')?.replace('Bearer ', '') || (req as any).cookies?.token;
    if (!token) {
      res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    const payload = jwt.verify(token, JWT_CONFIG.secret) as { accountId: string; role: string };
    const bundle = await loadBundle(payload.accountId);
    if (!bundle.account) {
      res.status(401).json({ success: false, error: 'Account not found', code: 'NOT_FOUND' });
      return;
    }
    if (!bundle.account.isActive) {
      res.status(401).json({ success: false, error: 'Account inactive', code: 'ACCOUNT_INACTIVE' });
      return;
    }
    req.account = bundle.account;
    req.profile = bundle.profile;
    req.subscription = bundle.subscription;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}

/**
 * Optional authentication. Populates req.account/profile/subscription when a
 * valid token is present, but NEVER blocks the request — anonymous callers
 * pass straight through. Use on public read endpoints that want to vary the
 * response by auth state (e.g. show seller contact to logged-in buyers, hide
 * it from anonymous scrapers).
 */
export async function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token =
      req.header('Authorization')?.replace('Bearer ', '') || (req as any).cookies?.token;
    if (!token) return next();
    const payload = jwt.verify(token, JWT_CONFIG.secret) as { accountId: string };
    const bundle = await loadBundle(payload.accountId);
    if (bundle.account && bundle.account.isActive) {
      req.account = bundle.account;
      req.profile = bundle.profile;
      req.subscription = bundle.subscription;
    }
  } catch {
    // Invalid/expired token on a public route → treat as anonymous, don't 401.
  }
  next();
}

export function requireRole(role: AccountRole | AccountRole[]) {
  const allowed = Array.isArray(role) ? role : [role];
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.account) {
      res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
      return;
    }
    if (!allowed.includes(req.account.role)) {
      res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
