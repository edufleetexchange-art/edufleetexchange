import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import authRoutes from '../../routes/auth.js';
import * as authService from '../../services/authService.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';

let app: express.Express;

beforeEach(async () => {
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  await SubscriptionPlan.create({
    name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
    features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    isActive: true,
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 with generic message even for non-existent email (anti-enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 and stores a token for an existing email', async () => {
    await authService.signupInstitute({
      name: 'X', email: 'pwreset@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'pwreset@e.com' });
    expect(res.status).toBe(200);
    // Verify token was created
    const { default: PasswordResetToken } = await import('../../models/PasswordResetToken.js');
    const count = await PasswordResetToken.countDocuments({});
    expect(count).toBe(1);
  });

  it('returns 400 with no email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('resets password with a valid token', async () => {
    await authService.signupInstitute({
      name: 'X', email: 'reset@e.com', password: 'oldpw1',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    // Generate token directly via service
    const { createResetToken } = await import('../../services/passwordResetService.js');
    const result = await createResetToken('reset@e.com');
    expect(result).toBeTruthy();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: result!.rawToken, newPassword: 'newpw1' });
    expect(res.status).toBe(200);
    // Verify new password works
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'reset@e.com', password: 'newpw1' });
    expect(loginRes.status).toBe(200);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'invalid', newPassword: 'newpw1' });
    expect(res.status).toBe(400);
  });

  it('rejects a too-short password', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'whatever', newPassword: 'x' });
    expect(res.status).toBe(400);
  });
});
