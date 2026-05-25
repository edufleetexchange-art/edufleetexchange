import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  leadId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // The Sales/Marketing user who performed the activity
  type: 'call' | 'email' | 'meeting' | 'note' | 'other';
  subject: string;
  description: string;
  duration?: number; // In minutes
  outcome?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema: Schema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { 
    type: String, 
    enum: ['call', 'email', 'meeting', 'note', 'other'], 
    default: 'note' 
  },
  subject: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: Number },
  outcome: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<IActivity>('Activity', ActivitySchema);
