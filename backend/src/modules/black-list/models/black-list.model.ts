import { Schema, model } from 'mongoose';
import { IBlackList } from '../interface/black-list.interface';

const BlackListSchema = new Schema<IBlackList>(
  {
    toNumber: {
      type: String,
      required: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    clientName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      required: true,
      default: 'Do Not Contact'
    },
    status: {
      type: Number,
      required: true,
      default: 1
    },
    callUUID: {
      type: String,
      default: null
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: 'BlackList'
  }
);

// Compound index to prevent duplicate entries per company
BlackListSchema.index({ toNumber: 1, companyId: 1 }, { unique: true });

export const BlackList = model<IBlackList>('BlackList', BlackListSchema);