import { Schema, model } from 'mongoose';
import { IRecipients } from '../interface/recipients.interface';

const recipientSchema = new Schema<IRecipients>(
  {
    batchCallId: {
      type: Schema.Types.ObjectId,
      ref: 'BatchCall',
      required: true
    },
    number: {
      type: String,
      required: true
    },
    gender: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },

    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
    },
    callResponses: {
      type: Schema.Types.Mixed,
      default: [],
    },
    attemptLength: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 0
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    status: {
      type: Number,
      default: 1 // 1: PENDING, 2: UN_SUCCESS, 3: SUCCESS, 4:DEAD
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const Recipient = model<IRecipients>('Recipients', recipientSchema, 'Recipients');
