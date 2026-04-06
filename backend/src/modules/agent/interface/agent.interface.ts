export interface IAgent {
  agentName: string;
  firstMessage: string;
  assistantId: string
  agentId?: string;
  vapiPhoneNumberId: string
  phone: string;
  agentPrompt: string;
  agentPromptType?: string;
  voiceProvider?: string;
  phoneBindings?: any[];
  primaryPhone?: string | null;
  callType?: 'inbound' | 'outbound';
  retellLlmId?: string;
  primaryCallType?: 'inbound' | 'outbound';
  postCallAnalysisData?: any[];
  webhookUrl?: string;
  phoneMapping?: {
    inbound?: {
      number: string;
      formatted: string;
      callType: string;
    } | null;
    outbound?: {
      number: string;
      formatted: string;
      callType: string;
    } | null;
  };
  responseEngine?: {
    type?: string;
    llm_id?: string;
    version?: any;
  };
  analysisPrompt?: string;
  outboundNumber?: string | null;
  retellAgentId?: string | ""
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  companyId?: string;
  isArchived?: boolean;
}

export interface AgentUpdatePayload {
  agentName: string;
  phone?: string;
  agentPrompt: string;
  callType?: 'inbound' | 'outbound';
}

export interface AgentPhoneUpdatePayload {
  phone: string;
  callType: 'inbound' | 'outbound';
}

export interface AgentListingPayload {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export interface RetellAgentResponse {
  agent_id: string;
  agent_name: string;
  voice_id: string;
  language: string;
  response_engine: {
    type: string;
    llm_id: string;
  };
}
