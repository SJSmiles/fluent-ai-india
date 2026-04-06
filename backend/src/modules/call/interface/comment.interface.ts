import { Types } from 'mongoose';

export interface IComment {
  _id?: Types.ObjectId;
  phone: string;
  companyId: Types.ObjectId;
  createdBy: Types.ObjectId;
  comment: string;
  readBy: Types.ObjectId[];
  callId?: Types.ObjectId;
  isEdited?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICommentCreatePayload {
  phone: string;
  comment: string;
  callId?: string;
}

export interface ICommentListPayload {
  phone: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
}

export interface IMarkAsReadPayload {
  phone: string;
}

export interface ICommentResponse {
  message: string;
  data: any;
  success: boolean;
  totalCount?: number;
}