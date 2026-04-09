import { Types } from "mongoose";
export interface ICompany {
  name: string;
  domain: string;
  description?: string;
  address: {
    street?: string;
    houseNo?: string;
    zipCode?: number;
    state?: string;
  };
  plivoAuthId: string;
  plivoAuthToken: string;
  elevenLabsApiKey: string;
  deepgramApiKey: string;
  isArchived: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
} 