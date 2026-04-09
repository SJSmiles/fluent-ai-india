import axios from 'axios';

/**
 * Generate TTS audio using ElevenLabs (agent-based key)
 */
export async function generateTtsAudio(
    text: string,
    voiceId: string,
    apiKey: string
): Promise<string> {
    try {
        if (!text) throw new Error('Text is required for TTS');
        if (!voiceId) throw new Error('VoiceId is required');
        if (!apiKey) throw new Error('ElevenLabs API key missing');

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`;

        const response = await axios({
            method: 'POST',
            url,
            headers: {
                Accept: 'audio/x-mulaw',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey, // ✅ from agent
            },
            data: {
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                },
            },
            responseType: 'arraybuffer',
        });

        if (!response.data) {
            throw new Error('No audio data received from ElevenLabs');
        }

        return Buffer.from(response.data).toString('base64');
    } catch (error: any) {
        console.error('❌ TTS Error:', error.response?.data || error.message);
        throw error;
    }
}