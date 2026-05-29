import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as metricsService from '../services/metricsService.js';

const requireAdmin = (req: AuthRequest, res: Response): boolean => {
  if (!req.account || req.account.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin only', code: 'FORBIDDEN' });
    return false;
  }
  return true;
};

export const summary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const data = await metricsService.summary();
    res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('metrics/summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch summary', code: 'FETCH_ERROR' });
  }
};

export const signups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const data = await metricsService.signupsByDay(days);
    res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('metrics/signups error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch signups', code: 'FETCH_ERROR' });
  }
};

export const approvalFunnel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    const data = await metricsService.approvalFunnel(days);
    res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('metrics/approval-funnel error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch approval funnel', code: 'FETCH_ERROR' });
  }
};

export const activeUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireAdmin(req, res)) return;
    const days = Math.min(Math.max(Number(req.query.days ?? 7), 1), 90);
    const data = await metricsService.activeUsers(days);
    res.status(200).json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('metrics/active-users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active users', code: 'FETCH_ERROR' });
  }
};
