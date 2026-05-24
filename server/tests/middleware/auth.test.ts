import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import Account from '../../models/Account.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';

async function makeApp() {
  await SubscriptionPlan.create({
    name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.get('/me', authenticate, (req: any, res) => {
    res.json({ account: req.account, profile: req.profile, subscription: req.subscription });
  });
  app.get('/admin-only', authenticate, requireRole('admin'), (_req, res) => res.json({ ok: true }));
  return app;
}

function signFor(accountId: string, role: string = 'institute') {
  return jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

describe('authenticate middleware', () => {
  it('rejects requests without a token', async () => {
    const app = await makeApp();
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('populates req.account/profile/subscription on a valid token', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'mw@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = signFor(bundle.account.id);
    const res = await request(app).get('/me').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.account.email).toBe('mw@e.com');
    expect(res.body.profile.instituteName).toBe('X');
    expect(res.body.subscription.status).toBe('active');
  });

  it('rejects inactive accounts', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'off-mw@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    await Account.updateOne({ _id: bundle.account.id }, { isActive: false });
    const token = signFor(bundle.account.id);
    const res = await request(app).get('/me').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('blocks wrong role', async () => {
    const app = await makeApp();
    const bundle = await authService.signupInstitute({
      name: 'X', email: 'role@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = signFor(bundle.account.id, 'institute');
    const res = await request(app).get('/admin-only').set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
  });
});
