import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Interview from '../models/Interview.js';
import {
  scheduleInterview,
  rescheduleInterview,
  completeInterview,
  cancelInterview,
  listInterviewsForAccount,
} from '../services/interviewService.js';

function ok(res: Response, data: any, status = 200) {
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, status: number, error: string, code: string) {
  res.status(status).json({ success: false, error, code });
}

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  const { applicationId, scheduledAt, durationMinutes, mode, location, meetingLink, participants, notesBefore, round } = req.body || {};
  if (!applicationId || !scheduledAt || !mode) {
    err(res, 400, 'applicationId, scheduledAt, mode required', 'MISSING_FIELDS');
    return;
  }
  try {
    const doc = await scheduleInterview({
      applicationId,
      scheduledByAccountId: String(req.account!.id),
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? 30,
      mode, location, meetingLink, participants, notesBefore, round,
    });
    ok(res, doc.toJSON(), 201);
  } catch (e: any) {
    err(res, 500, e.message ?? 'Failed to schedule', 'CREATE_FAILED');
  }
};

export const patch = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const { scheduledAt, rescheduleReason, outcome, notesAfter, cancel } = req.body || {};
  try {
    if (cancel) {
      const doc = await cancelInterview(id, rescheduleReason, String(req.account!.id));
      ok(res, doc.toJSON());
      return;
    }
    if (outcome) {
      const doc = await completeInterview(id, outcome, notesAfter, String(req.account!.id));
      ok(res, doc.toJSON());
      return;
    }
    if (scheduledAt) {
      const doc = await rescheduleInterview(id, new Date(scheduledAt), String(req.account!.id), rescheduleReason);
      ok(res, doc.toJSON());
      return;
    }
    err(res, 400, 'No-op patch', 'NO_OP');
  } catch (e: any) {
    err(res, 500, e.message ?? 'Failed', 'PATCH_FAILED');
  }
};

export const list = async (req: AuthRequest, res: Response): Promise<void> => {
  const filters: any = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.from) filters.from = new Date(String(req.query.from));
  if (req.query.to) filters.to = new Date(String(req.query.to));
  const items = await listInterviewsForAccount(String(req.account!.id), filters);
  ok(res, { items: items.map((i) => i.toJSON()), total: items.length });
};

export const get = async (req: AuthRequest, res: Response): Promise<void> => {
  const doc = await Interview.findById(req.params.id);
  if (!doc) { err(res, 404, 'Interview not found', 'NOT_FOUND'); return; }
  const accountId = String(req.account!.id);
  const isParticipant =
    doc.participants.map(String).includes(accountId) ||
    String(doc.consultantId) === accountId ||
    String(doc.scheduledByAccountId) === accountId ||
    String(doc.teacherAccountId) === accountId ||
    String(doc.instituteAccountId) === accountId;
  if (!isParticipant && req.account!.role !== 'admin') {
    err(res, 403, 'Forbidden', 'FORBIDDEN');
    return;
  }
  ok(res, doc.toJSON());
};
