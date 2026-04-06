// vapi.service.ts - Updated VapiClient
import axios from 'axios';

export class VapiClient {
  client: any;
  constructor(private apiKey: string) {
    this.client = axios.create({
      baseURL: process.env.VAPI_BASE_URL || 'https://api.vapi.ai',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  }

  async getAllAssistants() {
    const res = await this.client.get('/assistant');
    return res.data || [];
  }

  async getAllPhoneNumbers() {
    try {
      const res = await this.client.get('/phone-number');
      return res.data || [];
    } catch (error) {
      console.warn('Failed to fetch phone numbers:', error);
      return [];
    }
  }

  async getAssistantDetails(assistantId: string) {
    try {
      const res = await this.client.get(`/assistant/${assistantId}`);
      return res.data || null;
    } catch (error) {
      console.warn(`Failed to fetch details for assistant ${assistantId}:`, error);
      return null;
    }
  }

  async getAllAssistantsWithDetails() {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    
    // Fetch assistants and phone numbers in parallel
    const [assistants, phoneNumbers] = await Promise.all([
      this.getAllAssistants(),
      this.getAllPhoneNumbers()
    ]);

    console.log('📞 Found VAPI phone numbers:', phoneNumbers.length);

    // Build assistant-to-phone mapping
    const assistantToPhoneMap = new Map();
    phoneNumbers.forEach((phone: any) => {
      const assistantId = phone.assistantId;
      if (assistantId) {
        if (!assistantToPhoneMap.has(assistantId)) {
          assistantToPhoneMap.set(assistantId, {
            inbound: null,
            outbound: null,
            phoneNumbers: []
          });
        }

        const phoneInfo = {
          id: phone.id,
          number: phone.number,
          formatted: phone.number,
          twilioAccountSid: phone.twilioAccountSid,
          twilioAuthToken: phone.twilioAuthToken
        };

        assistantToPhoneMap.get(assistantId).phoneNumbers.push(phoneInfo);
        assistantToPhoneMap.get(assistantId).inbound = phoneInfo;
        assistantToPhoneMap.get(assistantId).outbound = phoneInfo;
      }
    });

    // Enrich assistants with details and phone information
    const detailed = [];
    for (const asst of assistants) {
      try {
        // ✅ Fetch full assistant details (includes server.url for webhook)
        const assistantDetails = await this.getAssistantDetails(asst.id);
        
        const enriched = { 
          ...asst, 
          ...assistantDetails,
          // ✅ Extract webhook URL from server object
          webhookUrl: assistantDetails?.server?.url || assistantDetails?.serverUrl || null
        };
        
        // Add phone bindings
        const phoneInfo = assistantToPhoneMap.get(asst.id);
        enriched.phoneBindings = phoneInfo?.phoneNumbers || [];
        enriched.inboundPhone = phoneInfo?.inbound || null;
        enriched.outboundPhone = phoneInfo?.outbound || null;
        enriched.primaryPhone = phoneInfo?.outbound?.number || 
                               phoneInfo?.inbound?.number || 
                               phoneInfo?.phoneNumbers[0]?.number || 
                               null;
        
        console.log(`✅ Enriched VAPI assistant: ${enriched.name}, webhook: ${enriched.webhookUrl ? 'Yes' : 'No'}`);
        
        detailed.push(enriched);
        await delay(100);
      } catch (error) {
        console.warn(`Failed to fetch details for assistant ${asst.id}:`, error);
        // Add basic assistant info even if details fetch fails
        const phoneInfo = assistantToPhoneMap.get(asst.id);
        detailed.push({
          ...asst,
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