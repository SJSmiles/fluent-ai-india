// src/modules/services/agent.service.ts
import { connectDB } from 'database/mongo-connection';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';


export async function getAgentConfig(agentId: string) {
    const database = await connectDB();
    const db = mongoose.connection.db;

    // ✅ collections
    const agentCollection = db.collection('Agent');
    const companyCollection = db.collection('Company');

    // ✅ convert to ObjectId
    const objectId = new ObjectId(agentId);

    const agent = await agentCollection.findOne({ _id: objectId });

    if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
    }

    const company = await companyCollection.findOne({ _id: agent.companyId });

    if (!company) {
        throw new Error(`Company not found for agent: ${agentId}`);
    }

    return {
        agentId,
        companyId: company._id.toString(),
        prompt: agent.prompt,
        voiceId: agent.voiceId,
        firstMessage: agent.firstMessage,
        endCallMessage: agent.endCallMessage,
        endCallInvoke: agent.endCallInvoke,
        deepgramKey: company.deepgramApiKey,
        elevenLabsKey: company.elevenLabsApiKey,
        openaiKey: process.env.VLLM_API_KEY,
    };
}