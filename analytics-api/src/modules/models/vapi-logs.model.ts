// modules/models/vapiCall.model.ts
import { Schema, model, Document } from 'mongoose';

export interface IVapiCall extends Document {
  headers: any;
  body: any;
  signature: string;
  createdAt: Date;
}

const VapiCallSchema = new Schema<IVapiCall>({
  headers: { type: Object, required: true },
  body: { type: Object, required: true },
  signature: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const VapiLogsModel = model<IVapiCall>('CallLogsVapi', VapiCallSchema, 'CallLogsVapi');

