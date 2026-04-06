// modules/controllers/vapi.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { decryptToken } from '../../helper/dateHelper';

export async function smsWebhookHandler(request: FastifyRequest, reply: FastifyReply) {

  // Get signature from query or headers
  const signatureFromQuery = (request.query as any)?.signature;
  const signatureFromHeader = request.headers['x-signature'];
  const signature = signatureFromQuery || signatureFromHeader;

  if (!signature) {
    console.log('Missing signature in webhook request');
    return reply.code(401).send({ error: 'Signature is required' });
  }

  console.log('Webhook signature verified');

  let companyId: string;
  try {
    companyId = decryptToken(signature);
    console.log('Company ID extracted:', companyId);
  } catch (error) {
    console.error('Error decrypting token:', error);
    return reply.code(401).send({ error: 'Invalid token' });
  }

  const smsData: any = request.body;

  console.log('Received SMS webhook data:', smsData);



}