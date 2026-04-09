// src/modules/models/agent.model.ts
import { Schema, model } from 'mongoose';
import { IAgent } from '../interface/agent.interface';

const agentSchema = new Schema<IAgent>(
  {
    name: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    voiceId: { type: String },
    prompt: { type: String, required: true },
    postCallAnalysisData: { type: [], default: [] },  // ← just []
    postCallStatus: { type: [], default: [] },          // ← just []
    version: { type: Schema.Types.Mixed },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Agent = model<IAgent>('Agent', agentSchema, 'Agent');