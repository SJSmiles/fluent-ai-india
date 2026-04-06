import { Schema, model } from 'mongoose';
import { IAgent } from '../interface/agent.interface';

const agentSchema = new Schema<IAgent>(
  {
    agentName: {
      type: String,
      required: true
    },
    retellAgentId: {
      type: String
    },
    retellLlmId: {
      type: String
    },
    phone: {
      type: String,
      required: true
    },
    agentPromptType: {
      type: String,
      enum: ['Single Prompt', 'Multi Prompt', 'Conversation Flow', 'Custom LLM'],
      default: 'Multi Prompt'
    },
    agentPrompt: {
      type: String,
      required: true
    },
    postCallAnalysisData: {
      type: Array
    },
    analysisPrompt: {
      type: String,
    },
    callType: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create a Model
export const Agent = model<IAgent>('Agent', agentSchema, 'Agent');
