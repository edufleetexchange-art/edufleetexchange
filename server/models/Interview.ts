import mongoose, { Schema, Document } from 'mongoose';

export type InterviewMode = 'in_person' | 'video' | 'phone';
export type InterviewStatus = 'scheduled' | 'rescheduled' | 'completed' | 'canceled' | 'no_show';
export type InterviewOutcome = 'recommend_hire' | 'hold' | 'reject';

export interface IInterview extends Document {
  applicationId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  teacherAccountId: mongoose.Types.ObjectId;
  instituteAccountId: mongoose.Types.ObjectId;
  scheduledByAccountId: mongoose.Types.ObjectId;
  round: number;
  mode: InterviewMode;
  scheduledAt: Date;
  durationMinutes: number;
  location?: string;
  meetingLink?: string;
  participants: mongoose.Types.ObjectId[];
  status: InterviewStatus;
  rescheduleReason?: string;
  notesBefore?: string;
  outcome?: InterviewOutcome;
  notesAfter?: string;
  consultantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInterview>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    teacherAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    instituteAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    scheduledByAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    round: { type: Number, default: 1, min: 1 },
    mode: { type: String, enum: ['in_person', 'video', 'phone'], required: true },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 30, min: 5 },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
    status: { type: String, enum: ['scheduled', 'rescheduled', 'completed', 'canceled', 'no_show'], default: 'scheduled' },
    rescheduleReason: { type: String, trim: true },
    notesBefore: { type: String, trim: true },
    outcome: { type: String, enum: ['recommend_hire', 'hold', 'reject'] },
    notesAfter: { type: String, trim: true },
    consultantId: { type: Schema.Types.ObjectId, ref: 'Account' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ teacherAccountId: 1, status: 1, scheduledAt: -1 });
schema.index({ instituteAccountId: 1, status: 1, scheduledAt: -1 });
schema.index({ consultantId: 1, status: 1 });
schema.index({ applicationId: 1, round: 1 });

export default (mongoose.models.Interview as mongoose.Model<IInterview>) ?? mongoose.model<IInterview>('Interview', schema);
