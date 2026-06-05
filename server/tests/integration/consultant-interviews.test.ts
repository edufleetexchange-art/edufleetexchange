import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import interviewRoutes from '../../routes/interviews.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Job from '../../models/Job.js';
import Application from '../../models/Application.js';
import Notification from '../../models/Notification.js';
import mongoose from 'mongoose';

let app: express.Express;

async function setup() {
  const consSignup = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5, specializations: { subjects: [], levels: [], regions: [] },
  });
  const consultantCookie = consSignup.headers['set-cookie'][0];
  const consultantId = consSignup.body.data.account.id;

  const teachSignup = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
    experience: 3, qualifications: [], subjects: ['Math'],
  });
  const teacherId = teachSignup.body.data.account.id;

  const instSignup = await request(app).post('/api/auth/institute/signup').send({
    name: 'I', email: `i-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@e.com`, password: 'pwpwpw',
    instituteName: 'X',
    address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
  });
  const instituteId = instSignup.body.data.account.id;

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
    instituteId,
    status: 'active',
  });

  const application = await Application.create({
    jobId: job._id,
    teacherId, teacherName: 'T',
    instituteId, instituteName: 'X',
    coverLetter: 'X',
    submittedByConsultantId: consultantId,
    statusHistory: [],
  });

  return { consultantCookie, consultantId, teacherId, instituteId, jobId: String(job._id), applicationId: String(application._id) };
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'C', planType: 'consultant', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/interviews', () => {
  it('schedules interview and notifies teacher + institute + consultant', async () => {
    const { consultantCookie, teacherId, instituteId, consultantId, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const res = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video', meetingLink: 'https://meet.example/abc',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.round).toBe(1);
    const notifs = await Notification.find({ 'metadata.event': 'interview_invitation' });
    const ids = notifs.map((n) => String((n as any).userId)).sort();
    expect(ids).toEqual([teacherId, instituteId, consultantId].sort());
  });

  it('PATCH reschedules and emits notifications again', async () => {
    const { consultantCookie, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const created = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video',
    });
    const id = created.body.data.id;
    const newWhen = new Date(Date.now() + 2 * 86400000);
    const patch = await request(app).patch(`/api/interviews/${id}`).set('Cookie', consultantCookie).send({
      scheduledAt: newWhen.toISOString(), rescheduleReason: 'Conflict',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('rescheduled');
  });

  it('PATCH completes with outcome', async () => {
    const { consultantCookie, applicationId } = await setup();
    const when = new Date(Date.now() + 86400000);
    const created = await request(app).post('/api/interviews').set('Cookie', consultantCookie).send({
      applicationId, scheduledAt: when.toISOString(), durationMinutes: 30, mode: 'video',
    });
    const id = created.body.data.id;
    const patch = await request(app).patch(`/api/interviews/${id}`).set('Cookie', consultantCookie).send({
      outcome: 'recommend_hire', notesAfter: 'Strong',
    });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('completed');
    expect(patch.body.data.outcome).toBe('recommend_hire');
  });
});
