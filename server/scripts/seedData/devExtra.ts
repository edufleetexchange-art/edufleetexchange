import 'dotenv/config';
import { connectDB, disconnectDB } from '../../config/index.js';
import Account from '../../models/Account.js';
import Job from '../../models/Job.js';
import Alert from '../../models/Alert.js';
import * as authService from '../../services/authService.js';

/**
 * DEV enrichment — adds more teachers (varied subjects/locations), a couple more
 * jobs, and a live demand-alert → match so the alerts/notifications flow has
 * data to test. Idempotent per email/label. DEV ONLY.
 */
const TEACHERS = [
  { name: 'Priya N',   email: 'priya@dev.test',   subjects: ['Maths'],             experience: 6,  location: 'Mysuru' },
  { name: 'Ravi K',    email: 'ravi@dev.test',    subjects: ['Science', 'Physics'], experience: 4,  location: 'Mysuru' },
  { name: 'Anita R',   email: 'anita@dev.test',   subjects: ['English'],           experience: 8,  location: 'Bengaluru' },
  { name: 'Suresh M',  email: 'suresh@dev.test',  subjects: ['Social Studies'],    experience: 3,  location: 'Mysuru' },
  { name: 'Kavya S',   email: 'kavya@dev.test',   subjects: ['Computer Science'],  experience: 2,  location: 'Mysuru' },
  { name: 'Deepa H',   email: 'deepa@dev.test',   subjects: ['Hindi'],             experience: 5,  location: 'Mysuru' },
  { name: 'Manoj P',   email: 'manoj@dev.test',   subjects: ['Maths', 'Physics'],  experience: 10, location: 'Mandya' },
  { name: 'Lakshmi V', email: 'lakshmi@dev.test', subjects: ['Kannada'],           experience: 7,  location: 'Mysuru' },
];

async function run() {
  await connectDB();
  try {
    const institute = await Account.findOne({ email: 'institute1@edufleet.test' });
    if (!institute) { console.error('Run `npm run seed` first (no institute1).'); return; }

    let added = 0;
    for (const t of TEACHERS) {
      if (await Account.findOne({ email: t.email })) continue;
      await authService.signupTeacher({
        name: t.name, email: t.email, password: 'password123',
        experience: t.experience, qualifications: ['B.Ed'], subjects: t.subjects,
        location: t.location, isAvailable: true,
      });
      added++;
    }
    console.log(`✓ teachers added: ${added} (skipped existing)`);

    // A couple more jobs
    if (!(await Job.findOne({ title: 'PRT Computer Science', instituteId: institute._id }))) {
      await Job.create([
        {
          title: 'PRT Computer Science', instituteName: 'Demo School', department: 'Computer Science',
          location: { city: 'Mysuru', state: 'Karnataka', country: 'India' }, subjects: ['Computer Science'],
          experience: { min: 1, max: 5 }, salary: { min: 25000, max: 40000, currency: 'INR' },
          qualification: ['B.E', 'BCA'], employmentType: 'full-time',
          description: 'Computer teacher, grades 6-10.', contactEmail: institute.email,
          instituteId: institute._id, status: 'active',
        },
        {
          title: 'TGT Social Studies', instituteName: 'Demo School', department: 'Social Studies',
          location: { city: 'Mysuru', state: 'Karnataka', country: 'India' }, subjects: ['Social Studies'],
          experience: { min: 2, max: 7 }, salary: { min: 26000, max: 38000, currency: 'INR' },
          qualification: ['B.Ed', 'B.A'], employmentType: 'full-time',
          description: 'Social Studies teacher for middle school.', contactEmail: institute.email,
          instituteId: institute._id, status: 'active',
        },
      ]);
      console.log('✓ 2 more jobs added');
    }

    // A live demand alert, then a matching teacher signup → fan-out fires
    // (populates AlertMatch + notifications for the institute and the admin).
    const alertLabel = 'Maths teacher — Mysuru';
    if (!(await Alert.findOne({ accountId: institute._id, label: alertLabel }))) {
      await Alert.create({
        accountId: institute._id, createdByRole: 'institute', entityType: 'teacher',
        label: alertLabel, criteria: { subjects: ['Maths'], location: 'Mysuru' },
        channels: ['in_app'], status: 'active',
      });
      // New matching teacher AFTER the alert → triggers the notification.
      if (!(await Account.findOne({ email: 'newmaths@dev.test' }))) {
        await authService.signupTeacher({
          name: 'Vidya M', email: 'newmaths@dev.test', password: 'password123',
          experience: 5, qualifications: ['B.Ed', 'M.Sc'], subjects: ['Maths'],
          location: 'Mysuru', isAvailable: true,
        });
      }
      console.log('✓ demand alert created + matching teacher signed up (fan-out fired)');
    }

    console.log('✓ dev enrichment complete');
  } finally {
    await disconnectDB();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
