import { Document, Types } from 'mongoose';

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
  batchCallId?: string;
  email?: string;
  bmbyId?: number;
  syncInBmby: Boolean;
  createdAt?: Date;
  callLogs?: object[];
  leadStatus?: string;
  callInterestStatus?: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  companyId?: Types.ObjectId;
}
