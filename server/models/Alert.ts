import mongoose, { Schema, Document } from 'mongoose';

/**
 * A saved-search "demand alert". A buyer (institute/admin/consultant) subscribes
 * to a need; when matching supply appears, alertService fans out a notification.
 *
 * NOTE: This is NOT the billing `Subscription` model — different concept entirely.
 * `Alert` = "notify me when X is available".
 */
export type AlertEntityType = 'teacher' | 'vehicle' | 'job' | 'supplier' | 'custom';
export type AlertStatus = 'active' | 'paused' | 'expired';
export type AlertChannel = 'in_app' | 'email' | 'whatsapp';

export interface TeacherCriteria {
  subjects?: string[];
  levels?: string[];
  location?: string;
  minExperience?: number;
  maxExpectedSalary?: number;
}
export interface VehicleCriteria {
  vehicleType?: string;
  minCapacity?: number;
  maxPrice?: number;
  location?: string;
}
export interface CustomCriteria {
  keywords?: string[];
  freeText?: string;
}

export interface IAlert extends Document {
  accountId: mongoose.Types.ObjectId;
  createdByRole?: string;
  entityType: AlertEntityType;
  label: string;
  criteria: TeacherCriteria | VehicleCriteria | CustomCriteria | Record<string, any>;
  channels: AlertChannel[];
  status: AlertStatus;
  expiresAt?: Date;
  lastMatchedAt?: Date;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IAlert>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    createdByRole: { type: String },
    entityType: { type: String, enum: ['teacher', 'vehicle', 'job', 'supplier', 'custom'], required: true },
    label: { type: String, required: true, trim: true },
    criteria: { type: Schema.Types.Mixed, default: {} },
    channels: { type: [String], enum: ['in_app', 'email', 'whatsapp'], default: ['in_app'] },
    status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active' },
    // Auto-expire stale alerts so they don't fire forever. Default 60 days out.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
    lastMatchedAt: { type: Date },
    matchCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

// Fan-out queries active alerts of a given entityType.
schema.index({ entityType: 1, status: 1 });
// "My alerts" list.
schema.index({ accountId: 1, status: 1, createdAt: -1 });

export default (mongoose.models.Alert as mongoose.Model<IAlert>) ?? mongoose.model<IAlert>('Alert', schema);
