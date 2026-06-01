import mongoose, { Schema, Document } from 'mongoose';

export interface IVendorProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  businessName: string;
  contactPerson?: string;
  phone?: string;
  website?: string;
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

const schema = new Schema<IVendorProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
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

export default (mongoose.models.VendorProfile as mongoose.Model<IVendorProfile>) ?? mongoose.model<IVendorProfile>('VendorProfile', schema);
