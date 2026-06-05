import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import rosterRoutes from '../../routes/roster.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

async function signupConsultant(): Promise<string> {
  const res = await request(app).post('/api/auth/consultant/signup').send({
    name: 'C', email: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}@e.com`, password: 'pwpwpw',
    yearsOfExperience: 5,
    specializations: { subjects: [], levels: [], regions: [] },
  });
  return res.headers['set-cookie'][0];
}

async function signupTeacher(): Promise<string> {
  const res = await request(app).post('/api/auth/teacher/signup').send({
    name: 'T', email: `t-${Date.now()}-${Math.floor(Math.random() * 1000)}@e.com`, password: 'pwpwpw',
    experience: 3, qualifications: ['B.Ed.'], subjects: ['Math'],
  });
  return res.body.data.account.id;
}

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/roster', rosterRoutes);
  await SubscriptionPlan.create([
    { name: 'cons-free', displayName: 'Consultant Free', planType: 'consultant',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'Teacher Free', planType: 'teacher',
      description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
});

describe('POST /api/roster', () => {
  it('consultant can add a teacher to their roster', async () => {
    const cookie = await signupConsultant();
    const teacherId = await signupTeacher();
    const res = await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId, internalNotes: 'Strong Math candidate',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.entityAccountId).toBe(teacherId);
    expect(res.body.data.status).toBe('active');
  });

  it('returns 409 when adding the same teacher twice while active', async () => {
    const cookie = await signupConsultant();
    const teacherId = await signupTeacher();
    await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId,
    });
    const res = await request(app).post('/api/roster').set('Cookie', cookie).send({
      entityType: 'teacher', entityAccountId: teacherId,
    });
    expect(res.status).toBe(409);
  });

  it('returns 403 when caller is not a consultant', async () => {
    const teacherCookie = (await request(app).post('/api/auth/teacher/signup').send({
      name: 'T2', email: `t2-${Date.now()}@e.com`, password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    })).headers['set-cookie'][0];
    const otherTeacherId = await signupTeacher();
    const res = await request(app).post('/api/roster').set('Cookie', teacherCookie).send({
      entityType: 'teacher', entityAccountId: otherTeacherId,
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/roster', () => {
  it('lists own roster, paginated', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const t2 = await signupTeacher();
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t2 });
    const res = await request(app).get('/api/roster?entityType=teacher&page=1&pageSize=10').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });
});

describe('PATCH/DELETE /api/roster/:id', () => {
  it('patches notes/tags', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const addRes = await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    const id = addRes.body.data.id;
    const patchRes = await request(app).patch(`/api/roster/${id}`).set('Cookie', cookie).send({ internalNotes: 'updated', tags: ['priority'] });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.internalNotes).toBe('updated');
    expect(patchRes.body.data.tags).toEqual(['priority']);
  });

  it('archives via DELETE (soft)', async () => {
    const cookie = await signupConsultant();
    const t1 = await signupTeacher();
    const addRes = await request(app).post('/api/roster').set('Cookie', cookie).send({ entityType: 'teacher', entityAccountId: t1 });
    const id = addRes.body.data.id;
    const delRes = await request(app).delete(`/api/roster/${id}`).set('Cookie', cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.status).toBe('archived');
  });
});
