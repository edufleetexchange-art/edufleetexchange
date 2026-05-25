import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../config/index.js';

const COLLECTIONS_TO_TRUNCATE = [
  'accounts',
  'instituteprofiles',
  'teacherprofiles',
  'vendorprofiles',
  'staffprofiles',
  'subscriptions',
  'vehicles',
  'jobs',
  'suppliers',
  'applications',
  'notifications',
  'ads',
  'leads',
  'tasks',
  'activities',
  'auditlogs',
  'subscriptionrequests',
];

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');
  for (const name of COLLECTIONS_TO_TRUNCATE) {
    try {
      const result = await db.collection(name).deleteMany({});
      console.log(`✓ truncated ${name} (${result.deletedCount} docs)`);
    } catch (e) {
      console.warn(`! could not truncate ${name}`, e);
    }
  }
  await disconnectDB();
  console.log('✓ reset complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
