import { Schema, model } from 'mongoose';
// Call model — add to Backend
const callsSchema = new Schema({
    callUUID: { type: String, required: true, unique: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    fromNumber: { type: String },
    toNumber: { type: String },
    callStatus: { type: String, default: 'initiated' },
    recordingUrl: { type: String },
    duration: { type: Number },
    transcript: [{ role: { type: String }, text: { type: String }, ts: { type: Date } }],
    summary: { type: String },
    leadStatus: { type: String },
    startedAt: { type: Date },
    endedAt: { type: Date },
}, { timestamps: true });

export const Calls = model('Calls', callsSchema, 'Calls');