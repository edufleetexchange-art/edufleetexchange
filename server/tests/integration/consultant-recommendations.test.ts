import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import recommendationRoutes from '../../routes/recommendations.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
// Importing ConsultantRoster ensures the model is registered for matchService lookups.
import '../../models/ConsultantRoster.js';
import mongoose from 'mongoose';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('GET /api/recommendations/jobs-for-roster', () => {
  it('returns top-scored jobs based on rostered teachers', async () => {
    const consSignup = await request(app).post('/api/auth/consultant/signup').send({
      name: 'C', email: `c-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
      yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
    });
    const cookie = consSignup.headers['set-cookie'][0];

    const teachSignup = await request(app).post('/api/auth/teacher/signup').send({
      name: 'T', email: `t-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
      experience: 5, qualifications: ['B.Ed.'], subjects: ['Math', 'Physics'], location: 'Bengaluru',
    });
    const teacherId = teachSignup.body.data.account.id;
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacherId });

    await Job.create({
      title: 'Math Teacher',
      instituteName: 'X',
      department: 'Mathematics',
      location: { city: 'Bengaluru', state: 'KA', country: 'India' },
      subjects: ['Math'],
      experience: { min: 2, max: 8 },
      salary: { min: 30000, max: 50000, currency: 'INR' },
      qualification: ['B.Ed.'],
      employmentType: 'full-time',
      description: 'd',
      contactEmail: 'inst@e.com',
      instituteId: new mongoose.Types.ObjectId(),
      status: 'active',
    });

    const res = await request(app).get('/api/recommendations/jobs-for-roster').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].score).toBeGreaterThan(0);
  });
});
