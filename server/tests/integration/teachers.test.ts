import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import teacherRoutes from '../../routes/teachers.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;
beforeEach(async () => {
  app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/teachers', teacherRoutes);
  await SubscriptionPlan.create({
    name: 't-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
});

describe('GET /api/teachers', () => {
  it('returns teachers filtered by subject', async () => {
    await authService.signupTeacher({ name: 'A', email: 'a@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Math'] });
    await authService.signupTeacher({ name: 'B', email: 'b@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Physics'] });
    const res = await request(app).get('/api/teachers?subject=Math');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].account.name).toBe('A');
  });

  it('returns teachers filtered by minimum experience', async () => {
    await authService.signupTeacher({ name: 'L', email: 'l@e.com', password: 'pwpwpw', experience: 2, qualifications: [], subjects: ['Math'] });
    await authService.signupTeacher({ name: 'H', email: 'h@e.com', password: 'pwpwpw', experience: 8, qualifications: [], subjects: ['Math'] });
    const res = await request(app).get('/api/teachers?minExperience=5');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].account.name).toBe('H');
  });
});
