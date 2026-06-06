import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import jobRoutes from '../../routes/jobs.js';
import rosterRoutes from '../../routes/roster.js';
import teacherRoutes from '../../routes/teachers.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import mongoose from 'mongoose';
import Application from '../../models/Application.js';

let app: express.Express;

async function seedConsultant() {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  return { cookie: res.headers['set-cookie'][0], id: res.body.data.account.id };
}
async function seedTeacher() {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
    experience: 1, qualifications: [], subjects: ['Math'],
  });
  return { cookie: res.headers['set-cookie'][0], id: res.body.data.account.id };
}
async function seedJob() {
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
  app.use('/api/jobs', jobRoutes);
  app.use('/api/roster', rosterRoutes);
  app.use('/api/teachers', teacherRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/jobs/:id/apply by consultant', () => {
  it('403 when teacher has not granted consent', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'On behalf',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/CONSENT/);
  });

  it('201 with submittedByConsultantId when consent granted and teacher in roster', async () => {
    const { cookie, id: consultantId } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'any' });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'On behalf',
    });
    expect(res.status).toBe(201);
    const appRow = await Application.findById(res.body.data._id ?? res.body.data.id);
    expect(String(appRow?.submittedByConsultantId)).toBe(consultantId);
    expect(String(appRow?.teacherId)).toBe(teacher.id);
  });

  it('403 when teacher consent scope=specific and consultant not in allowlist', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: teacher.id });
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'specific', allowedConsultantAccountIds: [] });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'X',
    });
    expect(res.status).toBe(403);
  });

  it('403 when teacher not in consultant roster', async () => {
    const { cookie } = await seedConsultant();
    const teacher = await seedTeacher();
    const jobId = await seedJob();
    await request(app).patch('/api/teachers/me/consultant-consent').set('Cookie', teacher.cookie).send({ granted: true, scope: 'any' });
    const res = await request(app).post(`/api/jobs/${jobId}/apply`).set('Cookie', cookie).send({
      teacherAccountId: teacher.id, coverLetter: 'X',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/ROSTER/);
  });
});
