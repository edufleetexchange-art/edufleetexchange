import { Request, Response } from 'express';
import VendorProfile from '../models/VendorProfile.js';

export const listVendors = async (req: Request, res: Response): Promise<void> => {
  const { city, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (city) filter['address.city'] = city;

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await VendorProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip).limit(Number(pageSize)).sort({ createdAt: -1 });
  const total = await VendorProfile.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: { items: profiles, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + profiles.length < total },
    timestamp: new Date().toISOString(),
  });
};

export const getVendor = async (req: Request, res: Response): Promise<void> => {
  const profile = await VendorProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
