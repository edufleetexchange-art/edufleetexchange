import 'dotenv/config';
import crypto from 'crypto';
import { connectDB, disconnectDB } from '../../config/index.js';
import SubscriptionPlan from '../../models/SubscriptionPlan.js';
import Account from '../../models/Account.js';
import StaffProfile from '../../models/StaffProfile.js';

/**
 * PRODUCTION seed — the MINIMUM a live DB needs to function:
 *   1. the free subscription plans (without these, signups fail), and
 *   2. ONE real admin account with a strong password.
 *
 * It does NOT create any demo `@edufleet.test` accounts (those use a public
 * password and must never exist in prod).
 *
 * Run against prod by overriding the DB inline, e.g.:
 *   MONGODB_URI='mongodb+srv://.../edu_fleet_prod' ADMIN_EMAIL='you@domain.com' \
 *     npx tsx scripts/seedData/prod.ts
 *
 * ADMIN_PASSWORD is optional — if omitted, a strong one is generated and printed
 * ONCE. Change it after first login.
 */

const FREE_PLANS: Array<['institute' | 'teacher' | 'vendor' | 'consultant', string, string, any]> = [
  ['institute', 'institute-free', 'Institute Free', { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }],
  ['teacher', 'teacher-free', 'Teacher Free', { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }],
  ['vendor', 'vendor-free', 'Vendor Free', { maxBrowsesPerMonth: 100, maxListings: 5, maxJobPosts: 3, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }],
  ['consultant', 'consultant-free', 'Consultant Free', { maxBrowsesPerMonth: 200, maxRosterTeachers: 25, maxRosterInstitutes: 25, maxApplicationsPerMonth: 10, maxPlacementsPerMonth: 3, canViewTeacherContact: false, dataDelayDays: 0, instantAlerts: false, analytics: false, supportLevel: 'basic' }],
];

function strongPassword(): string {
  return crypto.randomBytes(12).toString('base64url') + 'A9!';
}

async function run() {
  await connectDB();
  try {
    // 1) Free plans (idempotent)
    for (const [planType, name, displayName, features] of FREE_PLANS) {
      if (await SubscriptionPlan.findOne({ name })) continue;
      await SubscriptionPlan.create({ name, displayName, planType, description: `${displayName} plan`, price: 0, duration: 30, features, isActive: true });
      console.log(`✓ plan ${name}`);
    }

    // 2) One admin
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@edufleetexchange.com').toLowerCase().trim();
    if (await Account.findOne({ email: adminEmail })) {
      console.log(`✓ admin ${adminEmail} already exists — left unchanged.`);
    } else {
      const password = process.env.ADMIN_PASSWORD || strongPassword();
      const account = await Account.create({ name: 'Platform Admin', email: adminEmail, password, role: 'admin', isActive: true, isVerified: true });
      await StaffProfile.create({ accountId: account._id, employeeId: 'EMP-001', department: 'Platform' });
      console.log('✓ admin created');
      console.log('  ─────────────────────────────────────────────');
      console.log(`   EMAIL:    ${adminEmail}`);
      console.log(`   PASSWORD: ${password}`);
      console.log('   ^ save this now and change it after first login');
      console.log('  ─────────────────────────────────────────────');
    }
  } finally {
    await disconnectDB();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
