import { FastifyInstance } from 'fastify';
import {
  incomingTestCallHandler,
  testCallStatusHandler,
} from '../controllers/testWebhook.controller';
import { callStatusHandler, incomingCallHandler } from 'modules/controllers/webhook.controller';

export default async function (app: FastifyInstance) {
  app.post('/incoming-call', incomingCallHandler);
  app.post('/call-status', callStatusHandler);
  app.post('/incoming-test-call', incomingTestCallHandler);
  app.post('/test-call-status', testCallStatusHandler);
}