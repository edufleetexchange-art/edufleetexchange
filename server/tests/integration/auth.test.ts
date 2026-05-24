import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  await SubscriptionPlan.create([
    { name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'vend-free', displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/auth/institute/signup', () => {
  it('creates Account + InstituteProfile + Subscription and returns bundle', async () => {
    const res = await request(app).post('/api/auth/institute/signup').send({
      name: 'D', email: 'd@e.com', password: 'pwpwpw',
      instituteName: 'Demo',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.email).toBe('d@e.com');
    expect(res.body.data.profile.instituteName).toBe('Demo');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('returns 409 on duplicate email', async () => {
    const body = {
      name: 'D', email: 'dup@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    };
    await request(app).post('/api/auth/institute/signup').send(body);
    const res = await request(app).post('/api/auth/institute/signup').send(body);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/teacher/signup', () => {
  it('creates teacher bundle', async () => {
    const res = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 5, qualifications: ['M.Sc.'], subjects: ['Math'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('teacher');
  });
});

describe('POST /api/auth/vendor/signup', () => {
  it('creates vendor bundle', async () => {
    const res = await request(app).post('/api/auth/vendor/signup').send({
      name: 'V', email: 'v@e.com', password: 'pwpwpw',
      businessName: 'Acme',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('vendor');
  });
});

describe('POST /api/auth/login + GET /api/auth/me', () => {
  it('login returns bundle; /me returns same shape', async () => {
    await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: 'me@e.com', password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    });
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'me@e.com', password: 'pwpwpw' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.account.email).toBe('me@e.com');
    const cookie = loginRes.headers['set-cookie'][0];
    const meRes = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(meRes.status).toBe(200);
    expect(Object.keys(meRes.body.data).sort()).toEqual(['account', 'profile', 'subscription']);
  });
});
