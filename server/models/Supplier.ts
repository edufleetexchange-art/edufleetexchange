import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  category: 'edutech' | 'stationery' | 'uniforms' | 'furniture' | 'technology' | 'sports' | 'library' | 'lab-equipment' | 'cafeteria' | 'maintenance' | 'security' | 'transport' | 'other';
  description: string;
  services: string[];
  contactPerson: string;
  email: string;
  phone: string;
  website?: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  logo?: string;
  certifications?: string[];
  yearsInBusiness?: number;
  clientCount?: number;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'edutech',
        'stationery',
        'uniforms',
        'furniture',
        'technology',
        'sports',
        'library',
        'lab-equipment',
        'cafeteria',
        'maintenance',
        'security',
        'transport',
        'other'
      ],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    services: {
      type: [String],
      required: [true, 'At least one service is required'],
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
    },
    website: {
      type: String,
    },
    address: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        default: 'India',
      },
    },
    logo: {
      type: String,
    },
    certifications: {
      type: [String],
      default: [],
    },
    yearsInBusiness: {
      type: Number,
      min: 0,
    },
    clientCount: {
      type: Number,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
supplierSchema.index({ category: 1, status: 1 });
supplierSchema.index({ isVerified: 1, status: 1 });
supplierSchema.index({ createdBy: 1 });

export default mongoose.model<ISupplier>('Supplier', supplierSchema);