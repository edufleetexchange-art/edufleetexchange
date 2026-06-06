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
  await SubscriptionPlan.create({
    name: 'cons-free', displayName: 'Consultant Free', planType: 'consultant',
    description: 'd', price: 0, duration: 30,
    features: {
      maxBrowsesPerMonth: 100,
      maxRosterTeachers: 25, maxApplicationsPerMonth: 10, maxPlacementsPerMonth: 3,
      canViewTeacherContact: false,
      dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic',
    },
    isActive: true,
  });
});

describe('POST /api/auth/consultant/signup', () => {
  it('creates Account + ConsultantProfile + Subscription and returns bundle', async () => {
    const res = await request(app).post('/api/auth/consultant/signup').send({
      name: 'C. Broker', email: 'cons@e.com', password: 'pwpwpw', phone: '+91 999',
      agencyName: 'Acme Recruiters',
      yearsOfExperience: 7,
      specializations: { subjects: ['Math'], levels: ['Secondary'], regions: ['Bengaluru'] },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.account.role).toBe('consultant');
    expect(res.body.data.profile.agencyName).toBe('Acme Recruiters');
    expect(res.body.data.profile.specializations.subjects).toContain('Math');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('returns 409 on duplicate email', async () => {
    const body = {
      name: 'C', email: 'dup-c@e.com', password: 'pwpwpw',
      yearsOfExperience: 1,
      specializations: { subjects: [], levels: [], regions: [] },
    };
    await request(app).post('/api/auth/consultant/signup').send(body);
    const res = await request(app).post('/api/auth/consultant/signup').send(body);
    expect(res.status).toBe(409);
  });
});
