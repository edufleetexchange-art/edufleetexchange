import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  instituteName: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  subjects: string[];
  experience: {
    min: number;
    max: number;
  };
  salary: {
    min: number;
    max: number;
    currency: string;
  };
  qualification: string[];
  employmentType: 'full-time' | 'part-time' | 'contract' | 'temporary';
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  contactEmail: string;
  contactPhone?: string;
  instituteId: mongoose.Types.ObjectId;
  applicationDeadline?: Date;
  status: 'active' | 'closed' | 'expired';
  applicationsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    instituteName: {
      type: String,
      required: [true, 'Institute name is required'],
      trim: true,
    },
    location: {
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        default: 'India',
      },
    },
    subjects: {
      type: [String],
      required: [true, 'At least one subject is required'],
    },
    experience: {
      min: {
        type: Number,
        required: true,
        min: 0,
      },
      max: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    salary: {
      min: {
        type: Number,
        required: true,
        min: 0,
      },
      max: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },
    qualification: {
      type: [String],
      required: [true, 'Qualifications are required'],
    },
    employmentType: {
      type: String,
      required: true,
      enum: ['full-time', 'part-time', 'contract', 'temporary'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    contactEmail: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    contactPhone: {
      type: String,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    applicationDeadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'expired'],
      default: 'active',
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
jobSchema.index({ instituteId: 1, status: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ 'location.city': 1, 'location.state': 1 });
jobSchema.index({ subjects: 1 });

export default mongoose.model<IJob>('Job', jobSchema);
