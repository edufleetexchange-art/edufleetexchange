import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  type: 'vehicle' | 'job' | 'supplier';
  description?: string;
  isActive: boolean;
  order: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      required: [true, 'Category type is required'],
      enum: ['vehicle', 'job', 'supplier'],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index for slug + type
categorySchema.index({ slug: 1, type: 1 }, { unique: true });
categorySchema.index({ type: 1, isActive: 1 });

const Category = mongoose.model<ICategory>('Category', categorySchema);

export default Category;
