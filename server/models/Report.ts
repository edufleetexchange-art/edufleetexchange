import mongoose, { Schema, Document } from 'mongoose';

export type ReportTargetType = 'vehicle' | 'job' | 'supplier' | 'account';
export type ReportReason = 'spam' | 'fraud' | 'inappropriate' | 'inaccurate' | 'duplicate' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

export interface IReport extends Document {
  reporterAccountId: mongoose.Types.ObjectId;
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReport>(
  {
    reporterAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    targetType: { type: String, enum: ['vehicle', 'job', 'supplier', 'account'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: ['spam', 'fraud', 'inappropriate', 'inaccurate', 'duplicate', 'other'], required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    resolvedAt: { type: Date },
    resolution: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for moderation queue queries
schema.index({ status: 1, createdAt: -1 });
// One open report per (reporter, target) — prevents duplicate open reports
schema.index(
  { reporterAccountId: 1, targetType: 1, targetId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'reviewing'] } } }
);

export default (mongoose.models.Report as mongoose.Model<IReport>) ?? mongoose.model<IReport>('Report', schema);
