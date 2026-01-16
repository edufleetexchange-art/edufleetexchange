import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Ad } from '../models/Ad.js';
import { adsData } from './seedData/ads.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://edufleet-exchange:IZTSSecuHdkY7rww@cluster0.lpjvk8x.mongodb.net/EDUFLEET-EXCHANGE?retryWrites=true&w=majority&appName=EDUFLEET-EXCHANGE';

// Helper to sanitize ad data and fix validation errors
const sanitizeAd = (ad: any) => {
  let priority = ad.priority;
  
  // Fix priority if it's a string (e.g. "high" -> 10)
  if (typeof priority === 'string') {
    const p = priority.toLowerCase();
    if (p === 'high') priority = 10;
    else if (p === 'medium') priority = 5;
    else if (p === 'low') priority = 1;
    else priority = 5; // Default fallback
  }

  // Ensure priority is a number
  if (typeof priority !== 'number') {
    priority = 5;
  }

  // Map 'approved' status to 'active' to match Ad model enum
  let status = ad.status;
  if (status === 'approved') {
    status = 'active';
  }

  return {
    ...ad,
    priority,
    status,
    // Ensure required fields exist
    placement: ad.placement || 'LP_TOP_BANNER',
    targetUrl: ad.targetUrl || 'https://example.com',
    advertiser: ad.advertiser || 'Unknown Advertiser',
  };
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}${colors.bright}━━━ ${msg} ━━━${colors.reset}`),
};

async function seedAds() {
  try {
    log.section('Standalone Ad Seeding');
    
    log.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log.success('Connected to MongoDB');

    log.info('Clearing existing ads...');
    await Ad.deleteMany({});
    log.success('Cleared Ads collection');

    log.info(`Seeding ${adsData.length} ads...`);
    
    // Sanitize data before insertion
    const sanitizedAds = adsData.map(sanitizeAd);
    
    const createdAds = await Ad.insertMany(sanitizedAds);
    log.success(`Successfully seeded ${createdAds.length} ads`);

    log.info('Ad Summary:');
    console.log(`- Active: ${createdAds.filter(a => a.status === 'active').length}`);
    console.log(`- Pending: ${createdAds.filter(a => a.status === 'pending').length}`);
    console.log(`- Rejected: ${createdAds.filter(a => a.status === 'rejected').length}`);

  } catch (error) {
    log.error(`Seeding ads failed: ${error}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
    process.exit(0);
  }
}

seedAds();