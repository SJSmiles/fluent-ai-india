import { AppModule } from '../../common/common-interfaces';
import { readSheetHandler, webhookHandler } from './handlers/webhook.handlers';
import { sheetsWebhookRequest, webhookRequest } from './schema/webhook.schema';

export const module: AppModule = {
  name: 'Webhook module',
  mountPoint: '/webhooks',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/webhook',
      auth: false,
      schema: webhookRequest,
      handler: webhookHandler
    },
    {
      method: 'POST',
      url: '/sheets-webhook',
      auth: true,
      schema: sheetsWebhookRequest,
      handler: readSheetHandler
    }
  ]
};
