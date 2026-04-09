export interface IUserAgent {
  userId?: string;
  companyId?: string;
  agentId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isArchived?: boolean;
  isPrimary?: boolean;
}
