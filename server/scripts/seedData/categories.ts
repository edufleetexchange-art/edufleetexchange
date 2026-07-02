import 'dotenv/config';
import { connectDB, disconnectDB } from '../../config/index.js';
import Category from '../../models/Category.js';

/**
 * Seeds the baseline job / vehicle / supplier categories used to populate the
 * public filter dropdowns. Idempotent per {slug,type} (upsert). Safe for any
 * environment — no accounts or listings are touched.
 */
const CATEGORIES: Array<{ name: string; type: 'vehicle' | 'job' | 'supplier'; order: number }> = [
  // Job categories
  { name: 'PRT (Primary)', type: 'job', order: 1 },
  { name: 'TGT (Trained Graduate)', type: 'job', order: 2 },
  { name: 'PGT (Post Graduate)', type: 'job', order: 3 },
  { name: 'Administrative', type: 'job', order: 4 },
  { name: 'Support Staff', type: 'job', order: 5 },
  { name: 'Sports & Activities', type: 'job', order: 6 },

  // Vehicle categories
  { name: 'School Bus (40+ seater)', type: 'vehicle', order: 1 },
  { name: 'Mini Bus (20-30 seater)', type: 'vehicle', order: 2 },
  { name: 'Van (10-15 seater)', type: 'vehicle', order: 3 },
  { name: 'Tempo Traveller', type: 'vehicle', order: 4 },
  { name: 'Car (Staff transport)', type: 'vehicle', order: 5 },

  // Supplier categories
  { name: 'Stationery & Books', type: 'supplier', order: 1 },
  { name: 'Uniforms', type: 'supplier', order: 2 },
  { name: 'Lab Equipment', type: 'supplier', order: 3 },
  { name: 'Furniture', type: 'supplier', order: 4 },
  { name: 'IT & Electronics', type: 'supplier', order: 5 },
  { name: 'Sports Equipment', type: 'supplier', order: 6 },
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function run() {
  await connectDB();
  try {
    let upserted = 0;
    for (const c of CATEGORIES) {
      const slug = slugify(c.name);
      await Category.updateOne(
        { slug, type: c.type },
        { $set: { name: c.name, slug, type: c.type, order: c.order, isActive: true } },
        { upsert: true }
      );
      upserted++;
    }
    console.log(`✓ categories upserted: ${upserted}`);
  } finally {
    await disconnectDB();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
