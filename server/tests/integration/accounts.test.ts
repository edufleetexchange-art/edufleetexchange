import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import accountRoutes from '../../routes/accounts.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/accounts', accountRoutes);
  await SubscriptionPlan.create({
    name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
});

describe('PATCH /api/accounts/me', () => {
  it('updates name/phone/avatar on the current account', async () => {
    const b = await authService.signupInstitute({
      name: 'Old', email: 'a@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = jwt.sign({ accountId: b.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const res = await request(app).patch('/api/accounts/me').set('Cookie', [`token=${token}`]).send({ name: 'New', phone: '+91999' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
    expect(res.body.data.phone).toBe('+91999');
  });

  it('does not let user change role via PATCH /accounts/me', async () => {
    const b = await authService.signupInstitute({
      name: 'X', email: 'r@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = jwt.sign({ accountId: b.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
    const res = await request(app).patch('/api/accounts/me').set('Cookie', [`token=${token}`]).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('institute');
  });
});
