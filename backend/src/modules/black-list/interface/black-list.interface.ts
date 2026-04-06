export interface IBlackList {
  _id?: any; // MongoDB ObjectId (auto-generated)
  toNumber: string;
  status: Number;
  companyId: any; // ObjectId
  createdBy: any; // ObjectId
  clientName: string;
  bmbyId?: string;
  email?: string;
  reason: string; // Why they were blacklisted (e.g., "Do Not Contact")
  callId?: string; // Reference to the call that triggered blacklist
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}