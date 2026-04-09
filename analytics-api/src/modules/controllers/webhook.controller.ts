import { redis } from '../store/redis';
import { getAgentConfig } from '../services/agent.service';
import { callQueue } from '../queue/queue';
import { generatePlivoXml } from '../../helper/plivo';

export async function incomingCallHandler(req: any, reply: any) {
    try {
        const { agentId } = req.params;
        const callSid = req.body?.CallUUID;

        if (!agentId || !callSid) {
            return reply.code(400).send('Missing agentId or CallUUID');
        }

        const ngrokUrl = process.env.NGROK_URL!;
        const config = await getAgentConfig(agentId);

        await redis.set(
            `call:${callSid}`,
            JSON.stringify({ ...config, agentId }),
            'EX',
            3600
        );

        const xml = generatePlivoXml(ngrokUrl, agentId);
        console.log('Generated XML:', xml);

        return reply.type('text/xml').send(xml);

    } catch (error) {
        console.error(error);
        return reply
            .code(500)
            .type('text/xml')
            .send('<Response><Speak>Error</Speak></Response>');
    }
}

export async function callStatusHandler(req: any, reply: any) {
    try {
        console.log('req.params', req.params);
        console.log('req.body', req.body);
        const callSid = req.body?.CallUUID;
        if (!callSid) return reply.send({ success: true });

        if (req.body.CallStatus === 'completed') {
            const metaData = await redis.get(`call:${callSid}`);
            if (!metaData) {
                console.log('⚠️ No metadata found for', callSid);
                return reply.send({ success: true });
            }

            const meta = JSON.parse(metaData);

            await callQueue.add('end-call', {
                callSid,
                agentId: meta.agentId,
                companyId: meta.companyId,
                duration: Number(req.body.Duration || 0),
                recordingUrl: req.body.RecordingUrl || '',
            });

            await redis.del(`call:${callSid}`); // ✅ cleanup after queue
            console.log('📦 Job queued for', callSid);
        }

        return reply.send({ success: true });

    } catch (error) {
        console.error('Call status error:', error);
        return reply.send({ success: true });
    }
}