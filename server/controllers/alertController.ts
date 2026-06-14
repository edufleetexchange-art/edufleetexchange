import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Alert, { AlertChannel, AlertEntityType } from '../models/Alert.js';

const VALID_ENTITY_TYPES: AlertEntityType[] = ['teacher', 'vehicle', 'job', 'supplier', 'custom'];
const VALID_CHANNELS: AlertChannel[] = ['in_app', 'email', 'whatsapp'];

/** Build a safe criteria object per entity type — never trust req.body shape. */
function sanitizeCriteria(entityType: AlertEntityType, raw: any): Record<string, any> {
  const c = raw && typeof raw === 'object' ? raw : {};
  if (entityType === 'teacher') {
    return {
      subjects: Array.isArray(c.subjects) ? c.subjects.map(String).slice(0, 20) : [],
      levels: Array.isArray(c.levels) ? c.levels.map(String).slice(0, 10) : [],
      location: typeof c.location === 'string' ? c.location.trim() : undefined,
      minExperience: Number.isFinite(c.minExperience) ? Number(c.minExperience) : undefined,
      maxExpectedSalary: Number.isFinite(c.maxExpectedSalary) ? Number(c.maxExpectedSalary) : undefined,
    };
  }
  if (entityType === 'vehicle') {
    return {
      vehicleType: typeof c.vehicleType === 'string' ? c.vehicleType : undefined,
      minCapacity: Number.isFinite(c.minCapacity) ? Number(c.minCapacity) : undefined,
      maxPrice: Number.isFinite(c.maxPrice) ? Number(c.maxPrice) : undefined,
      location: typeof c.location === 'string' ? c.location.trim() : undefined,
    };
  }
  // custom / job / supplier
  return {
    keywords: Array.isArray(c.keywords) ? c.keywords.map(String).slice(0, 20) : [],
    freeText: typeof c.freeText === 'string' ? c.freeText.slice(0, 500) : undefined,
  };
}

// POST /api/alerts
export const createAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { entityType, label, criteria, channels } = req.body ?? {};

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      res.status(400).json({ success: false, error: 'Invalid entityType', code: 'VALIDATION_ERROR' });
      return;
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      res.status(400).json({ success: false, error: 'label is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const safeChannels: AlertChannel[] = Array.isArray(channels)
      ? channels.filter((c: any): c is AlertChannel => VALID_CHANNELS.includes(c))
      : ['in_app'];

    const alert = await Alert.create({
      accountId: req.account!.id,
      createdByRole: req.account!.role,
      entityType,
      label: label.trim(),
      criteria: sanitizeCriteria(entityType, criteria),
      channels: safeChannels.length ? safeChannels : ['in_app'],
      status: 'active',
    });

    res.status(201).json({ success: true, data: alert });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to create alert', code: 'CREATE_ALERT_FAILED' });
  }
};

// GET /api/alerts/mine
export const listMyAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await Alert.find({ accountId: req.account!.id }).sort('-createdAt');
    res.status(200).json({ success: true, data: { items, total: items.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load alerts', code: 'LIST_ALERTS_FAILED' });
  }
};

// PATCH /api/alerts/:id  — pause/resume/edit label/criteria/channels
export const patchAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found', code: 'NOT_FOUND' });
      return;
    }
    // Object-level authZ: only the owner (or admin) may mutate.
    if (String(alert.accountId) !== String(req.account!.id) && req.account!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }

    const { status, label, criteria, channels } = req.body ?? {};
    if (status && ['active', 'paused'].includes(status)) alert.status = status;
    if (label && typeof label === 'string') alert.label = label.trim();
    if (criteria) alert.criteria = sanitizeCriteria(alert.entityType, criteria);
    if (Array.isArray(channels)) {
      const safe = channels.filter((c: any): c is AlertChannel => VALID_CHANNELS.includes(c));
      if (safe.length) alert.channels = safe;
    }
    await alert.save();
    res.status(200).json({ success: true, data: alert });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update alert', code: 'UPDATE_ALERT_FAILED' });
  }
};

// DELETE /api/alerts/:id
export const deleteAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found', code: 'NOT_FOUND' });
      return;
    }
    if (String(alert.accountId) !== String(req.account!.id) && req.account!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }
    await alert.deleteOne();
    res.status(200).json({ success: true, data: { id: req.params.id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to delete alert', code: 'DELETE_ALERT_FAILED' });
  }
};
