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
    | 'error';
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
      ref: 'User',
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
        'error'
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

export default mongoose.model<INotification>('Notification', notificationSchema);
