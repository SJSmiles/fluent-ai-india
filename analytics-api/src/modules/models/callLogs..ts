import { Schema, model } from 'mongoose';

const callLogsSchema = new Schema(
    {
        callUUID: { type: String, required: true, unique: true, index: true },
        logs: [
            {
                event: { type: String },
                timestamp: { type: Date, default: Date.now },
                details: { type: Schema.Types.Mixed },
            },
        ],
    },
    { timestamps: true }
);

export const CallLogs = model('CallLogs', callLogsSchema, 'CallLogs');