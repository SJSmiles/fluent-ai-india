import { Schema, model } from 'mongoose';
import { IAgent } from '../interface/agent.interface';

const agentSchema = new Schema<IAgent>(
  {
    name: { type: String, required: true },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    voiceId: { type: String },
    prompt: { type: String, required: true },
    firstMessage: { type: String },
    endCallMessage: { type: String },
    endCallInvoke: { type: Boolean, default: false },
    version: { type: Schema.Types.Mixed },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
export const Agent = model<IAgent>('Agent', agentSchema, 'Agent');
