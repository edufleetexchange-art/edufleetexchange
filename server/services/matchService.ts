import mongoose from 'mongoose';
import type { IJob } from '../models/Job.js';
import type { ITeacherProfile } from '../models/TeacherProfile.js';
import type { IApplication } from '../models/Application.js';

// Use mongoose.models to look up pre-registered models instead of importing the model files
// directly. This avoids Mongoose's OverwriteModelError in test environments where Vitest
// isolates ES module caches per test file but all files share the same Mongoose singleton.
// The models are always registered before any of these functions are called (either by the
// server bootstrap or by the test's route imports).
function getJobModel(): mongoose.Model<IJob> {
  const m = mongoose.models['Job'] as mongoose.Model<IJob> | undefined;
  if (!m) throw new Error('Job model not registered — import models/Job.js before calling matchService');
  return m;
}

function getTeacherProfileModel(): mongoose.Model<ITeacherProfile> {
  const m = mongoose.models['TeacherProfile'] as mongoose.Model<ITeacherProfile> | undefined;
  if (!m) throw new Error('TeacherProfile model not registered — import models/TeacherProfile.js before calling matchService');
  return m;
}

function getApplicationModel(): mongoose.Model<IApplication> {
  const m = mongoose.models['Application'] as mongoose.Model<IApplication> | undefined;
  if (!m) throw new Error('Application model not registered — import models/Application.js before calling matchService');
  return m;
}

export function jaccard<T>(a: T[] = [], b: T[] = []): number {
  if (!a.length && !b.length) return 0;
  const sa = new Set(a.map(String));
  const sb = new Set(b.map(String));
  let inter = 0;
  sa.forEach(x => { if (sb.has(x)) inter++; });
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

export function experienceFit(teacherYears: number, min: number, max: number): number {
  if (teacherYears >= min && teacherYears <= max) return 1;
  const dist = teacherYears < min ? min - teacherYears : teacherYears - max;
  return Math.max(0, 1 - dist / 5);
}

export function locationMatch(teacherLocation: string | undefined, preferredLocations: string[] | undefined, jobCity: string): number {
  const tl = (teacherLocation ?? '').toLowerCase();
  const jc = jobCity.toLowerCase();
  if (tl && tl === jc) return 1;
  if ((preferredLocations ?? []).some(p => p.toLowerCase() === jc)) return 0.7;
  return 0;
}

export function scoreTeacherForJob(teacher: any, job: any): number {
  const subj = jaccard(teacher.subjects, job.subjects) * 0.4;
  const exp = experienceFit(teacher.experience ?? 0, job.experience?.min ?? 0, job.experience?.max ?? 99) * 0.3;
  const loc = locationMatch(teacher.location, teacher.preferredLocation, job.location?.city ?? '') * 0.2;
  const qual = jaccard(teacher.qualifications, job.qualification) * 0.1;
  return Math.round((subj + exp + loc + qual) * 100);
}

export async function recommendJobsForTeacher(accountId: string, limit = 10) {
  const TeacherProfile = getTeacherProfileModel();
  const Application = getApplicationModel();
  const Job = getJobModel();
  const profile = await TeacherProfile.findOne({ accountId });
  if (!profile) return [];
  const applied = await Application.find({ teacherId: accountId }).distinct('jobId');
  const jobs = await Job.find({ status: 'active', _id: { $nin: applied } });
  return jobs
    .map(j => ({ job: j.toJSON(), score: scoreTeacherForJob(profile, j) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function recommendTeachersForJob(jobId: string, limit = 10) {
  const Job = getJobModel();
  const TeacherProfile = getTeacherProfileModel();
  const job = await Job.findById(jobId);
  if (!job) return [];
  const teachers = await TeacherProfile.find({ isAvailable: true });
  return teachers
    .map(t => ({ teacher: t.toJSON(), score: scoreTeacherForJob(t, job) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================================
// COLLABORATIVE FILTERING (D2)
// ============================================================

// For a teacher, find teachers who share at least one job application,
// then rank jobs those teachers applied to.
export async function collaborativeJobsForTeacher(accountId: string, limit = 10) {
  const Application = getApplicationModel();
  const Job = getJobModel();

  // 1. Jobs this teacher applied to.
  const myApps = await Application.find({ teacherId: accountId }).select('jobId').lean();
  const myJobIds = myApps.map((a: any) => a.jobId);
  if (myJobIds.length === 0) return [];

  // 2. Find other teachers who applied to any of those jobs.
  const peerApps = await Application.find({
    jobId: { $in: myJobIds },
    teacherId: { $ne: accountId },
  }).select('teacherId').lean();
  const peerIds = Array.from(new Set(peerApps.map((a: any) => String(a.teacherId))));
  if (peerIds.length === 0) return [];

  // 3. Find jobs those peers applied to, excluding myJobIds (don't re-suggest).
  const peerJobApps = await Application.find({
    teacherId: { $in: peerIds },
    jobId: { $nin: myJobIds },
  }).select('jobId').lean();

  // 4. Aggregate: count how often each job appears (co-application frequency = score).
  const jobCount = new Map<string, number>();
  for (const a of peerJobApps) {
    const k = String((a as any).jobId);
    jobCount.set(k, (jobCount.get(k) ?? 0) + 1);
  }
  if (jobCount.size === 0) return [];

  // 5. Fetch the top-N jobs, only active ones.
  const topJobIds = [...jobCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2)  // overfetch in case some are now closed
    .map(([id]) => id);
  const jobs = await Job.find({ _id: { $in: topJobIds }, status: 'active' });

  // 6. Merge counts back into jobs, sort by score desc, truncate.
  return jobs
    .map((j: any) => ({ job: j.toJSON(), score: jobCount.get(String(j._id)) ?? 0, reason: 'peers' as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Content-based: jobs sharing subjects/department with jobs the teacher already applied to.
export async function similarJobsForTeacher(accountId: string, limit = 10) {
  const Application = getApplicationModel();
  const Job = getJobModel();

  const myApps = await Application.find({ teacherId: accountId }).select('jobId').lean();
  const myJobIds = myApps.map((a: any) => a.jobId);
  if (myJobIds.length === 0) return [];

  const myJobs = await Job.find({ _id: { $in: myJobIds } }).select('subjects department').lean();
  const mySubjects = Array.from(new Set((myJobs as any[]).flatMap((j: any) => j.subjects ?? [])));
  const myDepartments = Array.from(new Set((myJobs as any[]).map((j: any) => j.department).filter(Boolean)));

  if (mySubjects.length === 0 && myDepartments.length === 0) return [];

  // Find active jobs that share at least one subject or department, excluding already-applied jobs.
  const orClauses: any[] = [];
  if (mySubjects.length) orClauses.push({ subjects: { $in: mySubjects } });
  if (myDepartments.length) orClauses.push({ department: { $in: myDepartments } });

  const candidates = await Job.find({
    status: 'active',
    _id: { $nin: myJobIds },
    $or: orClauses,
  });

  // Score by overlap count.
  return candidates
    .map((j: any) => {
      const subjOverlap = (j.subjects ?? []).filter((s: any) => mySubjects.includes(s)).length;
      const deptOverlap = myDepartments.includes(j.department) ? 1 : 0;
      return { job: j.toJSON(), score: subjOverlap * 2 + deptOverlap, reason: 'similar' as const };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ============================================================
// CONSULTANT-SCOPED RECOMMENDATIONS
// ============================================================

function getConsultantRosterModel(): mongoose.Model<any> {
  const m = mongoose.models['ConsultantRoster'] as mongoose.Model<any> | undefined;
  if (!m) throw new Error('ConsultantRoster model not registered — import models/ConsultantRoster.js before calling matchService');
  return m;
}

export async function recommendJobsForConsultantRoster(consultantAccountId: string, limit = 20) {
  const ConsultantRoster = getConsultantRosterModel();
  const TeacherProfile = getTeacherProfileModel();
  const Job = getJobModel();
  const roster = await ConsultantRoster.find({
    consultantAccountId, entityType: 'teacher', status: 'active',
  });
  if (roster.length === 0) return [];
  const teacherIds = roster.map((r: any) => r.entityAccountId);
  const teachers = await TeacherProfile.find({ accountId: { $in: teacherIds } });
  if (teachers.length === 0) return [];

  const jobs = await Job.find({ status: 'active' }).limit(200);
  const scored = jobs.map((job: any) => {
    let bestScore = 0;
    let bestTeacherId: any = null;
    for (const t of teachers) {
      const s = scoreTeacherForJob(t, job);
      if (s > bestScore) { bestScore = s; bestTeacherId = (t as any).accountId; }
    }
    return { job: job.toJSON ? job.toJSON() : job, score: bestScore, bestTeacherAccountId: bestTeacherId };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function recommendTeachersFromRosterForJob(consultantAccountId: string, jobId: string, limit = 20) {
  const ConsultantRoster = getConsultantRosterModel();
  const TeacherProfile = getTeacherProfileModel();
  const Job = getJobModel();
  const job = await Job.findById(jobId);
  if (!job) return [];
  const roster = await ConsultantRoster.find({
    consultantAccountId, entityType: 'teacher', status: 'active',
  });
  if (roster.length === 0) return [];
  const teacherIds = roster.map((r: any) => r.entityAccountId);
  const teachers = await TeacherProfile.find({ accountId: { $in: teacherIds } });
  const scored = teachers.map((t: any) => ({
    teacher: t.toJSON(),
    score: scoreTeacherForJob(t, job),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
