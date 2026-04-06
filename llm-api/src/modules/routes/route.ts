import { FastifyInstance } from 'fastify';
import { handleWebSocket } from '../controllers/websocket.controller';
import { handleWebHook } from '../controllers/webhook.controller';

export default async function webRoutes(app: FastifyInstance) {
  app.get('/websocket/:call_id', { websocket: true }, (connection, request) => {
    handleWebSocket(connection, request);
  });
  app.post('/webhook',
    {
      handler: handleWebHook,
    }
  );

}