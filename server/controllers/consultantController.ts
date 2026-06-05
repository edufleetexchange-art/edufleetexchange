import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ConsultantProfile from '../models/ConsultantProfile.js';
import { loadBundle } from '../services/authService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') { err(res, 403, 'Forbidden', 'FORBIDDEN'); return; }
  const bundle = await loadBundle(String(req.account.id));
  ok(res, bundle);
};

export const patchMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.account?.role !== 'consultant') { err(res, 403, 'Forbidden', 'FORBIDDEN'); return; }
  const profile = await ConsultantProfile.findOne({ accountId: req.account.id });
  if (!profile) { err(res, 404, 'Profile not found', 'NOT_FOUND'); return; }
  const allowed = ['agencyName', 'registrationNumber', 'yearsOfExperience', 'specializations', 'bio', 'website', 'phone', 'address'];
  for (const key of allowed) {
    if (req.body && key in req.body) (profile as any)[key] = req.body[key];
  }
  await profile.save();
  ok(res, profile.toJSON());
};

export const getById = async (req: AuthRequest, res: Response): Promise<void> => {
  const profile = await ConsultantProfile.findOne({ accountId: req.params.id })
    .populate('accountId', 'name email avatar');
  if (!profile) { err(res, 404, 'Consultant not found', 'NOT_FOUND'); return; }
  ok(res, profile.toJSON());
};
