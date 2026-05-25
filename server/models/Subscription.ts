import mongoose, { Schema, Document } from 'mongoose';

export type SubStatus = 'active' | 'inactive' | 'suspended' | 'expired';
export type PayStatus = 'pending' | 'completed' | 'failed';

export interface ISubscription extends Document {
  accountId: mongoose.Types.ObjectId;
  planId?: mongoose.Types.ObjectId;
  status: SubStatus;
  paymentStatus: PayStatus;
  transactionId?: string;
  startDate: Date;
  endDate: Date;
  listingsUsed: number;
  listingsLimit: number;
  jobPostsUsed: number;
  jobPostsLimit: number;
  browseCount: number;
  browseCountLimit: number;
  lastBrowseReset?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscription>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'expired'], default: 'inactive' },
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    transactionId: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    listingsUsed: { type: Number, default: 0 },
    listingsLimit: { type: Number, default: 0 },
    jobPostsUsed: { type: Number, default: 0 },
    jobPostsLimit: { type: Number, default: 0 },
    browseCount: { type: Number, default: 0 },
    browseCountLimit: { type: Number, default: 0 },
    lastBrowseReset: Date,
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

// Only one active subscription per account
schema.index(
  { accountId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export default (mongoose.models.Subscription as mongoose.Model<ISubscription>) ?? mongoose.model<ISubscription>('Subscription', schema);
