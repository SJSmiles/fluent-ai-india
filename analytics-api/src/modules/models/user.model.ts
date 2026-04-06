import { Schema, model } from 'mongoose';
import { IUser } from '../interface/user.interface';

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    lastName: {
      type: String,
      default: '',
      lowercase: true
    },
    email: {
      type: String,
      default: '',
      lowercase: true
    },
    phoneNumber: {
      type: String,
      default: null
    },
    password: {
      type: String,
      default: ''
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Company'
    },
    status: {
      type: Number,
      default: 1
    },
    isHSAdmin: {
      type: Boolean,
      default: false
    },
    isSuperAdmin: {
      type: Boolean,
      default: false
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    tokenVersion: {
      type: Number,
      default: 0,
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    isArchived: {
      type: Boolean,
      default: false
    },

    profileCompletion: {
      type: Boolean,
      default: true
    },
    bmbyUserName: {
      type: String,

    },
    bmbyPassword: {
      type: String,
    },
    bmbyProjectId: {
      type: String,
    },
    bmbyUserId: {
      type: String,
    },
    bmbyConfig: {
      type: Boolean,
      default: false
    },
    sheetConfig: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  });

// 3. Create a Model.
export const User = model<IUser>('User', userSchema, 'User');