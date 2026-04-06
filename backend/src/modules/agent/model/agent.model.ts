import { Schema, model } from 'mongoose';
import { IAgent } from '../interface/agent.interface';

const agentSchema = new Schema<IAgent>(
  {
    agentName: { type: String, required: true },
    firstMessage: { type: String, required: false },
    retellAgentId: { type: String },
    agentId: { type: String, required: true, index: true },
    assistantId: { type: String },
    retellLlmId: { type: String },
    phone: { type: String, required: true },
    voiceProvider: { type: String, default: 'vapi' },
    phoneBindings: { type: Array, default: [] },
    primaryPhone: { type: String },
    primaryCallType: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'inbound'
    },
    phoneMapping: {
      inbound: {
        number: { type: String },
        formatted: { type: String },
        callType: { type: String }
      },
      outbound: {
        number: { type: String },
        formatted: { type: String },
        callType: { type: String }
      }
    },
    vapiPhoneNumberId: { type: String, default: null },
    outboundNumber: { type: String, default: null },
    webhookUrl: { type: String, default: null },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    agentPromptType: {
      type: String,
      enum: ['Single Prompt', 'Multi Prompt', 'Conversation Flow', 'Custom LLM'],
      default: 'Multi Prompt'
    },
    agentPrompt: { type: String, required: true },
    postCallAnalysisData: { type: Array },
    analysisPrompt: { type: String },
    callType: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    responseEngine: {
      type: {
        type: String
      },
      llm_id: { type: String },
      version: { type: Schema.Types.Mixed }
    },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

agentSchema.index({ agentId: 1, companyId: 1 }, { unique: true });
agentSchema.index({ companyId: 1, isArchived: 1 });

export const Agent = model<IAgent>('Agent', agentSchema, 'Agent');
