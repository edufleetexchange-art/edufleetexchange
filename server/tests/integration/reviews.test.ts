import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import reviewRoutes from '../../routes/reviews.js';
import * as authService from '../../services/authService.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';
import Supplier from '../../models/Supplier.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import { JWT_CONFIG } from '../../config/jwt.js';
import mongoose from 'mongoose';

let app: express.Express;

async function seedFreePlans() {
  await SubscriptionPlan.create([
    {
      name: 'inst-free-rv', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: 'vendor-free-rv', displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
  ]);
}

function makeToken(accountId: string, role: string) {
  return jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

async function makeSupplier(createdBy: string) {
  return Supplier.create({
    name: 'Test Supplier',
    category: 'books',
    description: 'A test supplier',
    services: ['Books'],
    contactPerson: 'Jane',
    email: `supplier+${Date.now()}@test.com`,
    phone: '9999999999',
    address: { street: '1 Main St', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
    status: 'approved',
    isVerified: true,
    createdBy: new mongoose.Types.ObjectId(createdBy),
  });
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/reviews', reviewRoutes);
  await seedFreePlans();
});

describe('POST /api/reviews', () => {
  it('creates a review → 201', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor1', email: `v1rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizA',
    });
    const reviewer = await authService.signupInstitute({
      name: 'Reviewer1', email: `r1rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolA',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(reviewer.account.id, 'institute');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 4, body: 'Great service!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rating).toBe(4);
  });

  it('POST without auth → 401', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ targetType: 'supplier', targetId: new mongoose.Types.ObjectId().toString(), rating: 3 });

    expect(res.status).toBe(401);
  });

  it('POST with rating=0 → 400', async () => {
    const reviewer = await authService.signupInstitute({
      name: 'R2', email: `r2rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolB',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(reviewer.account.id, 'institute');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: new mongoose.Types.ObjectId().toString(), rating: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RATING');
  });

  it('POST with rating=6 → 400', async () => {
    const reviewer = await authService.signupInstitute({
      name: 'R3', email: `r3rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolC',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(reviewer.account.id, 'institute');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: new mongoose.Types.ObjectId().toString(), rating: 6 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RATING');
  });

  it('POST duplicate from same user on same target → 409', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor2', email: `v2rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizB',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R4', email: `r4rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolD',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(reviewer.account.id, 'institute');

    await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 3 });

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 5 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_REVIEWED');
  });

  it('POST as vendor on own supplier → 403 (self-review)', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor3', email: `v3rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizC',
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(vendor.account.id, 'vendor');

    const res = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 5 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SELF_REVIEW');
  });
});

describe('PATCH /api/reviews/:id', () => {
  it('PATCH by original reviewer → 200, rating + body updated', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor4', email: `v4rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizD',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R5', email: `r5rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolE',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(reviewer.account.id, 'institute');

    const createRes = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 2, body: 'Decent' });

    const reviewId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set('Cookie', [`token=${token}`])
      .send({ rating: 5, body: 'Updated: excellent!' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.rating).toBe(5);
    expect(patchRes.body.data.body).toBe('Updated: excellent!');
  });

  it('PATCH by another user → 403', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor5', email: `v5rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizE',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R6', email: `r6rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolF',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const intruder = await authService.signupInstitute({
      name: 'Intruder', email: `intruder+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolG',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const reviewerToken = makeToken(reviewer.account.id, 'institute');
    const intruderToken = makeToken(intruder.account.id, 'institute');

    const createRes = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${reviewerToken}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 3 });

    const reviewId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set('Cookie', [`token=${intruderToken}`])
      .send({ rating: 1 });

    expect(patchRes.status).toBe(403);
  });
});

describe('DELETE /api/reviews/:id', () => {
  it('DELETE by reviewer → 200', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor6', email: `v6rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizF',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R7', email: `r7rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolH',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(reviewer.account.id, 'institute');

    const createRes = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 4 });

    const reviewId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Cookie', [`token=${token}`]);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);
  });

  it('DELETE by admin (different user) → 200', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor7', email: `v7rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizG',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R8', email: `r8rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolI',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const adminAccount = await Account.create({
      name: 'AdminRV', email: `adminrv+${Date.now()}@e.com`, password: 'hashed', role: 'admin', isActive: true, isVerified: true,
    });
    await StaffProfile.create({ accountId: adminAccount.id, employeeId: `EMP-RV-${Date.now()}`, department: 'Platform' });
    const supplier = await makeSupplier(vendor.account.id);
    const reviewerToken = makeToken(reviewer.account.id, 'institute');
    const adminToken = makeToken(adminAccount.id, 'admin');

    const createRes = await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${reviewerToken}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 2 });

    const reviewId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set('Cookie', [`token=${adminToken}`]);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.deleted).toBe(true);
  });
});

describe('GET /api/reviews', () => {
  it('paginates and populates reviewer', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor8', email: `v8rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizH',
    });
    const reviewer = await authService.signupInstitute({
      name: 'R9', email: `r9rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolJ',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token = makeToken(reviewer.account.id, 'institute');

    await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 5, body: 'Excellent!' });

    const res = await request(app)
      .get(`/api/reviews?targetType=supplier&targetId=${supplier._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    // Reviewer should be populated with name
    const item = res.body.data.items[0];
    expect(item.reviewerAccountId).toHaveProperty('name');
  });
});

describe('GET /api/reviews/stats', () => {
  it('returns average, count, breakdown', async () => {
    const vendor = await authService.signupVendor({
      name: 'Vendor9', email: `v9rv+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizI',
    });
    const reviewer1 = await authService.signupInstitute({
      name: 'R10', email: `r10rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolK',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const reviewer2 = await authService.signupInstitute({
      name: 'R11', email: `r11rv+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolL',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const supplier = await makeSupplier(vendor.account.id);
    const token1 = makeToken(reviewer1.account.id, 'institute');
    const token2 = makeToken(reviewer2.account.id, 'institute');

    await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token1}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 4 });

    await request(app)
      .post('/api/reviews')
      .set('Cookie', [`token=${token2}`])
      .send({ targetType: 'supplier', targetId: supplier._id.toString(), rating: 2 });

    const res = await request(app)
      .get(`/api/reviews/stats?targetType=supplier&targetId=${supplier._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.average).toBe(3); // (4+2)/2
    expect(res.body.data.breakdown['4']).toBe(1);
    expect(res.body.data.breakdown['2']).toBe(1);
  });
});
