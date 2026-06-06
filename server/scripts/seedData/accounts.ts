import 'dotenv/config';
import { connectDB, disconnectDB } from '../../config/index.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import * as authService from '../../services/authService.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';

const DEFAULT_PASSWORD = 'password123';

async function ensureFreePlans() {
  const planSpecs: Array<['institute' | 'teacher' | 'vendor' | 'consultant', string, string]> = [
    ['institute',  'institute-free',  'Institute Free'],
    ['teacher',    'teacher-free',    'Teacher Free'],
    ['vendor',     'vendor-free',     'Vendor Free'],
    ['consultant', 'consultant-free', 'Consultant Free'],
  ];
  const featuresByType: Record<string, any> = {
    institute:  { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    teacher:    { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    vendor:     { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
    consultant: { maxBrowsesPerMonth: 200, maxRosterTeachers: 25, maxRosterInstitutes: 25, maxApplicationsPerMonth: 10, maxPlacementsPerMonth: 3, canViewTeacherContact: false, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' },
  };
  for (const [planType, name, displayName] of planSpecs) {
    const exists = await SubscriptionPlan.findOne({ name });
    if (exists) continue;
    await SubscriptionPlan.create({
      name, displayName, planType,
      description: `${displayName} plan`,
      price: 0, duration: 30,
      features: featuresByType[planType],
      isActive: true,
    });
    console.log(`✓ seeded plan ${name}`);
  }
}

async function exists(email: string) {
  return (await Account.findOne({ email })) != null;
}

async function seedExternalPersonas() {
  if (!await exists('institute1@edufleet.test')) {
    await authService.signupInstitute({
      name: 'Demo School', email: 'institute1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91 1234567890',
      instituteName: 'Demo Public School', contactPerson: 'A. Sharma',
      address: { street: '1 St', city: 'Bengaluru', state: 'KA', pincode: '560001', country: 'India' },
    });
    console.log('✓ seeded institute institute1@edufleet.test');
  }
  if (!await exists('teacher1@edufleet.test')) {
    await authService.signupTeacher({
      name: 'R. Kumar', email: 'teacher1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91 1234567891',
      experience: 5, qualifications: ['M.Sc.', 'B.Ed.'], subjects: ['Math', 'Physics'], isAvailable: true,
    });
    console.log('✓ seeded teacher teacher1@edufleet.test');
  }
  if (!await exists('vendor1@edufleet.test')) {
    await authService.signupVendor({
      name: 'Acme Books', email: 'vendor1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91 1234567892',
      businessName: 'Acme Books Pvt Ltd', contactPerson: 'V. Mehta',
    });
    console.log('✓ seeded vendor vendor1@edufleet.test');
  }
  if (!await exists('consultant1@edufleet.test')) {
    await authService.signupConsultant({
      name: 'P. Recruiter', email: 'consultant1@edufleet.test', password: DEFAULT_PASSWORD, phone: '+91 1234567893',
      agencyName: 'Bengaluru Education Partners',
      yearsOfExperience: 8,
      specializations: { subjects: ['Math', 'Science'], levels: ['Secondary'], regions: ['Bengaluru', 'Mysore'] },
      bio: 'Senior K-12 placement consultant.',
    });
    console.log('✓ seeded consultant consultant1@edufleet.test');
  }
}

async function seedStaffAccount(opts: { email: string; name: string; role: 'admin' | 'marketing' | 'sales'; employeeId: string; department: string }) {
  if (await exists(opts.email)) return;
  const account = await Account.create({
    name: opts.name, email: opts.email, password: DEFAULT_PASSWORD,
    role: opts.role, isActive: true, isVerified: true,
  });
  await StaffProfile.create({ accountId: account._id, employeeId: opts.employeeId, department: opts.department });
  console.log(`✓ seeded ${opts.role} ${opts.email}`);
}

async function main() {
  await connectDB();
  await ensureFreePlans();
  await seedExternalPersonas();
  await seedStaffAccount({ email: 'admin@edufleet.test',      name: 'Platform Admin', role: 'admin',     employeeId: 'EMP-001', department: 'Platform' });
  await seedStaffAccount({ email: 'marketing1@edufleet.test', name: 'M. Patel',       role: 'marketing', employeeId: 'EMP-010', department: 'Marketing' });
  await seedStaffAccount({ email: 'sales1@edufleet.test',     name: 'S. Rao',         role: 'sales',     employeeId: 'EMP-020', department: 'Sales' });
  await disconnectDB();
  console.log('✓ seed complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
