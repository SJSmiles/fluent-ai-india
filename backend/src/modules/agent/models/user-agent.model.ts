import { Schema, model } from 'mongoose';
import { IUserAgent } from '../interface/user-agent.interface';

const agentSchema = new Schema<IUserAgent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company'
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent'
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
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Create a Model
export const UserAgent = model<IUserAgent>('UserAgents', agentSchema, 'UserAgents');
