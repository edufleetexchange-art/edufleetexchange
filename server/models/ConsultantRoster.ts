import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultantRoster extends Document {
  consultantAccountId: mongoose.Types.ObjectId;
  entityType: 'teacher' | 'institute';
  entityAccountId: mongoose.Types.ObjectId;
  status: 'active' | 'archived' | 'inactive';
  addedAt: Date;
  archivedAt?: Date;
  internalNotes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConsultantRoster>(
  {
    consultantAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    entityType: { type: String, enum: ['teacher', 'institute'], required: true },
    entityAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    status: { type: String, enum: ['active', 'archived', 'inactive'], default: 'active' },
    addedAt: { type: Date, default: Date.now },
    archivedAt: Date,
    internalNotes: { type: String, trim: true },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ consultantAccountId: 1, entityType: 1, status: 1 });
schema.index(
  { consultantAccountId: 1, entityAccountId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

export default (mongoose.models.ConsultantRoster as mongoose.Model<IConsultantRoster>) ?? mongoose.model<IConsultantRoster>('ConsultantRoster', schema);
