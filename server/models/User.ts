import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'guest' | 'institute' | 'admin' | 'teacher';
  instituteName?: string;
  contactPerson?: string;
  avatar?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  subscription?: {
    planId?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive' | 'suspended' | 'expired';
    paymentStatus: 'pending' | 'completed' | 'failed';
    transactionId?: string;
    startDate?: Date;
    endDate?: Date;
    listingsUsed: number;
    listingsLimit: number;
    jobPostsUsed: number;
    jobPostsLimit: number;
    browseCount: number;
    browseCountLimit: number;
    lastBrowseReset?: Date;
    notes?: string;
  };
  isVerified: boolean;
  isActive: boolean;
  instituteSearchability?: boolean;
  isAvailable: boolean;
  experience?: number;
  qualifications?: string[];
  subjects?: string[];
  bio?: string;
  location?: string;
  profile?: {
    qualification?: string[];
    subjects?: string[];
    experience?: number;
    currentInstitute?: string;
    preferredLocation?: string[];
    achievements?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
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
      enum: ['guest', 'institute', 'admin', 'teacher'],
      default: 'institute',
    },
    instituteName: {
      type: String,
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: String,
    },
    subscription: {
      planId: {
        type: Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'expired'],
        default: 'inactive',
      },
      paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed',
      },
      transactionId: String,
      startDate: Date,
      endDate: Date,
      listingsUsed: {
        type: Number,
        default: 0,
      },
      listingsLimit: {
        type: Number,
        default: 0,
      },
      jobPostsUsed: {
        type: Number,
        default: 0,
      },
      jobPostsLimit: {
        type: Number,
        default: 0,
      },
      browseCount: {
        type: Number,
        default: 0,
      },
      browseCountLimit: {
        type: Number,
        default: 0,
      },
      lastBrowseReset: Date,
      notes: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    instituteSearchability: {
      type: Boolean,
      default: false,
    },
    experience: {
      type: Number,
      default: 0,
    },
    qualifications: [String],
    subjects: [String],
    bio: String,
    location: String,
    profile: {
      qualification: [String],
      subjects: [String],
      experience: Number,
      currentInstitute: String,
      preferredLocation: [String],
      achievements: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', userSchema);