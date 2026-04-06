
import { FunctionCallingLlmClient } from '../services/llm.service';
import { WebhookService } from '../services/webhook.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { decryptToken } from '../helper/helper';
import { CallLog } from '../models/callLog.model';
import { userAgentValidationService } from '../services/user-agent-validation.service';

export async function handleWebHook(req: FastifyRequest, res: FastifyReply) {
    const webhookService = new WebhookService();
    let isValidated = false;
    let validatedAgentId: string | null = null;

    try {
        const body = req.body as any;
        const signatureFromQuery = (req.query as any)?.signature;
        const signatureFromHeader = req.headers['x-signature'];
        const signature = signatureFromQuery || signatureFromHeader;

        console.log('Received webhook event:', body?.event);

        if (!signature) {
            console.log('Missing signature in webhook request');
            return res.code(401).send({ error: 'Signature is required' });
        }

        let companyId: string;

        try {
            companyId = decryptToken(signature);
            console.log('Company ID extracted:', companyId);
        } catch (error) {
            console.error('Error decrypting token:', error);
            return res.code(401).send({ error: 'Invalid token' });
        }

        console.log("Company of webhook:", companyId);

        const agentId = body.call?.agent_id;

        // Agent ID validation
        if (!agentId) {
            console.error('Agent ID not provided in webhook request');
            return res.code(400).send({
                error: 'Agent ID is required',
                code: 'AGENT_ID_REQUIRED'
            });
        }

        // UserAgent validation - Company-Agent mapping check
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

                return res.code(403).send({
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

            isValidated = true;
            validatedAgentId = agentId;

        } catch (error) {
            console.error('Error validating UserAgent:', error);
            return res.code(500).send({
                error: 'Internal server error during validation',
                code: 'VALIDATION_ERROR'
            });
        }

        // Validation successful - ab webhook events process karo
        if (!isValidated || !validatedAgentId) {
            console.error('Validation state inconsistent');
            return res.code(403).send({ error: 'Unauthorized' });
        }

        switch (body?.event) {
            case "call_started":
                console.log("Call started event processed and saved to DB:", body?.call?.call_id);
                await webhookService.processWebhookEvent(body, req.headers, 'call_started');
                break;

            case "call_ended":
                console.log("Call ended event processed and saved to DB:", body?.call?.call_id);
                await webhookService.processWebhookEvent(body, req.headers, 'call_ended');
                break;

            case "call_analyzed":
                console.log("Call analyzed event processed and saved to DB:", body?.call?.call_id);

                const transcript = body?.call?.transcript_object;
                console.log(`Transcript contains ${transcript?.length || 0} messages`);

                if (transcript && transcript.length > 0) {
                    try {
                        const analysisLogsExist = await CallLog.findOne({
                            'raw_data.call.call_id': body.call.call_id,
                            'raw_data.event': 'call_analyzed'
                        });

                        if (analysisLogsExist) {
                            console.log("Analysis already exists for this call. Skipping re-analysis.");
                            break;
                        }

                        const llmClient = await new FunctionCallingLlmClient();

                        try {
                            await llmClient.initializeAgent(validatedAgentId);
                        } catch (initError) {
                            if (initError instanceof Error && initError.message.includes('Agent prompt is required')) {
                                console.error('Cannot initialize agent for analysis - Agent prompt missing:', initError.message);
                                // Save the webhook event without analysis
                                await webhookService.processWebhookEvent(body, req.headers, 'call_analyzed');
                                break;
                            }
                            throw initError; // Re-throw if it's a different error
                        }

                        const transcriptForAnalysis = transcript.map((item: any) => ({
                            role: item.role,
                            content: item.content || ''
                        })).filter((item: any) => item.content.trim() !== '');

                        if (transcriptForAnalysis.length > 0) {
                            // This will return {} if analysis prompt is missing (graceful degradation)
                            const analysisResult: any = await llmClient.getLeadStatusWithCustomData(transcriptForAnalysis);

                            if (Object.keys(analysisResult).length > 0) {
                                console.log("Custom Analysis Data (Generated from Ollama):", analysisResult.customAnalysisData);
                                body.call.call_analysis.custom_analysis_data = analysisResult?.customAnalysisData || {};
                            } else {
                                console.log("No analysis data generated - analysis prompt may be missing");
                                body.call.call_analysis.custom_analysis_data = {};
                            }

                            await webhookService.processWebhookEvent(body, req.headers, 'call_analyzed');

                        } else {
                            console.log("No valid messages found for analysis");
                            await webhookService.processWebhookEvent(body, req.headers, 'call_analyzed');
                        }
                    } catch (error) {
                        console.error("Error analyzing call data:", error);
                        // Save the event even if analysis fails
                        await webhookService.processWebhookEvent(body, req.headers, 'call_analyzed');
                    }
                } else {
                    console.log("No transcript available for analysis");
                    await webhookService.processWebhookEvent(body, req.headers, 'call_analyzed');
                }
                break;
            default:
                console.log("Unknown event processed and saved to DB:", body?.event);
        }

        return res.send({ received: true });

    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.code(500).send({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
}