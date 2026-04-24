import { redis } from '../store/redis';
import { getAgentConfig } from '../services/agent.service';
import jwt from 'jsonwebtoken';

import { TestCallLogs } from '../models/testCallLogs.model';
import { TestCalls } from 'modules/models/testCalls.model';
import { testCallProcessQueue } from 'modules/queue/queue';



export async function incomingTestCallHandler(req: any, reply: any) {
    try {
        const token = req.query.token as string;
        if (!token) throw new Error('TOKEN_MISSING');

        const decoded: any = jwt.verify(
            token,
            process.env.JWT_TOKEN_SECRET as string
        );

        const callUUID = req.body?.CallUUID;
        if (!callUUID) {
            return reply.code(400).type('text/xml')
                .send('<Response><Speak>Missing CallUUID</Speak></Response>');
        }

        const { agentId, userId, companyId } = decoded;

        const config = await getAgentConfig(agentId);

        console.log('📡 [incomingTestCallHandler] Event:', req?.body?.Event);

        // ✅ Store metadata in Redis
        await redis.set(
            `call:${callUUID}`,
            JSON.stringify({
                ...config,
                agentId,
                userId,
                companyId,
                direction: req.query?.direction || 'outbound',
                fromNumber: req.body?.From || null,
                toNumber: req.body?.To || null,
                startedAt: new Date().toISOString(),
            }),
            'EX',
            7200
        );

        // ✅ Create CallLogs (ONLY ONCE)
        await TestCallLogs.updateOne(
            { callUUID },
            {
                $setOnInsert: { callUUID },
                $push: {
                    logs: {
                        event: req.body?.Event || 'IncomingCall',
                        details: req.body,
                        timestamp: new Date(),
                    },
                },
            },
            { upsert: true }
        );

        // ✅ FIX: Pass BOTH token + callUUID
        const xml = generateTestPlivoXml(
            process.env.NGROK_URL!,
            agentId,
            token
        );

        return reply.type('text/xml').send(xml);

    } catch (err: any) {
        return handleError(err, reply, 'incomingTestCallHandler');
    }
}


export async function testCallStatusHandler(req: any, reply: any) {
    try {

        const event = req.body?.Event;
        const callUUID = req.query.callUUID || req.body?.CallUUID;

        if (!callUUID) return reply.send({ ok: false });

        console.log(`📡 testCallStatusHandler Event: ${event}`);

        // =====================================================
        // ✅ 1. UPSERT LOGS (COMMON FOR ALL EVENTS)
        // =====================================================
        const callLogs = await TestCallLogs.findOneAndUpdate(
            { callUUID },
            {
                $setOnInsert: { callUUID },
                $push: {
                    logs: {
                        event,
                        timestamp: new Date(),
                        details: req.body,
                    },
                },
            },
            { upsert: true, new: true }
        );


        // =====================================================
        // ✅ 2. HANGUP (FINAL SAVE)
        // =====================================================
        if (event === 'Hangup') {
            console.log(`⚙️ Processing call end: ${callUUID}`);

            const redisData = await redis.get(`call:${callUUID}`);
            const transcriptList = await redis.lrange(`transcript:${callUUID}`, 0, -1);

            const parsedMeta = redisData ? JSON.parse(redisData) : {};

            // ✅ SAFE TRANSCRIPT PARSE
            const transcript = transcriptList
                .map((t: string) => {
                    try {
                        const parsed = JSON.parse(t);

                        if (!parsed?.text || parsed.text.trim().length < 2) return null;

                        return {
                            role: parsed.role || null,
                            text: parsed.text || null,
                            ts: parsed.ts ? new Date(parsed.ts) : new Date(),
                        };
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);

            // ✅ Save transcript in logs
            await TestCallLogs.updateOne(
                { callUUID },
                {
                    $set: { transcript },
                }
            );



            // ✅ UPSERT FINAL CALL
            await TestCalls.updateOne(
                { callUUID },
                {
                    $set: {
                        callUUID,
                        agentId: parsedMeta.agentId || null,
                        companyId: parsedMeta.companyId || null,
                        userId: parsedMeta.userId || null,
                        direction: parsedMeta.direction || null,
                        callLogsId: callLogs?._id || null,
                        fromNumber: req.body?.From || null,
                        toNumber: req.body?.To || null,
                        callStatus: req.body?.CallStatus || 'completed',
                        event: event || null,
                        duration: Number(req.body?.Duration) || 0,
                        startedAt: parsedMeta.startedAt
                            ? new Date(parsedMeta.startedAt)
                            : null,
                        endedAt: req.body?.EndTime
                            ? new Date(req.body.EndTime)
                            : new Date(),
                        summary: null,
                        leadStatus: null,
                    },
                },
                { upsert: true }
            );

            let recordingUrl = null;

            // 1. Try from logs
            const callLogsFinal = await TestCallLogs.findOne({ callUUID });

            const recordEvent = callLogsFinal?.logs
                ?.filter((log: any) => log.event === 'RecordStop')
                ?.pop();

            recordingUrl = recordEvent?.details?.RecordUrl || null;

            // 2. Update only if exists
            if (recordingUrl) {
                await TestCalls.updateOne(
                    { callUUID },
                    {
                        $set: { recordingUrl },
                    }
                );
            }


            // ✅ Cleanup (SAFE DELAY OPTIONAL)
            await redis.del(`call:${callUUID}`);
            await redis.del(`transcript:${callUUID}`);

            //Add Process to Queue for Summary and Lead Status (FUTURE IMPROVEMENT)
            const job = await testCallProcessQueue.add(
                {
                    call_id: callUUID,
                    type: 'finalize',
                },
                {
                    removeOnComplete: true,
                    attempts: 3,
                }
            );

            console.log('✅ Job added:', job.id);
            console.log(`✅ Call saved with transcript: ${callUUID}`);
        }

        return reply.send({ ok: true });

    } catch (err) {
        console.error('❌ webhook error:', err);
        return reply.send({ ok: false });
    }
}
// =======================================================
// ❌ ERROR HANDLER (FIXED)
// =======================================================
function handleError(error: any, reply: any, context: string) {
    console.error(`❌ [${context}]`, error);

    return reply.code(500).send({
        success: false,
        message: error.message || 'Internal Server Error',
    });
}


export function generateTestPlivoXml(
    baseUrl: string,
    agentId: string,
    token: string
): string {
    const wsUrl = baseUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record
    recordSession="true"
    redirect="false"
    callbackUrl="${baseUrl}/webhook/test-call-status?token=${encodeURIComponent(token)}"
    callbackMethod="POST"
  />

  <Stream
    bidirectional="true"
    keepCallAlive="true"
    contentType="audio/x-mulaw;rate=8000"
    statusCallbackUrl="${baseUrl}/webhook/test-call-status?token=${encodeURIComponent(token)}"
    statusCallbackMethod="POST"
  >
    ${wsUrl}/realtime/${agentId}?token=${encodeURIComponent(token)}
  </Stream>

</Response>`;
}