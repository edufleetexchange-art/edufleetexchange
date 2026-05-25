import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  employeeId?: string;
  department?: string;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStaffProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, unique: true },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: function (v: string | undefined | null): string | undefined {
        if (v === null || v === undefined || v === '') return undefined;
        return v.trim();
      },
    },
    department: { type: String, trim: true },
    permissions: { type: [String], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (_d, ret: any) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } },
  }
);

export default (mongoose.models.StaffProfile as mongoose.Model<IStaffProfile>) ?? mongoose.model<IStaffProfile>('StaffProfile', schema);
