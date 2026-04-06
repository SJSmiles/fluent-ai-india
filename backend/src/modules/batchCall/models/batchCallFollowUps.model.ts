import { Schema, model } from 'mongoose';
import { IBatchCallFollowUps } from '../interface/batchCallFollowUps.interface';

const batchCallFollowUpsSchema = new Schema<IBatchCallFollowUps>(
    {
        batchCallId: {
            type: Schema.Types.ObjectId,
            ref: 'BatchCall',
            required: true,
        },
        timezone: {
            type: String,
            required: true,
            default: '',
        },
        phoneNumberId: {
            type: String,
            required: false,
            default: null,
        },
        callFrom: {
            type: String,
            required: true,
            default: 'vapi',
        },
        date: {
            type: String,
            required: true,
            default: '',
        },
        time: {
            type: String,
            required: true,
            default: '',
        },
        utcDateTime: {
            type: Date,
            required: true,
            default: '',
        },
        actualStartDateTime: {
            type: Date,
            required: false,
            default: '',
        },
        status: {
            type: Number,
            default: 1,
        },
        followupNumber: {
            type: Number,
            default: 1,
        },
        totalChunk: {
            type: Number,
            default: 0,
        },
        completedChunk: {
            type: Number,
            default: 0,
        },
        totalRecipient: {
            type: Number,
            default: 0,
        },
        processedRecipient: {
            type: Number,
            default: 0,
        },
        cronExpression: {
            type: String,
            required: false,
            default: '',
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
        retry: {
            type: Boolean,
            default: false,
        },
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company'
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },

    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const BatchCallFollowUps = model<IBatchCallFollowUps>('BatchCallFollowUps', batchCallFollowUpsSchema, 'BatchCallFollowUps');