import { FastifyInstance } from 'fastify';
import webhookRoutes from './modules/routes/webhook.route';
import { callHandler } from './realtime/callHandler';

export async function registerRoutes(app: FastifyInstance) {
  app.register(webhookRoutes, { prefix: '/webhook' });

  // ✅ Wrap WS route
  app.register(async function (fastify) {
    fastify.get('/realtime/:agentId', { websocket: true }, callHandler);
  });
}