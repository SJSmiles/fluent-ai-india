import { Document, Types } from 'mongoose';

export interface IBatchCall extends Document {
  name: string;
  callFrom?: string;
  agentId: Types.ObjectId;
  assistantId?: string;
  phoneNumberId?: string;
  schedule: boolean;
  timezone: string;
  date: string;
  time: string;
  utcDateTime?: Date;
  actualStartDateTime?: Date,
  status: number;
  totalChunk: number;
  completedChunk: number;
  maxAttempts: number;
  totalRecipient: number;
  processedRecipient?: number;
  responseBatchCallId: string;
  logs: any;
  cronExpression?: string;
  isArchived: boolean;
  isContactSheet?: boolean;
  callAttemptLength: number;
  updatedBy: Types.ObjectId;
  createdBy: Types.ObjectId;
  companyId: Types.ObjectId;
}
