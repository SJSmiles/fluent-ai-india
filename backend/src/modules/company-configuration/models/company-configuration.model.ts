import mongoose, { Schema } from 'mongoose';
import { ICompanyConfiguration, IFieldConfig, ConfigType } from '../interface/company-configuration.interface';
import { CONFIG_TYPES } from '../../../config/server-config';

// Sub-schema for individual fields
const FieldConfigSchema = new Schema<IFieldConfig>({
  fieldName: { type: String, required: true },
  type: { type: String, required: true, enum: ['string', 'number', 'boolean', 'date'] },
  required: { type: Boolean, required: true }
}, { _id: false });

// Main schema for company configuration
const CompanyConfigurationSchema = new Schema<ICompanyConfiguration>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  type: { 
    type: String as any,
    required: true,
    enum: Object.values(CONFIG_TYPES) as ConfigType[]
  },
  configuration: { type: [FieldConfigSchema], default: [] },
  queueProcessInMinutes: {     // ✅ Add this field
    type: Number,
    required: false
  },
  maximumAttempts: {           // ✅ Add this field
    type: Number,
    required: false
  }
}, { timestamps: false });

// ✅ FIX: Specify the collection name explicitly as the 3rd parameter
export const CompanyConfiguration = mongoose.model<ICompanyConfiguration>(
  'CompanyConfiguration',
  CompanyConfigurationSchema,
  'CompanyConfiguration'  // ← Add this to match your actual collection name
);