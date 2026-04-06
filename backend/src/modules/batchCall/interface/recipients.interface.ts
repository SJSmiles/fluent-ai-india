import { Document, Schema } from 'mongoose';

export interface IRecipients extends Document {
  batchCallId: Schema.Types.ObjectId;
  number: string;
  gender: 'masculine' | 'feminine' | 'neuter' | '';
  salutation: string,
  firstName: string;
  errorMessage: string;
  lastName: string;
  callFrom: string;
  email: string;
  attemptLength: number;
  maxAttempts: number;
  callAttemptLength: number;
  callStatus: number;
  logs: any;
  callResponse: any;
  callData: any;
  allCallData: any
  errorMessages: any;
  bmbyId: number;
  leadContactId: number;
  companyId: Schema.Types.ObjectId;
  status: number; // 1: PENDING, 2: UN_SUCCESS, 3: SUCCESS
  country?: string;
  isArchived: boolean;
}
