export interface IAgent {
  name: string;
  prompt: string;
  postCallAnalysisData?: any[];
  postCallStatus?: any[];
  version?: any;
  voiceId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  companyId?: string;
  firstMessage?: string;
  endCallMessage?: string;
  endCallInvoke?: boolean;
  isArchived?: boolean;
}
