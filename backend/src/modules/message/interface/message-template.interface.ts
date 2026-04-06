import { Document, Types } from 'mongoose';

export interface IMessageTemplate extends Document {
  companyId: Types.ObjectId;
  name: string;
  message: string;
  isActive: boolean;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
