import mongoose, { Schema, Document } from 'mongoose';

export type ReviewTargetType = 'supplier';

export interface IReview extends Document {
  reviewerAccountId: mongoose.Types.ObjectId;
  targetType: ReviewTargetType;
  targetId: mongoose.Types.ObjectId;
  rating: number;
  body?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReview>(
  {
    reviewerAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    targetType: { type: String, enum: ['supplier'], required: true, default: 'supplier' },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    rating: {
      type: Number, required: true, min: 1, max: 5,
      validate: { validator: Number.isInteger, message: 'rating must be an integer 1-5' },
    },
    body: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ reviewerAccountId: 1, targetType: 1, targetId: 1 }, { unique: true });
schema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default (mongoose.models.Review as mongoose.Model<IReview>) ?? mongoose.model<IReview>('Review', schema);
