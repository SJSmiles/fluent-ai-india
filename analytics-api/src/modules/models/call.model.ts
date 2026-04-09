import { Schema, model } from 'mongoose';
// Call model — add to Backend
const callSchema = new Schema({
    callUUID: { type: String, required: true, unique: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    fromNumber: { type: String },
    toNumber: { type: String },
    status: { type: String, default: 'initiated' },
    recordingUrl: { type: String },
    duration: { type: Number },
    transcript: [{ role: { type: String }, text: { type: String }, ts: { type: Date } }],
    analysis: { type: Schema.Types.Mixed },  // postCallAnalysisData result
    startedAt: { type: Date },
    endedAt: { type: Date },
}, { timestamps: true });

export const Call = model('Call', callSchema, 'Call');