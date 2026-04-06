import { WebSocket, RawData } from 'ws';
import { Environment } from '../../config/environment';
import { FunctionCallingLlmClient } from './llm.service';

// Define the types
interface CustomLlmResponse {
    response_type: string;
    config?: {
        auto_reconnect: boolean;
        call_details: boolean;
    };
    response_id?: string;
    content?: string;
    content_complete?: boolean;
    end_call?: boolean;
    timestamp?: number;
}

interface CustomLlmRequest {
    interaction_type: string;
    response_id?: string;
    timestamp?: number;
    call?: {
        agent_id: string;
        call_id: string;
    };
}

export class WebSocketService {
    private llmClient: FunctionCallingLlmClient;

    constructor() {
        this.llmClient = new FunctionCallingLlmClient();
    }

    /**
     * Create and send initial configuration to the client
     */
    sendInitialConfig(ws: WebSocket): void {
        const config: CustomLlmResponse = {
            response_type: "config",
            config: {
                auto_reconnect: true,
                call_details: true,
            },
        };
        ws.send(JSON.stringify(config));
    }

    /**
     * Process call details interaction
     */
    async processCallDetails(
        wsRequest: CustomLlmRequest,
        callId: string,
        ws: WebSocket,
        companyId: string,
        agentId: string | null
    ): Promise<void> {
        console.log(`Processing call details - Company: ${companyId}, Agent: ${agentId}`);
        console.log('Complete wsRequest:', JSON.stringify(wsRequest, null, 2));
        console.log("Call log saved successfully via WebSocket");

        // Initialize agent if provided
        if (agentId) {
            try {
                await this.llmClient.initializeAgent(agentId);
                console.log(`Agent ${agentId} initialized successfully`);
            } catch (error) {
                console.error(`Failed to initialize agent ${agentId}:`, error);
                throw error;
            }
        }
    }

    /**
     * Generate response for user interactions using the full-featured LLM client
     */
    async generateResponse(
        wsRequest: CustomLlmRequest,
        ws: WebSocket,
        companyId: string,
        agentId: string | null
    ): Promise<void> {
        try {
            console.log(`Generating response - Company: ${companyId}, Agent: ${agentId}`);

            // Ensure agent is initialized before generating response
            if (agentId) {
                await this.llmClient.initializeAgent(agentId);
            }

            await this.llmClient.DraftResponse(wsRequest as any, ws);
        } catch (responseError) {
            console.error("Error generating response:", responseError);
            this.sendErrorResponse(wsRequest, ws);
            throw responseError;
        }
    }

    /**
     * Send error response to client
     */
    private sendErrorResponse(wsRequest: CustomLlmRequest, ws: WebSocket): void {
        const errorResponse: CustomLlmResponse = {
            response_type: "response",
            response_id: wsRequest.response_id,
            content: "I'm experiencing technical difficulties. Please hold on.",
            content_complete: true,
            end_call: false,
        };
        ws.send(JSON.stringify(errorResponse));
    }

    /**
     * Handle ping-pong interaction for connection health
     */
    handlePingPong(wsRequest: CustomLlmRequest, ws: WebSocket): void {
        const pingpongResponse: CustomLlmResponse = {
            response_type: "ping_pong",
            timestamp: wsRequest.timestamp,
        };
        ws.send(JSON.stringify(pingpongResponse));
    }

    /**
     * Parse incoming WebSocket message
     */
    parseWebSocketMessage(data: RawData): CustomLlmRequest {
        try {
            return JSON.parse(data.toString());
        } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
            throw new Error('Invalid message format');
        }
    }

    /**
     * Route WebSocket message to appropriate handler
     */
    async routeMessage(
        wsRequest: CustomLlmRequest,
        callId: string,
        ws: WebSocket,
        companyId: string,
        agentId: string | null
    ): Promise<void> {
        switch (wsRequest.interaction_type) {
            case "call_details":
                await this.processCallDetails(wsRequest, callId, ws, companyId, agentId);
                break;

            case "reminder_required":
            case "response_required":
                await this.generateResponse(wsRequest, ws, companyId, agentId);
                break;

            case "ping_pong":
                this.handlePingPong(wsRequest, ws);
                break;

            case "update_only":
                // Optional transcript handling - implement as needed
                console.log(`Update only - Company: ${companyId}, Agent: ${agentId}`);
                break;

            default:
                console.warn(`Unknown interaction type: ${wsRequest.interaction_type}`);
                break;
        }
    }
}