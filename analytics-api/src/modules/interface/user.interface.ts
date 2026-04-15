import { Types } from 'mongoose';

export interface IUser {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber: string;
  password: string;
  isArchived: boolean;
  isAdmin: boolean;
  status: number;
  companyId: Types.ObjectId;
  tokenVersion?: number;
  lastLoginAt?: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  bmbyConfig: boolean;
  sheetConfig: boolean;
}