import { FastifyRequest } from 'fastify';
import { WebSocket, RawData } from 'ws';
import { WebSocketService } from '../services/websocket.service';
import { decryptToken } from '../helper/helper';
import { userAgentValidationService } from '../services/user-agent-validation.service';

export async function handleWebSocket(ws: WebSocket, request: FastifyRequest) {
    const webSocketService = new WebSocketService();
    let isValidated = false;
    let validatedAgentId: string | null = null;

    try {
        const callId = (request.params as any).call_id;
        const encryptedToken = (request.query as any).signature;

        console.log('=== WebSocket Connection ===');
        console.log('Call ID:', callId);
        console.log('Token received:', encryptedToken ? 'Yes' : 'No');

        if (!encryptedToken) {
            console.error('No signature token provided');
            ws.close(1008, 'Missing authentication token');
            return;
        }

        let companyId: string;

        try {
            companyId = decryptToken(encryptedToken);
            console.log('Company ID extracted:', companyId);
        } catch (error) {
            console.error('Error decrypting token:', error);
            ws.close(1008, 'Invalid token');
            return;
        }

        console.log('===========================');
        console.log("Handle llm ws for:", callId, "Company:", companyId);

        webSocketService.sendInitialConfig(ws);

        ws.on("error", (err: Error) => {
            console.error("Error received in LLM websocket:", err);
        });

        ws.on("close", () => {
            console.log("Closing llm ws for:", callId, "Company:", companyId, "Agent:", validatedAgentId);
        });

        ws.on("message", async (data: RawData, isBinary: boolean) => {
            try {
                if (isBinary) {
                    console.error("Got binary message instead of text");
                    ws.close();
                    return;
                }

                const wsRequest = webSocketService.parseWebSocketMessage(data);
                const agentId = wsRequest.call?.agent_id;

                if (!isValidated) {
                    if (!agentId) {
                        console.error('Agent ID not provided in the request');
                        ws.send(JSON.stringify({
                            error: 'Agent ID is required',
                            code: 'AGENT_ID_REQUIRED'
                        }));
                        ws.close(1008, 'Agent ID required');
                        return;
                    }

                    try {
                        const validation = await userAgentValidationService.validateUserAgent(
                            companyId,
                            agentId
                        );

                        if (!validation.isValid) {
                            console.error('UserAgent validation failed - Company and Agent are not mapped:', {
                                companyId,
                                agentId,
                                message: 'Please bind the user to company first'
                            });

                            ws.send(JSON.stringify({
                                error: 'Company and Agent are not mapped. Please bind the user to company first.',
                                code: 'INVALID_COMPANY_AGENT_MAPPING',
                                details: {
                                    companyId,
                                    agentId
                                }
                            }));
                            ws.close(1008, 'Invalid company and agent mapping');
                            return;
                        }

                        console.log('UserAgent validation successful:', {
                            companyId,
                            agentId
                        });

                        isValidated = true;
                        validatedAgentId = agentId;

                    } catch (error) {
                        console.error('Error validating UserAgent:', error);
                        ws.send(JSON.stringify({
                            error: 'Internal server error during validation',
                            code: 'VALIDATION_ERROR'
                        }));
                        ws.close(1011, 'Internal server error');
                        return;
                    }
                }

                if (isValidated && validatedAgentId) {
                    try {
                        await webSocketService.routeMessage(wsRequest, callId, ws, companyId, validatedAgentId);
                    } catch (error) {
                        // Handle agent prompt missing error specifically
                        if (error instanceof Error && error.message.includes('Agent prompt is required')) {
                            console.error('Cannot proceed with call - Agent prompt missing:', error.message);
                            ws.send(JSON.stringify({
                                error: 'Agent prompt is required for this agent. Please configure the agent prompt before making calls.',
                                code: 'AGENT_PROMPT_REQUIRED',
                                details: {
                                    agentId: validatedAgentId,
                                    message: error.message
                                }
                            }));
                            ws.close(1011, 'Agent prompt required');
                            return;
                        }

                        // Re-throw other errors
                        throw error;
                    }
                } else {
                    console.error('Attempted to route message without validation');
                    ws.close(1008, 'Unauthorized');
                }

            } catch (error) {
                console.error("Error processing WebSocket message:", error);
                ws.close();
            }
        });

    } catch (err) {
        console.error("Encountered error in WebSocket setup:", err);
        ws.close();
    }
}