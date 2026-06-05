import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import teacherRoutes from '../../routes/teachers.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import TeacherProfile from '../../models/TeacherProfile.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/teachers', teacherRoutes);
  await SubscriptionPlan.create({
    name: 'teach-free', displayName: 'T', planType: 'teacher',
    description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true,
  });
});

describe('PATCH /api/teachers/me/consultant-consent', () => {
  it('teacher can grant consent (scope=any)', async () => {
    const signup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
    });
    const cookie = signup.headers['set-cookie'][0];
    const accountId = signup.body.data.account.id;

    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({
      granted: true, scope: 'any',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.consultantConsent.granted).toBe(true);

    const profile = await TeacherProfile.findOne({ accountId });
    expect(profile?.consultantConsent?.granted).toBe(true);
    expect(profile?.consultantConsent?.grantedAt).toBeTruthy();
  });

  it('teacher can revoke consent', async () => {
    const signup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't2@e.com', password: 'pwpwpw',
      experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
    });
    const cookie = signup.headers['set-cookie'][0];
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: true, scope: 'any' });

    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: false });
    expect(res.status).toBe(200);
    expect(res.body.data.consultantConsent.granted).toBe(false);
    expect(res.body.data.consultantConsent.revokedAt).toBeTruthy();
  });

  it('returns 403 when caller is not a teacher', async () => {
    await SubscriptionPlan.create({
      name: 'inst-free', displayName: 'I', planType: 'institute',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true,
    });
    const inst = await request(app).post('/api/auth/institute/signup').send({
      name: 'I', email: 'i@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const cookie = inst.headers['set-cookie'][0];
    const res = await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', cookie).send({ granted: true });
    expect(res.status).toBe(403);
  });
});
