import { Schema, model } from 'mongoose';
import { IMessages } from '../interface/messages.interface';

const MessagesSchema = new Schema<IMessages>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    fromNumber: {
      type: String,
      required: true
    },
    senderType: {
      type: String,
      enum: ['user', 'contact'],
      required: true
    },
    clientId: {
      type: String,
      required: true
    },
    receiverType: {
      type: String,
      enum: ['user', 'contact'],
      required: true
    },
    toNumber: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text'
    },
    callId: {
      type: Schema.Types.ObjectId,
      ref: 'Calls',
      default: null
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    },

    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const Messages = model<IMessages>(
  'Messages',
  MessagesSchema,
  'Messages'
);
