import { Document, Schema } from 'mongoose';

export interface IRecipients extends Document {
  batchCallId: Schema.Types.ObjectId;
  number: string;
  gender: string;
  firstName: string;
  lastName: string;
  email: string;
  attemptLength: number;
  maxAttempts: number;
  callResponses: any;
  companyId: Schema.Types.ObjectId;
  status: number; // 1: PENDING, 2: UN_SUCCESS, 3: SUCCESS
  isArchived: boolean;
}
