import { WebSocket } from "ws";
import axios from "axios";
import OpenAI from "openai";
import { Agent } from "../models/agent.model";
import { getRedisClient } from "../../database/mongo-connection";

interface AgentPrompts {
    agentId: string;
    agentPrompt: string;
    analysisPrompt: string;
}

export class FunctionCallingLlmClient {
    private client: OpenAI;
    private agentPrompts: AgentPrompts | null = null;
    private readonly REDIS_AGENT_PREFIX = "agent:prompts:";
    private readonly REDIS_TTL = 300;

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_APIKEY,
        });
    }

    private async getAgentPromptsFromRedis(
        agentId: string
    ): Promise<AgentPrompts | null> {
        try {
            const redis = getRedisClient();
            const redisKey = `${this.REDIS_AGENT_PREFIX}${agentId}`;
            const cachedData = await redis.get(redisKey);

            if (cachedData) {
                console.log(`✅ Agent prompts loaded from Redis cache: ${agentId}`);
                return JSON.parse(cachedData) as AgentPrompts;
            }

            return null;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Redis fetch error:", error.message);
            } else {
                console.error("Unknown Redis fetch error:", error);
            }
            return null;
        }
    }

    private async getAgentPromptsFromDatabase(
        agentId: string
    ): Promise<AgentPrompts | null> {
        try {
            console.log(`📥 Fetching prompts from DB for agent: ${agentId}`);
            const agent: any = await Agent.findOne({ agentId: agentId });

            if (!agent) {
                console.error(`❌ Agent ${agentId} not found in database`);
                return null;
            }

            // CRITICAL: Agent prompt is required for calls to work
            if (!agent.agentPrompt || agent.agentPrompt.trim() === '') {
                const errorMsg = `❌ Agent prompt is required for agent: ${agentId}. Cannot proceed with call.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            // Analysis prompt is optional - log warning but continue
            let analysisPrompt = '';
            if (!agent.analysisPrompt || agent.analysisPrompt.trim() === '') {
                console.warn(`⚠️ Analysis prompt missing for agent: ${agentId}. Call will proceed but analysis will be skipped.`);
                analysisPrompt = ''; // Set to empty string
            } else {
                analysisPrompt = typeof agent.analysisPrompt === "string"
                    ? agent.analysisPrompt
                    : JSON.stringify(agent.analysisPrompt);
            }

            const agentPrompts: AgentPrompts = {
                agentId: agent.agentId,
                agentPrompt: agent.agentPrompt,
                analysisPrompt: analysisPrompt,
            };

            const redis = getRedisClient();
            const redisKey = `${this.REDIS_AGENT_PREFIX}${agentId}`;
            await redis.setex(
                redisKey,
                this.REDIS_TTL,
                JSON.stringify(agentPrompts)
            );

            console.log(`✅ Prompts loaded from DB and cached in Redis: ${agentId}`);
            return agentPrompts;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error fetching agent prompts:", error.message);
                throw error; // Re-throw to propagate the error
            } else {
                console.error("Unknown error fetching agent prompts:", error);
                throw new Error("Failed to fetch agent prompts");
            }
        }
    }

    async getLeadStatusWithCustomData(transcript: any) {
        if (!this.agentPrompts) {
            throw new Error("Agent not initialized");
        }

        if (!transcript || transcript.length === 0) {
            return {};
        }

        // Skip analysis if analysis prompt is not available
        if (!this.agentPrompts.analysisPrompt || this.agentPrompts.analysisPrompt.trim() === '') {
            console.warn("⚠️ Analysis prompt not available. Skipping call analysis.");
            return {};
        }

        try {
            let prompt =
                this.agentPrompts.analysisPrompt +
                "\n\nConversation Transcript:\n";

            for (const turn of transcript) {
                const role = turn.role === "agent" ? "Assistant" : "User";
                prompt += `${role}: ${turn.content}\n`;
            }

            prompt +=
                "\n\nIMPORTANT: Return ONLY the JSON object, no explanations or additional text:";

            console.log(
                "Sending prompt to Ollama for analysis:",
                prompt.substring(0, 200) + "..."
            );

            const completion = await axios.post<any>(
                process.env.OLLAMA_BASE_URL!,
                {
                    model: process.env.OLLAMA_MODEL,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        top_p: 0.9,
                        top_k: 40,
                    },
                },
                {
                    timeout: 30000,
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const raw = completion.data?.response?.trim();
            if (!raw) {
                console.log("No result from Ollama");
                return {};
            }
            return JSON.parse(raw);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(
                    "Error getting lead status and custom data from Ollama:",
                    error.message
                );
            } else {
                console.error(
                    "Error getting lead status and custom data from Ollama:",
                    error
                );
            }
            return {};
        }
    }

    private async fetchAgentPrompts(
        agentId: string
    ): Promise<AgentPrompts | null> {
        try {
            let prompts = await this.getAgentPromptsFromRedis(agentId);

            if (!prompts) {
                prompts = await this.getAgentPromptsFromDatabase(agentId);
            }

            return prompts;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error in fetchAgentPrompts:", error.message);
            } else {
                console.error("Unknown error in fetchAgentPrompts:", error);
            }
            return null;
        }
    }

    async initializeAgent(agentId: string): Promise<void> {
        try {
            console.log(`🚀 Initializing agent: ${agentId}`);

            if (this.agentPrompts?.agentId === agentId) {
                console.log(`✅ Agent ${agentId} already initialized - FAST PATH`);
                return;
            }

            this.agentPrompts = await this.fetchAgentPrompts(agentId);

            if (!this.agentPrompts) {
                throw new Error(`Failed to load prompts for agent ${agentId}`);
            }

            console.log(`✅ Agent ${agentId} initialized successfully`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Failed to initialize agent ${agentId}:`, error.message);
            } else {
                console.error(`Failed to initialize agent ${agentId}:`, error);
            }
            throw error;
        }
    }

    async getCurrentPrompts(agentId: string): Promise<AgentPrompts | null> {
        return await this.fetchAgentPrompts(agentId);
    }

    async clearAgentCache(agentId: string): Promise<void> {
        try {
            const redis = getRedisClient();
            const redisKey = `${this.REDIS_AGENT_PREFIX}${agentId}`;
            await redis.del(redisKey);
            console.log(`🗑️ Cache cleared for agent: ${agentId}`);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error clearing cache:", error.message);
            } else {
                console.error("Unknown error clearing cache:", error);
            }
        }
    }

    async clearAllAgentCaches(): Promise<void> {
        try {
            const redis = getRedisClient();
            const pattern = `${this.REDIS_AGENT_PREFIX}*`;
            const keys = await redis.keys(pattern);

            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`🗑️ Cleared ${keys.length} agent caches`);
            } else {
                console.log("No agent caches to clear");
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("Error clearing all caches:", error.message);
            } else {
                console.error("Unknown error clearing all caches:", error);
            }
        }
    }


    private ConversationToChatRequestMessages(
        conversation: any
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        for (const turn of conversation) {
            result.push({
                role: turn.role === "agent" ? "assistant" : "user",
                content: turn.content,
            });
        }
        return result;
    }

    private PreparePrompt(
        request: any,
        funcResult?: any
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        if (!this.agentPrompts) {
            throw new Error("Agent not initialized");
        }

        const transcript = this.ConversationToChatRequestMessages(
            request.transcript
        );

        const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [
                {
                    role: "system",
                    content: this.agentPrompts.agentPrompt,
                },
            ];

        for (const message of transcript) {
            requestMessages.push(message);
        }

        if (funcResult) {
            requestMessages.push({
                role: "assistant",
                content: null,
                tool_calls: [
                    {
                        id: funcResult.id,
                        type: "function",
                        function: {
                            name: funcResult.funcName,
                            arguments: JSON.stringify(funcResult.arguments),
                        },
                    },
                ],
            });
            requestMessages.push({
                role: "tool",
                tool_call_id: funcResult.id,
                content: funcResult.result || "",
            });
        }

        if (request.interaction_type === "reminder_required") {
            requestMessages.push({
                role: "user",
                content: "(Now the user has not responded in a while, you would say:)",
            });
        }

        return requestMessages;
    }

    async DraftResponse(
        request: any,
        ws: WebSocket,
        funcResult?: any
    ): Promise<void> {
        if (!this.agentPrompts) {
            console.error("Agent not initialized");
            return;
        }

        const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            this.PreparePrompt(request, funcResult);

        let funcCall: any;
        let funcArguments = "";

        try {
            const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
                {
                    type: "function",
                    function: {
                        name: "end_call",
                        description:
                            "End the call only when user explicitly requests it.",
                        parameters: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description:
                                        "The message you will say before ending the call with the customer.",
                                },
                            },
                            required: ["message"],
                        },
                    },
                },
            ];

            const events = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: requestMessages,
                stream: true,
                temperature: 0.3,
                max_tokens: 150,
                frequency_penalty: 0.5,
                presence_penalty: 0.3,
                tools: tools,
            });

            for await (const event of events) {
                if (event.choices.length >= 1) {
                    const delta = event.choices[0].delta;
                    if (!delta) continue;

                    if (delta.tool_calls && delta.tool_calls.length >= 1) {
                        const toolCall = delta.tool_calls[0];
                        if (toolCall.id) {
                            if (funcCall) {
                                break;
                            } else {
                                funcCall = {
                                    id: toolCall.id,
                                    funcName: toolCall.function?.name || "",
                                    arguments: {},
                                };
                            }
                        } else {
                            funcArguments += toolCall.function?.arguments || "";
                        }
                    } else if (delta.content) {
                        const res: any = {
                            response_type: "response",
                            response_id: request.response_id,
                            content: delta.content,
                            content_complete: false,
                            end_call: false,
                        };
                        ws.send(JSON.stringify(res));
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                console.error("Error in OpenAI stream:", err.message);
            } else {
                console.error("Unknown error in OpenAI stream:", err);
            }
        } finally {
            if (funcCall != null) {
                try {
                    funcCall.arguments = JSON.parse(funcArguments);

                    if (funcCall.funcName === "end_call") {
                        const res: any = {
                            response_type: "response",
                            response_id: request.response_id,
                            content: funcCall.arguments.message,
                            content_complete: true,
                            end_call: true,
                        };
                        ws.send(JSON.stringify(res));
                    }
                } catch (parseError: unknown) {
                    if (parseError instanceof Error) {
                        console.error(
                            "Error parsing function arguments:",
                            parseError.message
                        );
                    } else {
                        console.error(
                            "Error parsing function arguments:",
                            parseError
                        );
                    }
                }
            } else {
                const res: any = {
                    response_type: "response",
                    response_id: request.response_id,
                    content: "",
                    content_complete: true,
                    end_call: false,
                };
                ws.send(JSON.stringify(res));
            }
        }
    }
}