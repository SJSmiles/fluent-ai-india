import { Schema, model } from 'mongoose';
import { ICall } from '../interface/call.interface';

const CallSchema = new Schema<ICall>(
  {
    callId: String,
    clientName: String,
    status: Number,
    recordingUrl: String,
    duration: Number,
    disconnectionReason: String,
    direction: Number,
    fromNumber: String,
    toNumber: String,
    agentId: String,
    batchCallId: String,
    email: String,
    bmbyId: Number,
    syncInBmby: { type: Boolean, default: false },
    callLogs: [Object],
    leadStatus: { type: String, default: 'Pending' },
    callInterestStatus: { type: Boolean, default: false },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

export const Call = model<ICall>('Call', CallSchema, 'Calls');
