import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

import {
    BATCH_CALL_PROCESS_STATUS,
    BATCH_CALL_STATUS,
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
    callUUID?: string;
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
    public batchCall!: Collection;
    public user!: Collection;
    public batchCallFollowUps!: Collection;
    public recipients!: Collection;
    public blackList!: Collection;
    public leadStatusHistory!: Collection;

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
            this.calls = this.db.collection('Calls');
            this.Company = this.db.collection('Company');
            this.callLogs = this.db.collection('CallLogs');
            this.batchCall = this.db.collection('BatchCall');
            this.batchCallFollowUps = this.db.collection('BatchCallFollowUps');
            this.recipients = this.db.collection('Recipients');
            this.user = this.db.collection('User');
            this.blackList = this.db.collection('BlackList');
            this.leadStatusHistory = this.db.collection('LeadStatusHistory');
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



// ============================================================
// BLACKLIST MANAGER
// ============================================================

class BlacklistManager {
    private db: DatabaseConnection;

    constructor(db: DatabaseConnection) {
        this.db = db;
    }

    async addToBlacklist(callData: any): Promise<void> {
        const timer = Logger.startTimer();

        try {
            Logger.info('Adding number to blacklist', {
                phoneNumber: callData.toNumber,
                callUUID: callData.callUUID,
                reason: 'Do Not Contact'
            });

            let companyId = null;

            if (callData.createdBy) {
                const userDoc = await this.db.user.findOne(
                    { _id: callData.createdBy },
                    { projection: { companyId: 1 } }
                );
                companyId = userDoc?.companyId || null;
            }

            if (!companyId) {
                Logger.warn('Cannot add to blacklist - no companyId', {
                    phoneNumber: callData.toNumber,
                    userId: callData.createdBy?.toString()
                });
                return;
            }

            // Check if already exists
            const existing = await this.db.blackList.findOne({
                toNumber: callData.toNumber,
                companyId,
                isArchived: false
            });

            if (existing) {
                Logger.info('Number already in blacklist', {
                    phoneNumber: callData.toNumber,
                    companyId: companyId.toString()
                });
                return;
            }

            const blackListEntry = {
                toNumber: callData.toNumber,
                companyId,
                createdBy: callData.createdBy,
                clientName: callData.clientName || 'Unknown',
                bmbyId: callData.bmbyId || null,
                email: callData.email || null,
                reason: 'Do Not Contact',
                callUUID: callData.callUUID,
                isArchived: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.db.blackList.insertOne(blackListEntry);

            performanceMetrics.track('addToBlacklist', timer());
            Logger.success('Number added to blacklist', {
                phoneNumber: callData.toNumber,
                companyId: companyId.toString(),
                duration: timer()
            });
        } catch (error: any) {
            performanceMetrics.track('addToBlacklist', timer(), true);

            if (error.code === 11000) {
                Logger.info('Duplicate key - number already in blacklist', {
                    phoneNumber: callData.toNumber
                });
            } else {
                Logger.error('Error adding to blacklist', error, {
                    phoneNumber: callData.toNumber
                });
            }
        }
    }
}

// ============================================================
// BATCH PROCESSOR
// ============================================================

class BatchProcessor {
    private db: DatabaseConnection;

    constructor(db: DatabaseConnection) {
        this.db = db;
    }

    async process(
        callData: any,
    ): Promise<void> {
        const timer = Logger.startTimer();

        try {
            // Get recipient
            const recipient = await this.db.recipients.findOne({
                _id: new ObjectId(callData?.recipientId)
            });

            if (!recipient) {
                Logger.warn('Recipient not found', { recipientId: callData?.recipientId });
                return;
            }

            // Calculate status
            const statusUpdate = this.calculateRecipientStatus(
                callData,
                recipient,
            );

            // Update recipient
            await this.updateRecipient(recipient._id, callData, statusUpdate);

            // Update calls collection
            await this.updateCallAttempts(callData, statusUpdate.newAttemptLength, recipient);

            // Update batch counters
            await this.updateBatchCounters(callData?.batchCallId, callData?.followupBatchCallId);

            // Check for completion
            await this.checkAndCompleteBatch(callData.batchCallId);

            performanceMetrics.track('processBatch', timer());
            Logger.success('Batch processing complete', {
                callUUID: callData?.callUUID,
                recipientId: callData?.recipientId,
                status: statusUpdate.statusValue,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('processBatch', timer(), true);
            Logger.error('Error processing batch', error, {
                callUUID: callData?.callUUID,
                batchCallId: callData?.batchCallId,
                recipientId: callData?.recipientId
            });
            throw error;
        }
    }



    private calculateRecipientStatus(
        callData: any,
        recipient: any,
    ): { statusValue: number; newAttemptLength: number } {
        const newAttemptLength = (recipient.attemptLength || 0) + 1;
        let statusValue = BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE;

        // Check for success
        if (callData.duration >= BATCH_CALL_PROCESS_STATUS.MIN_TIME_FOR_SUCCESS) {
            statusValue = BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE;
            Logger.debug('Call marked as successful', {
                recipientId: recipient._id.toString(),
                duration: callData.duration
            });
        }
        // Check for max attempts reached
        else if (newAttemptLength >= (recipient?.maxAttempts || 1)) {
            statusValue = BATCH_CALL_PROCESS_STATUS.DEAD;
            Logger.debug('Max attempts reached - marking as dead', {
                recipientId: recipient._id.toString(),
                attempts: newAttemptLength,
                maxAttempts: recipient?.maxAttempts
            });
        }

        // Override for Do Not Contact
        if (callData.leadStatus === 'Do Not Contact') {
            statusValue = BATCH_CALL_PROCESS_STATUS.DEAD;
            Logger.debug('Do Not Contact - marking as dead', {
                recipientId: recipient._id.toString()
            });
        }

        console.log('Calculated recipient status', {
            recipientId: recipient._id.toString(),
            statusValue,
            newAttemptLength
        });
        return { statusValue, newAttemptLength };
    }

    private async updateRecipient(
        recipientId: any,
        callData: any,
        statusUpdate: { statusValue: number; newAttemptLength: number }
    ): Promise<void> {
        await this.db.recipients.updateOne(
            { _id: recipientId },
            {
                $set: {
                    status: statusUpdate.statusValue,
                    updatedAt: new Date(),
                    attemptLength: statusUpdate.newAttemptLength,
                }
            }
        );

        Logger.debug('Recipient updated', {
            recipientId: recipientId.toString(),
            status: statusUpdate.statusValue,
            attemptLength: statusUpdate.newAttemptLength
        });
    }

    private async updateCallAttempts(
        callData: any,
        newAttemptLength: number,
        recipient: any
    ): Promise<void> {
        await this.db.calls.updateOne(
            { batchCallId: callData.batchCallId, toNumber: callData.toNumber, callUUID: callData.callUUID },
            {
                $set: {
                    updatedAt: new Date(),
                    firstName: recipient.firstName || null,
                    lastName: recipient.lastName || null,
                    email: recipient.email || null,
                    gender: recipient.gender || null,
                    attemptLength: newAttemptLength
                }
            }
        );

        Logger.debug('Call attempts updated', {
            callUUID: callData.callUUID,
            toNumber: callData.toNumber,
            attemptLength: newAttemptLength
        });
    }

    private async updateBatchCounters(
        batchCallId: any,
        followupCallId: any
    ): Promise<void> {
        const isFollowUp = !!followupCallId;

        if (!isFollowUp) {
            await this.db.batchCall.updateOne(
                { _id: new ObjectId(batchCallId) },
                {
                    $set: { updatedAt: new Date() },
                    $inc: { processedRecipient: 1 }
                }
            );

            Logger.debug('Main batch counter incremented', {
                batchCallId: batchCallId.toString()
            });
        } else {
            await this.db.batchCallFollowUps.updateOne(
                { _id: new ObjectId(followupCallId) },
                {
                    $set: { updatedAt: new Date() },
                    $inc: { processedRecipient: 1 }
                }
            );

            Logger.debug('Follow-up batch counter incremented', {
                followupCallId: followupCallId.toString()
            });

            // Check follow-up completion
            const updatedFollowUp: any = await this.db.batchCallFollowUps.findOne({
                _id: new ObjectId(followupCallId)
            });

            if (updatedFollowUp?.processedRecipient === updatedFollowUp?.totalRecipient) {
                await this.db.batchCallFollowUps.updateOne(
                    { _id: new ObjectId(followupCallId) },
                    {
                        $set: {
                            status: BATCH_CALL_STATUS.COMPLETED,
                            updatedAt: new Date()
                        }
                    }
                );

                Logger.success('Follow-up batch completed', {
                    followupCallId: followupCallId.toString(),
                    processed: updatedFollowUp.processedRecipient,
                    total: updatedFollowUp.totalRecipient
                });
            }
        }
    }

    private async checkAndCompleteBatch(batchId: any): Promise<void> {
        const timer = Logger.startTimer();

        try {
            Logger.debug('Checking batch completion', {
                batchId: batchId.toString()
            });

            const completionCheck = await this.db.recipients.aggregate([
                { $match: { batchCallId: batchId } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        completed: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            "$status",
                                            [
                                                BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE,
                                                BATCH_CALL_PROCESS_STATUS.DEAD,
                                                BATCH_CALL_PROCESS_STATUS.SKIP,
                                                BATCH_CALL_PROCESS_STATUS.FAILED
                                            ]
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]).toArray();

            if (!completionCheck.length) {
                Logger.debug('No recipients found for batch', {
                    batchId: batchId.toString()
                });
                return;
            }

            const { total, completed } = completionCheck[0];

            Logger.debug('Batch completion status', {
                batchId: batchId.toString(),
                completed,
                total,
                percentage: ((completed / total) * 100).toFixed(2)
            });

            if (total === completed) {
                // Use findOneAndUpdate to prevent race conditions
                const result = await this.db.batchCall.findOneAndUpdate(
                    {
                        _id: batchId,
                        status: { $ne: BATCH_CALL_STATUS.COMPLETED }
                    },
                    {
                        $set: {
                            status: BATCH_CALL_STATUS.COMPLETED,
                            updatedAt: new Date()
                        }
                    },
                    { returnDocument: 'after' }
                );

                if (result) {
                    Logger.success('Batch marked as completed', {
                        batchId: batchId.toString(),
                        totalRecipients: total
                    });
                } else {
                    Logger.debug('Batch already marked as completed by another process', {
                        batchId: batchId.toString()
                    });
                }
            }

            performanceMetrics.track('checkAndCompleteBatch', timer());
        } catch (error) {
            performanceMetrics.track('checkAndCompleteBatch', timer(), true);
            Logger.error('Error checking batch completion', error, {
                batchId: batchId.toString()
            });
            throw error;
        }
    }
}


// ============================================================
// LEAD STATUS HISTORY HANDLER
// ============================================================

class LeadStatusHistoryHandler {
    private db: DatabaseConnection;

    constructor(db: DatabaseConnection) {
        this.db = db;
    }

    async trackStatusChange(callData: any): Promise<void> {
        const timer = Logger.startTimer();

        console.log('callData:', callData);

        try {
            console.log('Tracking lead status change inside method for call:', callData.callUUID, 'with status:', callData.leadStatus);
            if (!callData?.callUUID || !callData?.leadStatus) {
                Logger.debug('Missing required fields for status history');
                return;
            }

            // Get previous status
            const previousCall = await this.db.leadStatusHistory.findOne(
                {
                    phoneNumber: callData.toNumber,
                    companyId: callData.companyId
                },
                {
                    sort: { updatedAt: -1 } // latest updated record
                }
            );

            console.log('Previous call data retrieved for call:', callData.callUUID, 'is:', previousCall);


            const previousLeadStatus = previousCall?.leadStatus || null;

            console.log('Previous lead status for call:', callData.callUUID, 'is:', previousLeadStatus);

            // ✅ Skip if same status
            if (previousLeadStatus === callData.leadStatus) {
                Logger.debug('Lead status unchanged - skipping history');
                return;
            }

            Logger.info('Creating lead status history', {
                callUUID: callData.callUUID,
                previousStatus: previousLeadStatus,
                newStatus: callData.leadStatus
            });



            // ✅ Use existing collection
            const historyEntry = {
                phoneNumber: callData.toNumber,
                companyId: callData.companyId,
                leadStatus: callData.leadStatus,
                callUUID: callData.callUUID,
                createdBy: callData.createdBy,
                createdByType: 'system',
                changeReason: `Auto-updated via webhook from "${previousLeadStatus || 'Unclassified'}" to "${callData.leadStatus}"`,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log('Inserting lead status history entry for call:', callData.callUUID, 'Entry:', historyEntry);

            const newHistoryEntry = await this.db.leadStatusHistory.insertOne(historyEntry);
            console.log('Lead status history entry created with ID:', newHistoryEntry.insertedId.toString());

            performanceMetrics.track('trackStatusChange', timer());
            Logger.success('Lead status history created');
        } catch (error: any) {
            performanceMetrics.track('trackStatusChange', timer(), true);
            Logger.error('Error creating lead status history', error);
        }
    }
}


// =====================================================
// 🚀 MAIN FUNCTION
// =====================================================
export async function handleCallUpdate(callUUID: string): Promise<void> {
    try {
        Logger.info('='.repeat(50));
        Logger.info('📞 Processing call update', { callUUID });

        const db = DatabaseConnection.getInstance();
        await db.initialize();

        const callData: any = await db.calls.findOne({ callUUID });
        if (!callData) {
            Logger.warn('Call not found', { callUUID });
            return;
        }

        // ✅ Prevent duplicate processing
        if (callData.aiProcessedAt) {
            Logger.info('⚠️ Already processed, skipping AI');
            return;
        }

        const callLogsData: any = await db.callLogs.findOne({ callUUID });
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

            const leadPrompt =
                companyData.leadStatusPrompt || DEFAULT_LEAD_STATUS_PROMPT;

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
        // ✅ UPDATE CALL (RUNS IN BOTH CASES)
        // =====================================================
        await db.calls.updateOne(
            { callUUID },
            {
                $set: {
                    summary,
                    leadStatus,
                    sentiment,
                    nextAction,
                    intent,
                    aiProcessedAt: new Date(),

                    aiRaw:
                        transcript.length === 0
                            ? null
                            : {
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
        callData.leadStatus = leadStatus || 'Unclassified';

        // =====================================================
        // ✅ BLACKLIST
        // =====================================================
        if (leadStatus === 'Do Not Disturb') {
            const blacklistManager = new BlacklistManager(db);
            await blacklistManager.addToBlacklist(callData);
        }

        // =====================================================
        // ✅ LEAD STATUS HISTORY
        // =====================================================
        const leadStatusHistoryHandler = new LeadStatusHistoryHandler(db);
        await leadStatusHistoryHandler.trackStatusChange(callData);

        // =====================================================
        // ✅ BATCH PROCESS
        // =====================================================
        const batchProcessor = new BatchProcessor(db);
        await batchProcessor.process(callData);

        Logger.success('✅ Call update complete', { callUUID });
        Logger.info('='.repeat(50));

    } catch (error) {
        Logger.error('❌ Fatal error in handleCallUpdate', error, {
            callUUID,
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
