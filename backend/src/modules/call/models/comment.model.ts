import { Schema, model } from 'mongoose';
import { IComment } from '../interface/comment.interface';

const commentSchema = new Schema<IComment>(
  {
    phone: {
      type: String,
      required: true,
      index: true
    },
    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Company',
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true
    },
    comment: {
      type: String,
      required: true,
      maxlength: 2000
    },
    readBy: {
      type: [Schema.Types.ObjectId],
      default: [],
      ref: 'User'
    },
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'Call',
      default: null
    },
    isEdited: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
commentSchema.index({ phone: 1, companyId: 1, createdAt: -1 });

// Index for finding unread comments
commentSchema.index({ phone: 1, companyId: 1, readBy: 1 });

export const Comment = model<IComment>('Comment', commentSchema, 'Comment');