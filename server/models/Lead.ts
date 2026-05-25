import mongoose, { Schema, Document } from 'mongoose';

export interface ILead extends Document {
  name: string;
  email: string;
  phone: string;
  instituteName?: string;
  type: 'institute' | 'teacher' | 'vendor' | 'individual';
  status: 'new' | 'contacted' | 'negotiating' | 'closed' | 'lost';
  notes: string;
  generatedBy: mongoose.Types.ObjectId; // Marketing User ID
  closedBy?: mongoose.Types.ObjectId; // Sales User ID
  isMarketingOnly: boolean; // Flag to keep lead within marketing cloud scope
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  instituteName: { type: String },
  type: { 
    type: String, 
    enum: ['institute', 'teacher', 'vendor', 'individual'], 
    default: 'institute' 
  },
  status: { 
    type: String, 
    enum: ['new', 'contacted', 'negotiating', 'closed', 'lost'], 
    default: 'new' 
  },
  notes: { type: String, default: '' },
  generatedBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  closedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
  isMarketingOnly: { type: Boolean, default: false }
}, {
  timestamps: true
});

export default mongoose.model<ILead>('Lead', LeadSchema);
