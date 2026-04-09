import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // ✅ OpenAI API Key
});

// ✅ Step labels for context injection
const STEP_LABELS: Record<number, string> = {
    1: 'Greet the user and ask if they have 5 minutes to discuss an ODCC loan. If user says anything positive (yes, haan, sure, perfect, bilkul, theek hai, हां, हाँ, जी, हां जी, etc.), move forward.',
    2: 'Ask the user what type of business they have. Options: Manufacturing, Trading, or Service. If user already answered this, acknowledge and move to next step.',
    3: 'Ask the user which city their business is in.',
    4: 'Ask how many years old their business is.',
    5: 'Ask about their approximate annual turnover.',
    6: 'Ask if they have any existing loans or EMIs running currently.',
    7: 'Ask: "Kya main ODCC loan ke baare mein thoda aur bataun?" If user says yes or anything positive (हां, हाँ, yes, bilkul, zaroor, batao), briefly explain ODCC in 1 line then move forward.',
    8: 'Ask the user for the name on their PAN card.',
    9: 'Ask the user for WhatsApp consent to send details.',
    10: 'Give a warm closing message thanking the user. Then append [[STOP_NOW]] at the very end.',
};

export async function getAgentReply(
    agentConfig: any,
    history: any[] = [],
    currentStep: number = 1
): Promise<string> {
    try {
        let systemPrompt =
            agentConfig?.prompt ||
            'You are a helpful AI voice assistant. Speak briefly and clearly.';

        // Support for placeholders like {name}
        systemPrompt = systemPrompt.replace(/{(.*?)}/g, (match: string, key: string) => {
            const val = agentConfig[key.trim()];
            return val !== undefined ? val : match;
        });

        // ✅ Core constraints
        systemPrompt = `### AGENT ROLE\n${systemPrompt}

### STRICT CONSTRAINTS
1. DIALOGUE ONLY: Only output the words you want to speak. Never output thoughts, labels, or text in brackets or parenthesis.

2. ONE QUESTION PER TURN: Ask exactly one question then stop and wait.

3. NATURAL HINGLISH: Mix Hindi and English naturally. Use words like Loan, Business, City, Turnover, Years.

4. BREVITY: Keep response under 15 words. This is a phone call.

5. ACKNOWLEDGMENT: Briefly acknowledge what the user said before asking next question.

6. HINDI + DEVANAGARI UNDERSTANDING: User will often respond in Hindi Devanagari script. You MUST understand and accept these as valid answers. Never say "Maaf kijiye" for these:
   - "हां" / "हाँ" / "हां जी" / "जी हां" / "हाँ जी" / "जी" = YES, agreement → move forward
   - "नहीं" / "नहीं जी" / "ना" / "नही" = NO → acknowledge and move forward
   - "उदयपुर" / "जयपुर" / "मुंबई" / any city in Devanagari = city name → accept it
   - "दस साल" / "पांच साल" / "तीन साल" / any number + साल = years → accept it
   - "दो करोड़" / "पचास लाख" / "एक करोड़" / any amount = turnover → accept it
   - "सेवा" / "सर्विस" = Service business type → accept it
   - "व्यापार" / "ट्रेडिंग" = Trading → accept it
   - Any Devanagari text that is a clear answer to your question = VALID, accept it and move on.

7. CONFIRMATION HANDLING: If user says anything positive like "haan", "yes", "perfect", "bilkul", "theek hai", "sure", "okay", "हां", "जी", "बिल्कुल", "ज़रूर" — treat it as agreement and move forward immediately.

8. FALLBACK: Only say "Maaf kijiye, kya aap firse bolenge?" ONLY if the response is genuinely random, irrelevant, or completely unintelligible. Never use it for Hindi/Devanagari answers.`;

        // ✅ Inject current step
        const stepInstruction = STEP_LABELS[currentStep];
        if (stepInstruction) {
            systemPrompt += `\n\n### YOUR CURRENT TASK (Step ${currentStep} of 10)\n${stepInstruction}\nFocus ONLY on this step. Do not skip ahead or repeat previous questions.`;
        }

        // ✅ Termination rule
        if (agentConfig.endCallInvoke) {
            systemPrompt += `\n\n### TERMINATION RULE\nOnly append [[STOP_NOW]] at the very end of the closing message in Step 10. Never use this tag in any other step.`;
        }

        // ✅ History already contains the latest user message — do NOT re-add
        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history,
        ];

        const response = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            messages: messages,
            temperature: 0.5,
            max_tokens: 150,
        });

        const text = response.choices?.[0]?.message?.content;

        return text?.trim() || 'Maaf kijiye, kya aap firse bolenge?';
    } catch (err: any) {
        console.error('❌ OpenAI error:', err?.response?.data || err.message);
        return 'Sorry, kuch technical issue aa gaya. Ek second.';
    }
}