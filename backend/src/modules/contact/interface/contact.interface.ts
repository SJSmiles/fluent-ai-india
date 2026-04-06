import { Document, Types } from 'mongoose';

export interface IContact extends Document {
  companyId: Types.ObjectId;
  bmbyId: number; 
  number: string;  
  salutation?: string;
  firstName: string;
  lastName?: string; 
  gender?: 'masculine' | 'feminine' | 'neuter' | '';  
  email: string;
  country?: string;
  isActive: boolean;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}