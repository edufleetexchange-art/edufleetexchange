import { Response } from 'express';
import mongoose from 'mongoose';
import VerificationRequest from '../models/VerificationRequest.js';
import InstituteProfile from '../models/InstituteProfile.js';
import VendorProfile from '../models/VendorProfile.js';
import Notification from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';

function profileModelForTargetType(targetType: 'institute' | 'vendor'): mongoose.Model<any> {
  return (targetType === 'institute' ? InstituteProfile : VendorProfile) as mongoose.Model<any>;
}

// POST /api/verifications
export const submitRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const role = req.account.role;
  if (role !== 'institute' && role !== 'vendor') {
    res.status(403).json({ success: false, error: 'Only institute and vendor accounts can request verification', code: 'FORBIDDEN' });
    return;
  }
  const targetType = role as 'institute' | 'vendor';
  const { documentType, documentUrl, notes } = req.body ?? {};
  if (!documentType || !documentUrl) {
    res.status(400).json({ success: false, error: 'documentType and documentUrl are required', code: 'MISSING_FIELDS' });
    return;
  }
  try {
    const verReq = await VerificationRequest.create({
      accountId: req.account.id,
      targetType,
      documentType,
      documentUrl,
      notes,
      status: 'pending',
    });
    // Update profile verification status
    const ProfileModel = profileModelForTargetType(targetType);
    await ProfileModel.findOneAndUpdate(
      { accountId: req.account.id },
      { $set: { 'verification.status': 'pending' } }
    );
    res.status(201).json({
      success: true,
      data: verReq,
      message: 'Verification request submitted successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ success: false, error: 'You already have a pending verification request.', code: 'ALREADY_PENDING' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to submit verification request', code: 'VERIFICATION_ERROR' });
  }
};

// GET /api/verifications/me
export const myRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const verReq = await VerificationRequest.findOne({ accountId: req.account.id }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: verReq ?? null,
    timestamp: new Date().toISOString(),
  });
};

// GET /api/verifications/admin
export const listAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status = 'pending', targetType, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;
  const skip = (Number(page) - 1) * Number(pageSize);
  const [items, total] = await Promise.all([
    VerificationRequest.find(filter)
      .populate('accountId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(pageSize)),
    VerificationRequest.countDocuments(filter),
  ]);
  res.status(200).json({
    success: true,
    data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + items.length < total },
    timestamp: new Date().toISOString(),
  });
};

// PATCH /api/verifications/admin/:id
export const reviewAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const { status, reviewNotes } = req.body ?? {};
  if (!status || !['verified', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, error: 'status must be "verified" or "rejected"', code: 'INVALID_STATUS' });
    return;
  }
  const verReq = await VerificationRequest.findById(req.params.id);
  if (!verReq) {
    res.status(404).json({ success: false, error: 'Verification request not found', code: 'NOT_FOUND' });
    return;
  }
  verReq.status = status;
  verReq.reviewedBy = req.account.id;
  verReq.reviewedAt = new Date();
  if (reviewNotes !== undefined) verReq.reviewNotes = reviewNotes;
  await verReq.save();

  // Update the matching profile
  const ProfileModel = profileModelForTargetType(verReq.targetType);
  const profileUpdate: any = { 'verification.status': status };
  if (status === 'verified') {
    profileUpdate['verification.verifiedAt'] = new Date();
    profileUpdate['verification.verifiedBy'] = req.account.id;
  }
  await ProfileModel.findOneAndUpdate(
    { accountId: verReq.accountId },
    { $set: profileUpdate }
  );

  // Fire notification
  const isVerified = status === 'verified';
  const notifMessage = isVerified
    ? `Your ${verReq.targetType} account has been verified! You now have a Verified badge.`
    : `Your verification request was rejected.${reviewNotes ? ` Note: ${reviewNotes}` : ''} You may resubmit with updated documents.`;

  await Notification.create({
    userId: verReq.accountId,
    type: 'system',
    title: isVerified ? 'Account Verified' : 'Verification Rejected',
    message: notifMessage,
    priority: 'high',
  });

  res.status(200).json({
    success: true,
    data: verReq,
    timestamp: new Date().toISOString(),
  });
};
