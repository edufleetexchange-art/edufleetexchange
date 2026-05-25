import { Request, Response } from 'express';
import TeacherProfile from '../models/TeacherProfile.js';

export const listTeachers = async (req: Request, res: Response): Promise<void> => {
  const { subject, minExperience, location, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (subject) filter.subjects = subject;
  if (minExperience) filter.experience = { $gte: Number(minExperience) };
  if (location) filter.location = location;

  const skip = (Number(page) - 1) * Number(pageSize);
  const profiles = await TeacherProfile.find(filter)
    .populate('accountId', 'name email avatar phone')
    .skip(skip)
    .limit(Number(pageSize))
    .sort({ createdAt: -1 });
  const total = await TeacherProfile.countDocuments(filter);

  const items = profiles.map((p: any) => ({
    profile: { id: p._id, experience: p.experience, qualifications: p.qualifications, subjects: p.subjects, bio: p.bio, location: p.location, isAvailable: p.isAvailable },
    account: p.accountId ? { id: p.accountId._id, name: p.accountId.name, email: p.accountId.email, avatar: p.accountId.avatar, phone: p.accountId.phone } : null,
  }));

  res.status(200).json({
    success: true,
    data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + items.length < total },
    timestamp: new Date().toISOString(),
  });
};

export const getTeacher = async (req: Request, res: Response): Promise<void> => {
  const profile = await TeacherProfile.findById(req.params.id).populate('accountId', 'name email avatar phone');
  if (!profile) {
    res.status(404).json({ success: false, error: 'Teacher not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: profile, timestamp: new Date().toISOString() });
};
