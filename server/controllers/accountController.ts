import { Response } from 'express';
import Account from '../models/Account.js';
import { AuthRequest } from '../middleware/auth.js';

const ALLOWED_PATCH_FIELDS = ['name', 'phone', 'avatar'] as const;

export const patchMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const updates: Record<string, any> = {};
  for (const k of ALLOWED_PATCH_FIELDS) {
    if (k in req.body) updates[k] = req.body[k];
  }
  const updated = await Account.findByIdAndUpdate(req.account.id, updates, { new: true });
  res.status(200).json({ success: true, data: updated, timestamp: new Date().toISOString() });
};

export const listAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (role) filter.role = role;
  const items = await Account.find(filter).skip((Number(page) - 1) * Number(pageSize)).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await Account.countDocuments(filter);
  res.status(200).json({
    success: true,
    data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: Number(page) * Number(pageSize) < total },
    timestamp: new Date().toISOString(),
  });
};
