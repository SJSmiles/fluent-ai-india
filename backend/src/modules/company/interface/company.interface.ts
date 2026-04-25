import { Types } from 'mongoose';

export interface ICsvColumnConfig {
  name: string;           // CSV header key, e.g. 'phone_number'
  label?: string;         // human-readable name for reports, e.g. 'Phone Number'
  type: 'string' | 'number' | 'boolean' | 'email' | 'phone';
  required: boolean;
  enum: string[];         // allowed values; empty means no restriction
}

export interface ICompany {
  name: string;
  domain: string;
  description?: string;
  address?: {
    street?: string;
    houseNo?: string;
    zipCode?: number;
    state?: string;
  };
  isArchived: boolean;
  isActive: boolean;
  plivoAuthId: string;
  plivoAuthToken: string;
  elevenLabsApiKey: string;
  deepgramApiKey: string;
  csvColumnConfig: ICsvColumnConfig[];
  leadStatus?: any[];
  leadStatusPrompt: string;
  callSummaryPrompt: string;
  companyWorkPrompt: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}