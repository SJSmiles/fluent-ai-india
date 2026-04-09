import WebSocket from 'ws';

export async function startDeepgram({
    agentConfig,
    onTranscript,
}: {
    agentConfig: any;
    onTranscript: (text: string) => Promise<void>;
}) {

    const ws = new WebSocket(
        'wss://api.deepgram.com/v1/listen?model=nova-3&encoding=mulaw&sample_rate=8000&language=hi',
        {
            headers: {
                Authorization: `Token ${agentConfig.deepgramKey}`, // ✅ from agent
            },
        }
    );

    ws.on('open', () => {
        console.log('🟢 Deepgram connected');
    });

    ws.on('message', async (data: any) => {
        try {
            const msg = JSON.parse(data.toString());

            const transcript =
                msg.channel?.alternatives?.[0]?.transcript;

            if (transcript && transcript.trim()) {
                await onTranscript(transcript);
            }
        } catch (err) {
            console.error('[Deepgram] Parse error:', err);
        }
    });

    ws.on('error', (err) => {
        console.error('[Deepgram] Error:', err);
    });

    ws.on('close', () => {
        console.log('[Deepgram] Closed');
    });

    return {
        send: (audio: Buffer) => {
            if (ws.readyState === 1) {
                ws.send(audio);
            }
        },
        finish: () => {
            ws.close();
        },
    };
}