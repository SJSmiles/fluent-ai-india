import axios from 'axios';
import OpenAI from 'openai';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatGenerationChunk {
    content: string;
}

interface ChatResult {
    content: string;
    finishReason?: string;
}

type LLMProvider = 'ollama' | 'vllm' | 'openai';

interface LLMConfig {
    provider: LLMProvider;
    model: string;
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
}

interface EmbeddingConfig {
    provider: LLMProvider;
    model: string;
    baseUrl?: string;
    apiKey?: string;
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export async function isOllamaAlive(ollamaUrl: string): Promise<boolean> {
    try {
        const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 3000 });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// =============================================================================
// CHAT LLM CLASS
// =============================================================================

export class OpenAICompatibleLLM {
    private provider: LLMProvider;
    private model: string;
    private temperature: number;
    private maxTokens?: number;
    private streaming: boolean;
    private llmBaseUrl: string;
    private openaiClient?: OpenAI;

    constructor(config: LLMConfig) {
        this.provider = config.provider;
        this.model = config.model;
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens;
        this.streaming = config.streaming ?? false;
        this.llmBaseUrl = config.baseUrl || '';

        // URL normalization
        if (config.provider === 'ollama') {
            this.llmBaseUrl = (config.baseUrl || '').replace(/\/$/, '');
        } else if (config.provider === 'vllm') {
            this.llmBaseUrl = (config.baseUrl || '').replace(/\/$/, '');
        } else if (config.provider === 'openai') {
            this.llmBaseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
            this.openaiClient = new OpenAI({
                apiKey: config.apiKey,
                baseURL: this.llmBaseUrl,
            });
        }

        console.log(
            `LLM init | provider=${this.provider} | model=${this.model} | streaming=${this.streaming}`
        );
    }

    // -------------------------------------------------------------------------
    // MESSAGE CONVERSION
    // -------------------------------------------------------------------------

    private convertMessages(messages: Message[]): Message[] {
        return messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));
    }

    // -------------------------------------------------------------------------
    // GENERATE (NON-STREAM)
    // -------------------------------------------------------------------------

    private async generateOllama(messages: Message[]): Promise<ChatResult> {
        const prompt = messages.map((m) => m.content).join(' ');

        console.log(
            `Ollama generate request to ${this.llmBaseUrl}/api/generate with prompt: ${prompt}, model: ${this.model}`
        );

        const response = await axios.post(
            `${this.llmBaseUrl}/api/generate`,
            {
                model: this.model,
                prompt: prompt,
                stream: false,
            },
            { timeout: 120000 }
        );

        return {
            content: response.data.response || '',
        };
    }

    private async generateVllm(messages: Message[]): Promise<ChatResult> {
        console.log(
            `vLLM generate request to ${this.llmBaseUrl}/v1/chat/completions with model: ${this.model}`
        );

        const response = await axios.post(
            `${this.llmBaseUrl}/v1/chat/completions`,
            {
                model: this.model,
                messages: this.convertMessages(messages),
                stream: false,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer none',
                },
                timeout: 60000,
            }
        );

        return {
            content: response.data.choices[0].message.content,
        };
    }

    async generate(messages: Message[]): Promise<ChatResult> {
        // Try Ollama first if it's the provider
        if (this.provider === 'ollama' && (await isOllamaAlive(this.llmBaseUrl))) {
            try {
                return await this.generateOllama(messages);
            } catch (error) {
                console.error(`Ollama failed → vLLM: ${error}`);
            }
        }

        // Use vLLM for ollama/vllm providers
        if (this.provider === 'ollama' || this.provider === 'vllm') {
            return await this.generateVllm(messages);
        }

        // OpenAI
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }
        console.log(`OpenAI generate request with model: ${this.model}`);
        const response = await this.openaiClient.chat.completions.create({
            model: this.model,
            messages: this.convertMessages(messages),
            stream: false,
        });

        return {
            content: response.choices[0].message.content || '',
        };
    }

    // -------------------------------------------------------------------------
    // STREAMING
    // -------------------------------------------------------------------------

    async *stream(messages: Message[]): AsyncGenerator<ChatGenerationChunk> {
        console.log(`_stream method called! provider=${this.provider}, streaming=${this.streaming}`);

        // Try Ollama streaming
        if (this.provider === 'ollama' && (await isOllamaAlive(this.llmBaseUrl))) {
            console.log('Using Ollama streaming');
            yield* this.streamOllama(messages);
            return;
        }

        // Use vLLM streaming
        if (this.provider === 'ollama' || this.provider === 'vllm') {
            console.log('Using vLLM streaming');
            yield* this.streamVllm(messages);
            return;
        }

        // OpenAI streaming
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const stream = await this.openaiClient.chat.completions.create({
            model: this.model,
            messages: this.convertMessages(messages),
            stream: true,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                yield { content: delta };
            }
        }
    }

    private async *streamOllama(messages: Message[]): AsyncGenerator<ChatGenerationChunk> {
        const prompt = messages.map((m) => m.content).join(' ');

        console.log(`Starting Ollama streaming for model ${this.model}`);

        const response = await axios.post(
            `${this.llmBaseUrl}/api/generate`,
            {
                model: this.model,
                prompt: prompt,
                stream: true,
                options: {
                    num_predict: -1,
                    temperature: 0.7,
                },
            },
            {
                responseType: 'stream',
                timeout: 300000,
            }
        );

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    const token = data.response;

                    if (token) {
                        yield { content: token };
                    }

                    if (data.done) {
                        return;
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }
        }
    }

    private async *streamVllm(messages: Message[]): AsyncGenerator<ChatGenerationChunk> {
        console.log(`Starting vLLM streaming for model ${this.model}`);

        const url = `${this.llmBaseUrl}/v1/chat/completions`;
        const payload = {
            model: this.model,
            messages: this.convertMessages(messages),
            stream: true,
        };

        console.log(`vLLM streaming request to ${url}`);

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer none',
            },
            responseType: 'stream',
            timeout: 120000,
        });

        for await (const chunk of response.data) {
            const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

            for (let line of lines) {
                if (line.startsWith('data:')) {
                    line = line.slice(5).trim();
                }

                if (line === '[DONE]') {
                    return;
                }

                try {
                    const data = JSON.parse(line);
                    const delta = data.choices?.[0]?.delta?.content;

                    if (delta) {
                        yield { content: delta };
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }
        }
    }

    // Simple prompt-based generation (backward compatible with your existing code)
    async generateFromPrompt(prompt: string): Promise<string> {
        const result = await this.generate([
            { role: 'user', content: prompt }
        ]);
        return result.content;
    }
}

// =============================================================================
// EMBEDDINGS CLASS
// =============================================================================

export class UnifiedEmbeddings {
    private provider: LLMProvider;
    private model: string;
    private llmBaseUrl: string;
    private openaiClient?: OpenAI;

    constructor(config: EmbeddingConfig) {
        this.provider = config.provider;
        this.model = config.model;
        this.llmBaseUrl = (config.baseUrl || '').replace(/\/$/, '');

        console.log(
            `Embeddings init | provider=${this.provider} | model=${this.model} | llmBaseUrl=${this.llmBaseUrl}`
        );

        if (this.provider === 'openai') {
            this.openaiClient = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || 'https://api.openai.com/v1',
            });
        }
    }

    async embedQuery(text: string): Promise<number[]> {
        try {
            if (this.provider === 'openai') {
                return await this.embedOpenai(text);
            }

            if (this.provider === 'ollama') {
                return await this.embedOllama(text);
            }

            if (this.provider === 'vllm') {
                return await this.embedVllm(text);
            }
        } catch (error) {
            console.error(`Embedding failed → vLLM fallback: ${error}`);
            return await this.embedVllm(text);
        }

        throw new Error('Unsupported embedding provider');
    }

    async embedDocuments(texts: string[]): Promise<number[][]> {
        return Promise.all(texts.map((text) => this.embedQuery(text)));
    }

    private async embedOpenai(text: string): Promise<number[]> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const response = await this.openaiClient.embeddings.create({
            model: this.model,
            input: text,
        });

        return response.data[0].embedding;
    }

    private async embedOllama(text: string): Promise<number[]> {
        const response = await axios.post(
            `${this.llmBaseUrl}/api/embeddings`,
            {
                model: this.model,
                prompt: text,
            },
            { timeout: 60000 }
        );

        return response.data.embedding;
    }

    private async embedVllm(text: string): Promise<number[]> {
        console.log(`${this.llmBaseUrl}/v1/embeddings`);
        console.log(`Request payload: model=${this.model}, input=[text]`);

        const response = await axios.post(
            `${this.llmBaseUrl}/v1/embeddings`,
            {
                model: this.model,
                input: [text],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer none',
                },
                timeout: 60000,
            }
        );

        return response.data.data[0].embedding;
    }
}

// =============================================================================
// FACTORY FUNCTIONS & SINGLETON INSTANCE
// =============================================================================

let llmInstance: OpenAICompatibleLLM | null = null;

export function initLLM(
    modelName?: string,
    streaming: boolean = false,
    config?: {
        provider?: string;
        baseUrl?: string;
        apiKey?: string;
        model?: string;
    }
): OpenAICompatibleLLM {
    const provider = (config?.provider || process.env.LLM_PROVIDER || 'ollama').toLowerCase() as LLMProvider;

    if (provider === 'openai') {
        return new OpenAICompatibleLLM({
            provider: 'openai',
            baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
            apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
            model: config?.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            streaming,
        });
    }

    if (provider === 'vllm') {
        return new OpenAICompatibleLLM({
            provider: 'vllm',
            baseUrl: config?.baseUrl || process.env.VLLM_BASE_URL,
            apiKey: 'EMPTY',
            model: config?.model || process.env.VLLM_MODEL || 'default',
            streaming,
        });
    }

    return new OpenAICompatibleLLM({
        provider: 'ollama',
        baseUrl: config?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        apiKey: 'ollama',
        model: modelName || config?.model || process.env.OLLAMA_MODEL || 'llama2',
        streaming,
    });
}

export function getEmbeddings(config?: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
}): UnifiedEmbeddings {
    const provider = (config?.provider || process.env.EMBEDDING_PROVIDER || 'ollama').toLowerCase() as LLMProvider;

    if (provider === 'openai') {
        return new UnifiedEmbeddings({
            provider: 'openai',
            baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
            apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
            model: config?.model || process.env.TEXT_EMBEDDING_MODEL || 'text-embedding-ada-002',
        });
    }

    if (provider === 'vllm') {
        return new UnifiedEmbeddings({
            provider: 'vllm',
            baseUrl: config?.baseUrl || process.env.VLLM_BASE_URL,
            model: config?.model || process.env.TEXT_EMBEDDING_MODEL || 'default',
        });
    }

    return new UnifiedEmbeddings({
        provider: 'ollama',
        baseUrl: config?.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: config?.model || process.env.TEXT_EMBEDDING_MODEL || 'nomic-embed-text',
    });
}

// =============================================================================
// SIMPLIFIED API (Compatible with your existing generateChat function)
// =============================================================================

/**
 * Simple function to generate chat response (backward compatible)
 * Replaces your existing generateChat function
 */
// export async function generateChat(prompt: string, model: any = process.env.VLLM_MODEL): Promise<string> {
//     try {
//         llmInstance = initLLM('', false, { model: model });
//         const result = await llmInstance.generateFromPrompt(prompt);
//         return result;
//     } catch (error: any) {
//         console.error('Error generating chat:', error?.response?.data || error.message);
//         throw error;
//     }
// }

export async function generateChat(
    prompt: string,
    model: any = process.env.VLLM_MODEL,
    maxRetries = 3
): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            llmInstance = initLLM('', false, { model });
            const result = await llmInstance.generateFromPrompt(prompt);
            return result;
        } catch (error: any) {
            lastError = error;
            console.error(
                `❌ generateChat failed (attempt ${attempt}/${maxRetries}):`,
                error?.response?.data || error.message
            );

            if (attempt < maxRetries) {
                // small backoff before retry
                await new Promise((res) => setTimeout(res, attempt * 500));
            }
        }
    }

    throw lastError;
}


/**
 * Generate chat with custom configuration
 */
export async function generateChatWithConfig(
    prompt: string,
    config?: {
        provider?: string;
        model?: string;
        baseUrl?: string;
        apiKey?: string;
    }
): Promise<string> {
    try {
        const llm = initLLM(config?.model, false, config);
        const result = await llm.generateFromPrompt(prompt);
        return result;
    } catch (error: any) {
        console.error('Error generating chat:', error?.response?.data || error.message);
        throw error;
    }
}