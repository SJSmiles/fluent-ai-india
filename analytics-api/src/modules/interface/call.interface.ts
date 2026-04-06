import { Document } from 'mongoose';

export interface ICall extends Document {
  callId: string;
  clientName?: string;
  status: number;
  recordingUrl?: string;
  duration?: number;
  disconnectionReason?: string;
  direction?: number;
  fromNumber?: string;
  toNumber?: string;
  agentId?: string;
  createdAt?: Date;
  callLogs?: object[];
}
