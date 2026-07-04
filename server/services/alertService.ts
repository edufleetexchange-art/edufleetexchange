import mongoose from 'mongoose';
import { sendAlertMatchEmail, sendDemandLeadEmail } from '../utils/email.js';
import Alert, { IAlert, TeacherCriteria } from '../models/Alert.js';
import AlertMatch from '../models/AlertMatch.js';
import Account from '../models/Account.js';
import Notification from '../models/Notification.js';
import { jaccard, experienceFit, locationMatch } from './matchService.js';

/**
 * Demand-alert fan-out. When new supply becomes available we find active alerts
 * whose criteria match and notify the subscriber — AND notify the founder/admin
 * so they can go fulfil the demand by hand (the GTM concierge loop). Matches are
 * deduped so a buyer is never pinged twice about the same entity.
 */

// A teacher "entity" shape the matcher understands (profile fields + account name).
export interface TeacherSupply {
  accountId: string;
  name?: string;
  subjects?: string[];
  experience?: number;
  location?: string;
  preferredLocation?: string[];
  qualifications?: string[];
}

const MATCH_THRESHOLD = 0.6; // 0..1 — below this we don't fire (avoids near-miss spam)

/**
 * Score a teacher against a teacher-alert's criteria → 0..1.
 * Subjects dominate; experience and location refine. A criterion that's left
 * blank simply doesn't constrain (treated as satisfied).
 */
export function scoreTeacherForAlert(teacher: TeacherSupply, criteria: TeacherCriteria): number {
  let weightSum = 0;
  let score = 0;

  if (criteria.subjects && criteria.subjects.length) {
    const s = jaccard(teacher.subjects ?? [], criteria.subjects);
    score += s * 0.6;
    weightSum += 0.6;
  }
  if (criteria.minExperience != null) {
    // Treat the alert's minimum as a floor; full credit at/above it.
    const e = experienceFit(teacher.experience ?? 0, criteria.minExperience, 99);
    score += e * 0.25;
    weightSum += 0.25;
  }
  if (criteria.location) {
    const l = locationMatch(teacher.location, teacher.preferredLocation, criteria.location);
    score += l * 0.15;
    weightSum += 0.15;
  }

  // No constraints at all → a broad "any teacher" alert always matches.
  if (weightSum === 0) return 1;
  return score / weightSum;
}

/** Cached lookup of founder/admin account ids to receive demand leads. */
async function getFounderAccounts(): Promise<Array<{ _id: mongoose.Types.ObjectId; email: string }>> {
  const admins = await Account.find({ role: 'admin', isActive: true }).select('_id email').lean();
  return admins.map((a: any) => ({ _id: a._id, email: a.email }));
}

/** Email delivery must never break a fan-out — log and continue. */
async function safeEmail(task: Promise<void>, label: string): Promise<void> {
  try {
    await task;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[alertService] ${label} email failed:`, err);
  }
}

/**
 * Fan out a newly-available teacher to all matching active alerts.
 * Safe to call fire-and-forget after the teacher is persisted.
 */
export async function fanOutTeacher(teacher: TeacherSupply): Promise<number> {
  const alerts = await Alert.find({ entityType: 'teacher', status: 'active' });
  if (!alerts.length) return 0;

  const founders = await getFounderAccounts();
  let fired = 0;

  for (const alert of alerts) {
    // Skip expired alerts defensively (the index query already filters status,
    // but expiresAt is a separate dimension).
    if (alert.expiresAt && alert.expiresAt.getTime() < Date.now()) continue;
    // Don't notify a teacher about themselves if a teacher ever sets an alert.
    if (String(alert.accountId) === String(teacher.accountId)) continue;

    const score = scoreTeacherForAlert(teacher, (alert.criteria ?? {}) as TeacherCriteria);
    if (score < MATCH_THRESHOLD) continue;

    // Dedupe: claim the (alert, entity) pair via the unique index. If it already
    // exists, this throws E11000 and we skip — guarantees one ping per pair.
    try {
      await AlertMatch.create({
        alertId: alert._id,
        entityType: 'teacher',
        entityId: new mongoose.Types.ObjectId(teacher.accountId),
        score,
      });
    } catch (err: any) {
      if (err?.code === 11000) continue; // already notified
      throw err;
    }

    const teacherLabel = teacher.name ?? 'A teacher';
    const subjectStr = (teacher.subjects ?? []).join(', ') || 'teaching';

    // 1) Notify the subscriber (the buyer / school).
    if (alert.channels.includes('in_app')) {
      await Notification.create({
        userId: alert.accountId,
        type: 'alert_teacher_available',
        title: `Match for your alert: ${alert.label}`,
        message: `${teacherLabel} (${subjectStr}) is available and matches "${alert.label}".`,
        priority: 'high',
        link: `/teachers/${teacher.accountId}`,
        metadata: { alertId: String(alert._id), teacherAccountId: teacher.accountId, score },
      });
    }

    // 1b) Email the subscriber — alerts must reach people who don't log in
    // daily. Only when the alert opted into the email channel.
    if (alert.channels.includes('email')) {
      const subscriber = await Account.findById(alert.accountId).select('email').lean();
      if (subscriber?.email) {
        const clientUrl = process.env.CLIENT_URL ?? 'https://www.edufleetexchange.com';
        await safeEmail(
          sendAlertMatchEmail(subscriber.email, {
            alertLabel: alert.label,
            matchLabel: teacherLabel,
            subjects: subjectStr,
            link: `${clientUrl}/teachers/${teacher.accountId}`,
          }),
          'subscriber match',
        );
      }
    }

    // 2) Notify the founder/admin — this is the concierge lead: go place a teacher.
    for (const founder of founders) {
      const fid = founder._id;
      // Don't double-notify if the founder IS the subscriber.
      if (String(fid) === String(alert.accountId)) continue;
      await Notification.create({
        userId: fid,
        type: 'alert_demand_lead',
        title: `Demand lead: ${alert.label}`,
        message: `An alert "${alert.label}" just matched ${teacherLabel} (${subjectStr}). Reach out to the requester and close the placement.`,
        priority: 'high',
        metadata: { alertId: String(alert._id), requesterAccountId: String(alert.accountId), teacherAccountId: teacher.accountId },
      });
      if (founder.email) {
        await safeEmail(
          sendDemandLeadEmail(founder.email, { alertLabel: alert.label, matchLabel: teacherLabel, subjects: subjectStr }),
          'demand lead',
        );
      }
    }

    alert.matchCount += 1;
    alert.lastMatchedAt = new Date();
    await alert.save();
    fired += 1;
  }

  return fired;
}

/**
 * Convenience used by the signup path: build the supply shape from a freshly
 * created teacher bundle and fan out. Never throws into the caller.
 */
export async function fanOutTeacherSafe(teacher: TeacherSupply): Promise<void> {
  try {
    await fanOutTeacher(teacher);
  } catch (err) {
    // Alert delivery must never break a signup. Log and move on.
    // eslint-disable-next-line no-console
    console.error('[alertService] fanOutTeacher failed:', err);
  }
}
