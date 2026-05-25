import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordResetToken extends Document {
  accountId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IPasswordResetToken>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index so MongoDB auto-deletes expired tokens
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (mongoose.models.PasswordResetToken as mongoose.Model<IPasswordResetToken>)
  ?? mongoose.model<IPasswordResetToken>('PasswordResetToken', schema);
