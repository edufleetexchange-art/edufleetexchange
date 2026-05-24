import mongoose, { Schema, Document } from 'mongoose';

export interface ITeacherProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  experience: number;
  qualifications: string[];
  subjects: string[];
  bio?: string;
  location?: string;
  preferredLocation?: string[];
  currentInstitute?: string;
  achievements?: string[];
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITeacherProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    experience: { type: Number, default: 0, min: 0 },
    qualifications: { type: [String], default: [] },
    subjects: { type: [String], default: [] },
    bio: { type: String, trim: true },
    location: { type: String, trim: true },
    preferredLocation: { type: [String], default: [] },
    currentInstitute: { type: String, trim: true },
    achievements: { type: [String], default: [] },
    isAvailable: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

schema.index({ subjects: 1 });
schema.index({ location: 1 });
schema.index({ experience: 1 });

export default (mongoose.models.TeacherProfile as mongoose.Model<ITeacherProfile>) ?? mongoose.model<ITeacherProfile>('TeacherProfile', schema);
