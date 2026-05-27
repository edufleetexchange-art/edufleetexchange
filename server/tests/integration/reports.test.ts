import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import reportRoutes from '../../routes/reports.js';
import * as authService from '../../services/authService.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import { JWT_CONFIG } from '../../config/jwt.js';
import mongoose from 'mongoose';

let app: express.Express;

async function seedFreePlans() {
  await SubscriptionPlan.create([
    {
      name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
  ]);
}

function makeToken(accountId: string, role: string) {
  return jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/reports', reportRoutes);
  await seedFreePlans();
});

describe('POST /api/reports', () => {
  it('creates a report for an authenticated user', async () => {
    const b = await authService.signupInstitute({
      name: 'Reporter', email: 'reporter@e.com', password: 'pwpwpw',
      instituteName: 'TestInst',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(b.account.id, 'institute');
    const targetId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'vehicle', targetId, reason: 'spam' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reason).toBe('spam');
    expect(res.body.data.status).toBe('open');
    expect(res.body.message).toMatch(/review/i);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ targetType: 'vehicle', targetId: new mongoose.Types.ObjectId().toString(), reason: 'spam' });

    expect(res.status).toBe(401);
  });

  it('rejects missing fields with 400', async () => {
    const b = await authService.signupInstitute({
      name: 'R2', email: 'r2@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(b.account.id, 'institute');

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'vehicle' }); // missing targetId + reason

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('returns 409 on duplicate open report from same user on same target', async () => {
    const b = await authService.signupInstitute({
      name: 'R3', email: 'r3@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(b.account.id, 'institute');
    const targetId = new mongoose.Types.ObjectId().toString();

    await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'job', targetId, reason: 'fraud' });

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'job', targetId, reason: 'fraud' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_REPORTED');
  });
});

describe('GET /api/reports', () => {
  it('returns 403 for non-admin (institute role)', async () => {
    const b = await authService.signupInstitute({
      name: 'I1', email: 'i1@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(b.account.id, 'institute');

    const res = await request(app)
      .get('/api/reports')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it('returns items list for admin role', async () => {
    // Create admin account directly
    const adminAccount = await Account.create({
      name: 'Admin', email: 'admin@e.com', password: 'hashed', role: 'admin', isActive: true, isVerified: true,
    });
    await StaffProfile.create({ accountId: adminAccount.id, employeeId: 'EMP-01', department: 'Platform' });
    const adminToken = makeToken(adminAccount.id, 'admin');

    // Create a reporter and a report
    const reporter = await authService.signupInstitute({
      name: 'RR', email: 'rr@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const reporterToken = makeToken(reporter.account.id, 'institute');
    const targetId = new mongoose.Types.ObjectId().toString();
    await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${reporterToken}`])
      .send({ targetType: 'supplier', targetId, reason: 'inaccurate' });

    const res = await request(app)
      .get('/api/reports')
      .set('Cookie', [`token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PATCH /api/reports/:id', () => {
  it('resolves a report and sets resolvedBy/resolvedAt', async () => {
    const adminAccount = await Account.create({
      name: 'Admin2', email: 'admin2@e.com', password: 'hashed', role: 'admin', isActive: true, isVerified: true,
    });
    await StaffProfile.create({ accountId: adminAccount.id, employeeId: 'EMP-02', department: 'Platform' });
    const adminToken = makeToken(adminAccount.id, 'admin');

    const reporter = await authService.signupInstitute({
      name: 'RC', email: 'rc@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const reporterToken = makeToken(reporter.account.id, 'institute');
    const targetId = new mongoose.Types.ObjectId().toString();

    const createRes = await request(app)
      .post('/api/reports')
      .set('Cookie', [`token=${reporterToken}`])
      .send({ targetType: 'account', targetId, reason: 'other', details: 'Test detail' });

    const reportId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/reports/${reportId}`)
      .set('Cookie', [`token=${adminToken}`])
      .send({ status: 'resolved', resolution: 'Content removed.' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('resolved');
    expect(patchRes.body.data.resolution).toBe('Content removed.');
    expect(patchRes.body.data.resolvedBy).toBeTruthy();
    expect(patchRes.body.data.resolvedAt).toBeTruthy();
  });
});
