import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import mongoose from 'mongoose';
import { JWT_CONFIG } from '../../config/jwt.js';
import recommendationRoutes from '../../routes/recommendations.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
// Import model files directly so mongoose.models is populated before tests run
import JobModel from '../../models/Job.js';
import ApplicationModel from '../../models/Application.js';
import {
  jaccard,
  experienceFit,
  locationMatch,
  scoreTeacherForJob,
} from '../../services/matchService.js';

// Use already-compiled models to avoid OverwriteModelError in single-fork test suite
const Job = JobModel;
// Application model accessor
function getApplication(): mongoose.Model<any> {
  return ApplicationModel as mongoose.Model<any>;
}

// ─── pure-function unit tests ────────────────────────────────────────────────

describe('matchService pure functions', () => {
  it('jaccard of identical sets is 1', () => expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1));
  it('jaccard of disjoint sets is 0', () => expect(jaccard(['a'], ['b'])).toBe(0));
  it('jaccard with overlap', () => expect(jaccard(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(2 / 4));
  it('jaccard both empty returns 0', () => expect(jaccard([], [])).toBe(0));
  it('jaccard one empty returns 0', () => expect(jaccard(['a'], [])).toBe(0));

  it('experienceFit inside range', () => expect(experienceFit(5, 3, 7)).toBe(1));
  it('experienceFit below range decays', () => expect(experienceFit(0, 3, 7)).toBeCloseTo(1 - 3 / 5));
  it('experienceFit above range decays', () => expect(experienceFit(12, 3, 7)).toBeCloseTo(1 - 5 / 5));
  it('experienceFit far below range clamps to 0', () => expect(experienceFit(0, 10, 20)).toBe(0));

  it('locationMatch exact (case-insensitive)', () => expect(locationMatch('Bengaluru', [], 'bengaluru')).toBe(1));
  it('locationMatch preferred', () => expect(locationMatch('Mumbai', ['Bengaluru'], 'Bengaluru')).toBe(0.7));
  it('locationMatch no match', () => expect(locationMatch('Chennai', ['Mumbai'], 'Bengaluru')).toBe(0));
  it('locationMatch undefined teacher location', () => expect(locationMatch(undefined, ['BLR'], 'blr')).toBe(0.7));

  it('scoreTeacherForJob perfect match returns 100', () => {
    const score = scoreTeacherForJob(
      { subjects: ['Math'], qualifications: ['M.Sc.'], experience: 5, location: 'BLR', preferredLocation: [] },
      { subjects: ['Math'], qualification: ['M.Sc.'], experience: { min: 3, max: 7 }, location: { city: 'BLR' } }
    );
    expect(score).toBe(100);
  });

  it('scoreTeacherForJob no overlap returns 0 when experience in range and no location', () => {
    // subjects disjoint (0.4*0=0), exp in range (0.3*1=0.3), no location (0.2*0=0), qual disjoint (0.1*0=0)
    const score = scoreTeacherForJob(
      { subjects: ['Art'], qualifications: ['B.A.'], experience: 5, location: 'Chennai', preferredLocation: [] },
      { subjects: ['Math'], qualification: ['M.Sc.'], experience: { min: 3, max: 7 }, location: { city: 'BLR' } }
    );
    expect(score).toBe(30); // 0.3 * 100 = 30
  });
});

// ─── integration tests ────────────────────────────────────────────────────────

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/recommendations', recommendationRoutes);

  // Seed subscription plans needed for signups
  await SubscriptionPlan.create([
    {
      name: 'rec-teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
    {
      name: 'rec-inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
      isActive: true,
    },
  ]);
});

async function makeTeacherToken(suffix = '') {
  const b = await authService.signupTeacher({
    name: `Teacher${suffix}`, email: `teacher${suffix}@rec.test`, password: 'pwpwpw',
    experience: 5, qualifications: ['M.Sc.'], subjects: ['Math'],
  });
  return jwt.sign({ accountId: b.account.id, role: 'teacher' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
}

async function makeInstituteToken(suffix = '') {
  const b = await authService.signupInstitute({
    name: `Institute${suffix}`, email: `inst${suffix}@rec.test`, password: 'pwpwpw',
    instituteName: `School${suffix}`,
    address: { street: '1', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
  });
  return { token: jwt.sign({ accountId: b.account.id, role: 'institute' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any }), account: b.account };
}

describe('GET /api/recommendations/jobs', () => {
  it('returns 200 with items array for authenticated teacher', async () => {
    const token = await makeTeacherToken('a');
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 403 when called by an institute', async () => {
    const { token } = await makeInstituteToken('b');
    const res = await request(app)
      .get('/api/recommendations/jobs')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/recommendations/jobs');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/recommendations/teachers', () => {
  it('returns 200 with items array when institute provides jobId', async () => {
    const { token, account } = await makeInstituteToken('c');
    const job = await Job.create({
      title: 'Math Teacher', instituteName: 'Test School', department: 'Science',
      location: { city: 'BLR', state: 'KA', country: 'India' },
      subjects: ['Math'], experience: { min: 2, max: 8 },
      salary: { min: 300000, max: 600000, currency: 'INR' },
      qualification: ['M.Sc.'], employmentType: 'full-time',
      description: 'Teach math', contactEmail: 'contact@test.com',
      instituteId: (account as any).id || (account as any)._id,
      status: 'active',
    });
    const res = await request(app)
      .get(`/api/recommendations/teachers?jobId=${job._id}`)
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 400 when jobId is missing', async () => {
    const { token } = await makeInstituteToken('d');
    const res = await request(app)
      .get('/api/recommendations/teachers')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_JOB_ID');
  });

  it('returns 403 when called by a teacher', async () => {
    const token = await makeTeacherToken('e');
    const res = await request(app)
      .get('/api/recommendations/teachers?jobId=abc123')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});

// ─── collaborative endpoint tests ────────────────────────────────────────────

async function makeTeacherBundle(suffix = '') {
  const b = await authService.signupTeacher({
    name: `Collab${suffix}`, email: `collab${suffix}@rec.test`, password: 'pwpwpw',
    experience: 3, qualifications: ['B.Ed.'], subjects: ['Science'],
  });
  const token = jwt.sign({ accountId: b.account.id, role: 'teacher' }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn as any });
  return { token, account: b.account };
}

async function makeJobForInstitute(instituteId: string, overrides: Record<string, any> = {}) {
  return Job.create({
    title: overrides.title ?? 'Science Teacher',
    instituteName: 'Collab School',
    department: overrides.department ?? 'Science',
    location: { city: 'BLR', state: 'KA', country: 'India' },
    subjects: overrides.subjects ?? ['Science'],
    experience: { min: 1, max: 10 },
    salary: { min: 200000, max: 500000, currency: 'INR' },
    qualification: ['B.Ed.'],
    employmentType: 'full-time',
    description: 'Teach science',
    contactEmail: 'contact@collabschool.com',
    instituteId,
    status: 'active',
    ...overrides,
  });
}

describe('GET /api/recommendations/jobs/collaborative', () => {
  it('returns 403 when called by an institute', async () => {
    const { token } = await makeInstituteToken('cf1');
    const res = await request(app)
      .get('/api/recommendations/jobs/collaborative')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 200 with empty peers and similar when teacher has no applications', async () => {
    const { token } = await makeTeacherBundle('cf2');
    const res = await request(app)
      .get('/api/recommendations/jobs/collaborative')
      .set('Cookie', [`token=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.peers).toEqual([]);
    expect(res.body.data.similar).toEqual([]);
  });

  it('returns peer-recommended jobs ranked by co-application count', async () => {
    const { token: aliceToken, account: alice } = await makeTeacherBundle('cf3alice');
    const { account: bob } = await makeTeacherBundle('cf3bob');
    const { account: carol } = await makeTeacherBundle('cf3carol');
    const { token: instToken, account: inst } = await makeInstituteToken('cf3inst');

    // Create jobs
    const sharedJob = await makeJobForInstitute(inst.id, { title: 'Shared Job cf3' });
    const peerJobA = await makeJobForInstitute(inst.id, { title: 'Peer Job A cf3' });
    const peerJobB = await makeJobForInstitute(inst.id, { title: 'Peer Job B cf3' });

    const App = getApplication();
    // Alice applies to sharedJob
    await App.create({
      jobId: sharedJob._id, teacherId: alice.id, teacherName: alice.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });
    // Bob also applied to sharedJob (makes bob a peer of alice), and also applied to peerJobA + peerJobB
    await App.create({
      jobId: sharedJob._id, teacherId: bob.id, teacherName: bob.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });
    await App.create({
      jobId: peerJobA._id, teacherId: bob.id, teacherName: bob.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });
    await App.create({
      jobId: peerJobB._id, teacherId: bob.id, teacherName: bob.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });
    // Carol also applied to sharedJob (peer of alice) and peerJobA (adds score)
    await App.create({
      jobId: sharedJob._id, teacherId: carol.id, teacherName: carol.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });
    await App.create({
      jobId: peerJobA._id, teacherId: carol.id, teacherName: carol.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });

    const res = await request(app)
      .get('/api/recommendations/jobs/collaborative')
      .set('Cookie', [`token=${aliceToken}`]);

    expect(res.status).toBe(200);
    const peers = res.body.data.peers as Array<{ job: any; score: number; reason: string }>;
    expect(peers.length).toBeGreaterThan(0);
    // peerJobA should rank higher (2 peers applied) than peerJobB (1 peer applied)
    const titles = peers.map(p => p.job.title);
    const idxA = titles.indexOf('Peer Job A cf3');
    const idxB = titles.indexOf('Peer Job B cf3');
    expect(idxA).not.toBe(-1);
    expect(idxB).not.toBe(-1);
    expect(idxA).toBeLessThan(idxB);
    // reason field should be 'peers'
    expect(peers[0].reason).toBe('peers');
  });

  it('similar list returns jobs sharing subjects and excludes already-applied jobs', async () => {
    const { token: aliceToken, account: alice } = await makeTeacherBundle('cf4alice');
    const { token: instToken, account: inst } = await makeInstituteToken('cf4inst');

    // Job alice applied to (Math)
    const appliedJob = await makeJobForInstitute(inst.id, { title: 'Applied Math cf4', subjects: ['Math'], department: 'Mathematics' });
    // Similar job (shares Math subject) — should appear in similar list
    const similarJob = await makeJobForInstitute(inst.id, { title: 'Similar Math cf4', subjects: ['Math'], department: 'Mathematics' });
    // Unrelated job (Physics) — should NOT appear
    const unrelatedJob = await makeJobForInstitute(inst.id, { title: 'Unrelated Physics cf4', subjects: ['Physics'], department: 'Physics' });

    // Alice applies to appliedJob only
    const App2 = getApplication();
    await App2.create({
      jobId: appliedJob._id, teacherId: alice.id, teacherName: alice.name,
      instituteId: inst.id, instituteName: 'Collab School', coverLetter: 'Hello',
    });

    const res = await request(app)
      .get('/api/recommendations/jobs/collaborative')
      .set('Cookie', [`token=${aliceToken}`]);

    expect(res.status).toBe(200);
    const similar = res.body.data.similar as Array<{ job: any; score: number; reason: string }>;
    const titles = similar.map(s => s.job.title);
    // Similar Math job should appear
    expect(titles).toContain('Similar Math cf4');
    // Already-applied job should NOT appear
    expect(titles).not.toContain('Applied Math cf4');
    // reason should be 'similar'
    const item = similar.find(s => s.job.title === 'Similar Math cf4');
    expect(item?.reason).toBe('similar');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/recommendations/jobs/collaborative');
    expect(res.status).toBe(401);
  });
});
