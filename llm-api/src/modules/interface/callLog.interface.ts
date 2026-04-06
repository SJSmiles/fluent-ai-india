import { Document, Types } from 'mongoose';

export interface ICallLog extends Document {
  raw_data: any; // Store full webhook body
  received_at: Date;
  headers?: any;
  createdBy: Types.ObjectId;
}
