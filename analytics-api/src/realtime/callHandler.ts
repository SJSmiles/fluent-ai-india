import { redis } from '../modules/store/redis';
import { startDeepgram } from '../integrations/deepgram';
import { generateTtsAudio } from '../integrations/elevenlabs';
import { getAgentReply } from './llm';

// ✅ Helper to replace placeholders like {name}
function replacePlaceholders(text: string, context: any) {
    if (!text) return '';
    return text.replace(/{(.*?)}/g, (match, key) => {
        const value = context[key.trim()];
        return value !== undefined ? value : match;
    });
}

// ✅ Helper to clean LLM response (removes script markers, phase tags, brackets)
function cleanReply(text: string) {
    if (!text) return '';
    return text
        .replace(/\[.*?\]/g, '')        // Remove everything in brackets [Like This]
        .replace(/\(.*?\)/g, '')        // Remove everything in parenthesis (Like This)
        .replace(/Phase\s+\d+:/gi, '')  // Remove "Phase 1:" etc.
        .replace(/\*\*/g, '')           // Remove bold markdown
        .replace(/assistant:/gi, '')    // Remove prefix
        .replace(/user:/gi, '')         // Remove prefix
        .replace(/\s+/g, ' ')          // Normalize spaces
        .trim();
}

// ✅ Helper to save a transcript turn to Redis list
async function saveTranscriptTurn(callSid: string, role: string, text: string) {
    try {
        await redis.rpush(
            `transcript:${callSid}`,
            JSON.stringify({ role, text, ts: new Date().toISOString() })
        );
        await redis.expire(`transcript:${callSid}`, 3600);
    } catch (err) {
        console.error('❌ Failed to save transcript turn to Redis:', err);
    }
}

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
    let processingReply = false;
    let currentStep = 1;

    let history: any[] = []; // ✅ Conversation History

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
            if (msg.event !== 'media') {
                console.log(`📩 Received event: ${msg.event}`);
            }

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


                    // ✅ Initialize step in Redis
                    await redis.set(`step:${callSid}`, '1', 'EX', 3600);
                    currentStep = 1;


                    // ✅ Start Deepgram WITH agentConfig
                    deepgramSession = await startDeepgram({
                        agentConfig,
                        onTranscript: async (text: string) => {
                            console.log(`🗣 STT: ${text}`);

                            // Skip if already processing a reply
                            if (processingReply) {
                                console.log('⏭ Skipping transcript — already processing reply');
                                return;
                            }

                            // User interrupted — clear audio
                            if (isSpeaking) {
                                console.log('🛑 User interrupted agent, clearing audio...');
                                socket.send(JSON.stringify({ event: 'clearAudio' }));
                                isSpeaking = false;
                            }

                            processingReply = true;

                            try {
                                // Add user message to history
                                history.push({ role: 'user', content: text });

                                // ✅ Save user turn to Redis transcript
                                if (callSid) {
                                    await saveTranscriptTurn(callSid, 'user', text);
                                }

                                const reply = await getAgentReply(agentConfig, history, currentStep);
                                console.log(`🤖 LLM: ${reply}`);

                                // ✅ Check for [[STOP_NOW]] BEFORE cleaning markers
                                const shouldHangUp = reply.includes('[[STOP_NOW]]');

                                // ✅ Clean all markers, brackets, and phase tags
                                const cleanedReply = cleanReply(reply.replace('[[STOP_NOW]]', ''));

                                if (cleanedReply) {
                                    isSpeaking = true;
                                    console.log(`🔊 Generating TTS for: ${cleanedReply}`);
                                    const audioBase64 = await generateTtsAudio(
                                        cleanedReply,
                                        agentConfig.voiceId,
                                        agentConfig.elevenLabsKey
                                    );
                                    console.log(`✅ TTS Generated (${audioBase64.length} chars)`);

                                    socket.send(JSON.stringify({
                                        event: 'playAudio',
                                        media: {
                                            payload: audioBase64,
                                            contentType: 'audio/x-mulaw',
                                            sampleRate: 8000
                                        },
                                    }));

                                    // Add assistant reply to history
                                    history.push({ role: 'assistant', content: cleanedReply });

                                    // ✅ Save assistant turn to Redis transcript
                                    if (callSid) {
                                        await saveTranscriptTurn(callSid, 'assistant', cleanedReply);
                                    }

                                    // Increment step after each successful reply
                                    currentStep = Math.min(currentStep + 1, 10);
                                    if (callSid) {
                                        await redis.set(`step:${callSid}`, String(currentStep), 'EX', 3600);
                                    }
                                    console.log(`📍 Step advanced to: ${currentStep}`);
                                }

                                if (shouldHangUp) {
                                    console.log('🏁 LLM requested [[STOP_NOW]]. Hanging up in 5s...');
                                    setTimeout(() => {
                                        socket.close();
                                    }, 5000);
                                }

                            } catch (err) {
                                console.error('❌ TTS/LLM error:', err);
                            } finally {
                                processingReply = false;
                                isSpeaking = false;
                            }
                        },
                    });

                    // 🚀 PLAY FIRST MESSAGE (if exists)
                    if (agentConfig.firstMessage) {
                        const welcomeText = replacePlaceholders(agentConfig.firstMessage, agentConfig);
                        console.log(`👋 First Message: ${welcomeText}`);

                        try {
                            isSpeaking = true;
                            const audioBase64 = await generateTtsAudio(
                                welcomeText,
                                agentConfig.voiceId,
                                agentConfig.elevenLabsKey
                            );

                            socket.send(JSON.stringify({
                                event: 'playAudio',
                                media: {
                                    payload: audioBase64,
                                    contentType: 'audio/x-mulaw',
                                    sampleRate: 8000
                                },
                            }));

                            history.push({ role: 'assistant', content: welcomeText });

                            // ✅ Save first message to Redis transcript
                            if (callSid) {
                                await saveTranscriptTurn(callSid, 'assistant', welcomeText);
                            }

                        } catch (err) {
                            console.error('❌ First message TTS error:', err);
                        } finally {
                            isSpeaking = false;
                        }
                    }

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
                    // ✅ Cleanup step from Redis (transcript key cleaned by queue worker)
                    if (callSid) await redis.del(`step:${callSid}`);
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
        if (callSid) redis.del(`step:${callSid}`);
    });

    socket.on('error', (err: any) => {
        console.error('❌ WS error:', err);
        clearInterval(interval);
        deepgramSession?.finish();
    });
}