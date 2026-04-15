import { FastifyInstance } from 'fastify';
import {
  // incomingCallHandler,
  // callStatusHandler,
  incomingTestCallHandler,
  testCallStatusHandler,
} from '../controllers/webhook.controller';

export default async function (app: FastifyInstance) {
  // app.post('/incoming-call/:token', incomingCallHandler);
  // app.post('/call-status/:token', callStatusHandler);
  app.post('/incoming-test-call', incomingTestCallHandler);
  app.post('/test-call-status', testCallStatusHandler);
}