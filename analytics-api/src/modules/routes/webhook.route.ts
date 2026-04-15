import { FastifyInstance } from 'fastify';
import {
  incomingTestCallHandler,
  testCallStatusHandler,
} from '../controllers/testWebhook.controller';

export default async function (app: FastifyInstance) {
  app.post('/incoming-call', incomingTestCallHandler);
  app.post('/call-status', testCallStatusHandler);
  app.post('/incoming-test-call', incomingTestCallHandler);
  app.post('/test-call-status', testCallStatusHandler);
}