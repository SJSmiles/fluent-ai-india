import { Document, Types } from 'mongoose';

export interface IBatchCall extends Document {
  name: string;
  agentId: Types.ObjectId;
  phoneNumber: string;
  date: string;
  time: string;
  utcDateTime?: any;
  actualStartDateTime?: any,
  status: number;
  maxAttempts: number;
  totalRecipient: number;
  processedRecipient?: number;
  isArchived: boolean;
  updatedBy: Types.ObjectId;
  createdBy: Types.ObjectId;
  companyId: Types.ObjectId;
}
