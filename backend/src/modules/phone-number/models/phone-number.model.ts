import { Schema, model } from 'mongoose';
import { IPhoneNumber } from '../interface/phone-number.interface';

const PhoneNumberSchema = new Schema<IPhoneNumber>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    phoneNumberId: {
      type: String,
      required: true,
      trim: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const PhoneNumber = model<IPhoneNumber>(
  'PhoneNumber',
  PhoneNumberSchema,
  'PhoneNumbers'
);
