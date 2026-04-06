//interface.ts


import { Types } from 'mongoose';

export interface IUserApiKeys {
  createdBy: Types.ObjectId;  
  userId: Types.ObjectId;    
  userEmail: string;   
  expiryTime: Date;     
  token: string;       
  companyId: Types.ObjectId; 
  isActive: boolean; 
  createdAt?: Date;
  updatedAt?: Date;
}