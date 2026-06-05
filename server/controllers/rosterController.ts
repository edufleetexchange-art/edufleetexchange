import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ConsultantRoster from '../models/ConsultantRoster.js';
import Account from '../models/Account.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const createRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const { entityType, entityAccountId, internalNotes, tags } = req.body || {};
  if (!entityType || !entityAccountId) {
    err(res, 400, 'entityType and entityAccountId required', 'MISSING_FIELDS');
    return;
  }
  const target = await Account.findById(entityAccountId);
  if (!target) {
    err(res, 404, 'Target account not found', 'NOT_FOUND');
    return;
  }
  if (entityType === 'teacher' && target.role !== 'teacher') {
    err(res, 400, 'entityAccountId is not a teacher', 'INVALID_TARGET');
    return;
  }
  if (entityType === 'institute' && target.role !== 'institute') {
    err(res, 400, 'entityAccountId is not an institute', 'INVALID_TARGET');
    return;
  }
  try {
    const entry = await ConsultantRoster.create({
      consultantAccountId: req.account!.id,
      entityType,
      entityAccountId,
      internalNotes,
      tags,
    });
    ok(res, entry.toJSON(), 201);
  } catch (e: any) {
    if (e.code === 11000) { err(res, 409, 'Already in roster', 'DUPLICATE'); return; }
    err(res, 500, e.message ?? 'Failed to add', 'CREATE_FAILED');
  }
};

export const listRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const filter: any = { consultantAccountId: req.account!.id };
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.status) filter.status = req.query.status;
  else filter.status = 'active';

  const [items, total] = await Promise.all([
    ConsultantRoster.find(filter)
      .populate('entityAccountId', 'name email avatar role')
      .sort({ addedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    ConsultantRoster.countDocuments(filter),
  ]);
  ok(res, {
    items: items.map((i) => i.toJSON()),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
};

export const patchRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await ConsultantRoster.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!entry) { err(res, 404, 'Roster entry not found', 'NOT_FOUND'); return; }
  const { internalNotes, tags, status } = req.body || {};
  if (internalNotes !== undefined) entry.internalNotes = internalNotes;
  if (tags !== undefined) entry.tags = tags;
  if (status !== undefined) {
    entry.status = status;
    if (status === 'archived') entry.archivedAt = new Date();
  }
  await entry.save();
  ok(res, entry.toJSON());
};

export const archiveRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  const entry = await ConsultantRoster.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!entry) { err(res, 404, 'Roster entry not found', 'NOT_FOUND'); return; }
  entry.status = 'archived';
  entry.archivedAt = new Date();
  await entry.save();
  ok(res, entry.toJSON());
};
