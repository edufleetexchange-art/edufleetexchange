import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  displayName: string;
  description: string;
  planType: 'teacher' | 'institute' | 'vendor';
  price: number;
  currency: string;
  duration: number; // in days
  features: {
    maxListings: number;
    maxJobPosts: number;
    maxBrowsesPerMonth: number;
    dataDelayDays: number;
    teacherDataDelayDays: number;
    canAdvertiseVehicles: boolean;
    instantVehicleAlerts: boolean;
    instantJobAlerts: boolean;
    priorityListings: boolean;
    analytics: boolean;
    supportLevel: 'basic' | 'priority' | 'premium';
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    planType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: 1,
    },
    features: {
      maxListings: {
        type: Number,
        required: true,
        min: 0,
      },
      maxJobPosts: {
        type: Number,
        default: 0,
      },
      maxBrowsesPerMonth: {
        type: Number,
        required: true,
        min: 0,
      },
      dataDelayDays: {
        type: Number,
        default: 0,
      },
      teacherDataDelayDays: {
        type: Number,
        default: 0,
      },
      canAdvertiseVehicles: {
        type: Boolean,
        default: false,
      },
      instantVehicleAlerts: {
        type: Boolean,
        default: false,
      },
      instantJobAlerts: {
        type: Boolean,
        default: false,
      },
      priorityListings: {
        type: Boolean,
        default: false,
      },
      analytics: {
        type: Boolean,
        default: false,
      },
      supportLevel: {
        type: String,
        enum: ['basic', 'priority', 'premium'],
        default: 'basic',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export default mongoose.model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);