import mongoose, { Schema, Document } from 'mongoose';

export interface IInstituteProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  instituteName: string;
  contactPerson?: string;
  instituteSearchability: boolean;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  verification?: {
    status: 'none' | 'pending' | 'verified' | 'rejected';
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IInstituteProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    instituteName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    instituteSearchability: { type: Boolean, default: false },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
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

export default (mongoose.models.InstituteProfile as mongoose.Model<IInstituteProfile>) ?? mongoose.model<IInstituteProfile>('InstituteProfile', schema);
