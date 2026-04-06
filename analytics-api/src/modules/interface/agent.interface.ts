export interface IAgent {
  agentName: string;
  phone: string;
  agentPrompt: string;
  agentPromptType?: string;
  callType?: 'inbound' | 'outbound';
  retellLlmId?: string;
  postCallAnalysisData?: any[];
  analysisPrompt?: string;
  retellAgentId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
