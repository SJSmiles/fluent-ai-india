import { Document } from 'mongoose';

export interface IGoogleSheetDataProcess extends Document {
  companyId: string;
  agentId?: string | null;
  createdBy: string;
  createdAt: Date;
  outboundNumber?: string | null;
  sheetData: Record<string, any>;
  reason?: string | null;  // description of missing fields or reason for invalid status
  callStatus?: 1 | 2 | 3;  // 1 = not called, 2 = calling, 3 = completed
  status: 'successful' | 'unsuccessful',
  attemptLength: 0,
  errorMessage: string,
  endedReason: string,
  callId: string,
}
