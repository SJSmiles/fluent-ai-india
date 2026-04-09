// src/modules/services/agent.service.ts
import { Types } from 'mongoose';
import { Agent } from '../models/agent.model';
import { Company } from '../models/company.model';

export async function getAgentConfig(agentId: string) {
    // ✅ Convert string → ObjectId first
    const objectId = new Types.ObjectId(agentId);

    const agent = await Agent.findById(objectId).lean();

    if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
    }

    const company = await Company.findById(agent.companyId).lean();

    if (!company) {
        throw new Error(`Company not found for agent: ${agentId}`);
    }

    return {
        agentId,
        companyId: company._id.toString(),
        prompt: agent.prompt,
        voiceId: agent.voiceId,
        firstMessage: (agent as any).firstMessage,
        endCallMessage: (agent as any).endCallMessage,
        endCallInvoke: (agent as any).endCallInvoke,
        deepgramKey: company.deepgramApiKey,
        elevenLabsKey: company.elevenLabsApiKey,
        openaiKey: process.env.VLLM_API_KEY,
    };
}