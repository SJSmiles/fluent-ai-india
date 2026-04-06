// modules/services/vapi.service.ts

import { VapiCallModel } from "../models/vapi.model";


export const vapiService = {
  async saveWebhookData(headers: any, body: any, signature: string) {
    try {
      const doc = new VapiCallModel({
        headers,
        body,
        signature
      });
      await doc.save();
      console.log('VAPI webhook data saved successfully');
      return doc;
    } catch (error) {
      console.error('Error saving VAPI webhook data:', error);
      throw error;
    }
  }
};
