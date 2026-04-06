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
    errorMessage: {
      type: String,
      required: false,
      default: ''
    },
    gender: {
      type: String,
      enum: ['masculine', 'feminine', 'neuter', 'male', 'female', '', null],
      required: false
    },
    email: {
      type: String,
      required: false
    },
    callFrom: {
      type: String,
      required: true,
      default: 'vapi',
    },
    salutation: {
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

    callData: {
      type: Schema.Types.Mixed, // to allow any object
      default: {},
    },
    allCallData: {
      type: Schema.Types.Mixed, // to allow any object
      default: [],
    },
    logs: {
      type: Schema.Types.Mixed, // to allow any object
      default: [],
    },
    callResponse: {
      type: Schema.Types.Mixed, // to allow any object
      default: [],
    },
    errorMessages: {
      type: Schema.Types.Mixed, // to allow any object
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
    bmbyId: {
      type: Number,
      required: false
    },
    leadContactId: {
      type: Number,
      required: false
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    status: {
      type: Number,
      default: 1 // 1: PENDING, 2: UN_SUCCESS, 3: SUCCESS, 4:DEAD
    },
    country: {
      type: String,
      trim: false,
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
