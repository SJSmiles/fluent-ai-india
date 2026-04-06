import { Schema, model, Types } from 'mongoose';
import { IContact } from '../interface/contact.interface';

const contactSchema = new Schema<IContact>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true
    },
    bmbyId: {
      type: Number,
      required: true
    },
    number: {
      type: String,
      required: true
    },
    salutation: {
      type: String,
      enum: ['Herr', 'Frau', ''],
      default: ''
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: false,
      default: ''
    },
    gender: {
      type: String,
      enum: ['masculine', 'feminine', 'neuter', ''],
      default: ''
    },
    email: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

contactSchema.index({ createdBy: 1, email: 1 }, { unique: true });
contactSchema.index({ createdBy: 1, number: 1 }, { unique: true });
contactSchema.index({ companyId: 1, isActive: 1 });
contactSchema.index({ createdBy: 1, isArchived: 1 });

export const Contact = model<IContact>('Contact', contactSchema, 'Contact');