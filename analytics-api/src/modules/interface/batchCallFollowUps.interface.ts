import { Document, Types } from 'mongoose';

export interface IBatchCallFollowUps extends Document {
    batchCallId: Types.ObjectId;
    timezone: string;
    phoneNumber: string;
    date: string;
    time: string;
    utcDateTime?: any;
    actualStartDateTime?: any,
    status: number;
    totalRecipient: number;
    processedRecipient?: number;
    isArchived: boolean;
    updatedBy: Types.ObjectId;
    createdBy: Types.ObjectId;
    companyId: Types.ObjectId;
}