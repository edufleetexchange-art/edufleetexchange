import mongoose, { Document, Schema } from 'mongoose';

export type AdType = 'image' | 'video' | 'html';
export type AdPlacement = 'LP_TOP_BANNER' | 'LP_INLINE_1' | 'LP_INLINE_2' | 'LIST_SIDEBAR' | 'DASH_TOP';
export type AdStatus = 'draft' | 'pending' | 'active' | 'paused' | 'expired' | 'rejected';
export type AdPricingModel = 'cpm' | 'cpc' | 'fixed';

// Ad Document Interface
export interface IAd extends Document {
  title: string;
  advertiser: string;
  type: AdType;
  mediaUrl?: string;
  htmlContent?: string;
  targetUrl: string;
  placement: AdPlacement;
  priority: number;
  startDate: Date;
  endDate: Date;
  status: AdStatus;
  rejectionReason?: string;
  budget: number;
  pricingModel: AdPricingModel;
  currency: string;
  targetLocation?: string;
  impressions: number;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

// Ad Request Document Interface
export interface IAdRequest extends Document {
  name: string;
  email: string;
  company: string;
  phone?: string;
  adType: string;
  message?: string;
  status: 'pending' | 'contacted' | 'converted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Ad Schema
const adSchema = new Schema<IAd>(
  {
    title: {
      type: String,
      required: [true, 'Ad title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    advertiser: {
      type: String,
      required: [true, 'Advertiser name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['image', 'video', 'html'],
      default: 'image',
    },
    mediaUrl: {
      type: String,
      trim: true,
    },
    htmlContent: {
      type: String,
    },
    targetUrl: {
      type: String,
      required: [true, 'Target URL is required'],
      trim: true,
    },
    placement: {
      type: String,
      enum: ['LP_TOP_BANNER', 'LP_INLINE_1', 'LP_INLINE_2', 'LIST_SIDEBAR', 'DASH_TOP'],
      required: [true, 'Ad placement is required'],
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'paused', 'expired', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    pricingModel: {
      type: String,
      enum: ['cpm', 'cpc', 'fixed'],
      default: 'fixed',
    },
    currency: {
      type: String,
      default: 'USD',
    },
    targetLocation: {
      type: String,
      trim: true,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ad Request Schema
const adRequestSchema = new Schema<IAdRequest>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    adType: {
      type: String,
      required: [true, 'Ad type is required'],
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'converted', 'rejected'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
adSchema.index({ status: 1, placement: 1 });
adSchema.index({ startDate: 1, endDate: 1 });
adRequestSchema.index({ status: 1, createdAt: -1 });

export const Ad = mongoose.model<IAd>('Ad', adSchema);
export const AdRequest = mongoose.model<IAdRequest>('AdRequest', adRequestSchema);
