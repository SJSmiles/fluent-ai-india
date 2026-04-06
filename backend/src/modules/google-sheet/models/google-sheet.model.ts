import mongoose, { Schema } from 'mongoose';
import { IGoogleSheetDataProcess } from '../interface/google-sheet.interface';

const GoogleSheetDataProcessSchema = new Schema<any>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, ref: 'Company' },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    outboundNumber: { type: String, default: null },
    sheetData: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, default: null },
    errorMessage: { type: String, default: null },
    endedReason: { type: String, default: null },
    callId: { type: String, default: null },
    callStatus: { type: Number, enum: [1, 2, 3], default: 1 },
    assistantId: { type: String, default: null },
    phoneNumberId: { type: String, default: null },
    status: { type: String, default: 'successful' },
    attemptLength: { type: Number, default: 0 },
    timeZone: { type: String, default: '' }
  },
  {
    collection: 'GoogleSheetDataProcess' // ✅ Explicit collection name
  }
);

export const GoogleSheetDataProcess = mongoose.model<IGoogleSheetDataProcess>(
  'GoogleSheetDataProcess',
  GoogleSheetDataProcessSchema
);
