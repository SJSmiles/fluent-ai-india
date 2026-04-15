import { redis } from "modules/store/redis";
import { testCallQueue } from "../testCall";
import { TestCalls } from "modules/models/testCalls.model";

export function registerEndTestCallWorker() {
  testCallQueue.process('test-call-end', async (job) => {

    const {
      callSid,
      callLogsId,
      agentId,
      companyId,
      userId,
      direction,
      fromNumber,
      toNumber,
      startedAt,
      endedAt,
      duration,
      event,
      recordingUrl,
      recipientId,
      batchCallId,
      followupBatchCallId,
    } = job.data;

    console.log(`⚙️ Processing call end: ${callSid}`);

    try {
      // ✅ 1. GET TRANSCRIPT FROM REDIS
      const rawEntries: string[] = await redis.lrange(`transcript:${callSid}`, 0, -1);

      const transcript = rawEntries.map((entry: string) => {
        try {
          const parsed = JSON.parse(entry);
          return {
            role: parsed.role || null,
            text: parsed.text || null,
            ts: parsed.ts ? new Date(parsed.ts) : new Date(),
          };
        } catch {
          return {
            role: null,
            text: entry,
            ts: new Date(),
          };
        }
      });

      // ✅ 2. FINAL SAVE (ALL FIELDS FILLED)
      await TestCalls.updateOne(
        { callUUID: callSid },
        {
          $set: {
            callUUID: callSid,

            agentId: agentId || null,
            recipientId: recipientId || null,
            batchCallId: batchCallId || null,
            followupBatchCallId: followupBatchCallId || null,

            companyId: companyId || null,
            userId: userId || null,

            direction: direction || null,
            callLogsId: callLogsId || null,

            fromNumber: fromNumber || null,
            toNumber: toNumber || null,

            callStatus: 'completed',
            event: event || 'Hangup',

            recordingUrl: recordingUrl || null,
            duration: duration || 0,

            transcript: transcript || [],

            summary: null,        // 🔥 future AI
            leadStatus: null,    // 🔥 future AI

            startedAt: startedAt ? new Date(startedAt) : null,
            endedAt: endedAt ? new Date(endedAt) : new Date(),
          },
        },
        { upsert: true }
      );

      console.log(`✅ Call saved (all fields): ${callSid}`);

      // ✅ 3. CLEANUP
      await redis.del(`transcript:${callSid}`);

    } catch (err: any) {
      console.error(`❌ Worker failed: ${callSid}`, err);
      throw err;
    }
  });

  console.log('✅ test-call-end worker registered');
}