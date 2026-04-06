import { Document, Types } from 'mongoose';

export interface IMessages extends Document {
  companyId: Types.ObjectId;

  conversationId: string;

  senderId: Types.ObjectId;
  fromNumber: string;
  senderType: 'user' | 'contact';

  clientId: string;
  toNumber: string;
  receiverType: 'user' | 'contact';

  message: string;
  messageType: 'text' | 'image' | 'file' | 'system';

  callId?: Types.ObjectId | null;

  status: 'pending' | 'sent' | 'delivered' | 'read';

  isArchived: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}
