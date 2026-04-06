// modules/controllers/vapi.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { decryptToken } from '../../helper/dateHelper';

export async function plivoWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  console.log('Plivo webhook received:', request);
  console.log('Plivo webhook received with body:', request.body);


}