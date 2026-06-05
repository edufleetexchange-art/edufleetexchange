import mongoose, { Schema, Document } from 'mongoose';

export type PlacementStage =
  | 'proposed'
  | 'applied'
  | 'interviewing'
  | 'offer_extended'
  | 'placed'
  | 'declined'
  | 'lost';

export const ACTIVE_PLACEMENT_STAGES: PlacementStage[] = ['proposed', 'applied', 'interviewing', 'offer_extended'];

export interface IPlacement extends Document {
  consultantAccountId: mongoose.Types.ObjectId;
  teacherAccountId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  applicationId?: mongoose.Types.ObjectId;
  stage: PlacementStage;
  agreedFee?: number;
  agreedFeeNotes?: string;
  stageHistory: Array<{
    stage: PlacementStage;
    changedAt: Date;
    changedByAccountId: mongoose.Types.ObjectId;
    reason?: string;
  }>;
  lastActivityAt: Date;
  internalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlacement>(
  {
    consultantAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    teacherAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    stage: {
      type: String,
      enum: ['proposed', 'applied', 'interviewing', 'offer_extended', 'placed', 'declined', 'lost'],
      default: 'proposed',
    },
    agreedFee: { type: Number, min: 0 },
    agreedFeeNotes: { type: String, trim: true },
    stageHistory: [{
      stage: String,
      changedAt: { type: Date, default: Date.now },
      changedByAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
      reason: String,
    }],
    lastActivityAt: { type: Date, default: Date.now },
    internalNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ consultantAccountId: 1, stage: 1, lastActivityAt: -1 });
schema.index({ teacherAccountId: 1, stage: 1 });
schema.index({ jobId: 1 });
schema.index(
  { consultantAccountId: 1, teacherAccountId: 1, jobId: 1 },
  {
    unique: true,
    partialFilterExpression: { stage: { $in: ['proposed', 'applied', 'interviewing', 'offer_extended'] } },
  }
);

export default (mongoose.models.Placement as mongoose.Model<IPlacement>) ?? mongoose.model<IPlacement>('Placement', schema);
