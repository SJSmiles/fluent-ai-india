import { Schema, model, Types } from 'mongoose';
import { ICompany } from '../interface/company.interface';

const csvColumnConfigSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. 'phone_number', 'first_name', 'gender'
    },
    label: {
      type: String,
      required: false,
      trim: true,
      // human-readable label shown in error reports, e.g. 'Phone Number'
    },
    type: {
      type: String,
      required: true,
      enum: ['string', 'number', 'boolean', 'email', 'phone'],
      default: 'string',
    },
    required: {
      type: Boolean,
      default: false,
    },
    enum: {
      // allowed values — only meaningful when type is 'string'
      type: [String],
      default: [],
    },
  },
  { _id: false } // no separate _id per column entry
);

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
    },
    domain: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    address: {
      street: { type: String },
      houseNo: { type: String },
      zipCode: { type: Number },
      state: { type: String },
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    plivoAuthId: {
      type: String,
      required: true,
    },
    plivoAuthToken: {
      type: String,
      required: true,
    },
    elevenLabsApiKey: {
      type: String,
      required: true,
    },
    deepgramApiKey: {
      type: String,
      required: true,
    },
    csvColumnConfig: {
      type: [csvColumnConfigSchema],
      default: [],
    },
    callStatus: {
      type: [String],
      default: [],
    },
    callStatusPrompt: {
      type: String,
      default: '',
    },
    callSummaryPrompt: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const Company = model<ICompany>('Company', companySchema, 'Company');