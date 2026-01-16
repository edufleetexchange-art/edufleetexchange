import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { vehiclesData } from './seedData/vehicles.js';
import { usersData, userCredentials } from './seedData/users.js';
import { jobsData } from './seedData/jobs.js';
import { suppliersData } from './seedData/suppliers.js';
import { subscriptionPlansData, sampleNotificationsData } from './seedData/subscriptions.js';
import { adsData } from './seedData/ads.js';
import { applicationsData } from './seedData/applications.js';

// Models
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
import Application from '../models/Application.js';
import Supplier from '../models/Supplier.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Notification from '../models/Notification.js';
import { Ad } from '../models/Ad.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edufleet';

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

// Color console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.cyan}${colors.bright}━━━ ${msg} ━━━${colors.reset}`),
};

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    log.success('Connected to MongoDB');
  } catch (error) {
    log.error(`MongoDB connection error: ${error}`);
    process.exit(1);
  }
}

// Clear all collections
async function clearDatabase() {
  log.section('Clearing Database');
  try {
    await User.deleteMany({});
    log.info('Cleared Users collection');
    
    await Vehicle.deleteMany({});
    log.info('Cleared Vehicles collection');
    
    await Job.deleteMany({});
    log.info('Cleared Jobs collection');
    
    await Application.deleteMany({});
    log.info('Cleared Applications collection');
    
    await Supplier.deleteMany({});
    log.info('Cleared Suppliers collection');
    
    await SubscriptionPlan.deleteMany({});
    log.info('Cleared SubscriptionPlans collection');
    
    await Notification.deleteMany({});
    log.info('Cleared Notifications collection');

    await Ad.deleteMany({});
    log.info('Cleared Ads collection');
    
    log.success('Database cleared successfully');
  } catch (error) {
    log.error(`Error clearing database: ${error}`);
    throw error;
  }
}

// Seed users
async function seedUsers() {
  log.section('Seeding Users');
  try {
    const users = await User.insertMany(usersData);
    log.success(`Created ${users.length} users`);
    log.info(`- ${users.filter(u => u.role === 'admin').length} admin users`);
    log.info(`- ${users.filter(u => u.role === 'institute').length} institute users`);
    log.info(`- ${users.filter(u => u.role === 'teacher').length} teacher users`);
    return users;
  } catch (error) {
    log.error(`Error seeding users: ${error}`);
    throw error;
  }
}

// Seed subscription plans
async function seedSubscriptionPlans() {
  log.section('Seeding Subscription Plans');
  try {
    // Validate subscription data before inserting
    if (!subscriptionPlansData || !Array.isArray(subscriptionPlansData) || subscriptionPlansData.length === 0) {
      throw new Error('subscriptionPlansData is empty or not properly loaded. Check imports.');
    }
    
    // Log the first plan for debugging
    log.info(`Loaded ${subscriptionPlansData.length} subscription plan(s) from seed data`);
    if (subscriptionPlansData[0]) {
      log.info(`First plan: ${subscriptionPlansData[0].name || 'NO NAME'}`);
    }
    
    // Validate each plan has required fields before inserting
    for (const plan of subscriptionPlansData) {
      const isInvalid = !plan.name || 
                        !plan.displayName || 
                        !plan.description || 
                        plan.price === undefined || 
                        plan.duration === undefined || 
                        !plan.features ||
                        plan.features.maxListings === undefined || 
                        plan.features.maxBrowsesPerMonth === undefined;

      if (isInvalid) {
        log.error(`Invalid plan data detected: ${JSON.stringify(plan, null, 2)}`);
        throw new Error(`Plan missing required fields: ${plan.name || 'UNKNOWN'}`);
      }
    }
    
    const plans = await SubscriptionPlan.insertMany(subscriptionPlansData);
    log.success(`Created ${plans.length} subscription plans`);
    plans.forEach(plan => {
      log.info(`- ${plan.displayName} (₹${plan.price}/month)`);
    });
    return plans;
  } catch (error) {
    log.error(`Error seeding subscription plans: ${error}`);
    throw error;
  }
}

// Seed vehicles
async function seedVehicles(users: any[]) {
  log.section('Seeding Vehicles');
  try {
    const institutes = users.filter(u => u.role === 'institute');
    
    const vehiclesWithSellers = vehiclesData.map((vehicle, index) => {
      const institute = institutes[index % institutes.length];
      return {
        ...vehicle,
        sellerId: institute._id,
        sellerName: institute.instituteName,
        sellerEmail: institute.email,
        sellerPhone: institute.phone || '+91-9999999999',
      };
    });
    
    const vehicles = await Vehicle.insertMany(vehiclesWithSellers);
    log.success(`Created ${vehicles.length} vehicle listings`);
    log.info(`- ${vehicles.filter(v => v.status === 'approved').length} approved`);
    log.info(`- ${vehicles.filter(v => v.status === 'pending').length} pending approval`);
    log.info(`- ${vehicles.filter(v => v.isPriority).length} priority listings`);
    return vehicles;
  } catch (error) {
    log.error(`Error seeding vehicles: ${error}`);
    throw error;
  }
}

// Seed jobs
async function seedJobs(users: any[]) {
  log.section('Seeding Job Listings');
  try {
    const institutes = users.filter(u => u.role === 'institute');
    
    const jobsWithInstitutes = jobsData.map((job, index) => {
      const institute = institutes[index % institutes.length];
      return {
        ...job,
        instituteId: institute._id,
        instituteName: job.instituteName || institute.instituteName,
      };
    });
    
    const jobs = await Job.insertMany(jobsWithInstitutes);
    log.success(`Created ${jobs.length} job listings`);
    log.info(`- ${jobs.filter(j => j.status === 'active').length} active jobs`);
    log.info(`- ${jobs.filter(j => j.employmentType === 'full-time').length} full-time positions`);
    log.info(`- ${jobs.filter(j => j.employmentType === 'part-time').length} part-time positions`);
    return jobs;
  } catch (error) {
    log.error(`Error seeding jobs: ${error}`);
    throw error;
  }
}

// Seed job applications
async function seedJobApplications(users: any[], jobs: any[]) {
  log.section('Seeding Job Applications (Enhanced)');
  try {
    const teachers = users.filter(u => u.role === 'teacher');
    const applications = [];
    
    // Use enhanced seed data with real cover letters
    for (let i = 0; i < Math.min(applicationsData.length, jobs.length * 2); i++) {
      const appData = applicationsData[i];
      const teacher = teachers[i % teachers.length];
      const job = jobs[i % jobs.length];
      
      // Get job institute details
      const jobInstitute = users.find(u => u._id.equals(job.instituteId));
      
      applications.push({
        jobId: job._id,
        teacherId: teacher._id,
        teacherName: teacher.name || appData.teacherName,
        instituteId: job.instituteId,
        instituteName: jobInstitute?.instituteName || job.instituteName,
        coverLetter: appData.coverLetter,
        status: appData.status,
        appliedDate: appData.appliedDate,
        updatedAt: appData.updatedAt,
      });
    }
    
    const createdApplications = await Application.insertMany(applications);
    
    // Update job application counts
    for (const job of jobs) {
      const count = createdApplications.filter(a => a.jobId.equals(job._id)).length;
      await Job.findByIdAndUpdate(job._id, { applicationsCount: count });
    }
    
    log.success(`Created ${createdApplications.length} job applications`);
    log.info(`- ${createdApplications.filter(a => a.status === 'pending').length} pending`);
    log.info(`- ${createdApplications.filter(a => a.status === 'reviewed').length} reviewed`);
    log.info(`- ${createdApplications.filter(a => a.status === 'shortlisted').length} shortlisted`);
    return createdApplications;
  } catch (error) {
    log.error(`Error seeding job applications: ${error}`);
    throw error;
  }
}

// Seed suppliers
async function seedSuppliers(users: any[]) {
  log.section('Seeding Suppliers');
  try {
    const admin = users.find(u => u.role === 'admin');
    if (!admin) {
      throw new Error('Admin user not found. Cannot seed suppliers without createdBy field.');
    }

    const suppliersWithCreator = suppliersData.map(supplier => ({
      ...supplier,
      createdBy: admin._id
    }));

    const suppliers = await Supplier.insertMany(suppliersWithCreator);
    log.success(`Created ${suppliers.length} supplier listings`);
    log.info(`- ${suppliers.filter(s => s.status === 'approved').length} approved`);
    log.info(`- ${suppliers.filter(s => s.status === 'pending').length} pending approval`);
    log.info(`- ${suppliers.filter(s => s.isVerified).length} verified suppliers`);
    return suppliers;
  } catch (error) {
    log.error(`Error seeding suppliers: ${error}`);
    throw error;
  }
}

// Seed notifications
async function seedNotifications(users: any[], vehicles: any[]) {
  log.section('Seeding Notifications');
  try {
    const institutes = users.filter(u => u.role === 'institute');
    const notifications = [];
    
    // Welcome notifications for all institutes
    for (const institute of institutes) {
      notifications.push({
        userId: institute._id,
        type: 'new_feature',
        title: 'Welcome to EduFleet Exchange!',
        message: `Welcome ${institute.instituteName}! Start browsing vehicles or list your own.`,
        isRead: false,
        priority: 'low',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });
    }
    
    // Listing approved notifications
    const approvedVehicles = vehicles.filter(v => v.status === 'approved').slice(0, 5);
    for (const vehicle of approvedVehicles) {
      notifications.push({
        userId: vehicle.sellerId,
        type: 'listing_approved',
        entityId: vehicle._id,
        entityType: 'vehicle',
        title: 'Vehicle Listing Approved',
        message: `Your vehicle listing "${vehicle.title}" has been approved and is now live.`,
        isRead: Math.random() > 0.5,
        priority: 'medium',
        actionUrl: `/vehicle/${vehicle._id}`,
        createdAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000),
      });
    }
    
    // Browse limit warnings for some users
    for (let i = 0; i < Math.min(3, institutes.length); i++) {
      notifications.push({
        userId: institutes[i]._id,
        type: 'browse_limit_warning',
        title: 'Browse Limit Warning',
        message: 'You have used 8 out of 10 vehicle detail views this month.',
        isRead: false,
        priority: 'medium',
        actionUrl: '/dashboard',
        createdAt: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000),
      });
    }
    
    const createdNotifications = await Notification.insertMany(notifications);
    log.success(`Created ${createdNotifications.length} notifications`);
    log.info(`- ${createdNotifications.filter((n: any) => !n.isRead).length} unread`);
    log.info(`- ${createdNotifications.filter((n: any) => n.isRead).length} read`);
    return createdNotifications;
  } catch (error) {
    log.error(`Error seeding notifications: ${error}`);
    throw error;
  }
}

// Seed ads
async function seedAds() {
  log.section('Seeding Ads');
  try {
    // Sanitize data before insertion
    const sanitizedAds = adsData.map(sanitizeAd);
    const ads = await Ad.insertMany(sanitizedAds);
    log.success(`Created ${ads.length} ads`);
    log.info(`- ${ads.filter(a => a.status === 'active').length} active ads`);
    log.info(`- ${ads.filter(a => a.status === 'pending').length} pending ads`);
    return ads;
  } catch (error) {
    log.error(`Error seeding ads: ${error}`);
    throw error;
  }
}

// Display credentials
function displayCredentials() {
  log.section('Login Credentials');
  
  console.log(`\n${colors.bright}Admin Access:${colors.reset}`);
  console.log(`Email: ${colors.yellow}${userCredentials.admin.email}${colors.reset}`);
  console.log(`Password: ${colors.yellow}${userCredentials.admin.password}${colors.reset}`);
  
  console.log(`\n${colors.bright}Support Admin:${colors.reset}`);
  console.log(`Email: ${colors.yellow}${userCredentials.support.email}${colors.reset}`);
  console.log(`Password: ${colors.yellow}${userCredentials.support.password}${colors.reset}`);
  
  console.log(`\n${colors.bright}Sample Institute:${colors.reset}`);
  console.log(`Email: ${colors.yellow}${userCredentials.institute.email}${colors.reset}`);
  console.log(`Password: ${colors.yellow}${userCredentials.institute.password}${colors.reset}`);
  
  console.log(`\n${colors.bright}Sample Teacher:${colors.reset}`);
  console.log(`Email: ${colors.yellow}${userCredentials.teacher.email}${colors.reset}`);
  console.log(`Password: ${colors.yellow}${userCredentials.teacher.password}${colors.reset}`);
  
  console.log(`\n${colors.cyan}Note: All institute and teacher accounts use the same password for demo purposes.${colors.reset}`);
}

// Main seed function
async function seed() {
  try {
    console.log(`\n${colors.bright}${colors.magenta}╔═══════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}║   EduFleet Exchange - Enhanced Database Seed v2.0      ║${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}╚═══════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    await connectDB();
    await clearDatabase();
    
    const users = await seedUsers();
    const plans = await seedSubscriptionPlans();
    const ads = await seedAds();
    const vehicles = await seedVehicles(users);
    const jobs = await seedJobs(users);
    const applications = await seedJobApplications(users, jobs);
    const suppliers = await seedSuppliers(users);
    const notifications = await seedNotifications(users, vehicles);
    
    log.section('Summary');
    console.log(`
${colors.green}✓ Users:${colors.reset}            ${users.length}
${colors.green}✓ Plans:${colors.reset}            ${plans.length}
${colors.green}✓ Ads:${colors.reset}              ${ads.length}
${colors.green}✓ Vehicles:${colors.reset}         ${vehicles.length}
${colors.green}✓ Jobs:${colors.reset}             ${jobs.length}
${colors.green}✓ Applications:${colors.reset}     ${applications.length}
${colors.green}✓ Suppliers:${colors.reset}        ${suppliers.length}
${colors.green}✓ Notifications:${colors.reset}    ${notifications.length}
    `);
    
    displayCredentials();
    
    log.section('Seeding Complete');
    log.success('Database seeded successfully! 🎉');
    
  } catch (error) {
    log.error(`Seeding failed: ${error}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    log.info('Database connection closed');
    process.exit(0);
  }
}

// Run seed
seed();