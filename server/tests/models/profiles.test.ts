import { describe, it, expect } from 'vitest';
import Account from '../../models/Account.js';
import InstituteProfile from '../../models/InstituteProfile.js';
import TeacherProfile from '../../models/TeacherProfile.js';
import VendorProfile from '../../models/VendorProfile.js';
import StaffProfile from '../../models/StaffProfile.js';

async function makeAccount(role: string = 'institute') {
  return Account.create({
    name: 'X',
    email: `x-${Date.now()}-${Math.random()}@e.com`,
    password: 'pwpwpw',
    role,
  });
}

describe('Profile models', () => {
  describe('InstituteProfile', () => {
    it('creates and links to Account by accountId', async () => {
      const a = await makeAccount('institute');
      const p = await InstituteProfile.create({
        accountId: a._id,
        instituteName: 'Demo School',
        contactPerson: 'A. Sharma',
        instituteSearchability: true,
        address: { street: '1 St', city: 'BLR', state: 'KA', pincode: '560001', country: 'India' },
      });
      expect(String(p.accountId)).toBe(String(a._id));
    });

    it('enforces unique accountId', async () => {
      const a = await makeAccount('institute');
      await InstituteProfile.create({
        accountId: a._id, instituteName: 'A',
        address: { street: '1', city: 'X', state: 'Y', pincode: '1', country: 'India' },
      });
      await expect(
        InstituteProfile.create({
          accountId: a._id, instituteName: 'B',
          address: { street: '2', city: 'X', state: 'Y', pincode: '1', country: 'India' },
        })
      ).rejects.toThrow();
    });
  });

  describe('TeacherProfile', () => {
    it('creates with qualifications and subjects', async () => {
      const a = await makeAccount('teacher');
      const p = await TeacherProfile.create({
        accountId: a._id,
        experience: 5,
        qualifications: ['M.Sc.', 'B.Ed.'],
        subjects: ['Math', 'Physics'],
        isAvailable: true,
      });
      expect(p.qualifications).toContain('M.Sc.');
      expect(p.subjects).toContain('Math');
    });
  });

  describe('VendorProfile', () => {
    it('creates with business fields', async () => {
      const a = await makeAccount('vendor');
      const p = await VendorProfile.create({
        accountId: a._id,
        businessName: 'Acme Books',
        contactPerson: 'V. Mehta',
        phone: '+91...',
      });
      expect(p.businessName).toBe('Acme Books');
    });
  });

  describe('StaffProfile', () => {
    it('creates with employeeId', async () => {
      const a = await makeAccount('admin');
      const p = await StaffProfile.create({
        accountId: a._id, employeeId: 'EMP-001', department: 'Platform',
      });
      expect(p.employeeId).toBe('EMP-001');
    });

    it('enforces unique employeeId (sparse)', async () => {
      const a1 = await makeAccount('admin');
      const a2 = await makeAccount('marketing');
      await StaffProfile.create({ accountId: a1._id, employeeId: 'EMP-DUP' });
      await expect(
        StaffProfile.create({ accountId: a2._id, employeeId: 'EMP-DUP' })
      ).rejects.toThrow();
    });
  });
});
