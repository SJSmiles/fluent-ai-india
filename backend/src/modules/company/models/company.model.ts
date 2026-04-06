import { Schema, model, Types } from 'mongoose';
import { ICompany } from '../interface/company.interface';

const voiceProviderSchema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    api_key_id: {
      type: String,
      required: true
    }
  },
  { _id: false } // Disable auto _id for subdocuments if not needed
);

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
    interestedMeetingBooked: {
      type: String,
      required: true
    },
    interestedTask: {
      type: String,
      required: true
    },
    notInterested: {
      type: String,
      required: true
    },
    webhookToken: {
      type: String
    },
    voiceProviders: {
      type: [voiceProviderSchema],
      default: []
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
      countryId: {
        type: Types.ObjectId,
        ref: 'CountryMaster',
        default: null
      }
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    bmbyProfileActive: {
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
  {
    timestamps: true
  }
);

export const Company = model<ICompany>('Company', companySchema, 'Company');