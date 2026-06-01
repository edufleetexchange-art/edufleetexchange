import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  leadId?: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId; // Sales/Marketing User
  createdBy: mongoose.Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: Date, required: true },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  completedAt: { type: Date }
}, {
  timestamps: true
});

export default (mongoose.models.Task as mongoose.Model<ITask>) ?? mongoose.model<ITask>('Task', TaskSchema);
