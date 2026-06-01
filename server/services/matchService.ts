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
