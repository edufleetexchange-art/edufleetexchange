import mongoose, { Schema, type Document } from 'mongoose';

export interface IVehicle extends Omit<Document, 'model'> {
  title: string;
  manufacturer: string;
  vehicleModel: string;
  year: number;
  type: 'school-bus' | 'minibus' | 'van' | 'truck';
  price: number;
  registrationNumber: string;
  mileage: number;
  condition: 'excellent' | 'good' | 'fair' | 'needs-repair';
  features: string[];
  images: string[];
  description: string;
  sellerId: mongoose.Types.ObjectId;
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;
  isPriority: boolean;
  status: 'pending' | 'approved' | 'rejected';
  insurance?: {
    valid: boolean;
    expiryDate?: Date;
    provider?: string;
  };
  fitness?: {
    valid: boolean;
    expiryDate?: Date;
  };
  roadTax?: {
    valid: boolean;
    expiryDate?: Date;
  };
  permit?: {
    valid: boolean;
    expiryDate?: Date;
    permitType?: string;
  };
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleSchema = new Schema<IVehicle>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true,
    },
    vehicleModel: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: 1900,
      max: new Date().getFullYear() + 1,
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['school-bus', 'minibus', 'van', 'truck'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      uppercase: true,
    },
    mileage: {
      type: Number,
      required: [true, 'Mileage is required'],
      min: 0,
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: ['excellent', 'good', 'fair', 'needs-repair'],
    },
    features: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      required: [true, 'At least one image is required'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'At least one image is required',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerName: {
      type: String,
      required: true,
    },
    sellerEmail: {
      type: String,
      required: true,
    },
    sellerPhone: {
      type: String,
    },
    isPriority: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    insurance: {
      valid: Boolean,
      expiryDate: Date,
      provider: String,
    },
    fitness: {
      valid: Boolean,
      expiryDate: Date,
    },
    roadTax: {
      valid: Boolean,
      expiryDate: Date,
    },
    permit: {
      valid: Boolean,
      expiryDate: Date,
      permitType: String,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
vehicleSchema.index({ sellerId: 1, status: 1 });
vehicleSchema.index({ type: 1, status: 1 });
vehicleSchema.index({ manufacturer: 1, vehicleModel: 1 });
vehicleSchema.index({ isPriority: 1, status: 1 });
vehicleSchema.index({ createdAt: -1 });

export default mongoose.model<IVehicle>('Vehicle', vehicleSchema);