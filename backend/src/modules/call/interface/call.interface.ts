import { Types } from 'mongoose';

export interface IFilterPayload {
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  skip?: number;
  limit?: number;
  status?: number;
  search?: string;
  companyId?: string;
  leadStatus?: string;
  userId: Types.ObjectId;
  timezone: string;
  agentId?: string;
}

export interface ITranscriptMessage {
  role: 'user' | 'agent';
  content: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  timestamp: number;
  end_timestamp: number;
}

export interface ICallInGroup {
  callId: string;
  date: string;
  duration: string;
  status: string;
  leadStatus: string;
  transcriptPreview: ITranscriptMessage[];
  _id: string;
  createdAt: Date;
  disconnectionReason?: string;
  direction?: string;
}

export interface ICallGroup {
  phoneNumber: string;
  totalCalls: number;
  latestCallDate: Date;
  customerName: string;
  agentName?: {};
  bmbyId?: string;
  syncInBmby: boolean;
  status: string;
  leadStatus: string;
  disconnectionReason?: string;
  duration: string;
  durationInMs?: number;
  unreadComments: number;
}

export interface IGroupedCallResponse {
  data: ICallGroup[];
  totalCount: number;
}

// Phone detail call interface
export interface IPhoneDetailCall {
  callId: string;
  date: string;
  duration: string;
  status: string;
  leadStatus: string;
  disconnectionReason?: string;
  direction?: string;
  agentName?: string;
  agentId?: string;
  recordingUrl?: string;
  transcript: ITranscriptMessage[];
  summary?: string;
  createdAt: Date;
  startTimestamp?: number;
  endTimestamp?: number;
  _id: string;
}

// Populated User Info (for comments and history)
export interface IPopulatedUser {
  _id?: string;
  name: string;
  email?: string;
}

// Comment interface for phone detail response
export interface IPhoneDetailComment {
  _id?: string;
  comment: string;
  createdBy: IPopulatedUser;
  isEdited: boolean;
  readBy: Types.ObjectId[];
  callId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Lead status history interface for phone detail response
export interface IPhoneDetailLeadStatusHistory {
  _id?: string;
  leadStatus: string;
  callId: string;
  createdBy: IPopulatedUser;
  createdByType: 'manual' | 'system';
  changeReason?: string;
  createdAt?: Date;
}

// ✅ NEW: Followup detail interface
export interface IPhoneDetailFollowup {
  _id?: string;
  batchCallId?: string;
  followupNumber?: number;
  date?: string;
  time?: string;
  timezone?: string;
  utcDateTime?: Date;
  status?: number;
  totalRecipient?: number;
  processedRecipient?: number;
  createdAt?: Date;
}

// Phone detail response interface
export interface IPhoneDetailResponse {
  success: boolean;
  data: {
    phoneNumber: string;
    customerName: string;
    totalAttempts: number;
    bmbyId?: string;
    syncStatus?: string;
    calls: IPhoneDetailCall[];
    comments: IPhoneDetailComment[];
    leadStatusHistory: IPhoneDetailLeadStatusHistory[];
    followup?: IPhoneDetailFollowup;  // ✅ NEW - Single object (earliest scheduled)
  };
  message?: string;
}

// Phone detail payload with pagination
export interface IPhoneDetailPayload {
  phoneNumber: string;
  userId: Types.ObjectId;
  companyId?: string;
  targetUserId?: string;
  skip?: number;
  limit?: number;
}