import mongoose, { Schema, Document } from 'mongoose';

/**
 * Records that a given Alert was already notified about a given supply entity,
 * so the buyer is never pinged twice for the same teacher/vehicle.
 * The unique {alertId, entityId} index is the dedupe guarantee.
 */
export interface IAlertMatch extends Document {
  alertId: mongoose.Types.ObjectId;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  score?: number;
  notifiedAt: Date;
}

const schema = new Schema<IAlertMatch>(
  {
    alertId: { type: Schema.Types.ObjectId, ref: 'Alert', required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    score: { type: Number },
    notifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Dedupe: one notification per (alert, entity) pair, ever.
schema.index({ alertId: 1, entityId: 1 }, { unique: true });

export default (mongoose.models.AlertMatch as mongoose.Model<IAlertMatch>) ?? mongoose.model<IAlertMatch>('AlertMatch', schema);
