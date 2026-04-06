// retell.service.ts - Updated RetellClient
import axios from "axios";

export class RetellClient {
  client: any;
  constructor(private apiKey: string) {
    this.client = axios.create({
      baseURL: process.env.RETELL_BASE_URL || 'https://api.retellai.com',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  }

  async getAllAgents() {
    const res = await this.client.get('/list-agents');
    return res.data || [];
  }

  async getAllPhoneNumbers() {
    try {
      const res = await this.client.get('/list-phone-numbers');
      return res.data || [];
    } catch (error) {
      console.warn('Failed to fetch Retell phone numbers:', error);
      return [];
    }
  }

  async getLLMDetails(llmId: string) {
    try {
      const res = await this.client.get(`/get-retell-llm/${llmId}`);
      return res.data || null;
    } catch (error) {
      console.warn(`Failed to fetch LLM details for ${llmId}:`, error);
      return null;
    }
  }

  async getAgentDetails(agentId: string) {
    try {
      const res = await this.client.get(`/get-agent/${agentId}`);
      return res.data || null;
    } catch (error) {
      console.warn(`Failed to fetch details for agent ${agentId}:`, error);
      return null;
    }
  }

  async getAllAgentsWithDetails() {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Fetch agents and phone numbers in parallel
    const [agents, phoneNumbers] = await Promise.all([
      this.getAllAgents(),
      this.getAllPhoneNumbers()
    ]);

    console.log('📞 Found Retell phone numbers:', phoneNumbers.length);

    // Build agent-to-phone mapping
    const agentToPhoneMap = new Map();
    phoneNumbers.forEach((phone: any) => {
      const inboundAgentId = phone.inbound_agent_id;
      const outboundAgentId = phone.outbound_agent_id;

      if (outboundAgentId) {
        if (!agentToPhoneMap.has(outboundAgentId)) {
          agentToPhoneMap.set(outboundAgentId, {
            inbound: null,
            outbound: null,
            phoneNumbers: []
          });
        }

        const phoneInfo = {
          id: phone.phone_number_id || phone.phone_number,
          number: phone.phone_number,
          formatted: phone.phone_number_pretty || phone.phone_number,
          direction: 'outbound',
          nickname: phone.nickname || null,
          lastModificationTimestamp: phone.last_modification_timestamp || null
        };

        agentToPhoneMap.get(outboundAgentId).phoneNumbers.push(phoneInfo);
        agentToPhoneMap.get(outboundAgentId).outbound = phoneInfo;
      }

      if (inboundAgentId && inboundAgentId !== outboundAgentId) {
        if (!agentToPhoneMap.has(inboundAgentId)) {
          agentToPhoneMap.set(inboundAgentId, {
            inbound: null,
            outbound: null,
            phoneNumbers: []
          });
        }

        const phoneInfo = {
          id: phone.phone_number_id || phone.phone_number,
          number: phone.phone_number,
          formatted: phone.phone_number_pretty || phone.phone_number,
          direction: 'inbound',
          nickname: phone.nickname || null,
          lastModificationTimestamp: phone.last_modification_timestamp || null
        };

        agentToPhoneMap.get(inboundAgentId).phoneNumbers.push(phoneInfo);
        agentToPhoneMap.get(inboundAgentId).inbound = phoneInfo;
      }
    });

    // Enrich agents with details and phone information
    const detailed = [];
    for (const agent of agents) {
      try {
        const agentId = agent.agent_id;

        // Fetch detailed agent information
        const details = await this.getAgentDetails(agentId);

        let llmDetails = null;
        let generalPrompt = null;
        
        if (details?.response_engine?.type === 'retell-llm' && details?.response_engine?.llm_id) {
          llmDetails = await this.getLLMDetails(details.response_engine.llm_id);
          generalPrompt = llmDetails?.general_prompt || null;
          await delay(100); // Rate limit between LLM calls
        }

        // Merge all data
        const enriched = {
          ...agent,
          ...details,
          general_prompt: generalPrompt || details?.general_prompt || agent.general_prompt || null,
          post_call_analysis_data: details?.post_call_analysis_data || agent.post_call_analysis_data || [],
          // ✅ Extract webhook URL
          webhookUrl: details?.webhook_url || agent.webhook_url || null
        };

        // Add phone bindings
        const phoneInfo = agentToPhoneMap.get(agentId);
        enriched.phoneBindings = phoneInfo?.phoneNumbers || [];
        enriched.inboundPhone = phoneInfo?.inbound || null;
        enriched.outboundPhone = phoneInfo?.outbound || null;
        enriched.primaryPhone = phoneInfo?.outbound?.number ||
          phoneInfo?.inbound?.number ||
          phoneInfo?.phoneNumbers[0]?.number ||
          null;

        console.log(`✅ Enriched Retell agent: ${enriched.agent_name}, webhook: ${enriched.webhookUrl ? 'Yes' : 'No'}`);

        detailed.push(enriched);
        await delay(100); // Rate limiting
      } catch (error) {
        console.warn(`Failed to fetch details for Retell agent ${agent.agent_id}:`, error);
        const phoneInfo = agentToPhoneMap.get(agent.agent_id);
        detailed.push({
          ...agent,
          webhookUrl: null,
          phoneBindings: phoneInfo?.phoneNumbers || [],
          inboundPhone: phoneInfo?.inbound || null,
          outboundPhone: phoneInfo?.outbound || null,
          primaryPhone: phoneInfo?.outbound?.number ||
            phoneInfo?.inbound?.number ||
            phoneInfo?.phoneNumbers[0]?.number ||
            null
        });
      }
    }

    return detailed;
  }
}