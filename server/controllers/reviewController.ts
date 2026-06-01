import { Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Supplier from '../models/Supplier.js';
import { AuthRequest } from '../middleware/auth.js';

export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const { targetType, targetId, rating, body } = req.body ?? {};
  if (!targetType || !targetId || rating === undefined) {
    res.status(400).json({ success: false, error: 'targetType, targetId, rating required', code: 'MISSING_FIELDS' });
    return;
  }
  if (targetType !== 'supplier') {
    res.status(400).json({ success: false, error: 'Only supplier reviews supported in v1', code: 'UNSUPPORTED_TARGET' });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ success: false, error: 'rating must be integer 1-5', code: 'INVALID_RATING' });
    return;
  }
  // Reject self-review
  const supplier = await Supplier.findById(targetId);
  if (!supplier) {
    res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND' });
    return;
  }
  if (String((supplier as any).createdBy) === String(req.account.id)) {
    res.status(403).json({ success: false, error: 'Cannot review your own listing', code: 'SELF_REVIEW' });
    return;
  }
  try {
    const review = await Review.create({
      reviewerAccountId: req.account.id,
      targetType, targetId, rating, body,
    });
    res.status(201).json({ success: true, data: review, timestamp: new Date().toISOString() });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ success: false, error: 'You have already reviewed this supplier. Use PATCH to update.', code: 'ALREADY_REVIEWED' });
      return;
    }
    res.status(500).json({ success: false, error: err?.message ?? 'Failed to create review', code: 'REVIEW_ERROR' });
  }
};

export const updateReview = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404).json({ success: false, error: 'Review not found', code: 'NOT_FOUND' });
    return;
  }
  if (String(review.reviewerAccountId) !== String(req.account.id)) {
    res.status(403).json({ success: false, error: 'You can only edit your own review', code: 'FORBIDDEN' });
    return;
  }
  const { rating, body } = req.body ?? {};
  if (rating !== undefined) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'rating must be integer 1-5', code: 'INVALID_RATING' });
      return;
    }
    review.rating = rating;
  }
  if (body !== undefined) review.body = body;
  await review.save();
  res.status(200).json({ success: true, data: review, timestamp: new Date().toISOString() });
};

export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404).json({ success: false, error: 'Review not found', code: 'NOT_FOUND' });
    return;
  }
  const isOwner = String(review.reviewerAccountId) === String(req.account.id);
  const isAdmin = req.account.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  await review.deleteOne();
  res.status(200).json({ success: true, data: { deleted: true }, timestamp: new Date().toISOString() });
};

export const listReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  const { targetType, targetId, page = 1, pageSize = 20 } = req.query as any;
  if (!targetType || !targetId) {
    res.status(400).json({ success: false, error: 'targetType and targetId required', code: 'MISSING_QUERY' });
    return;
  }
  const skip = (Number(page) - 1) * Number(pageSize);
  const [items, total] = await Promise.all([
    Review.find({ targetType, targetId })
      .populate('reviewerAccountId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(pageSize)),
    Review.countDocuments({ targetType, targetId }),
  ]);
  res.status(200).json({
    success: true,
    data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + items.length < total },
    timestamp: new Date().toISOString(),
  });
};

export const getReviewStats = async (req: AuthRequest, res: Response): Promise<void> => {
  const { targetType, targetId } = req.query as any;
  if (!targetType || !targetId) {
    res.status(400).json({ success: false, error: 'targetType and targetId required', code: 'MISSING_QUERY' });
    return;
  }
  const agg = await Review.aggregate([
    { $match: { targetType, targetId: new mongoose.Types.ObjectId(String(targetId)) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let total = 0, sum = 0;
  for (const row of agg) {
    breakdown[String(row._id)] = row.count;
    total += row.count;
    sum += row._id * row.count;
  }
  const average = total > 0 ? sum / total : 0;
  res.status(200).json({
    success: true,
    data: { average, count: total, breakdown },
    timestamp: new Date().toISOString(),
  });
};
