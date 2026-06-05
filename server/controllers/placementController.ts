import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Placement from '../models/Placement.js';
import { createPlacement, transitionStage } from '../services/placementService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const createPlacementHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const { teacherAccountId, jobId, applicationId, internalNotes, agreedFee, initialStage } = req.body || {};
  if (!teacherAccountId || !jobId) {
    err(res, 400, 'teacherAccountId and jobId required', 'MISSING_FIELDS');
    return;
  }
  try {
    const placement = await createPlacement({
      consultantAccountId: String(req.account!.id),
      teacherAccountId, jobId, applicationId, internalNotes, agreedFee, initialStage,
    });
    ok(res, placement.toJSON(), 201);
  } catch (e: any) {
    if (e.code === 11000) { err(res, 409, 'Active placement already exists for this (teacher, job)', 'DUPLICATE'); return; }
    err(res, 500, e.message ?? 'Failed to create placement', 'CREATE_FAILED');
  }
};

export const listPlacements = async (req: AuthRequest, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) ?? '20', 10)));
  const filter: any = { consultantAccountId: req.account!.id };
  if (req.query.stage) filter.stage = req.query.stage;
  const [items, total] = await Promise.all([
    Placement.find(filter)
      .populate('teacherAccountId', 'name email avatar')
      .populate('jobId', 'title instituteName location')
      .sort({ lastActivityAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Placement.countDocuments(filter),
  ]);
  ok(res, {
    items: items.map((i) => i.toJSON()),
    total, page, pageSize,
    hasMore: page * pageSize < total,
  });
};

export const patchPlacement = async (req: AuthRequest, res: Response): Promise<void> => {
  const placement = await Placement.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!placement) { err(res, 404, 'Placement not found', 'NOT_FOUND'); return; }
  const { stage, reason, internalNotes, agreedFee, agreedFeeNotes } = req.body || {};
  try {
    if (stage && stage !== placement.stage) {
      await transitionStage(String(placement._id), stage, String(req.account!.id), reason);
    }
    if (internalNotes !== undefined || agreedFee !== undefined || agreedFeeNotes !== undefined) {
      const fresh = await Placement.findById(placement._id);
      if (!fresh) return;
      if (internalNotes !== undefined) fresh.internalNotes = internalNotes;
      if (agreedFee !== undefined) fresh.agreedFee = agreedFee;
      if (agreedFeeNotes !== undefined) fresh.agreedFeeNotes = agreedFeeNotes;
      fresh.lastActivityAt = new Date();
      await fresh.save();
      ok(res, fresh.toJSON());
      return;
    }
    const refreshed = await Placement.findById(placement._id);
    ok(res, refreshed!.toJSON());
  } catch (e: any) {
    if (/Cannot transition/.test(e.message)) {
      err(res, 400, e.message, 'INVALID_TRANSITION');
      return;
    }
    err(res, 500, e.message ?? 'Failed', 'PATCH_FAILED');
  }
};

export const placementTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  const placement = await Placement.findOne({
    _id: req.params.id,
    consultantAccountId: req.account!.id,
  });
  if (!placement) { err(res, 404, 'Placement not found', 'NOT_FOUND'); return; }
  ok(res, {
    placement: placement.toJSON(),
    stageHistory: placement.stageHistory,
  });
};
