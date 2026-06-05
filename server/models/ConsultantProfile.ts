import mongoose, { Schema, Document } from 'mongoose';

export interface IConsultantProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: {
    subjects: string[];
    levels: string[];
    regions: string[];
  };
  bio?: string;
  website?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  verification?: {
    status: 'none' | 'pending' | 'verified' | 'rejected';
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConsultantProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    agencyName: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    yearsOfExperience: { type: Number, default: 0, min: 0 },
    specializations: {
      subjects: { type: [String], default: [] },
      levels: { type: [String], default: [] },
      regions: { type: [String], default: [] },
    },
    bio: { type: String, trim: true },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: 'India' },
    },
    verification: {
      status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ 'specializations.subjects': 1 });
schema.index({ 'specializations.regions': 1 });

export default (mongoose.models.ConsultantProfile as mongoose.Model<IConsultantProfile>) ?? mongoose.model<IConsultantProfile>('ConsultantProfile', schema);
