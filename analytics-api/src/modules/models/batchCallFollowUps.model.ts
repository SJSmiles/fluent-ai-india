import { Schema, model } from 'mongoose';
import { IBatchCallFollowUps } from '../interface/batchCallFollowUps.interface';

const batchCallFollowUpsSchema = new Schema<IBatchCallFollowUps>(
    {
        batchCallId: {
            type: Schema.Types.ObjectId,
            ref: 'BatchCall',
            required: true,
        },
        phoneNumber: {
            type: String,
            required: false,
            default: null,
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
        totalRecipient: {
            type: Number,
            default: 0,
        },
        processedRecipient: {
            type: Number,
            default: 0,
        },
        isArchived: {
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