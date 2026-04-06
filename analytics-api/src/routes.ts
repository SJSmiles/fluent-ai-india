import { FastifyInstance } from 'fastify';
import dashboardRoutes from './modules/routes/dashboard.route';
import webhookRoutes from './modules/routes/webhook.route';
import vapiWebhookRoutes from './modules/routes/vapi.route';
import smsWebhookRoutes from './modules/routes/sms.route';
import plivoWebhookRoutes from './modules/routes/plivo.route';

export async function registerRoutes(app: FastifyInstance) {
  app.register(dashboardRoutes, { prefix: '/dashboard' });
  app.register(webhookRoutes, { prefix: '/webhook' });
  app.register(vapiWebhookRoutes, { prefix: '/vapi-webhook' });
  app.register(smsWebhookRoutes, { prefix: '/sms-webhook' });
  app.register(plivoWebhookRoutes, { prefix: '/plivo-webhook' });
}
