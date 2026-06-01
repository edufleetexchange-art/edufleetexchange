import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { JWT_CONFIG } from '../../config/jwt.js';
import adminRoutes from '../../routes/admin.js';
import Account from '../../models/Account.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Vehicle from '../../models/Vehicle.js';
import Supplier from '../../models/Supplier.js';
import * as authService from '../../services/authService.js';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeToken(accountId: string, role: string) {
  return jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

async function seedFreePlans() {
  await SubscriptionPlan.create([
    {
      name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: 'vend-free', displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
  ]);
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------
let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRoutes);
  await seedFreePlans();
});

// ---------------------------------------------------------------------------
// 1. GET /admin/metrics/summary as admin → 200 with correct shape
// ---------------------------------------------------------------------------
describe('GET /api/admin/metrics/summary', () => {
  it('returns 200 with accounts/subscriptions/listings/applications keys for admin', async () => {
    const adminBundle = await authService.adminCreateStaff({
      name: 'Admin', email: 'admin@m.com', password: 'pwpwpw', role: 'admin',
    });
    const token = makeToken(adminBundle.account.id, 'admin');

    const res = await request(app)
      .get('/api/admin/metrics/summary')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accounts');
    expect(res.body.data).toHaveProperty('subscriptions');
    expect(res.body.data).toHaveProperty('listings');
    expect(res.body.data).toHaveProperty('applications');
    expect(res.body.data.accounts).toHaveProperty('total');
    expect(res.body.data.accounts).toHaveProperty('byRole');
    expect(res.body.data.listings).toHaveProperty('vehicles');
    expect(res.body.data.listings).toHaveProperty('jobs');
    expect(res.body.data.listings).toHaveProperty('suppliers');
  });

  // -------------------------------------------------------------------------
  // 2. GET /admin/metrics/summary as institute → 403
  // -------------------------------------------------------------------------
  it('returns 403 for non-admin role', async () => {
    const instBundle = await authService.signupInstitute({
      name: 'Inst', email: 'inst@m.com', password: 'pwpwpw',
      instituteName: 'Demo', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(instBundle.account.id, 'institute');

    const res = await request(app)
      .get('/api/admin/metrics/summary')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. GET /admin/metrics/signups → 200, items array with role keys
// ---------------------------------------------------------------------------
describe('GET /api/admin/metrics/signups', () => {
  it('returns 200 with items array of exactly `days` entries', async () => {
    const adminBundle = await authService.adminCreateStaff({
      name: 'Admin2', email: 'admin2@m.com', password: 'pwpwpw', role: 'admin',
    });
    const token = makeToken(adminBundle.account.id, 'admin');

    const res = await request(app)
      .get('/api/admin/metrics/signups?days=30')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items).toHaveLength(30);

    const first = res.body.data.items[0];
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('institute');
    expect(first).toHaveProperty('teacher');
    expect(first).toHaveProperty('vendor');
    expect(first).toHaveProperty('admin');
    expect(first).toHaveProperty('marketing');
    expect(first).toHaveProperty('sales');
  });

  // -------------------------------------------------------------------------
  // 4. signupsByDay aggregation correctness
  // -------------------------------------------------------------------------
  it('correctly pivots account counts per day', async () => {
    const adminBundle = await authService.adminCreateStaff({
      name: 'Admin3', email: 'admin3@m.com', password: 'pwpwpw', role: 'admin',
    });
    const token = makeToken(adminBundle.account.id, 'admin');

    // Create two teacher accounts with createdAt manipulated to today
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Insert teachers directly with specific createdAt
    await Account.create([
      { name: 'T1', email: 't1@m.com', password: 'pwpwpw', role: 'teacher', isActive: true, isVerified: true, createdAt: today },
      { name: 'T2', email: 't2@m.com', password: 'pwpwpw', role: 'teacher', isActive: true, isVerified: true, createdAt: today },
    ]);

    const res = await request(app)
      .get('/api/admin/metrics/signups?days=7')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    const items: any[] = res.body.data.items;
    expect(items).toHaveLength(7);

    // Find today's row
    const todayRow = items.find((r: any) => r.date === todayStr);
    expect(todayRow).toBeDefined();
    // admin3 was created today as well, so admin should be 1
    expect(todayRow.teacher).toBeGreaterThanOrEqual(2);
    expect(todayRow.admin).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 5. GET /admin/metrics/approval-funnel → correct shape (zero data is fine)
// ---------------------------------------------------------------------------
describe('GET /api/admin/metrics/approval-funnel', () => {
  it('returns 200 with items array containing funnel keys', async () => {
    const adminBundle = await authService.adminCreateStaff({
      name: 'Admin4', email: 'admin4@m.com', password: 'pwpwpw', role: 'admin',
    });
    const token = makeToken(adminBundle.account.id, 'admin');

    const res = await request(app)
      .get('/api/admin/metrics/approval-funnel?days=14')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items).toHaveLength(14);

    const first = res.body.data.items[0];
    expect(first).toHaveProperty('date');
    expect(first).toHaveProperty('vehicleSubmitted');
    expect(first).toHaveProperty('vehicleApproved');
    expect(first).toHaveProperty('vehicleRejected');
    expect(first).toHaveProperty('supplierSubmitted');
    expect(first).toHaveProperty('supplierApproved');
    expect(first).toHaveProperty('supplierRejected');
  });

  it('counts pending vehicles correctly in funnel', async () => {
    const adminBundle = await authService.adminCreateStaff({
      name: 'Admin5', email: 'admin5@m.com', password: 'pwpwpw', role: 'admin',
    });
    const token = makeToken(adminBundle.account.id, 'admin');

    // Create a vehicle with status pending today
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    await Vehicle.create({
      title: 'Test Bus', manufacturer: 'Tata', vehicleModel: 'LP407',
      year: 2020, type: 'bus', price: 500000, registrationNumber: 'KA01AB1234',
      mileage: 50000, condition: 'good', images: ['img.jpg'], description: 'A bus',
      sellerId: new mongoose.Types.ObjectId(),
      sellerName: 'Vendor1', sellerEmail: 'vendor1@test.com',
      status: 'pending', createdAt: today,
    });

    const res = await request(app)
      .get('/api/admin/metrics/approval-funnel?days=7')
      .set('Cookie', [`token=${token}`]);

    const items: any[] = res.body.data.items;
    const todayRow = items.find((r: any) => r.date === todayStr);
    expect(todayRow).toBeDefined();
    expect(todayRow.vehicleSubmitted).toBeGreaterThanOrEqual(1);
  });
});
