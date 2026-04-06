import { Schema, model, Types } from 'mongoose';
import { ICall } from '../interface/call.interface';

const CallSchema = new Schema<ICall>(
  {
    callId: {
      type: String,
      required: true
    },
    clientName: {
      type: String,
      required: true
    },
    status: {
      type: Number,
      required: true
    },
    direction: {
      type: Number,
      required: true
    },
    fromNumber: {
      type: String,
      required: true
    },
    toNumber: {
      type: String,
      required: true
    },
    agentId: {
      type: String,
      required: true
    },
    callLogs: [{
      eventType: String,
      callLogId: {
        type: Schema.Types.ObjectId,
        ref: 'CallLog'
      }
    }],
    disconnectionReason: {
      type: String,
      default: null
    },
    duration: {
      type: Number,
      default: 0
    },
    recordingUrl: {
      type: String,
      default: ""
    },
    callInterestStatus: {
      type: Boolean,
      default: false
    },
    leadStatus: {
      type: String,
      default: 'Unclassified'
    },
  },
  {
    timestamps: true,
    collection: 'Calls'
  },
);

export const Call = model<ICall>('Call', CallSchema, 'Calls');