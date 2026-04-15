import { Call } from "modules/models/calls.model";
import { redis } from "modules/store/redis";

export async function tryTestSaveCall(callSid: string, meta: any): Promise<void> {
    // ✅ Wait for BOTH hangup (duration) AND recording (url) before saving
    if (!meta.hangupReceived || !meta.recordingReceived) {
        console.log(
            `[trySaveCall] ${callSid} — waiting: hangup=${meta.hangupReceived}, recording=${meta.recordingReceived}`
        );
        return;
    }

    // ✅ Prevent double-save
    if (meta.saved) {
        console.log(`[trySaveCall] ${callSid} — already saved, skipping`);
        return;
    }

    try {
        await Call.findOneAndUpdate(
            { callUUID: callSid },
            {
                $set: {
                    callUUID: callSid,
                    agentId: meta.agentId,
                    recipientId: meta.recipientId || null,
                    batchCallId: meta.batchCallId || null,
                    followupBatchCallId: meta.followupBatchCallId || null,
                    companyId: meta.companyId,
                    userId: meta.userId,
                    direction: meta.direction || 'outbound',
                    fromNumber: meta.fromNumber,
                    toNumber: meta.toNumber,
                    callStatus: meta.callStatus || 'completed',
                    recordingUrl: meta.recordingUrl || null,
                    duration: meta.duration || 0,
                    startedAt: meta.startedAt ? new Date(meta.startedAt) : null,
                    endedAt: meta.endedAt ? new Date(meta.endedAt) : null,
                },
            },
            { upsert: true, new: true }
        );

        // Mark saved then let Redis TTL clean up
        await redis.set(
            `call:${callSid}`,
            JSON.stringify({ ...meta, saved: true }),
            'EX', 300 // 5 min is enough after save
        );

        console.log(`[trySaveCall] ✅ Saved call ${callSid} to DB`);
    } catch (err: any) {
        console.error(`[trySaveCall] ❌ DB save failed for ${callSid}:`, err.message);
    }
}