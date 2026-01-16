import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherName: string;
  instituteId: mongoose.Types.ObjectId;
  instituteName: string;
  coverLetter: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'accepted' | 'rejected';
  appliedDate: Date;
  reviewedAt?: Date;
  shortlistedAt?: Date;
  interviewScheduled?: {
    scheduledDate: string;
    scheduledTime: string;
    duration: string;
    mode: 'video' | 'phone' | 'in-person';
    location?: string;
    meetingLink?: string;
    notes?: string;
    scheduledAt: Date;
  };
  rejectedAt?: Date;
  acceptedAt?: Date;
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy?: mongoose.Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    teacherName: {
      type: String,
      required: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    instituteName: {
      type: String,
      required: true,
    },
    coverLetter: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected'],
      default: 'pending',
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: Date,
    shortlistedAt: Date,
    interviewScheduled: {
      scheduledDate: String,
      scheduledTime: String,
      duration: String,
      mode: {
        type: String,
        enum: ['video', 'phone', 'in-person'],
      },
      location: String,
      meetingLink: String,
      notes: String,
      scheduledAt: Date,
    },
    rejectedAt: Date,
    acceptedAt: Date,
    statusHistory: [{
      status: String,
      changedAt: Date,
      changedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
applicationSchema.index({ jobId: 1, teacherId: 1 }, { unique: true });
applicationSchema.index({ instituteId: 1 });
applicationSchema.index({ teacherId: 1 });

export default mongoose.model<IApplication>('Application', applicationSchema);
