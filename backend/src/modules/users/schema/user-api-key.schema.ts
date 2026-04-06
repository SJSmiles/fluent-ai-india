import mongoose, { Schema, Document } from 'mongoose';
import { IUserApiKeys } from '../interface/userApiKeys.interface';

const UserApiKeySchema = new Schema<IUserApiKeys>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    expiryTime: {
      type: Date,
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    collection: 'UserApiKey'
  }
);

// Index for faster lookups
UserApiKeySchema.index({ token: 1, userEmail: 1 });
UserApiKeySchema.index({ userId: 1, isActive: 1 });
UserApiKeySchema.index({ expiryTime: 1 });

export const UserApiKey = mongoose.model<IUserApiKeys>('UserApiKeys', UserApiKeySchema);