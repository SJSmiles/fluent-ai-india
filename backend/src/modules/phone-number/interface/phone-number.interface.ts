import { Document, Types } from 'mongoose';

export interface IPhoneNumber extends Document {
  companyId: Types.ObjectId;
  name: string;
  phoneNumber: string;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
