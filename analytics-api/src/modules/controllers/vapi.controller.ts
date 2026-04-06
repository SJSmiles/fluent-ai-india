// modules/controllers/vapi.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { webhookService } from '../services/webhook.service';
import { rebuildQueue } from '../event-queue/queue';
import { userAgentValidationService } from '../services/user-agent-validation.service';
import { decryptToken } from '../../helper/dateHelper';
import { webhookAdapterNew } from '../services/webhook-adapter-new.service';
import { webhookAdapter } from '../services/webhook-adapter.service';
import { VapiCallModel } from '../models/vapi.model';
import { VapiLogsModel } from '../models/vapi-logs.model';

export async function vapiWebhookHandler(request: FastifyRequest, reply: FastifyReply) {

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

  // Convert VAPI data to Retell format
  const vapiData: any = request.body;
  console.log('Received VAPI webhook data:', vapiData?.message.type);
  // UPSERT (create or update) based on message type
  await VapiLogsModel.findOneAndUpdate(
    { "body.message.type": vapiData?.message?.type, 'body.message.call.id': vapiData?.message?.call?.id }, // match condition
    {
      headers: request.headers,
      body: vapiData,
      signature: signature,
      updatedAt: new Date()
    },
    {
      new: true,     // return updated document
      upsert: true,  // create when not exists
      setDefaultsOnInsert: true
    }
  );
  if (vapiData?.message.type === 'end-of-call-report') {
    await VapiCallModel.create({
      headers: request.headers,
      body: vapiData,
      signature: signature,
    })
    let retellFormattedData: any
    if (!vapiData?.message?.artifact?.structuredOutputs) {
      retellFormattedData = webhookAdapter.adaptVapiToRetell(vapiData);
    }
    if (vapiData?.message?.artifact?.structuredOutputs) {
      retellFormattedData = webhookAdapterNew.adaptVapiToRetell(vapiData);
    }


    // Extract agent ID from converted data
    const agentId = retellFormattedData?.call?.agent_id;

    if (!agentId) {
      console.error('Agent ID not found in VAPI webhook');
      return reply.code(400).send({
        error: 'Agent ID is required',
        code: 'AGENT_ID_REQUIRED'
      });
    }

    // Validate Company - Agent mapping
    try {
      const validation = await userAgentValidationService.validateUserAgent(
        companyId,
        agentId
      );

      if (!validation.isValid) {
        console.error('UserAgent validation failed for VAPI webhook:', {
          companyId,
          agentId,
          event: retellFormattedData?.event
        });

        return reply.code(403).send({
          error: 'Company and Agent are not mapped',
          code: 'INVALID_COMPANY_AGENT_MAPPING'
        });
      }

      console.log('UserAgent validation successful for VAPI webhook');

    } catch (error) {
      console.error('Error validating UserAgent for VAPI:', error);
      return reply.code(500).send({
        error: 'Internal server error during validation',
        code: 'VALIDATION_ERROR'
      });
    }
    try {
      // Save the converted data (not the original VAPI data)
      const callLog = await webhookService.saveCallLog(
        retellFormattedData,
        request.headers
      );
      console.log('VAPI call log saved successfully as Retell format');

      // Add to the same rebuild queue
      const callId = retellFormattedData.call.call_id;
      // await rebuildQueue.add(
      //   { call_id: callId },
      //   { jobId: `${callId}`, removeOnComplete: true }
      // );
      await rebuildQueue.add(
        { call_id: callId, type: 'vapi' },
        {
          jobId: `${callId}-vapi`,
          removeOnComplete: true
        }
      );

      console.log('Enqueued rebuild job for VAPI call:', callId);

      reply.code(200).send({
        status: 'success',
        message: 'VAPI webhook processed'
      });
    } catch (err) {
      console.error('VAPI webhook processing error:', err);
      reply.code(200).send({
        status: 'error',
        message: 'Error occurred but webhook acknowledged'
      });
    }

  }

  // Process webhook with Retell-formatted data

}