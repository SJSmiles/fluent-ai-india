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
      callLogs: [Object],
    },
    {
      timestamps: true,
    },
  );
  
  export const Call = model<ICall>('Call', CallSchema, 'Calls');
