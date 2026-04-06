import { FastifyReply, FastifyRequest } from 'fastify';
import { webhookService } from '../services/webhook.service';
import { rebuildQueue } from '../event-queue/queue';
import { userAgentValidationService } from '../services/user-agent-validation.service';
import { decryptToken } from '../../helper/dateHelper';

export async function webhookHandler(request: FastifyRequest, reply: FastifyReply) {
    console.log({ headers: request.headers, body: request.body }, 'Webhook received');

    // Get signature from query or headers
    const signatureFromQuery = (request.query as any)?.signature;
    const signatureFromHeader = request.headers['x-signature'];
    const signature = signatureFromQuery || signatureFromHeader;

    if (!signature) {
        console.log('Missing signature in webhook request');
        return reply.code(401).send({ error: 'Signature is required' });
    }

    console.log('Webhook signature verified');

    // Extract company ID from token
    let companyId: string;
    try {
        companyId = decryptToken(signature);
        console.log('Company ID extracted:', companyId);
    } catch (error) {
        console.error('Error decrypting token:', error);
        return reply.code(401).send({ error: 'Invalid token' });
    }

    // Extract and validate agent ID
    const body: any = request.body;
    const agentId = body?.call?.agent_id;

    if (!agentId) {
        console.error('Agent ID not provided in webhook request');
        return reply.code(400).send({
            error: 'Agent ID is required',
            code: 'AGENT_ID_REQUIRED'
        });
    }

    // Validate Company-Agent mapping
    try {
        const validation = await userAgentValidationService.validateUserAgent(
            companyId,
            agentId
        );

        if (!validation.isValid) {
            console.error('UserAgent validation failed - Company and Agent are not mapped:', {
                companyId,
                agentId,
                event: body?.event,
                message: 'Please bind the user to company first'
            });

            return reply.code(403).send({
                error: 'Company and Agent are not mapped. Please bind the user to company first.',
                code: 'INVALID_COMPANY_AGENT_MAPPING',
                details: {
                    companyId,
                    agentId,
                    event: body?.event
                }
            });
        }

        console.log('UserAgent validation successful:', {
            companyId,
            agentId,
            event: body?.event
        });

    } catch (error) {
        console.error('Error validating UserAgent:', error);
        return reply.code(500).send({
            error: 'Internal server error during validation',
            code: 'VALIDATION_ERROR'
        });
    }

    // Validation successful - ab webhook process karo
    try {
        const callLog = await webhookService.saveCallLog(request.body, request.headers);
        console.log('Call log saved successfully');

        // await rebuildQueue.add(
        //     { call_id: callLog.raw_data.call.call_id },
        //     { jobId: `${callLog.raw_data.call.call_id}`, removeOnComplete: true }
        // );
        await rebuildQueue.add(
            { call_id: callLog.raw_data.call.call_id, type: 'retell' },
            {
                jobId: `${callLog.raw_data.call.call_id}-retell`,
                removeOnComplete: true
            }
        );

        console.log('Enqueued rebuild job for', callLog.raw_data.call.call_id);

        console.log('Webhook processed');
        reply.code(200).send({ status: 'success', message: 'Webhook processed' });
    } catch (err) {
        console.log(err, 'Webhook processing error');
        reply.code(200).send({ status: 'error', message: 'Error occurred but webhook acknowledged' });
    }
}