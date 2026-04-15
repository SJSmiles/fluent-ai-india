// modules/queue/workers/end-call.worker.ts

import { Call } from "modules/models/calls.model";;
import { redis } from "modules/store/redis";
import { callQueue } from "../call";

export function registerEndCallWorker() {
  callQueue.process('end-call', async (job) => {
    const {
      callSid,
      agentId,
      companyId,
      userId,
      recipientId,
      batchCallId,
      followupBatchCallId,
      direction,
      fromNumber,
      toNumber,
      startedAt,
      endedAt,
      duration,
      recordingUrl,
    } = job.data;

    console.log(`⚙️  Processing end-call job for: ${callSid}`);

    try {
      // ✅ Fetch transcript turns from Redis
      const rawEntries: string[] = await redis.lrange(`transcript:${callSid}`, 0, -1);

      const transcript = rawEntries.map((entry: string) => {
        try {
          const parsed = JSON.parse(entry);
          return {
            role: parsed.role || 'unknown',
            text: parsed.text || '',
            ts: parsed.ts ? new Date(parsed.ts) : new Date(),
          };
        } catch {
          return { role: 'unknown', text: entry, ts: new Date() };
        }
      });

      console.log(`📝 Transcript turns collected: ${transcript.length}`);

      // ✅ Idempotency — skip if already saved
      const existing = await Call.findOne({ callUUID: callSid });
      if (existing) {
        console.log(`⚠️  Call already saved, skipping: ${callSid}`);
        await redis.del(`transcript:${callSid}`);
        return;
      }

      // ✅ Save Call document
      await Call.create({
        callUUID: callSid,
        agentId,
        companyId,
        recipientId: recipientId || null,
        batchCallId: batchCallId || null,
        followupBatchCallId: followupBatchCallId || null,
        direction,
        fromNumber,
        toNumber,
        callStatus: 'completed',
        recordingUrl: recordingUrl || '',
        duration: duration || 0,
        transcript,
        startedAt: startedAt ? new Date(startedAt) : undefined,
        endedAt: endedAt ? new Date(endedAt) : new Date(),
      });

      console.log(`✅ Call saved to DB: ${callSid}`);

      // ✅ Cleanup Redis
      await redis.del(`transcript:${callSid}`);

    } catch (err: any) {
      console.error(`❌ Failed to save call ${callSid}:`, err.message);
      throw err; // Re-throw so Bull retries automatically
    }
  });

  console.log('✅ end-call worker registered');
}