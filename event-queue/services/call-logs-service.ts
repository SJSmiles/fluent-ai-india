import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

import {
    BATCH_CALL_PROCESS_STATUS,
    BATCH_CALL_STATUS,
    CALL_DIRECTION,
    CALL_STATUS,
    LEAD_STATUS_FOR_SYNC,
    meetingStatusesArray,
    PM_QUALI_COMPANY_ID,
    SMS,
    SYNC_NOT_ALLOWED_AGENTS,
} from '../config/server-config';

import { generateChat } from './ai.service';
import { call } from 'assert/strict';

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

const MONGO_URI: string = process.env.MONGO_URI || '';
const DB_NAME = process.env.DB_NAME || '';

if (!MONGO_URI || !DB_NAME) {
    Logger.error('Missing required environment variables', null, {
        hasMongoUri: !!MONGO_URI,
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
            uri: MONGO_URI.substring(0, 20) + '...'
        });

        try {
            this.client = await MongoClient.connect(MONGO_URI, {
                useUnifiedTopology: true
            } as any);

            this.db = this.client.db(DB_NAME);

            // Initialize collections
            this.calls = this.db.collection('Calls');
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
// CALL EVALUATION LOGIC
// ============================================================

class CallEvaluator {
    static isCallSuccessful(disconnectionReason: string, durationMs: number): boolean {
        const isSuccess = !!(
            disconnectionReason &&
            BATCH_CALL_PROCESS_STATUS.SUCCESS.includes(disconnectionReason) &&
            durationMs >= CONFIG.MIN_SUCCESS_DURATION_MS
        );

        Logger.debug('Evaluating call success', {
            disconnectionReason,
            durationMs,
            minDuration: CONFIG.MIN_SUCCESS_DURATION_MS,
            isSuccess
        });

        return isSuccess;
    }
}


// ============================================================
// CALL UPSERT HANDLER
// ============================================================

class CallUpsertHandler {
    private db: DatabaseConnection;

    constructor(db: DatabaseConnection) {
        this.db = db;
    }

    async upsert(
        call_id: string,
        call: any,
        dynamicVars: any,
        clientName: string,
        status: number,
        nextCallDate: Date | null,
        taskType: string | null,
        createdById: ObjectId | null,
        logs: any,
        updatedBatch: any
    ): Promise<any> {
        const timer = Logger.startTimer();

        try {
            const leadStatus = call.call_analysis?.custom_analysis_data?.lead_status || 'Unclassified';

            const callData: any = {
                callId: call_id,
                clientName,
                status,
                recordingUrl: call.recording_url,
                syncInBmby: false,
                duration: call.duration_ms,
                disconnectionReason: call.disconnection_reason,
                direction: call.direction === 'outbound' ? CALL_DIRECTION.OUTBOUND : CALL_DIRECTION.INBOUND,
                fromNumber: call.from_number,
                toNumber: call.to_number,
                leadStatus,
                nextCallDate,
                callInterestStatus: true,
                taskType,
                leadFrom: dynamicVars?.leadFrom || '',
                agentId: call.agent_id,
                callLogs: [{
                    eventType: logs.raw_data.event,
                    callLogId: logs._id.toString()
                }],
                batchCallId: call.batch_call_id || dynamicVars?.batchCallId || null,
                followup_call_id: dynamicVars?.followupBatchCallId || null,
                callCreatedFrom: dynamicVars?.sheet_id ? 'sheet' : 'batch-call',
                updatedAt: new Date(),
                createdAt: new Date(),
                bmbyId: dynamicVars?.client_id,
                createdBy: createdById,
                availableInBmby: true,
                firstName: dynamicVars?.firstName || '',
                lastName: dynamicVars?.lastName || '',
                email: dynamicVars?.email || '',
                country: dynamicVars?.country || '',
                gender: dynamicVars?.gender || '',
                number: dynamicVars?.number || null,
                companyId: updatedBatch?.companyId
            };

            await this.db.calls.updateOne(
                { callId: call_id },
                { $set: callData },
                { upsert: true }
            );

            function getAgentSMS(agentId: string) {
                const config = SMS.agents.find((a: any) =>
                    a.agentIds.includes(agentId)
                );

                return config ? config.message : null;
            }


            performanceMetrics.track('upsertCall', timer());
            Logger.success('Call record upserted', {
                callId: call_id,
                leadStatus,
                status,
                duration: call.duration_ms,
                processingTime: timer()
            });

            return callData;
        } catch (error) {
            performanceMetrics.track('upsertCall', timer(), true);
            Logger.error('Error upserting call', error, { callId: call_id });
            throw error;
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
                callId: callData.callId,
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
                callId: callData.callId,
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
            await this.updateCallAttempts(callData?.batchCallId, callData?.toNumber, callData?.callId, statusUpdate.newAttemptLength);

            // Update batch counters
            await this.updateBatchCounters(callData?.batchCallId, callData?.followupCallId);

            // Check for completion
            await this.checkAndCompleteBatch(callData.batchCallId);

            performanceMetrics.track('processBatch', timer());
            Logger.success('Batch processing complete', {
                callId: callData?.callId,
                recipientId: callData?.recipientId,
                status: statusUpdate.statusValue,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('processBatch', timer(), true);
            Logger.error('Error processing batch', error, {
                callId: callData?.callId,
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
        if (BATCH_CALL_PROCESS_STATUS.SUCCESS.includes(callData.disconnection_reason) &&
            callData.duration_ms >= BATCH_CALL_PROCESS_STATUS.MIN_TIME_FOR_SUCCESS) {
            statusValue = BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE;
            Logger.debug('Call marked as successful', {
                recipientId: recipient._id.toString(),
                disconnectionReason: callData.disconnection_reason,
                duration: callData.duration_ms
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
        batchCallId: any,
        toNumber: string,
        callId: string,
        attemptLength: number
    ): Promise<void> {
        await this.db.calls.updateOne(
            { batchCallId: batchCallId, toNumber: toNumber, callId: callId },
            {
                $set: {
                    updatedAt: new Date(),
                    attemptLength: attemptLength
                }
            }
        );

        Logger.debug('Call attempts updated', {
            callId,
            toNumber,
            attemptLength
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
            console.log('Tracking lead status change inside method for call:', callData.callId, 'with status:', callData.leadStatus);
            if (!callData?.callId || !callData?.leadStatus) {
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

            console.log('Previous call data retrieved for call:', callData.callId, 'is:', previousCall);


            const previousLeadStatus = previousCall?.leadStatus || null;

            console.log('Previous lead status for call:', callData.callId, 'is:', previousLeadStatus);

            // ✅ Skip if same status
            if (previousLeadStatus === callData.leadStatus) {
                Logger.debug('Lead status unchanged - skipping history');
                return;
            }

            Logger.info('Creating lead status history', {
                callId: callData.callId,
                previousStatus: previousLeadStatus,
                newStatus: callData.leadStatus
            });



            // ✅ Use existing collection
            const historyEntry = {
                phoneNumber: callData.toNumber,
                companyId: callData.companyId,
                leadStatus: callData.leadStatus,
                callId: callData.callId,
                createdBy: callData.createdBy,
                createdByType: 'system',
                changeReason: `Auto-updated via webhook from "${previousLeadStatus || 'Unclassified'}" to "${callData.leadStatus}"`,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log('Inserting lead status history entry for call:', callData.callId, 'Entry:', historyEntry);

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


// ============================================================
// MAIN HANDLER
// ============================================================

export async function handleCallUpdate(call_id: string): Promise<void> {
    const overallTimer = Logger.startTimer();

    try {
        Logger.info('='.repeat(60));
        Logger.info('📞 Processing call update', { callId: call_id });
        Logger.info('='.repeat(60));

        // Initialize database
        const db = DatabaseConnection.getInstance();
        await db.initialize();
        // Get call details
        const callData: any = await db.calls.findOne({ callId: call_id });

        if (!callData) {
            Logger.warn('Call not found in database', { callId: call_id });
            return;
        }

        Logger.debug('Call details retrieved', {
            callId: call_id,
            fromNumber: callData.from_number,
            toNumber: callData.to_number,
            duration: callData.duration_ms,
            disconnectionReason: callData.disconnection_reason
        });


        // if (!requestedMeeting && (custom_analysis_data?.lead_status === 'will join session' || custom_analysis_data?.lead_status === 'callback requested')) {
        //     const call_summary = call?.call_analysis?.call_summary || '';
        //     const prompt = `
        //         You are extracting a meeting schedule from a call summary.

        //         Analyze the summary and determine when the lead agreed to join a session.

        //         Rules:
        //         1. Return ONLY a datetime in ISO format: YYYY-MM-DDTHH:MM
        //         2. Convert natural phrases to time:

        //         "tomorrow" → tomorrow at 10:00
        //         "morning" → 10:00
        //         "afternoon" → 14:00
        //         "evening" → 18:00
        //         "night" → 20:00

        //         3. If only weekday is mentioned (Friday, Monday), return the next upcoming weekday at 10:00.
        //         4. If the user said "anytime", "flexible", or no clear time is mentioned, return the next day at 10:00.
        //         5. If absolutely no meeting intention exists, return exactly: unknown

        //         Return ONLY the datetime or "unknown".

        //         Call Summary:
        //         ${call_summary}
        //         `;
        //     const response = await generateChat(prompt);
        //     if (!isNaN(new Date(response).getTime())) {
        //         nextCallDate = new Date(response);
        //         taskType = 'Appointment';
        //     }

        // }


        // Handle blacklist
        if (callData.leadStatus === 'Do Not Contact') {
            const blacklistManager = new BlacklistManager(db);
            await blacklistManager.addToBlacklist(callData);
        }


        //✅ Handle lead status history
        const leadStatusHistoryHandler = new LeadStatusHistoryHandler(db);

        console.log('Tracking lead status change for call:', callData.callId, 'with status:', callData.leadStatus);
        await leadStatusHistoryHandler.trackStatusChange(callData);

        // Process batch call
        if (callData) {
            const batchProcessor = new BatchProcessor(db);
            await batchProcessor.process(
                callData,
            );
        }



        performanceMetrics.track('handleCallUpdate', overallTimer());
        Logger.success('Call update processing complete', {
            callId: call_id,
            totalDuration: overallTimer()
        });
        // Logger.info(performanceMetrics.getReport());
        Logger.info('='.repeat(60));

    } catch (error) {
        performanceMetrics.track('handleCallUpdate', overallTimer(), true);
        Logger.error('Fatal error processing call update', error, {
            callId: call_id,
            duration: overallTimer()
        });
        Logger.info('='.repeat(60));
        throw error;
    }
}

