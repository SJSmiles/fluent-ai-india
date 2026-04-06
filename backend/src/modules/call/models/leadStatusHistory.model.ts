import { Schema, model } from 'mongoose';
import { ILeadStatusHistory } from '../interface/lead-status-history.interface';

const leadStatusHistorySchema = new Schema<ILeadStatusHistory>(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true
    },
    leadStatus: {
      type: String,
      required: true,
      enum: [
        'Already Bought',
        'Interested - Meeting',
        'Interested - Meeting Booked',
        'Ask Human Call',
        'Interested - Task',
        'Interested Task',
        'Interested Meeting',
        'Human Review Needed',
        'Human Call Needed',
        'Human Action Needed - Task',
        'Do Not Contact',
        'Invalid Lead',
        'No Human Detected',
        'Unclassified',
        'Not Interested',
        'Not Interested - For Now',
        'Changed Interest'
      ],
      index: true
    },
    callId: {
      type: String,
      required: true,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true
    },
    createdByType: {
      type: String,
      enum: ['manual', 'system'],
      required: true,
      default: 'manual',
      index: true
    },
    changeReason: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: true,
    collection: 'LeadStatusHistory'
  }
);

// Compound indexes for efficient queries
leadStatusHistorySchema.index({ phoneNumber: 1, companyId: 1, createdAt: -1 });
leadStatusHistorySchema.index({ callId: 1, createdAt: -1 });
leadStatusHistorySchema.index({ companyId: 1, createdAt: -1 });
leadStatusHistorySchema.index({ createdBy: 1, createdAt: -1 });
leadStatusHistorySchema.index({ phoneNumber: 1, companyId: 1, createdByType: 1 });

export const LeadStatusHistory = model<ILeadStatusHistory>(
  'LeadStatusHistory',
  leadStatusHistorySchema,
  'LeadStatusHistory'
);