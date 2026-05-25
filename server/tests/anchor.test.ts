import { describe, it, expect } from 'vitest';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import * as authService from '../services/authService.js';

describe('auth bundle shape (anchor)', () => {
  it('login response contract is { account, profile, subscription }', async () => {
    await SubscriptionPlan.create({
      name: 'inst-free',
      displayName: 'Institute Free',
      planType: 'institute',
      description: 'free',
      price: 0,
      duration: 30,
      features: {
        maxBrowsesPerMonth: 100,
        dataDelayDays: 0,
        instantAlerts: false,
        analytics: false,
        supportLevel: 'basic',
      },
      isActive: true,
    });
    await authService.signupInstitute({
      name: 'X',
      email: 'anchor@e.com',
      password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    const bundle = await authService.login('anchor@e.com', 'pwpwpw');
    expect(Object.keys(bundle).sort()).toEqual(['account', 'profile', 'subscription']);
  });
});
