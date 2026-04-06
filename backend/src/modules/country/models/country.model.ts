import { Schema, model } from 'mongoose';
import { ICountry } from '../interface/country.interface';

const countrySchema = new Schema<ICountry>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true
    },
    capital: {
      type: String,
      required: true
    },
    nationality: {
      type: String,
      required: true
    },
    flag: {
      type: String,
      required: true
    },
    diallingCode: {
      type: String,
      required: true
    },
    currency: {
      name: { type: String, required: true },
      code: { type: String, required: true },
      symbol: { type: String, required: true }
    },
    timeZone: {
      name: { type: String, required: true },
      utcOffset: { type: String, required: true },
      utcOffsetInSec: { type: String, required: true }
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

export const CountryMaster = model<ICountry>('CountryMaster', countrySchema, 'CountryMaster');
