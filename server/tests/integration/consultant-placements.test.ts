import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import placementRoutes from '../../routes/placements.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import mongoose from 'mongoose';

let app: express.Express;

async function seedConsultant(): Promise<string> {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  return res.headers['set-cookie'][0];
}
async function seedTeacher(): Promise<string> {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}-${Math.floor(Math.random() * 1000)}@e.com`, password: 'pwpwpw',
    experience: 1, qualifications: [], subjects: ['Math'],
  });
  return res.body.data.account.id;
}
async function seedJob(): Promise<string> {
  const job = await Job.create({
    title: 'Math Teacher',
    instituteName: 'X',
    department: 'Mathematics',
    location: { city: 'Bengaluru', state: 'KA', country: 'India' },
    subjects: ['Math'],
    experience: { min: 1, max: 10 },
    salary: { min: 30000, max: 50000, currency: 'INR' },
    qualification: ['B.Ed.'],
    employmentType: 'full-time',
    description: 'd',
    contactEmail: 'inst@e.com',
    instituteId: new mongoose.Types.ObjectId(),
    status: 'active',
  });
  return String(job._id);
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/placements', placementRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/placements', () => {
  it('consultant creates a proposed placement', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const res = await request(app).post('/api/placements').set('Cookie', cookie).send({
      teacherAccountId: teacherId, jobId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.stage).toBe('proposed');
    expect(res.body.data.stageHistory).toHaveLength(1);
  });

  it('returns 409 on duplicate active placement for same (teacher, job)', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const res = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/placements/:id', () => {
  it('valid stage transition proposed -> applied appends history', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const created = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const id = created.body.data.id;
    const res = await request(app).patch(`/api/placements/${id}`).set('Cookie', cookie).send({ stage: 'applied', reason: 'Submitted application' });
    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe('applied');
    expect(res.body.data.stageHistory).toHaveLength(2);
  });

  it('rejects invalid skip proposed -> placed with 400', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    const created = await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const id = created.body.data.id;
    const res = await request(app).patch(`/api/placements/${id}`).set('Cookie', cookie).send({ stage: 'placed' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/placements', () => {
  it('lists own placements paginated and filtered by stage', async () => {
    const cookie = await seedConsultant();
    const teacherId = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/placements').set('Cookie', cookie).send({ teacherAccountId: teacherId, jobId });
    const res = await request(app).get('/api/placements?stage=proposed').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].stage).toBe('proposed');
  });
});
