import mongoose from 'mongoose';
import { CONFIG_TYPES } from '../../../config/server-config';

// Use keyof typeof CONFIG_TYPES to bind type to constants
export type ConfigType = typeof CONFIG_TYPES[keyof typeof CONFIG_TYPES];

export interface IFieldConfig {
  fieldName: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
}

export interface ICompanyConfiguration extends mongoose.Document {
  companyId: mongoose.Types.ObjectId;
  type: ConfigType; // bind type to constants
  configuration: IFieldConfig[];
  queueProcessInMinutes?: number;  // ✅ Add this
  maximumAttempts?: number; 
}
