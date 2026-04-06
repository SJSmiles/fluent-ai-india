import { Document, Types } from 'mongoose';

export interface IBatchCallFollowUps extends Document {
    batchCallId: Types.ObjectId;
    timezone: string;
    phoneNumberId?: string;
    date: string;
    time: string;
    utcDateTime?: Date;
    actualStartDateTime?: Date,
    status: number;
    totalChunk: number;
    completedChunk: number;
    totalRecipient: number;
    followupNumber: number;
    callFrom: string;
    processedRecipient?: number;
    responseBatchCallId?: string;
    cronExpression?: string;
    callAttemptLength: number;
    isArchived: boolean;
    retry: boolean;
    updatedBy: Types.ObjectId;
    createdBy: Types.ObjectId;
    companyId: Types.ObjectId;
}