//model.ts  

import { Schema, model } from 'mongoose';
import { IUserApiKeys } from '../interface/userApiKeys.interface';

const userApiKeysSchema = new Schema<IUserApiKeys>(
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
      index: true
    },
    expiryTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (value: Date) {
          return value.getTime() > Date.now();
        },
        message: 'Expiry time must be in the future'
      },
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Company'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const UserApiKeys = model<IUserApiKeys>('UserApiKeys', userApiKeysSchema, 'UserApiKeys');
