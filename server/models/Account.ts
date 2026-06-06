import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type AccountRole = 'institute' | 'teacher' | 'vendor' | 'admin' | 'marketing' | 'sales' | 'consultant';

export interface IAccount extends Document {
  name: string;
  email: string;
  password: string;
  role: AccountRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const accountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['institute', 'teacher', 'vendor', 'admin', 'marketing', 'sales', 'consultant'],
      required: true,
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

accountSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

accountSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export default (mongoose.models.Account as mongoose.Model<IAccount>) ?? mongoose.model<IAccount>('Account', accountSchema);
