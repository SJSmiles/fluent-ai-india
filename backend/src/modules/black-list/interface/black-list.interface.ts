export interface IBlackList {
  _id?: any; // MongoDB ObjectId (auto-generated)
  toNumber: string;
  status: Number;
  companyId: any; // ObjectId
  createdBy: any; // ObjectId
  clientName: string;
  email?: string;
  reason: string; // Why they were blacklisted (e.g., "Do Not Contact")
  callUUID?: string; // Reference to the call that triggered blacklist
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}