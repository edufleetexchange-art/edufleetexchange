import { describe, it, expect, beforeEach } from 'vitest';
import Account from '../../models/Account.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import TeacherProfile from '../../models/TeacherProfile.js';
import VendorProfile from '../../models/VendorProfile.js';
import StaffProfile from '../../models/StaffProfile.js';
import Subscription from '../../models/Subscription.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';

async function seedFreePlans() {
  await SubscriptionPlan.create([
    { name: 'inst-free', displayName: 'I', planType: 'institute', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 100, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'teach-free', displayName: 'T', planType: 'teacher', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
    { name: 'vend-free', displayName: 'V', planType: 'vendor', description: 'd', price: 0, duration: 30,
      features: { maxBrowsesPerMonth: 50, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }, isActive: true },
  ]);
}

describe('authService.adminCreate* — produces Account + Profile + Subscription atomically', () => {
  beforeEach(seedFreePlans);

  it('adminCreateInstitute creates all three docs', async () => {
    const b = await authService.adminCreateInstitute({
      name: 'X', email: 'inst-admin@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    expect(b.account.email).toBe('inst-admin@e.com');
    expect((b.profile as any).instituteName).toBe('X');
    expect(b.subscription.status).toBe('active');
    expect(await InstituteProfile.countDocuments({ accountId: b.account.id })).toBe(1);
  });

  it('adminCreateTeacher creates all three docs', async () => {
    const b = await authService.adminCreateTeacher({
      name: 'T', email: 't-admin@e.com', password: 'pwpwpw',
      experience: 5, qualifications: [], subjects: ['Math'],
    });
    expect(await TeacherProfile.countDocuments({ accountId: b.account.id })).toBe(1);
  });

  it('adminCreateVendor creates all three docs', async () => {
    const b = await authService.adminCreateVendor({
      name: 'V', email: 'v-admin@e.com', password: 'pwpwpw',
      businessName: 'Acme',
    });
    expect(await VendorProfile.countDocuments({ accountId: b.account.id })).toBe(1);
  });

  it('adminCreateStaff creates Account + StaffProfile (no subscription)', async () => {
    const b = await authService.adminCreateStaff({
      name: 'A', email: 'a-admin@e.com', password: 'pwpwpw',
      role: 'admin', employeeId: 'EMP-X1', department: 'Platform',
    });
    expect(b.account.role).toBe('admin');
    expect(await StaffProfile.countDocuments({ accountId: b.account.id })).toBe(1);
    expect(await Subscription.countDocuments({ accountId: b.account.id })).toBe(0);
  });

  it('rolls back all docs on duplicate email', async () => {
    await authService.adminCreateInstitute({
      name: 'X', email: 'rb@e.com', password: 'pwpwpw',
      instituteName: 'X', address: { street: '1', city: 'BLR', state: 'KA', pincode: '1', country: 'India' },
    });
    await expect(
      authService.adminCreateInstitute({
        name: 'Y', email: 'rb@e.com', password: 'pwpwpw',
        instituteName: 'Y', address: { street: '2', city: 'BLR', state: 'KA', pincode: '2', country: 'India' },
      })
    ).rejects.toThrow();
    expect(await Account.countDocuments({})).toBe(1);
    expect(await InstituteProfile.countDocuments({})).toBe(1);
    expect(await Subscription.countDocuments({})).toBe(1);
  });
});
