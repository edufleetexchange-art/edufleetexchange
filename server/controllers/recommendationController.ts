import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as matchService from '../services/matchService.js';

// GET /api/recommendations/jobs?limit=10  — auth required, must be teacher
export const recommendJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || req.account.role !== 'teacher') {
      res.status(403).json({ success: false, error: 'Only teachers can request job recommendations', code: 'FORBIDDEN' });
      return;
    }
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const items = await matchService.recommendJobsForTeacher(req.account.id, limit);
    res.status(200).json({ success: true, data: { items }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

// GET /api/recommendations/teachers?jobId=X&limit=10  — auth required, must be institute
export const recommendTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.account || req.account.role !== 'institute') {
      res.status(403).json({ success: false, error: 'Only institutes can request teacher recommendations', code: 'FORBIDDEN' });
      return;
    }
    const jobId = String(req.query.jobId ?? '');
    if (!jobId) {
      res.status(400).json({ success: false, error: 'jobId is required', code: 'MISSING_JOB_ID' });
      return;
    }
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    const items = await matchService.recommendTeachersForJob(jobId, limit);
    res.status(200).json({ success: true, data: { items }, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error', code: 'SERVER_ERROR' });
  }
};
