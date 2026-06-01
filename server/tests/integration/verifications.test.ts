import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import verificationRoutes from '../../routes/verifications.js';
import * as authService from '../../services/authService.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import VendorProfile from '../../models/VendorProfile.js';
import Notification from '../../models/Notification.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import { JWT_CONFIG } from '../../config/jwt.js';

let app: express.Express;

async function seedFreePlans() {
  await SubscriptionPlan.create([
    {
      name: `inst-free-vr-${Date.now()}`, displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: `vendor-free-vr-${Date.now()}`, displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: `teacher-free-vr-${Date.now()}`, displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
  ]);
}

function makeToken(accountId: string, role: string) {
  return jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

const SAMPLE_DOC = {
  documentType: 'gst_certificate',
  documentUrl: 'https://example.com/doc.pdf',
  notes: 'Please review',
};

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/verifications', verificationRoutes);
  await seedFreePlans();
});

describe('POST /api/verifications', () => {
  it('institute creates request + sets profile.verification.status=pending', async () => {
    const inst = await authService.signupInstitute({
      name: 'InstVer1', email: `iv1+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR1',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(inst.account.id, 'institute');

    const res = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.targetType).toBe('institute');

    const profile = await InstituteProfile.findOne({ accountId: inst.account.id });
    expect(profile?.verification?.status).toBe('pending');
  });

  it('vendor creates request + sets profile.verification.status=pending', async () => {
    const vendor = await authService.signupVendor({
      name: 'VendorVer1', email: `vv1+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizVR1',
    });
    const token = makeToken(vendor.account.id, 'vendor');

    const res = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    expect(res.status).toBe(201);
    expect(res.body.data.targetType).toBe('vendor');

    const profile = await VendorProfile.findOne({ accountId: vendor.account.id });
    expect(profile?.verification?.status).toBe('pending');
  });

  it('teacher gets 403', async () => {
    const teacher = await authService.signupTeacher({
      name: 'TeacherVer1', email: `tv1+${Date.now()}@e.com`, password: 'pwpwpw',
      experience: 2, qualifications: ['B.Ed'], subjects: ['Math'],
    });
    const token = makeToken(teacher.account.id, 'teacher');

    const res = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    expect(res.status).toBe(403);
  });

  it('unauthenticated request gets 401', async () => {
    const res = await request(app)
      .post('/api/verifications')
      .send(SAMPLE_DOC);

    expect(res.status).toBe(401);
  });

  it('duplicate pending request from same account → 409', async () => {
    const inst = await authService.signupInstitute({
      name: 'InstVer2', email: `iv2+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR2',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(inst.account.id, 'institute');

    await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    const res = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_PENDING');
  });
});

describe('GET /api/verifications/me', () => {
  it('returns the most recent verification request', async () => {
    const inst = await authService.signupInstitute({
      name: 'InstVer3', email: `iv3+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR3',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(inst.account.id, 'institute');

    await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${token}`])
      .send(SAMPLE_DOC);

    const res = await request(app)
      .get('/api/verifications/me')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toBeNull();
    expect(res.body.data.status).toBe('pending');
  });
});

describe('GET /api/verifications/admin', () => {
  it('non-admin user gets 403', async () => {
    const inst = await authService.signupInstitute({
      name: 'InstVer4', email: `iv4+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR4',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const token = makeToken(inst.account.id, 'institute');

    const res = await request(app)
      .get('/api/verifications/admin')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(403);
  });

  it('admin gets paginated list with accountId populated', async () => {
    const admin = await authService.adminCreateStaff({
      name: 'AdminVR1', email: `admin-vr1+${Date.now()}@e.com`, password: 'pwpwpw', role: 'admin',
    });
    const inst = await authService.signupInstitute({
      name: 'InstVer5', email: `iv5+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR5',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const instToken = makeToken(inst.account.id, 'institute');
    await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${instToken}`])
      .send(SAMPLE_DOC);

    const adminToken = makeToken(admin.account.id, 'admin');
    const res = await request(app)
      .get('/api/verifications/admin?status=pending')
      .set('Cookie', [`token=${adminToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    // accountId should be populated
    const item = res.body.data.items.find((i: any) => i.accountId?.email === inst.account.email);
    expect(item).toBeDefined();
    expect(item.accountId).toHaveProperty('name');
  });
});

describe('PATCH /api/verifications/admin/:id (approve)', () => {
  it('approve: sets verified on request + profile + creates Notification', async () => {
    const admin = await authService.adminCreateStaff({
      name: 'AdminVR2', email: `admin-vr2+${Date.now()}@e.com`, password: 'pwpwpw', role: 'admin',
    });
    const vendor = await authService.signupVendor({
      name: 'VendorVer2', email: `vv2+${Date.now()}@e.com`, password: 'pwpwpw', businessName: 'BizVR2',
    });
    const vendorToken = makeToken(vendor.account.id, 'vendor');

    const submitRes = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${vendorToken}`])
      .send(SAMPLE_DOC);
    const reqId = submitRes.body.data.id;

    const adminToken = makeToken(admin.account.id, 'admin');
    const patchRes = await request(app)
      .patch(`/api/verifications/admin/${reqId}`)
      .set('Cookie', [`token=${adminToken}`])
      .send({ status: 'verified', reviewNotes: 'Looks good' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('verified');

    const profile = await VendorProfile.findOne({ accountId: vendor.account.id });
    expect(profile?.verification?.status).toBe('verified');
    expect(profile?.verification?.verifiedAt).toBeDefined();

    const notif = await Notification.findOne({ userId: vendor.account.id, type: 'system' });
    expect(notif).not.toBeNull();
    expect(notif?.message).toMatch(/verified/i);
  });

  it('reject: sets rejected status + Notification mentions rejection + includes reviewNotes', async () => {
    const admin = await authService.adminCreateStaff({
      name: 'AdminVR3', email: `admin-vr3+${Date.now()}@e.com`, password: 'pwpwpw', role: 'admin',
    });
    const inst = await authService.signupInstitute({
      name: 'InstVer6', email: `iv6+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR6',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const instToken = makeToken(inst.account.id, 'institute');

    const submitRes = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${instToken}`])
      .send(SAMPLE_DOC);
    const reqId = submitRes.body.data.id;

    const adminToken = makeToken(admin.account.id, 'admin');
    const patchRes = await request(app)
      .patch(`/api/verifications/admin/${reqId}`)
      .set('Cookie', [`token=${adminToken}`])
      .send({ status: 'rejected', reviewNotes: 'Document unclear' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe('rejected');

    const profile = await InstituteProfile.findOne({ accountId: inst.account.id });
    expect(profile?.verification?.status).toBe('rejected');

    const notif = await Notification.findOne({ userId: inst.account.id, type: 'system' });
    expect(notif?.message).toMatch(/rejected/i);
    expect(notif?.message).toMatch(/Document unclear/);
  });
});

describe('Resubmission after review', () => {
  it('after verified, account can submit a new request', async () => {
    const admin = await authService.adminCreateStaff({
      name: 'AdminVR4', email: `admin-vr4+${Date.now()}@e.com`, password: 'pwpwpw', role: 'admin',
    });
    const inst = await authService.signupInstitute({
      name: 'InstVer7', email: `iv7+${Date.now()}@e.com`, password: 'pwpwpw',
      instituteName: 'SchoolVR7',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const instToken = makeToken(inst.account.id, 'institute');
    const adminToken = makeToken(admin.account.id, 'admin');

    // First request
    const r1 = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${instToken}`])
      .send(SAMPLE_DOC);
    const reqId = r1.body.data.id;

    // Admin approves
    await request(app)
      .patch(`/api/verifications/admin/${reqId}`)
      .set('Cookie', [`token=${adminToken}`])
      .send({ status: 'verified' });

    // Resubmit - should succeed (no longer pending)
    const r2 = await request(app)
      .post('/api/verifications')
      .set('Cookie', [`token=${instToken}`])
      .send({ ...SAMPLE_DOC, documentType: 'pan_card' });

    expect(r2.status).toBe(201);
    expect(r2.body.data.status).toBe('pending');
  });
});
