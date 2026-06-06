import mongoose from 'mongoose';
import Interview, { InterviewMode, InterviewOutcome, InterviewStatus } from '../models/Interview.js';
import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import Placement from '../models/Placement.js';
import { transitionStage } from './placementService.js';

export interface ScheduleInterviewInput {
  applicationId: string;
  scheduledByAccountId: string;
  scheduledAt: Date;
  durationMinutes: number;
  mode: InterviewMode;
  location?: string;
  meetingLink?: string;
  participants?: string[];
  notesBefore?: string;
  round?: number;
}

async function notifyParticipants(args: {
  accountIds: string[];
  event: 'interview_invitation' | 'interview_rescheduled' | 'interview_canceled';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  const unique = Array.from(new Set(args.accountIds.filter(Boolean)));
  const docs = unique.map((id) => ({
    userId: new mongoose.Types.ObjectId(id),
    type: args.event,
    title: args.title,
    message: args.message,
    metadata: { event: args.event, ...(args.metadata ?? {}) },
    isRead: false,
  }));
  if (docs.length) {
    try { await Notification.insertMany(docs); } catch { /* notification failures are non-fatal */ }
  }
}

export async function scheduleInterview(input: ScheduleInterviewInput) {
  const application = await Application.findById(input.applicationId);
  if (!application) throw new Error('Application not found');
  const existingRoundCount = await Interview.countDocuments({ applicationId: input.applicationId });
  const round = input.round ?? existingRoundCount + 1;

  const consultantId = (application as any).submittedByConsultantId
    ? String((application as any).submittedByConsultantId)
    : undefined;

  const participants: string[] = input.participants && input.participants.length
    ? input.participants
    : [String(application.teacherId), String(application.instituteId), ...(consultantId ? [consultantId] : [])];

  const doc = await Interview.create({
    applicationId: application._id,
    jobId: application.jobId,
    teacherAccountId: application.teacherId,
    instituteAccountId: application.instituteId,
    scheduledByAccountId: new mongoose.Types.ObjectId(input.scheduledByAccountId),
    round,
    mode: input.mode,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    location: input.location,
    meetingLink: input.meetingLink,
    participants: participants.map((p) => new mongoose.Types.ObjectId(p)),
    status: 'scheduled',
    notesBefore: input.notesBefore,
    consultantId: consultantId ? new mongoose.Types.ObjectId(consultantId) : undefined,
  });

  await notifyParticipants({
    accountIds: participants,
    event: 'interview_invitation',
    title: `Interview scheduled (Round ${round})`,
    message: `An interview has been scheduled for ${input.scheduledAt.toISOString()}.`,
    metadata: { interviewId: String(doc._id), applicationId: input.applicationId },
  });

  if (consultantId) {
    const placement = await Placement.findOne({
      consultantAccountId: consultantId,
      teacherAccountId: application.teacherId,
      jobId: application.jobId,
      stage: { $in: ['applied'] },
    });
    if (placement) {
      try { await transitionStage(String(placement._id), 'interviewing', input.scheduledByAccountId, 'Interview scheduled'); } catch { /* swallow if not allowed */ }
    }
  }

  return doc;
}

export async function rescheduleInterview(
  interviewId: string,
  newScheduledAt: Date,
  changedByAccountId: string,
  reason?: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  if (doc.status === 'completed' || doc.status === 'canceled') {
    throw new Error('Cannot reschedule a completed or canceled interview');
  }
  doc.scheduledAt = newScheduledAt;
  doc.status = 'rescheduled';
  doc.rescheduleReason = reason;
  await doc.save();
  await notifyParticipants({
    accountIds: doc.participants.map(String),
    event: 'interview_rescheduled',
    title: 'Interview rescheduled',
    message: `Interview moved to ${newScheduledAt.toISOString()}.`,
    metadata: { interviewId, applicationId: String(doc.applicationId) },
  });
  return doc;
}

export async function completeInterview(
  interviewId: string,
  outcome: InterviewOutcome,
  notesAfter: string | undefined,
  _changedByAccountId: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  doc.status = 'completed';
  doc.outcome = outcome;
  doc.notesAfter = notesAfter;
  await doc.save();
  return doc;
}

export async function cancelInterview(
  interviewId: string,
  reason: string | undefined,
  _changedByAccountId: string
) {
  const doc = await Interview.findById(interviewId);
  if (!doc) throw new Error('Interview not found');
  doc.status = 'canceled';
  doc.rescheduleReason = reason;
  await doc.save();
  await notifyParticipants({
    accountIds: doc.participants.map(String),
    event: 'interview_canceled',
    title: 'Interview canceled',
    message: reason ?? 'The interview was canceled.',
    metadata: { interviewId, applicationId: String(doc.applicationId) },
  });
  return doc;
}

export async function listInterviewsForAccount(
  accountId: string,
  filters: { status?: InterviewStatus; from?: Date; to?: Date } = {}
) {
  const q: any = {
    $or: [
      { teacherAccountId: accountId },
      { instituteAccountId: accountId },
      { consultantId: accountId },
      { scheduledByAccountId: accountId },
    ],
  };
  if (filters.status) q.status = filters.status;
  if (filters.from || filters.to) {
    q.scheduledAt = {};
    if (filters.from) q.scheduledAt.$gte = filters.from;
    if (filters.to) q.scheduledAt.$lte = filters.to;
  }
  return Interview.find(q).sort({ scheduledAt: 1 });
}
