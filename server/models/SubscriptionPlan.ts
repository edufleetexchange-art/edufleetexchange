import mongoose, { Schema, Document } from 'mongoose';

// Persona-based feature interface
interface IPersonaFeatures {
  // Common features for all personas
  maxBrowsesPerMonth: number;
  maxListings?: number; // Legacy/Alias for backward compatibility
  dataDelayDays: number;
  instantAlerts: boolean;
  analytics: boolean;
  supportLevel: 'basic' | 'priority' | 'premium';
  
  // Institute-specific features
  maxVehicleListings?: number;
  maxJobPosts?: number;
  canAdvertiseVehicles?: boolean;
  priorityVehicleListings?: boolean;
  instantJobAlerts?: boolean;
  
  // Vendor-specific features
  maxProductListings?: number;
  canAdvertiseProducts?: boolean;
  priorityProductListings?: boolean;
  
  // Teacher-specific features
  maxJobApplications?: number;
  profileVisibility?: 'hidden' | 'basic' | 'enhanced' | 'premium';
  canAccessJobBoard?: boolean;
  teacherDataDelayDays?: number;
  instantJobNotifications?: boolean;

  // Consultant-specific features
  maxRosterTeachers?: number;
  maxRosterInstitutes?: number;
  maxApplicationsPerMonth?: number;
  maxPlacementsPerMonth?: number;
  canViewTeacherContact?: boolean;
}

export interface ISubscriptionPlan extends Document {
  name: string;
  displayName: string;
  description: string;
  planType: 'teacher' | 'institute' | 'vendor' | 'consultant';
  price: number;
  currency: string;
  duration: number; // in days
  features: IPersonaFeatures;
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
      enum: ['teacher', 'institute', 'vendor', 'consultant'],
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
      // Common features for all personas
      maxBrowsesPerMonth: {
        type: Number,
        required: true,
        min: 0,
      },
      maxListings: {
        type: Number,
        min: 0,
      },
      dataDelayDays: {
        type: Number,
        default: 0,
      },
      instantAlerts: {
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
      
      // Institute-specific features
      maxVehicleListings: {
        type: Number,
        min: 0,
      },
      maxJobPosts: {
        type: Number,
        min: 0,
      },
      canAdvertiseVehicles: {
        type: Boolean,
        default: false,
      },
      priorityVehicleListings: {
        type: Boolean,
        default: false,
      },
      instantJobAlerts: {
        type: Boolean,
        default: false,
      },
      
      // Vendor-specific features
      maxProductListings: {
        type: Number,
        min: 0,
      },
      canAdvertiseProducts: {
        type: Boolean,
        default: false,
      },
      priorityProductListings: {
        type: Boolean,
        default: false,
      },
      
      // Teacher-specific features
      maxJobApplications: {
        type: Number,
        min: 0,
      },
      profileVisibility: {
        type: String,
        enum: ['hidden', 'basic', 'enhanced', 'premium'],
      },
      canAccessJobBoard: {
        type: Boolean,
        default: true,
      },
      teacherDataDelayDays: {
        type: Number,
        default: 0,
      },
      instantJobNotifications: {
        type: Boolean,
        default: false,
      },

      // Consultant-specific features
      maxRosterTeachers: { type: Number, min: 0 },
      maxRosterInstitutes: { type: Number, min: 0 },
      maxApplicationsPerMonth: { type: Number, min: 0 },
      maxPlacementsPerMonth: { type: Number, min: 0 },
      canViewTeacherContact: { type: Boolean, default: false },
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

export default (mongoose.models.SubscriptionPlan as mongoose.Model<ISubscriptionPlan>) ?? mongoose.model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);