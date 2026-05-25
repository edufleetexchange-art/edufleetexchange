import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';

async function seedPlan(planType: 'institute' | 'teacher' | 'vendor') {
  return SubscriptionPlan.create({
    name: `${planType}-free`,
    displayName: `${planType} free`,
    planType,
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
}

describe('authService.signupInstitute', () => {
  it('creates Account + InstituteProfile + Subscription in one transaction', async () => {
    await seedPlan('institute');
    const bundle = await authService.signupInstitute({
      name: 'Demo School', email: 'inst@e.com', password: 'pwpwpw', phone: '+91...',
      instituteName: 'Demo Public School', contactPerson: 'A',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
    });
    expect(bundle.account.email).toBe('inst@e.com');
    expect((bundle.profile as any).instituteName).toBe('Demo Public School');
    expect(bundle.subscription.status).toBe('active');
    expect(await Account.countDocuments({})).toBe(1);
    expect(await InstituteProfile.countDocuments({})).toBe(1);
    expect(await Subscription.countDocuments({})).toBe(1);
  });

  it('rejects duplicate email and leaves the original account intact', async () => {
    await seedPlan('institute');
    await authService.signupInstitute({
      name: 'A', email: 'dup@e.com', password: 'pwpwpw',
      instituteName: 'X',
      address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    await expect(
      authService.signupInstitute({
        name: 'B', email: 'dup@e.com', password: 'pwpwpw',
        instituteName: 'Y',
        address: { street: '2', city: 'BLR', state: 'KA', pincode: '2', country: 'India' },
      })
    ).rejects.toThrow();
    expect(await Account.countDocuments({})).toBe(1);
    expect(await InstituteProfile.countDocuments({})).toBe(1);
    expect(await Subscription.countDocuments({})).toBe(1);
  });
});

describe('authService.signupTeacher', () => {
  it('creates Account + TeacherProfile + Subscription', async () => {
    await seedPlan('teacher');
    const bundle = await authService.signupTeacher({
      name: 'T', email: 't@e.com', password: 'pwpwpw',
      experience: 5, qualifications: ['M.Sc.'], subjects: ['Math'], isAvailable: true,
    });
    expect(bundle.account.role).toBe('teacher');
    expect((bundle.profile as any).subjects).toContain('Math');
  });
});

describe('authService.signupVendor', () => {
  it('creates Account + VendorProfile + Subscription', async () => {
    await seedPlan('vendor');
    const bundle = await authService.signupVendor({
      name: 'V', email: 'v@e.com', password: 'pwpwpw',
      businessName: 'Acme', contactPerson: 'M',
    });
    expect(bundle.account.role).toBe('vendor');
    expect((bundle.profile as any).businessName).toBe('Acme');
  });
});

describe('authService.login', () => {
  it('returns the full bundle on valid credentials', async () => {
    await seedPlan('teacher');
    await authService.signupTeacher({
      name: 'T', email: 'login@e.com', password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    });
    const bundle = await authService.login('login@e.com', 'pwpwpw');
    expect(bundle.account.email).toBe('login@e.com');
    expect(bundle.profile).toBeTruthy();
    expect(bundle.subscription).toBeTruthy();
  });

  it('rejects bad password', async () => {
    await seedPlan('teacher');
    await authService.signupTeacher({
      name: 'T', email: 'bad@e.com', password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    });
    await expect(authService.login('bad@e.com', 'wrong-')).rejects.toThrow();
  });

  it('rejects inactive account', async () => {
    await seedPlan('teacher');
    const bundle = await authService.signupTeacher({
      name: 'T', email: 'off@e.com', password: 'pwpwpw',
      experience: 1, qualifications: [], subjects: ['Math'],
    });
    await Account.updateOne({ _id: bundle.account.id }, { isActive: false });
    await expect(authService.login('off@e.com', 'pwpwpw')).rejects.toThrow(/inactive/i);
  });
});

describe('authService.loadBundle', () => {
  it('loads bundle by accountId with profile matched to role', async () => {
    await seedPlan('teacher');
    const created = await authService.signupTeacher({
      name: 'T', email: 'b@e.com', password: 'pwpwpw',
      experience: 3, qualifications: [], subjects: ['Math'],
    });
    const bundle = await authService.loadBundle(String(created.account.id));
    expect(bundle.account.email).toBe('b@e.com');
    expect((bundle.profile as any).subjects).toContain('Math');
    expect(bundle.subscription.status).toBe('active');
  });
});
