import { FastifyInstance } from 'fastify';
import { webhookRequest } from '../schema/webhook.schema';
import { webhookHandler } from '../controllers/webhook.controller';

export default async function webhookRoutes(app: FastifyInstance) {
  app.post('/create',
    {
      schema: webhookRequest,
      handler: webhookHandler,
      
    }
    );
}
