import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection } from 'mongodb';

import {
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_LEAD_STATUS_PROMPT,
    DEFAULT_SUMMARY_PROMPT,
    enhanceLeadPrompt
} from '../config/server-config';

import { generateChat } from './ai.service';

// ============================================================
// LOGGING SYSTEM
// ============================================================

enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    SUCCESS = 'SUCCESS'
}

interface LogContext {
    callId?: string;
    batchId?: string;
    recipientId?: string;
    sheetId?: string;
    companyId?: string;
    phoneNumber?: string;
    duration?: number;
    event?: string;
    status?: string | number;
    [key: string]: any;
}

class Logger {
    private static formatTimestamp(): string {
        return new Date().toISOString();
    }

    private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = this.formatTimestamp();
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        const emoji = this.getEmoji(level);
        return `[${timestamp}] ${emoji} ${level}: ${message}${contextStr}`;
    }

    private static getEmoji(level: LogLevel): string {
        const emojiMap = {
            [LogLevel.DEBUG]: '🔍',
            [LogLevel.INFO]: 'ℹ️',
            [LogLevel.WARN]: '⚠️',
            [LogLevel.ERROR]: '❌',
            [LogLevel.SUCCESS]: '✅'
        };
        return emojiMap[level] || '📝';
    }

    static debug(message: string, context?: LogContext): void {
        if (process.env.LOG_LEVEL === 'DEBUG') {
            console.log(this.formatMessage(LogLevel.DEBUG, message, context));
        }
    }

    static info(message: string, context?: LogContext): void {
        console.log(this.formatMessage(LogLevel.INFO, message, context));
    }

    static warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }

    static error(message: string, error?: any, context?: LogContext): void {
        const errorDetails = error ? {
            message: error.message,
            stack: error.stack,
            code: error.code,
            ...context
        } : context;
        console.error(this.formatMessage(LogLevel.ERROR, message, errorDetails));
    }

    static success(message: string, context?: LogContext): void {
        console.log(this.formatMessage(LogLevel.SUCCESS, message, context));
    }

    static startTimer(): () => number {
        const start = Date.now();
        return () => Date.now() - start;
    }
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

class PerformanceMetrics {
    private metrics: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();

    track(operation: string, duration: number, isError: boolean = false): void {
        const existing = this.metrics.get(operation) || { count: 0, totalDuration: 0, errors: 0 };
        this.metrics.set(operation, {
            count: existing.count + 1,
            totalDuration: existing.totalDuration + duration,
            errors: existing.errors + (isError ? 1 : 0)
        });
    }

    getReport(): string {
        const report: string[] = ['\n📊 Performance Metrics Report:'];
        this.metrics.forEach((value, key) => {
            const avgDuration = (value.totalDuration / value.count).toFixed(2);
            const errorRate = ((value.errors / value.count) * 100).toFixed(2);
            report.push(
                `  ${key}: ${value.count} calls, avg ${avgDuration}ms, ${errorRate}% errors`
            );
        });
        return report.join('\n');
    }

    reset(): void {
        this.metrics.clear();
    }
}

const performanceMetrics = new PerformanceMetrics();

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================

const CONFIG = {
    MIN_SUCCESS_DURATION_MS: 5000,
    DEFAULT_SHEET_MAX_ATTEMPTS: 3,
    BULK_WRITE_CHUNK_SIZE: 500
} as const;

const MONGODB_URI: string = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || '';

if (!MONGODB_URI || !DB_NAME) {
    Logger.error('Missing required environment variables', null, {
        hasMongoUri: !!MONGODB_URI,
        hasDbName: !!DB_NAME
    });
    process.exit(1);
}

// ============================================================
// DATABASE CONNECTION (SINGLETON)
// ============================================================

class DatabaseConnection {
    private static instance: DatabaseConnection;
    private db: Db | null = null;
    private client: MongoClient | null = null;

    public calls!: Collection;
    public Company!: Collection;
    public callLogs!: Collection;

    private constructor() { }

    static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    async initialize(): Promise<void> {
        if (this.db) {
            Logger.debug('Database already initialized');
            return;
        }

        const timer = Logger.startTimer();
        Logger.info('Initializing MongoDB connection...', {
            dbName: DB_NAME,
            uri: MONGODB_URI.substring(0, 20) + '...'
        });

        try {
            this.client = await MongoClient.connect(MONGODB_URI, {
                useUnifiedTopology: true
            } as any);

            this.db = this.client.db(DB_NAME);

            // Initialize collections
            this.calls = this.db.collection('TestCalls');
            this.Company = this.db.collection('Company');
            this.callLogs = this.db.collection('TestCallLogs');
            performanceMetrics.track('initializeDatabase', timer());
            Logger.success('MongoDB connection established', {
                dbName: DB_NAME,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('initializeDatabase', timer(), true);
            Logger.error('Failed to initialize MongoDB', error);
            throw error;
        }
    }

    isInitialized(): boolean {
        return !!this.db;
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.db = null;
            this.client = null;
            Logger.info('MongoDB connection closed');
        }
    }
}


export async function handleTestCallUpdate(callUUID: string): Promise<void> {
    try {
        Logger.info('='.repeat(50));
        Logger.info('📞 Processing call update', { callId: callUUID });

        const db = DatabaseConnection.getInstance();
        await db.initialize();

        const callData: any = await db.calls.findOne({ callUUID: callUUID });
        if (!callData) {
            Logger.warn('Call not found', { callUUID });
            return;
        }

        // ✅ Prevent duplicate processing
        if (callData.aiProcessedAt) {
            Logger.info('⚠️ Already processed, skipping AI');
            return;
        }

        const callLogsData: any = await db.callLogs.findOne({ callUUID: callUUID });
        if (!callLogsData?.transcript) {
            Logger.warn('Transcript not found', { callUUID });
            return;
        }

        const companyData: any = await db.Company.findOne({ _id: callData.companyId });
        if (!companyData) {
            Logger.warn('Company not found', { callUUID });
            return;
        }

        const transcript = callLogsData.transcript;

        // =====================================================
        // ✅ DEFAULT VALUES (for empty transcript case)
        // =====================================================
        let summary: string | null = null;
        let leadStatus: string | null = null;
        let sentiment: string | null = null;
        let nextAction: string | null = null;
        let intent: string | null = null;


        let summaryRes: any = null;
        let leadRes: any = null;
        let analysisRes: any = null;

        // =====================================================
        // 🤖 AI EXECUTION (ONLY IF TRANSCRIPT EXISTS)
        // =====================================================
        if (transcript.length === 0) {
            Logger.warn('Transcript is empty → Skipping AI', { callUUID });
        } else {
            // ✅ PROMPTS
            const summaryPrompt =
                companyData.callSummaryPrompt || DEFAULT_SUMMARY_PROMPT;

            const baseLeadPrompt =
                companyData.leadStatusPrompt || DEFAULT_LEAD_STATUS_PROMPT;

            const leadStatusArray = companyData.leadStatus || [];

            const leadPrompt = enhanceLeadPrompt(baseLeadPrompt, leadStatusArray);

            // 🚀 PARALLEL AI CALLS
            [summaryRes, leadRes, analysisRes] = await Promise.all([
                runAI(summaryPrompt, transcript, { expectJson: false }), // ✅ STRING
                runAI(leadPrompt, transcript, { expectJson: true }),     // ✅ JSON
                runAI(DEFAULT_ANALYSIS_PROMPT, transcript, { expectJson: true }), // ✅ JSON
            ]);

            summary = summaryRes || null;
            leadStatus = leadRes || null;
            leadStatus = mapLeadStatus(
                leadStatus,
                companyData.leadStatus || []
            );

            sentiment = analysisRes?.sentiment || null;
            nextAction = analysisRes?.nextAction || null;
            intent = analysisRes?.intent || null;

            Logger.info('🧠 AI Results', {
                summary,
                leadStatus,
                sentiment,
                nextAction,
                intent,
            });
        }

        // =====================================================
        // ✅ UPDATE CALL
        // =====================================================
        await db.calls.updateOne(
            { callUUID: callUUID },
            {
                $set: {
                    summary,
                    leadStatus,
                    sentiment,
                    nextAction,
                    intent,
                    aiProcessedAt: new Date(),

                    // optional debug
                    aiRaw: {
                        summary: summaryRes,
                        lead: leadRes,
                        analysis: analysisRes,
                    },
                    aiSkipped: transcript.length === 0, // ✅ optional debug flag
                },
            }
        );

        // update local object
        callData.summary = summary;
        callData.leadStatus = leadStatus;


        Logger.success('✅ Call update complete', { callId: callUUID });
        Logger.info('='.repeat(50));

    } catch (error) {
        Logger.error('❌ Fatal error in handleCallUpdate', error, {
            callId: callUUID,
        });
        throw error;
    }
}

function normalize(text: string) {
    return text?.toLowerCase().trim();
}

function mapLeadStatus(aiStatus: any, allowedStatuses: string[]) {
    if (!aiStatus) return 'Unclassified';

    const normalizedAI = normalize(aiStatus);

    // exact match
    const exactMatch = allowedStatuses.find(
        s => normalize(s) === normalizedAI
    );
    if (exactMatch) return exactMatch;

    // partial match
    const partialMatch = allowedStatuses.find(
        s =>
            normalizedAI.includes(normalize(s)) ||
            normalize(s).includes(normalizedAI)
    );
    if (partialMatch) return partialMatch;

    return 'Unclassified';
}

async function runAI(
    prompt: string,
    transcript: any[],
    options?: { expectJson?: boolean }
) {
    const finalPrompt = `
${prompt}

Conversation:
${transcript.map(t => `${t.role}: ${t.text}`).join('\n')}
`;

    const response = await generateChat(finalPrompt);

    console.log('🤖 AI Raw Response:', response);

    // ✅ If expecting plain text → return as-is
    if (!options?.expectJson) {
        return { text: response?.trim() };
    }

    // ✅ JSON mode
    const parsed = safeParseJSON(response);

    if (!parsed) {
        Logger.error('❌ AI parse failed', { response });
        return {};
    }

    return parsed;
}


function safeParseJSON(response: string) {
    try {
        return JSON.parse(response);
    } catch {
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e) {
                Logger.error('❌ JSON extraction failed', { response });
            }
        }
        return null;
    }
}

