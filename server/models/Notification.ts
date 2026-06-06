import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type:
    | 'approval'
    | 'rejection'
    | 'priority'
    | 'message'
    | 'system'
    | 'listing_approved'
    | 'listing_rejected'
    | 'subscription_expiring'
    | 'subscription_expired'
    | 'browse_limit_warning'
    | 'listing_limit_reached'
    | 'new_feature'
    | 'system_alert'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'consultant_added_to_roster'
    | 'consultant_consent_revoked'
    | 'placement_stage_changed'
    | 'interview_invitation'
    | 'interview_rescheduled'
    | 'interview_canceled'
    | 'placement_completed';
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high';
  link?: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'approval',
        'rejection',
        'priority',
        'message',
        'system',
        'listing_approved',
        'listing_rejected',
        'subscription_expiring',
        'subscription_expired',
        'browse_limit_warning',
        'listing_limit_reached',
        'new_feature',
        'system_alert',
        'info',
        'success',
        'warning',
        'error',
        'consultant_added_to_roster',
        'consultant_consent_revoked',
        'placement_stage_changed',
        'interview_invitation',
        'interview_rescheduled',
        'interview_canceled',
        'placement_completed',
      ],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    link: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default (mongoose.models.Notification as mongoose.Model<INotification>) ?? mongoose.model<INotification>('Notification', notificationSchema);
