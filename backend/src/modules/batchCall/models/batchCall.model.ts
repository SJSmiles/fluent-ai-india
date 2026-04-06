import { Schema, model } from 'mongoose';
import { IBatchCall } from '../interface/batchCall.interface';

const batchCallSchema = new Schema<IBatchCall>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    callFrom: {
      type: String,
      required: true,
      default: 'vapi',
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: false,
      default: null,
    },
    assistantId: {
      type: String,
      required: false,
      default: null,
    },
    phoneNumberId: {
      type: String,
      required: false,
      default: null,
    },
    schedule: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      required: true,
      default: '',
    },
    date: {
      type: String,
      required: true,
      default: '',
    },
    time: {
      type: String,
      required: true,
      default: '',
    },
    utcDateTime: {
      type: Date,
      required: true,
      default: '',
    },
    actualStartDateTime: {
      type: Date,
      required: false,
      default: '',
    },
    maxAttempts: {
      type: Number,
      default: 1
    },
    status: {
      type: Number,
      default: 1,
    },
    totalChunk: {
      type: Number,
      default: 0,
    },
    completedChunk: {
      type: Number,
      default: 0,
    },
    totalRecipient: {
      type: Number,
      default: 0,
    },
    processedRecipient: {
      type: Number,
      default: 0,
    },
    responseBatchCallId: {
      type: String,
      default: '',
    },
    logs: {
      type: Schema.Types.Mixed, // to allow any object
      default: [],
    },
    cronExpression: {
      type: String,
      required: false,
      default: '',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isContactSheet: {
      type: Boolean,
      default: false,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const BatchCall = model<IBatchCall>('BatchCall', batchCallSchema, 'BatchCall');