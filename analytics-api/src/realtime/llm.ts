import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: 'not-required',
    baseURL: 'https://vllm.visions.team/v1', // ✅ FORCE FIX
});

export async function getAgentReply(
    transcript: string,
    agentConfig: any
): Promise<string> {
    try {
        console.log('agentConfig', agentConfig);
        const systemPrompt =
            agentConfig?.prompt ||
            'You are a helpful AI voice assistant. Speak briefly and clearly.';

        const response = await client.chat.completions.create({
            model: process.env.VLLM_MODEL || 'ibm-granite/granite-3.1-8b-instruct',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: transcript },
            ],
            temperature: 0.7,
            max_tokens: 100,
        });

        const text = response.choices?.[0]?.message?.content;

        return text?.trim() || 'Sorry, I did not understand that.';
    } catch (err: any) {
        console.error('❌ vLLM error:', err?.response?.data || err.message);
        return 'Sorry, something went wrong.';
    }
}