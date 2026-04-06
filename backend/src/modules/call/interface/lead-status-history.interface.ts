import { Types } from 'mongoose';

export interface ILeadStatusHistory {
  _id?: Types.ObjectId;
  phoneNumber: string;
  companyId: Types.ObjectId;
  leadStatus: string;
  callId: string;
  createdBy: Types.ObjectId;
  createdByType: 'manual' | 'system';
  changeReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILeadStatusHistoryCreatePayload {
  phoneNumber: string;
  leadStatus: string;
  callId: string;
  changeReason?: string;
}

export interface ILeadStatusHistoryListPayload {
  phoneNumber?: string;
  callId?: string;
  companyId?: string;
  createdBy?: string;
  createdByType?: 'manual' | 'system';
  startDate?: string;
  endDate?: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
}

export interface ILeadStatusHistoryResponse {
  message: string;
  data: any;
  success: boolean;
  totalCount?: number;
}