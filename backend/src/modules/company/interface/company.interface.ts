import { Types } from "mongoose";

export interface IVoiceProvider {
  name: string;
  api_key_id: string;
}

export interface ICompany {
  name: string;
  interestedMeetingBooked: string;
  interestedTask: string;
  notInterested: string;
  domain: string;
  description?: string;
  voiceProviders: IVoiceProvider[]; // Changed to array
  webhookToken: string;
  address: {
    street?: string;
    houseNo?: string;
    zipCode?: number;
    state?: string;
    countryId?: Types.ObjectId;
  };
  isArchived: boolean;
  isActive: boolean;
  bmbyProfileActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
} 