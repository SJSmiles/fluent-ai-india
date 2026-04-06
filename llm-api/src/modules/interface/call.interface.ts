import { Document, Types } from 'mongoose';

export interface ICallLog {
  eventType: string;
  callLogId: Types.ObjectId;
}

export interface ICall extends Document {
  callId: string;
  clientName: string;
  status: number;
  direction: number; // 1 for outbound, 2 for inbound
  fromNumber: string;
  toNumber: string;
  agentId: string;
  callLogs: ICallLog[];
  disconnectionReason?: string;
  duration: number;
  recordingUrl: string;
  callInterestStatus: boolean;
  leadStatus: 'Unclassified' | 'Hot' | 'Warm' | 'Cold' | 'Converted' | 'Rejected';
  createdBy: Types.ObjectId;
}