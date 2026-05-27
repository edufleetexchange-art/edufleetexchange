import { Response } from 'express';
import Report from '../models/Report.js';
import { AuthRequest } from '../middleware/auth.js';

// POST /api/reports
export const createReport = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const { targetType, targetId, reason, details } = req.body ?? {};
  if (!targetType || !targetId || !reason) {
    res.status(400).json({ success: false, error: 'targetType, targetId, and reason are required', code: 'MISSING_FIELDS' });
    return;
  }
  try {
    const report = await Report.create({
      reporterAccountId: req.account.id,
      targetType,
      targetId,
      reason,
      details,
      status: 'open',
    });
    res.status(201).json({
      success: true,
      data: report,
      message: 'Thank you — we will review this report.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ success: false, error: 'You have already reported this. We are reviewing it.', code: 'ALREADY_REPORTED' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create report', code: 'REPORT_ERROR' });
  }
};

// GET /api/reports?status=open&page=1&pageSize=20
export const listReports = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, targetType, page = 1, pageSize = 20 } = req.query as any;
  const filter: any = {};
  if (status) filter.status = status;
  if (targetType) filter.targetType = targetType;
  const skip = (Number(page) - 1) * Number(pageSize);
  const [items, total] = await Promise.all([
    Report.find(filter)
      .populate('reporterAccountId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(pageSize)),
    Report.countDocuments(filter),
  ]);
  res.status(200).json({
    success: true,
    data: { items, total, page: Number(page), pageSize: Number(pageSize), hasMore: skip + items.length < total },
    timestamp: new Date().toISOString(),
  });
};

// PATCH /api/reports/:id  body: { status, resolution? }
export const updateReport = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.account) {
    res.status(401).json({ success: false, error: 'Not authenticated', code: 'NOT_AUTHENTICATED' });
    return;
  }
  const { status, resolution } = req.body ?? {};
  const updates: any = {};
  if (status) updates.status = status;
  if (resolution !== undefined) updates.resolution = resolution;
  if (status === 'resolved' || status === 'dismissed') {
    updates.resolvedBy = req.account.id;
    updates.resolvedAt = new Date();
  }
  const updated = await Report.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('reporterAccountId', 'name email role');
  if (!updated) {
    res.status(404).json({ success: false, error: 'Report not found', code: 'NOT_FOUND' });
    return;
  }
  res.status(200).json({ success: true, data: updated, timestamp: new Date().toISOString() });
};
