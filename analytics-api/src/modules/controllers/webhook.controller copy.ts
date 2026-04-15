import { redis } from '../store/redis';
import { getAgentConfig } from '../services/agent.service';
import { generatePlivoXml } from '../../helper/plivo-call';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Agent } from '../models/agent.model';
import { Recipient } from '../models/recipient.model';
import { BatchCall } from '../models/batchCall.model';
import { BatchCallFollowUps } from '../models/batchCallFollowUps.model';
import { User } from '../models/user.model';
import { callQueue } from 'modules/queue/call';
import { callProcessQueue } from 'modules/queue/callProcess';
import { testCallQueue } from 'modules/queue/testCall';
import { testCallProcessQueue } from 'modules/queue/testCallProcess';
import { generateTestPlivoXml } from '@helper/plivo-test-call';
import { tryTestSaveCall } from 'modules/services/call.service';

// ─── Type ─────────────────────────────────────────────────────────────────────
interface DecodedToken {
    agentId: string;
    userId: string;
    recipientId: string;
    batchCallId?: string;
    followupBatchCallId?: string;
}

// ─── Step 1: Verify & type-check JWT ──────────────────────────────────────────
function validateDecodedToken(decoded: any): DecodedToken {
    const errors: string[] = [];

    if (!decoded.agentId || typeof decoded.agentId !== 'string')
        errors.push('agentId is missing or invalid');

    if (!decoded.recipientId || typeof decoded.recipientId !== 'string')
        errors.push('recipientId is missing or invalid');

    if (!decoded.userId || typeof decoded.userId !== 'string')
        errors.push('userId is missing or invalid');

    if (decoded.batchCallId !== undefined && typeof decoded.batchCallId !== 'string') { }
    errors.push('batchCallId must be a string if provided');


    if (errors.length > 0) throw new Error(`Invalid token payload: ${errors.join(', ')}`);

    return decoded as DecodedToken;
}

// ─── Step 2: ObjectId format check ────────────────────────────────────────────
function isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
}

// ─── Step 3: Convert string → ObjectId ────────────────────────────────────────
function toObjectId(id: string): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId(id);
}

// ─── Step 4: DB existence checks ──────────────────────────────────────────────
async function validateDecodedTokenInDB(decoded: DecodedToken): Promise<void> {
    const errors: string[] = [];

    // agentId — required
    if (!isValidObjectId(decoded.agentId)) {
        errors.push(`agentId "${decoded.agentId}" is not a valid ObjectId`);
    } else {
        const agentExists = await Agent.exists({
            _id: toObjectId(decoded.agentId),
            isArchived: false
        });
        if (!agentExists) errors.push(`Agent not found: ${decoded.agentId}`);
    }

    // recipientId — required
    if (!isValidObjectId(decoded.recipientId)) {
        errors.push(`recipientId "${decoded.recipientId}" is not a valid ObjectId`);
    } else {
        const recipientExists = await Recipient.exists({
            _id: toObjectId(decoded.recipientId),
            isArchived: false
        });
        if (!recipientExists) errors.push(`Recipient not found: ${decoded.recipientId}`);
    }

    // batchCallId — optional, skip if empty string or undefined
    if (decoded.batchCallId) {
        if (!isValidObjectId(decoded.batchCallId)) {
            errors.push(`batchCallId "${decoded.batchCallId}" is not a valid ObjectId`);
        } else {
            const batchExists = await BatchCall.exists({
                _id: toObjectId(decoded.batchCallId),
                isArchived: false
            });
            if (!batchExists) errors.push(`BatchCall not found: ${decoded.batchCallId}`);
        }
    }

    // followupBatchCallId — optional, skip if empty string or undefined
    if (decoded.followupBatchCallId) {
        if (!isValidObjectId(decoded.followupBatchCallId)) {
            errors.push(`followupBatchCallId "${decoded.followupBatchCallId}" is not a valid ObjectId`);
        } else {
            const followupExists = await BatchCallFollowUps.exists({
                _id: toObjectId(decoded.followupBatchCallId),
                isArchived: false
            });
            if (!followupExists) errors.push(`BatchCallFollowUps not found: ${decoded.followupBatchCallId}`);
        }
    }

    // followupBatchCallId — optional, skip if empty string or undefined
    if (decoded.userId) {
        if (!isValidObjectId(decoded.userId)) {
            errors.push(`userId "${decoded.userId}" is not a valid ObjectId`);
        } else {
            const userExists = await User.exists({
                _id: toObjectId(decoded.userId),
                isArchived: false
            });
            if (!userExists) errors.push(`User not found: ${decoded.userId}`);
        }
    }

    if (errors.length > 0) throw new Error(`DB validation failed: ${errors.join(', ')}`);
}

// ─── Shared: Extract & validate token from req.params ─────────────────────────
async function extractAndValidateToken(req: any): Promise<DecodedToken> {
    const { token } = req.params;

    if (!token) throw new Error('TOKEN_MISSING');

    const rawDecoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET as string);
    const decoded = validateDecodedToken(rawDecoded);
    await validateDecodedTokenInDB(decoded);

    return decoded;
}

// ─── Shared: Error handler ─────────────────────────────────────────────────────
function handleError(error: any, reply: any, context: string) {
    if (error.message === 'TOKEN_MISSING') {
        console.error(`[${context}] Token missing`);
        return reply.code(400).type('text/xml').send('<Response><Speak>Token missing</Speak></Response>');
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        console.error(`[${context}] JWT error:`, error.message);
        return reply.code(401).type('text/xml').send('<Response><Speak>Unauthorized</Speak></Response>');
    }

    if (error.message?.startsWith('DB validation failed')) {
        console.error(`[${context}] DB error:`, error.message);
        return reply.code(422).type('text/xml').send('<Response><Speak>Invalid call data</Speak></Response>');
    }

    console.error(`[${context}] Unexpected error:`, error.message);
    return reply.code(500).type('text/xml').send('<Response><Speak>Error</Speak></Response>');
}

// ─── Handler 1: incomingCallHandler ───────────────────────────────────────────
export async function incomingCallHandler(req: any, reply: any) {
    try {
        // ✅ Full token + DB validation
        const decoded = await extractAndValidateToken(req);
        console.log('[incomingCall] Token & DB validated:', decoded);

        const callSid = req.body?.CallUUID;
        if (!callSid) {
            return reply.code(400).type('text/xml').send('<Response><Speak>Missing CallUUID</Speak></Response>');
        }

        const { agentId, userId, recipientId, batchCallId, followupBatchCallId } = decoded;



        const ngrokUrl = process.env.NGROK_URL!;
        const config = await getAgentConfig(agentId);
        const metadata = req.query || {};

        // Store metadata in Redis
        await redis.set(
            `call:${callSid}`,
            JSON.stringify({
                ...config,
                ...metadata,
                agentId,
                userId: userId || null,
                recipientId,
                batchCallId: batchCallId || null,
                followupBatchCallId: followupBatchCallId || null,
                fromNumber: req.body?.From || req.body?.CallerNumber || '',
                toNumber: req.body?.To || req.body?.DestinationNumber || '',
                direction: (req.query?.direction as string) || 'outbound',
                startedAt: new Date().toISOString(),
            }),
            'EX',
            3600
        );

        const xml = generatePlivoXml(ngrokUrl, agentId);
        console.log('[incomingCall] Generated XML:', xml);

        return reply.type('text/xml').send(xml);

    } catch (error: any) {
        return handleError(error, reply, 'incomingCallHandler');
    }
}

// ─── Handler 2: callStatusHandler ─────────────────────────────────────────────
export async function callStatusHandler(req: any, reply: any) {
    try {
        // ✅ Full token + DB validation
        const decoded = await extractAndValidateToken(req);
        console.log('[callStatus] Token & DB validated:', decoded);

        const callSid = req.body?.CallUUID;
        if (!callSid) return reply.send({ success: true });

        if (req.body.CallStatus === 'completed') {
            const metaData = await redis.get(`call:${callSid}`);
            if (!metaData) {
                console.warn('[callStatus] ⚠️ No metadata found for', callSid);
                return reply.send({ success: true });
            }

            const meta = JSON.parse(metaData);

            await callQueue.add('end-call', {
                callSid,
                agentId: meta.agentId,
                userId: meta.userId || null,
                recipientId: meta.recipientId,
                batchCallId: meta.batchCallId || null,
                followupBatchCallId: meta.followupBatchCallId || null,
                companyId: meta.companyId,
                direction: meta.direction || 'outbound',
                fromNumber: meta.fromNumber || '',
                toNumber: meta.toNumber || '',
                startedAt: meta.startedAt || null,
                endedAt: new Date().toISOString(),
                duration: Number(req.body.Duration || 0),
                recordingUrl: req.body.RecordingUrl || '',
            });

            await redis.del(`call:${callSid}`);
            console.log('[callStatus] 📦 Job queued for', callSid);
            await callProcessQueue.add(
                { callSid: callSid },
                {
                    jobId: `${callSid}`,
                    removeOnComplete: true
                }
            );
        }

        return reply.send({ success: true });

    } catch (error: any) {
        return handleError(error, reply, 'callStatusHandler');
    }
}



export async function incomingTestCallHandler(req: any, reply: any) {
    try {
        const token = req.query.token as string;
        if (!token) throw new Error('TOKEN_MISSING');

        const decoded: any = jwt.verify(token, process.env.JWT_TOKEN_SECRET as string);

        const callSid = req.body?.CallUUID;
        if (!callSid) {
            return reply.code(400).type('text/xml').send('<Response><Speak>Missing CallUUID</Speak></Response>');
        }

        const { agentId, userId, companyId } = decoded;

        const config = await getAgentConfig(agentId);

        // ✅ Store metadata — recording URL will be patched in later by recording-callback
        await redis.set(
            `call:${callSid}`,
            JSON.stringify({
                ...config,
                agentId,
                userId,
                companyId,
                direction: (req.query?.direction as string) || 'outbound',
                fromNumber: req.body?.From || '',
                toNumber: req.body?.To || '',
                startedAt: new Date().toISOString(),
                recordingUrl: null,   // filled by recording-callback
                duration: null,       // filled by hangup/call-status
                saved: false,
            }),
            'EX',
            7200 // 2 hours to allow recording callback to come after hangup
        );

        // ✅ Pass callSid so stream-status callback can identify the call without JWT
        const xml = generateTestPlivoXml(process.env.NGROK_URL!, agentId, callSid);

        return reply.type('text/xml').send(xml);
    } catch (err: any) {
        console.error('[incomingTestCall] Error:', err);
        return reply.code(500).send('Error');
    }
}

export async function testCallStatusHandler(req: any, reply: any) {
    try {
        const token = req.query.token as string;
        if (!token) throw new Error('TOKEN_MISSING');

        const rawDecoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET as string);
        console.log('[callStatus] Token validated:', rawDecoded);

        console.log('📡 Stream Event:', req.body?.Event);

        const callSid = req.body?.CallUUID;
        if (!callSid) return reply.send({ success: true });

        // ✅ FIX: handle StopStream instead of CallStatus
        if (req.body.Event === 'StopStream') {

            const metaData = await redis.get(`call:${callSid}`);
            if (!metaData) {
                console.warn('[callStatus] ⚠️ No metadata found for', callSid);
                return reply.send({ success: true });
            }

            const meta = JSON.parse(metaData);

            await testCallQueue.add('end-call-test', {
                callSid,
                agentId: meta.agentId,
                userId: meta.userId || null,
                companyId: meta.companyId,
                direction: meta.direction || 'outbound',
                fromNumber: meta.fromNumber || '',
                toNumber: meta.toNumber || '',
                startedAt: meta.startedAt || null,
                endedAt: new Date().toISOString(),
                duration: 0, // ❗ not available in stream
                recordingUrl: '', // ❗ not available in stream
            });

            await redis.del(`call:${callSid}`);

            console.log('[callStatus] ✅ Stream ended, job queued:', callSid);

            await testCallProcessQueue.add(
                { callSid },
                {
                    jobId: `${callSid}`,
                    removeOnComplete: true
                }
            );
        }

        return reply.send({ success: true });

    } catch (error: any) {
        return handleError(error, reply, 'callStatusHandler');
    }
}



