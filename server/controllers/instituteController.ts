import { Request, Response } from 'express';
import InstituteProfile from '../models/InstituteProfile.js';

export const listInstitutes = async (req: Request, res: Response): Promise<void> => {
  const { city, state, searchable, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (city) filter['address.city'] = city;
  if (state) filter['address.state'] = state;
  if (searchable !== undefined) filter.instituteSearchability = searchable === 'true';

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await InstituteProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await InstituteProfile.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: { items: profiles, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + profiles.length < total },
    timestamp: new Date().toISOString(),
  });
};

export const getInstitute = async (req: Request, res: Response): Promise<void> => {
  const profile = await InstituteProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
