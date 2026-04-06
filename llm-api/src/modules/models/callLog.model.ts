import { Schema, model } from 'mongoose';
import { ICallLog } from '../interface/callLog.interface';

const CallLogSchema = new Schema<ICallLog>(
  {
    raw_data: {
      type: Schema.Types.Mixed, // to allow any object
      required: true,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    received_at: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  },
);

export const CallLog = model<ICallLog>('CallLogs', CallLogSchema, 'CallLogs');