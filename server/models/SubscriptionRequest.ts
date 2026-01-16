import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionRequest extends Document {
  userId: mongoose.Types.ObjectId;
  currentPlanId: mongoose.Types.ObjectId;
  requestedPlanId: mongoose.Types.ObjectId;
  requestType: 'upgrade' | 'downgrade' | 'renewal';
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  userNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionRequestSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    currentPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    requestedPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    requestType: { type: String, enum: ['upgrade', 'downgrade', 'renewal'], required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String },
    userNotes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<ISubscriptionRequest>('SubscriptionRequest', SubscriptionRequestSchema);
