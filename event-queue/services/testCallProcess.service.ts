import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection } from 'mongodb';

import {
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_LEAD_STATUS_PROMPT,
    DEFAULT_SUMMARY_PROMPT
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


export async function handleTestCallUpdate(call_id: string): Promise<void> {
    try {
        Logger.info('='.repeat(50));
        Logger.info('📞 Processing call update', { callId: call_id });

        const db = DatabaseConnection.getInstance();
        await db.initialize();

        const callData: any = await db.calls.findOne({ callUUID: call_id });
        if (!callData) {
            Logger.warn('Call not found', { call_id });
            return;
        }

        // ✅ Prevent duplicate processing
        if (callData.aiProcessedAt) {
            Logger.info('⚠️ Already processed, skipping AI');
            return;
        }

        const callLogsData: any = await db.callLogs.findOne({ callUUID: call_id });
        if (!callLogsData?.transcript) {
            Logger.warn('Transcript not found', { call_id });
            return;
        }

        const companyData: any = await db.Company.findOne({ _id: callData.companyId });
        if (!companyData) {
            Logger.warn('Company not found', { call_id });
            return;
        }

        const transcript = callLogsData.transcript;

        // =====================================================
        // ✅ PROMPTS (company OR default)
        // =====================================================
        const summaryPrompt = companyData.callSummaryPrompt || DEFAULT_SUMMARY_PROMPT;
        const leadPrompt = companyData.leadStatusPrompt || DEFAULT_LEAD_STATUS_PROMPT;

        // =====================================================
        // 🚀 PARALLEL AI CALLS
        // =====================================================
        const [summaryRes, leadRes, analysisRes] = await Promise.all([
            runAI(summaryPrompt, transcript),
            runAI(leadPrompt, transcript),
            runAI(DEFAULT_ANALYSIS_PROMPT, transcript),
        ]);

        // =====================================================
        // ✅ EXTRACT VALUES
        // =====================================================
        const rawLeadStatus = leadRes?.leadStatus || null;

        const summary = summaryRes?.summary || null;
        const leadStatus = mapLeadStatus(
            rawLeadStatus,
            companyData.leadStatus || []
        );

        const sentiment = analysisRes?.sentiment || null;
        const nextAction = analysisRes?.nextAction || null;
        const intent = analysisRes?.intent || null;

        Logger.info('🧠 AI Results', {
            summary,
            rawLeadStatus,
            finalLeadStatus: leadStatus,
            sentiment,
            nextAction,
            intent,
        });

        // =====================================================
        // ✅ UPDATE CALL
        // =====================================================
        await db.calls.updateOne(
            { callUUID: call_id },
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
                },
            }
        );

        // update local object
        callData.summary = summary;
        callData.leadStatus = leadStatus;


        Logger.success('✅ Call update complete', { callId: call_id });
        Logger.info('='.repeat(50));

    } catch (error) {
        Logger.error('❌ Fatal error in handleCallUpdate', error, {
            callId: call_id,
        });
        throw error;
    }
}

function normalize(text: string) {
    return text?.toLowerCase().trim();
}

function mapLeadStatus(aiStatus: string, allowedStatuses: string[]) {
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

async function runAI(prompt: string, transcript: any[]) {
    const finalPrompt = `
${prompt}

Conversation:
${transcript.map(t => `${t.role}: ${t.text}`).join('\n')}
`;

    const response = await generateChat(finalPrompt);

    try {
        return JSON.parse(response);
    } catch (e) {
        Logger.error('❌ AI parse failed', { response });
        return {};
    }
}

