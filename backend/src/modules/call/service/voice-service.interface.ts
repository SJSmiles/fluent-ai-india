// Create a new file: voice-service.interface.ts
export interface IVoiceService {
  processAgentCreationRequest(user: any, payload: any): Promise<{ agentId: string; llmId?: string; assistantId?: string }>;
  processAgentUpdateRequest(user: any, existingAgent: any, payload: any): Promise<void>;
  processAgentDeletionRequest(agentData: any): Promise<void>;
  processAgentDuplicationRequest(user: any, sourceAgent: any): Promise<{ agentId: string; llmId?: string; assistantId?: string; duplicateName: string }>;
  processPhoneNumberUpdateRequest(agentId: string, newPhone: string, oldPhone: string, callType: 'inbound' | 'outbound'): Promise<void>;
  getRetellAgentById?(payload: any): Promise<any>;
  getVapiAssistantById?(assistantId: string): Promise<any>;
  getRetellAgentPromptById?(payload: any): Promise<any>;
}