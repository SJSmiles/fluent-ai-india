import { Schema, model } from 'mongoose';

const testCallSchema = new Schema(
    {
        callUUID: { type: String, required: true, unique: true, index: true },

        agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
        recipientId: { type: Schema.Types.ObjectId, ref: 'Recipient', default: null },
        batchCallId: { type: Schema.Types.ObjectId, ref: 'BatchCall', default: null },
        followupBatchCallId: { type: Schema.Types.ObjectId, ref: 'BatchCallFollowUps', default: null },

        companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

        direction: { type: String, enum: ['inbound', 'outbound'], required: true },
        disconnectionReason: { type: String, default: null },
        callLogsId: { type: Schema.Types.ObjectId, ref: 'CallLogs' },

        fromNumber: { type: String, default: null },
        toNumber: { type: String, default: null },

        callStatus: { type: String, default: 'initiated' },
        event: { type: String, default: null },

        recordingUrl: { type: String, default: null },
        duration: { type: Number, default: null },

        summary: { type: String, default: null },
        leadStatus: { type: String, default: null },

        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
        firstName: { type: String, default: null },
        lastName: { type: String, default: null },
        gender: {
            type: String,
            default: null
        },
        email: {
            type: String,
            default: null
        },
    },
    { timestamps: true }
);

export const TestCalls = model('TestCalls', testCallSchema, 'TestCalls');