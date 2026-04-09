import { FastifyInstance } from 'fastify';
import {
  incomingCallHandler,
  callStatusHandler,
} from '../controllers/webhook.controller';

export default async function (app: FastifyInstance) {
  app.post('/incoming-call/:agentId', incomingCallHandler);
  app.post('/call-status/:agentId', callStatusHandler);
}