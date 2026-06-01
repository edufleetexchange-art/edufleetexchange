import mongoose, { Schema, Document } from 'mongoose';

export type VerificationDocumentType = 'gst_certificate' | 'pan_card' | 'registration_certificate' | 'other';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type VerificationTargetType = 'institute' | 'vendor';

export interface IVerificationRequest extends Document {
  accountId: mongoose.Types.ObjectId;
  targetType: VerificationTargetType;
  documentType: VerificationDocumentType;
  documentUrl: string;
  notes?: string;
  status: VerificationStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IVerificationRequest>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    targetType: { type: String, enum: ['institute', 'vendor'], required: true },
    documentType: { type: String, enum: ['gst_certificate', 'pan_card', 'registration_certificate', 'other'], required: true },
    documentUrl: { type: String, required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

// Compound for the admin queue
schema.index({ status: 1, createdAt: -1 });
// Partial-unique: only ONE pending request per account at a time (prevents spam-submit)
schema.index(
  { accountId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export default (mongoose.models.VerificationRequest as mongoose.Model<IVerificationRequest>) ?? mongoose.model<IVerificationRequest>('VerificationRequest', schema);
