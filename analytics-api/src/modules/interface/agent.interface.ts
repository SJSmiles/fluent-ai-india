// src/modules/interface/agent.interface.ts
import { Types } from 'mongoose';

export interface IAgent {
  name: string;
  prompt: string;
  postCallAnalysisData?: any[];
  postCallStatus?: any[];
  version?: any;
  voiceId?: string;
  createdBy?: Types.ObjectId;   // ← was string
  updatedBy?: Types.ObjectId;   // ← was string
  companyId?: Types.ObjectId;   // ← was string
  isArchived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}