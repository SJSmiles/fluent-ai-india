import { Types } from 'mongoose';

export interface ICountry {
  name: string;
  code: string;
  capital: string;
  nationality: string;
  flag: string;
  diallingCode: string;
  currency: {
    name: string;
    code: string;
    symbol: string;
  };
  timeZone: {
    name: string;
    utcOffset: string;
    utcOffsetInSec: string;
  };
  isArchived: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
