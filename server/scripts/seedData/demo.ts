import 'dotenv/config';
import { connectDB, disconnectDB } from '../../config/index.js';
import Account from '../../models/Account.js';
import Job from '../../models/Job.js';
import Vehicle from '../../models/Vehicle.js';
import Supplier from '../../models/Supplier.js';
import Application from '../../models/Application.js';
import ConsultantRoster from '../../models/ConsultantRoster.js';
import Placement from '../../models/Placement.js';

/**
 * Cross-area DEMO data seeder — populates jobs, vehicles, suppliers,
 * applications, roster and a placement so EVERY persona has populated screens
 * to test. Run AFTER `npm run seed` (which creates plans + the persona
 * accounts). Idempotent: skips if demo jobs already exist.
 *
 * DEV/DEMO ONLY — these reference the demo `@edufleet.test` accounts. Never run
 * against production.
 */
async function run() {
  await connectDB();
  try {
    const institute = await Account.findOne({ email: 'institute1@edufleet.test' });
    const teacher = await Account.findOne({ email: 'teacher1@edufleet.test' });
    const vendor = await Account.findOne({ email: 'vendor1@edufleet.test' });
    const consultant = await Account.findOne({ email: 'consultant1@edufleet.test' });

    if (!institute || !teacher || !vendor || !consultant) {
      console.error('✗ Persona accounts missing. Run `npm run seed` first.');
      return;
    }

    if (await Job.findOne({ instituteId: institute._id })) {
      console.log('✓ Demo cross-area data already present — skipping.');
      return;
    }

    const city = { city: 'Mysuru', state: 'Karnataka', country: 'India' };

    // ── Jobs (institute) ─────────────────────────────────────────────
    const jobs = await Job.create([
      {
        title: 'PGT Mathematics', instituteName: 'Demo School', department: 'Mathematics',
        location: city, subjects: ['Maths'], experience: { min: 3, max: 8 },
        salary: { min: 35000, max: 55000, currency: 'INR' }, qualification: ['B.Ed', 'M.Sc'],
        employmentType: 'full-time', description: 'Teach Maths for grades 9-12 (CBSE).',
        contactEmail: institute.email, instituteId: institute._id, status: 'active',
      },
      {
        title: 'TGT Science', instituteName: 'Demo School', department: 'Science',
        location: city, subjects: ['Science', 'Physics'], experience: { min: 2, max: 6 },
        salary: { min: 28000, max: 42000, currency: 'INR' }, qualification: ['B.Ed', 'B.Sc'],
        employmentType: 'full-time', description: 'Science teacher for middle school.',
        contactEmail: institute.email, instituteId: institute._id, status: 'active',
      },
      {
        title: 'Primary English Teacher', instituteName: 'Demo School', department: 'English',
        location: city, subjects: ['English'], experience: { min: 1, max: 5 },
        salary: { min: 22000, max: 32000, currency: 'INR' }, qualification: ['D.El.Ed', 'B.A'],
        employmentType: 'part-time', description: 'Primary English, grades 1-5.',
        contactEmail: institute.email, instituteId: institute._id, status: 'active',
      },
    ]);

    // ── Applications (teacher → jobs) ────────────────────────────────
    await Application.create([
      {
        jobId: jobs[0]._id, teacherId: teacher._id, teacherName: teacher.name,
        instituteId: institute._id, instituteName: 'Demo School',
        coverLetter: 'I have 5 years teaching CBSE Maths and would love to join.',
        status: 'pending', appliedDate: new Date(),
      },
      {
        jobId: jobs[1]._id, teacherId: teacher._id, teacherName: teacher.name,
        instituteId: institute._id, instituteName: 'Demo School',
        coverLetter: 'Experienced science teacher, available immediately.',
        status: 'shortlisted', appliedDate: new Date(),
      },
    ]);
    await Job.updateOne({ _id: jobs[0]._id }, { $inc: { applicationsCount: 1 } });
    await Job.updateOne({ _id: jobs[1]._id }, { $inc: { applicationsCount: 1 } });

    // ── Vehicles (institute as seller) ───────────────────────────────
    await Vehicle.create([
      {
        title: '40-seater School Bus', manufacturer: 'Tata', vehicleModel: 'Starbus',
        year: 2019, type: 'school-bus', price: 850000, registrationNumber: 'KA09AB1234',
        mileage: 60000, condition: 'good', images: ['https://via.placeholder.com/800x400'],
        description: 'Well-maintained 40-seater, fitness valid.', sellerId: institute._id,
        sellerName: 'Demo School', sellerEmail: institute.email, sellerPhone: institute.phone,
        status: 'approved',
      },
      {
        title: '18-seater Minibus', manufacturer: 'Force', vehicleModel: 'Traveller',
        year: 2021, type: 'minibus', price: 1200000, registrationNumber: 'KA09CD5678',
        mileage: 30000, condition: 'excellent', images: ['https://via.placeholder.com/800x400'],
        description: 'Low mileage minibus for school trips.', sellerId: institute._id,
        sellerName: 'Demo School', sellerEmail: institute.email, sellerPhone: institute.phone,
        status: 'approved',
      },
    ]);

    // ── Suppliers (vendor) ───────────────────────────────────────────
    await Supplier.create([
      {
        name: 'Acme Books & Stationery', category: 'books',
        description: 'Textbooks and notebooks for K-12 schools across Karnataka.',
        services: ['Textbooks', 'Notebooks', 'Stationery'], contactPerson: 'Acme Books',
        email: vendor.email, phone: vendor.phone || '+91 1234567892',
        address: { street: 'Sayyaji Rao Rd', city: 'Mysuru', state: 'Karnataka', pincode: '570001', country: 'India' },
        status: 'approved', createdBy: vendor._id,
      },
      {
        name: 'BrightLab Equipment', category: 'lab-equipment',
        description: 'Science lab equipment and consumables.',
        services: ['Lab setup', 'Consumables'], contactPerson: 'Acme Books',
        email: vendor.email, phone: vendor.phone || '+91 1234567892',
        address: { street: 'Sayyaji Rao Rd', city: 'Mysuru', state: 'Karnataka', pincode: '570001', country: 'India' },
        status: 'pending', createdBy: vendor._id,
      },
    ]);

    // ── Consultant: roster + a placement ─────────────────────────────
    await ConsultantRoster.create({
      consultantAccountId: consultant._id, entityType: 'teacher',
      entityAccountId: teacher._id, status: 'active', tags: ['maths', 'cbse'],
    });
    await Placement.create({
      consultantAccountId: consultant._id, teacherAccountId: teacher._id,
      jobId: jobs[0]._id, stage: 'proposed',
      stageHistory: [{ stage: 'proposed', changedAt: new Date() }],
    });

    console.log('✓ Demo cross-area data seeded: 3 jobs, 2 applications, 2 vehicles, 2 suppliers, 1 roster entry, 1 placement.');
  } finally {
    await disconnectDB();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
