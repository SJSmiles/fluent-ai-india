import { Schema, model, Types } from 'mongoose';
import { ICompany } from '../interface/company.interface';



const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true
    },
    domain: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    address: {
      street: {
        type: String
      },
      houseNo: {
        type: String
      },
      zipCode: {
        type: Number
      },
      state: {
        type: String
      },
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    plivoAuthId: {
      type: String,
      required: true
    },
    plivoAuthToken: {
      type: String,
      required: true
    },
    elevenLabsApiKey: {
      type: String,
      required: true
    },
    deepgramApiKey: {
      type: String,
      required: true
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
  {
    timestamps: true
  }
);

export const Company = model<ICompany>('Company', companySchema, 'Company');