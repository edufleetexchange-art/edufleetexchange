import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  userId: mongoose.Types.ObjectId;
  employeeId?: string;
  userName: string;
  userRole: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    employeeId: String,
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    targetId: String,
    targetType: String,
    details: {
      type: String,
      required: true,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ?? mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
