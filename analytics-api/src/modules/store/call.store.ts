export const sessions = new Map<string, any>();

export const callMeta = new Map<
    string,
    {
        agentId: string;
        prompt: string;
        voiceId?: string;
        direction: string;
        startTime: number;
    }
>();