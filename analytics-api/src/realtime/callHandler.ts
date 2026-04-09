import { redis } from '../modules/store/redis';
import { startDeepgram } from '../integrations/deepgram';
import { generateTtsAudio } from '../integrations/elevenlabs';
import { getAgentReply } from './llm';

export async function callHandler(connection: any, req: any) {
    const socket = connection;

    // ✅ Get agentId
    let agentId = req.params?.agentId;
    if (!agentId && req.url) {
        const parts = req.url.split('/');
        agentId = parts[parts.length - 1];
    }

    if (!agentId) {
        console.error('❌ Missing agentId');
        socket.terminate();
        return;
    }

    console.log(`✅ WS connected — agentId: ${agentId}`);

    let callSid: string | null = null;
    let agentConfig: any = null;
    let deepgramSession: any = null;
    let isSpeaking = false;

    // ✅ HEARTBEAT
    const interval = setInterval(() => {
        if (socket.readyState === 1) {
            socket.ping();
        }
    }, 5000);

    socket.on('message', async (raw: any) => {
        try {
            if (!raw) return;

            let msg;
            try {
                msg = JSON.parse(raw.toString());
            } catch {
                return;
            }

            if (!msg.event) return;

            switch (msg.event) {

                // 📞 START CALL
                case 'start': {
                    callSid = msg.start?.callId ?? msg.start?.call_id;

                    console.log(`📞 Call started: ${callSid}`);

                    const stored = await redis.get(`call:${callSid}`);

                    try {
                        agentConfig = stored ? JSON.parse(stored) : { agentId };
                    } catch (err) {
                        console.error('❌ Redis JSON parse error');
                        agentConfig = { agentId };
                    }

                    // ✅ Start Deepgram WITH agentConfig
                    deepgramSession = await startDeepgram({
                        agentConfig,
                        onTranscript: async (text: string) => {
                            if (!text.trim() || isSpeaking) return;

                            console.log(`🗣 STT: ${text}`);

                            isSpeaking = true;

                            try {
                                const reply = await getAgentReply(text, agentConfig);
                                console.log(`🤖 LLM: ${reply}`);

                                const audioBase64 = await generateTtsAudio(
                                    reply,
                                    agentConfig.voiceId,
                                    agentConfig.elevenLabsKey
                                );

                                socket.send(JSON.stringify({
                                    event: 'media',
                                    media: {
                                        payload: audioBase64,
                                    },
                                }));

                            } catch (err) {
                                console.error('❌ TTS/LLM error:', err);
                            } finally {
                                isSpeaking = false;
                            }
                        },
                    });

                    break;
                }

                // 🎤 AUDIO STREAM
                case 'media': {
                    if (!deepgramSession) return;

                    const audio = Buffer.from(msg.media.payload, 'base64');
                    deepgramSession.send(audio);
                    break;
                }

                // ❌ STOP CALL
                case 'stop': {
                    console.log(`❌ Call stopped: ${callSid}`);
                    deepgramSession?.finish();
                    break;
                }
            }

        } catch (err) {
            console.error('❌ Message error:', err);
        }
    });

    socket.on('close', () => {
        console.log(`🔌 WS closed — ${callSid}`);
        clearInterval(interval);
        deepgramSession?.finish();
    });

    socket.on('error', (err: any) => {
        console.error('❌ WS error:', err);
        clearInterval(interval);
        deepgramSession?.finish();
    });
}