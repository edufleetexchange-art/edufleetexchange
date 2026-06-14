import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import alertRoutes from '../../routes/alerts.js';
import Account from '../../models/Account.js';
import Alert from '../../models/Alert.js';
import AlertMatch from '../../models/AlertMatch.js';
import Notification from '../../models/Notification.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';
import { JWT_CONFIG } from '../../config/jwt.js';

function cookieFor(accountId: string, role: string): string {
  return `token=${jwt.sign({ accountId, role }, JWT_CONFIG.secret, { expiresIn: '1h' })}`;
}

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/alerts', alertRoutes);
  // teacher-free plan so signupTeacher can attach a subscription
  await SubscriptionPlan.create({
    name: 't-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
});

async function makeInstitute(email = 'inst@e.com') {
  const a = await Account.create({ name: 'Demo School', email, password: 'pwpwpw', role: 'institute' });
  return { id: String(a._id), cookie: cookieFor(String(a._id), 'institute') };
}

describe('Alerts API', () => {
  it('creates a teacher alert and lists it', async () => {
    const inst = await makeInstitute();
    const create = await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Maths – Secondary – Bengaluru', criteria: { subjects: ['Maths'], location: 'Bengaluru', minExperience: 3 } });
    expect(create.status).toBe(201);
    expect(create.body.data.entityType).toBe('teacher');

    const list = await request(app).get('/api/alerts/mine').set('Cookie', inst.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.items[0].label).toContain('Maths');
  });

  it('rejects a teacher trying to create an alert (buyer-side only)', async () => {
    const t = await Account.create({ name: 'T', email: 't@e.com', password: 'pwpwpw', role: 'teacher' });
    const res = await request(app)
      .post('/api/alerts')
      .set('Cookie', cookieFor(String(t._id), 'teacher'))
      .send({ entityType: 'teacher', label: 'x', criteria: {} });
    expect(res.status).toBe(403);
  });

  it('fires a notification to the subscriber when a matching teacher signs up', async () => {
    const inst = await makeInstitute('match@e.com');
    await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Maths teacher', criteria: { subjects: ['Maths'] } });

    // A matching teacher joins → fan-out runs inside signupTeacher.
    await authService.signupTeacher({ name: 'R Kumar', email: 'rk@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Maths'] });

    const notes = await Notification.find({ userId: inst.id, type: 'alert_teacher_available' });
    expect(notes.length).toBe(1);
    expect(notes[0].message).toContain('Maths');
  });

  it('does NOT fire for a non-matching teacher (different subject)', async () => {
    const inst = await makeInstitute('nomatch@e.com');
    await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Maths teacher', criteria: { subjects: ['Maths'] } });

    await authService.signupTeacher({ name: 'P E Teacher', email: 'pe@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Physical Education'] });

    const notes = await Notification.find({ userId: inst.id, type: 'alert_teacher_available' });
    expect(notes.length).toBe(0);
  });

  it('sends a demand lead to the founder/admin when an alert matches', async () => {
    const admin = await Account.create({ name: 'Founder', email: 'admin@e.com', password: 'pwpwpw', role: 'admin' });
    const inst = await makeInstitute('lead@e.com');
    await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Science teacher', criteria: { subjects: ['Science'] } });

    await authService.signupTeacher({ name: 'S Rao', email: 'sr@e.com', password: 'pwpwpw', experience: 4, qualifications: [], subjects: ['Science'] });

    const leads = await Notification.find({ userId: admin._id, type: 'alert_demand_lead' });
    expect(leads.length).toBe(1);
    expect(leads[0].metadata?.requesterAccountId).toBe(inst.id);
  });

  it('dedupes — the same teacher never notifies the same alert twice', async () => {
    const inst = await makeInstitute('dedupe@e.com');
    const created = await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Maths', criteria: { subjects: ['Maths'] } });
    const alertId = created.body.data.id;

    // Sign up the teacher (fires once), then manually re-run fan-out for the
    // same teacher — the AlertMatch unique index must prevent a second ping.
    await authService.signupTeacher({ name: 'Dup', email: 'dup@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Maths'] });
    const teacher = await Account.findOne({ email: 'dup@e.com' });
    const { fanOutTeacher } = await import('../../services/alertService.js');
    await fanOutTeacher({ accountId: String(teacher!._id), name: 'Dup', subjects: ['Maths'], experience: 5 });

    const notes = await Notification.find({ userId: inst.id, type: 'alert_teacher_available' });
    expect(notes.length).toBe(1); // still one, not two
    const matches = await AlertMatch.find({ alertId });
    expect(matches.length).toBe(1);
  });

  it('a paused alert does not fire', async () => {
    const inst = await makeInstitute('paused@e.com');
    const created = await request(app)
      .post('/api/alerts')
      .set('Cookie', inst.cookie)
      .send({ entityType: 'teacher', label: 'Maths', criteria: { subjects: ['Maths'] } });
    await request(app).patch(`/api/alerts/${created.body.data.id}`).set('Cookie', inst.cookie).send({ status: 'paused' });

    await authService.signupTeacher({ name: 'Q', email: 'q@e.com', password: 'pwpwpw', experience: 5, qualifications: [], subjects: ['Maths'] });

    const notes = await Notification.find({ userId: inst.id, type: 'alert_teacher_available' });
    expect(notes.length).toBe(0);
  });
});
