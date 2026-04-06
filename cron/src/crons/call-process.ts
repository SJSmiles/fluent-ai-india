import mongoose from "mongoose";
import { getCollection } from "../database/mongo-connect.js";
import { BATCH_CALL_STATUS, RECIPIENTS_CALL_STATUS } from "./helper.js";
import { VapiClient } from "@vapi-ai/server-sdk";
import dotenv from 'dotenv';
import { BatchCall } from "retell-sdk/resources/batch-call.js";

dotenv.config();

const ObjectId = mongoose.Types.ObjectId;

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
    batchId?: string;
    followUpId?: string;
    recipientCount?: number;
    chunkIndex?: number;
    duration?: number;
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
            body: error.body,
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
    MAX_CUSTOMERS_PER_BATCH: 10,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY: 2000,
    CHUNK_DELAY: 2000,
    BULK_WRITE_CHUNK_SIZE: 500,
    DEFAULT_DELAY_DAYS: 2,
    MAX_BATCH_NAME_LENGTH: 30,
    MAX_HOURS_BATCH_COMPLETE: Number(process.env.MAX_HOURS_BATCH_COMPLETE || 2),
    MAX_PROCESS: parseInt(process.env.MAX_PROCESS || "10", 10)
} as const;

// ============================================================
// COLLECTIONS CACHE
// ============================================================

class CollectionsCache {
    private static instance: CollectionsCache;
    private initialized: boolean = false;

    public Calls: any;
    public GoogleSheetDataProcess: any;
    public BatchCall: any;
    public BatchCallFollowUps: any;
    public Recipients: any;
    public BlackList: any;
    public Company: any;

    private constructor() { }

    static getInstance(): CollectionsCache {
        if (!CollectionsCache.instance) {
            CollectionsCache.instance = new CollectionsCache();
        }
        return CollectionsCache.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            Logger.debug('Collections already initialized');
            return;
        }

        const timer = Logger.startTimer();
        Logger.info('Initializing MongoDB collections...');

        try {
            [
                this.Calls,
                this.GoogleSheetDataProcess,
                this.Recipients,
                this.Company,
                this.BlackList,
                this.BatchCall,
                this.BatchCallFollowUps
            ] = await Promise.all([
                getCollection('Calls'),
                getCollection('GoogleSheetDataProcess'),
                getCollection('Recipients'),
                getCollection('Company'),
                getCollection('BlackList'),
                getCollection('BatchCall'),
                getCollection('BatchCallFollowUps')
            ]);

            this.initialized = true;
            Logger.success('Collections initialized', { duration: timer() });
        } catch (error) {
            Logger.error('Failed to initialize collections', error);
            throw error;
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

// ============================================================
// BATCH EXPIRATION HANDLER
// ============================================================

class BatchExpirationHandler {
    private collections: CollectionsCache;
    private maxMs: number;

    constructor(collections: CollectionsCache, maxHours: number) {
        this.collections = collections;
        this.maxMs = maxHours * 60 * 60 * 1000;
        //this.maxMs = 5 * 60 * 1000;
    }

    async handleExpiredBatches(now: Date): Promise<void> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Checking for expired batches...');

        try {
            const expiredBatches = await this.collections.BatchCall.find({
                isArchived: false,
                callFrom: 'vapi',
                status: {
                    $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.IN_PROCESS]
                },
                $expr: {
                    $lt: [{ $add: ["$utcDateTime", this.maxMs] }, now]
                }
            }).toArray();

            Logger.info('Found expired batches', { count: expiredBatches.length });

            for (const batch of expiredBatches) {
                await this.processExpiredBatch(batch, now);
            }

            performanceMetrics.track('handleExpiredBatches', timer());
            Logger.success('Expired batches processed', {
                count: expiredBatches.length,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('handleExpiredBatches', timer(), true);
            Logger.error('Error handling expired batches', error);
            throw error;
        }
    }

    private async processExpiredBatch(batch: any, now: Date): Promise<void> {
        const timer = Logger.startTimer();
        const batchId = batch._id.toString();

        try {
            Logger.info('Processing expired batch', {
                batchId,
                status: batch.status,
                name: batch.name
            });

            if (batch.status === BATCH_CALL_STATUS.CREATED) {
                await this.failUnstartedBatch(batch, now);
            } else if (batch.status === BATCH_CALL_STATUS.IN_PROCESS) {
                await this.handleInProcessExpiredBatch(batch, now);
            }

            Logger.success('Expired batch processed', { batchId, duration: timer() });
        } catch (error) {
            Logger.error('Error processing expired batch', error, { batchId });
            throw error;
        }
    }

    private async failUnstartedBatch(batch: any, now: Date): Promise<void> {
        Logger.warn('Failing unstarted batch', { batchId: batch._id.toString() });

        const followUpsCount =
            await this.collections.BatchCallFollowUps.countDocuments({
                batchCallId: batch._id,
                isArchived: false,
            });

        // +1 for main batch
        const decrementBy = followUpsCount + 1;

        await Promise.all([
            this.collections.BatchCall.updateOne(
                { _id: batch._id },
                {
                    $set: {
                        status: BATCH_CALL_STATUS.FAILED,
                        errorMessage: "Batch expired before start",
                        updatedAt: now
                    }
                }
            ),

            this.collections.BatchCallFollowUps.updateMany(
                { batchCallId: batch._id },
                {
                    $set: {
                        status: BATCH_CALL_STATUS.FAILED,
                        errorMessage: "Main batch expired before start",
                        updatedAt: now
                    }
                }
            ),

            this.collections.Recipients.updateMany(
                { batchCallId: batch._id },
                {
                    $set: {
                        status: RECIPIENTS_CALL_STATUS.FAILED,
                        errorMessage: "Main batch expired before start",
                        updatedAt: now
                    },
                    $inc: {
                        maxAttempts: -decrementBy
                    }
                }
            )
        ]);

    }

    private async handleInProcessExpiredBatch(batch: any, now: Date): Promise<void> {
        const batchId = batch._id.toString();

        const pendingFollowUps = await this.collections.BatchCallFollowUps.countDocuments({
            isArchived: false,
            batchCallId: batch._id,
            status: {
                $in: [
                    BATCH_CALL_STATUS.CREATED,
                    BATCH_CALL_STATUS.NOT_STARTED,
                    BATCH_CALL_STATUS.IN_PROCESS
                ]
            }
        });

        Logger.info('In-process batch expired', {
            batchId,
            pendingFollowUps
        });

        if (pendingFollowUps > 0) {
            await this.markRecipientsForRetry(batch, now);
        } else {
            await this.completeBatchWithFailures(batch, now);
        }
    }

    private async markRecipientsForRetry(batch: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            {
                batchCallId: batch._id,
                status: RECIPIENTS_CALL_STATUS.PENDING
            },
            {
                $set: {
                    status: RECIPIENTS_CALL_STATUS.UN_SUCCESS,
                    errorMessage: 'Batch timeout - will retry in next follow-up',
                    updatedAt: now
                },
                $inc: { maxAttempts: - 1 }
            }
        );

        Logger.info('Recipients marked for retry', {
            batchId: batch._id.toString(),
            modifiedCount: result.modifiedCount
        });

        const inProcessCount = await this.collections.Recipients.countDocuments({
            batchCallId: batch._id,
            status: RECIPIENTS_CALL_STATUS.IN_PROCESS
        });

        if (inProcessCount > 0) {
            Logger.info('Batch has recipients still in process, not marking as completed', {
                batchId: batch._id.toString(),
                inProcessCount
            });
            return;
        }

        await this.collections.BatchCall.updateOne(
            { _id: batch._id },
            {
                $set: {
                    processedRecipient: batch.totalRecipient,
                    updatedAt: now
                }
            }
        );
    }

    private async completeBatchWithFailures(batch: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            {
                batchCallId: batch._id,
                status: RECIPIENTS_CALL_STATUS.PENDING
            },
            {
                $set: {
                    status: RECIPIENTS_CALL_STATUS.FAILED,
                    errorMessage: 'Batch timeout - no follow-ups available',
                    updatedAt: now
                },
                $inc: { maxAttempts: -1 }
            }
        );

        Logger.warn('Recipients marked as failed', {
            batchId: batch._id.toString(),
            failedCount: result.modifiedCount
        });

        const inProcessCount = await this.collections.Recipients.countDocuments(
            {
                batchCallId: batch._id,
                status: {
                    $in: [
                        RECIPIENTS_CALL_STATUS.IN_PROCESS,
                    ]
                }
            }
        );

        if (inProcessCount > 0) {
            Logger.info('Batch has recipients still in process, not marking as completed', {
                batchId: batch._id.toString(),
                inProcessCount
            });
            return;
        }


        await this.collections.BatchCall.updateOne(
            { _id: batch._id },
            {
                $set: {
                    status: BATCH_CALL_STATUS.COMPLETED,
                    processedRecipient: batch.totalRecipient,
                    updatedAt: now
                }
            }
        );
    }

    async handleExpiredFollowUps(now: Date): Promise<void> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Checking for expired follow-ups...');

        try {
            const expiredFollowUps = await this.collections.BatchCallFollowUps.find({
                isArchived: false,
                callFrom: 'vapi',
                status: {
                    $in: [
                        BATCH_CALL_STATUS.CREATED,
                        BATCH_CALL_STATUS.NOT_STARTED,
                        BATCH_CALL_STATUS.IN_PROCESS
                    ]
                },
                $expr: {
                    $lt: [{ $add: ["$utcDateTime", this.maxMs] }, now]
                }
            }).toArray();

            Logger.info('Found expired follow-ups', { count: expiredFollowUps.length });

            for (const followUp of expiredFollowUps) {
                await this.processExpiredFollowUp(followUp, now);
            }

            performanceMetrics.track('handleExpiredFollowUps', timer());
            Logger.success('Expired follow-ups processed', {
                count: expiredFollowUps.length,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('handleExpiredFollowUps', timer(), true);
            Logger.error('Error handling expired follow-ups', error);
            throw error;
        }
    }

    private async processExpiredFollowUp(followUp: any, now: Date): Promise<void> {
        const timer = Logger.startTimer();
        const followUpId = followUp._id.toString();

        try {
            Logger.info('Processing expired follow-up', {
                followUpId,
                status: followUp.status,
                batchCallId: followUp.batchCallId.toString()
            });

            if (
                followUp.status === BATCH_CALL_STATUS.CREATED ||
                followUp.status === BATCH_CALL_STATUS.NOT_STARTED
            ) {
                await this.failUnstartedFollowUp(followUp, now);
            } else if (followUp.status === BATCH_CALL_STATUS.IN_PROCESS) {
                await this.handleInProcessExpiredFollowUp(followUp, now);
            }

            Logger.success('Expired follow-up processed', { followUpId, duration: timer() });
        } catch (error) {
            Logger.error('Error processing expired follow-up', error, { followUpId });
            throw error;
        }
    }

    private async failUnstartedFollowUp(followUp: any, now: Date): Promise<void> {
        Logger.warn('Failing unstarted follow-up', { followUpId: followUp._id.toString() });

        await this.collections.BatchCallFollowUps.updateOne(
            { _id: followUp._id },
            {
                $set: {
                    status: BATCH_CALL_STATUS.FAILED,
                    errorMessage: "Follow-up expired before start",
                    updatedAt: now
                },

            }
        );



        await this.collections.BatchCall.updateOne(
            { _id: followUp.batchCallId },
            {
                $inc: { maxAttempts: -1 },
                $set: { updatedAt: now }
            }
        );

        const pendingFollowUps = await this.collections.BatchCallFollowUps.countDocuments({
            isArchived: false,
            batchCallId: followUp.batchCallId,
            status: {
                $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED]
            }
        });

        if (pendingFollowUps === 0) {
            await this.finalizeUnsuccessfulRecipients(followUp.batchCallId, now);
        } else {
            await this.collections.BatchCallFollowUps.updateMany(
                {
                    batchCallId: followUp.batchCallId,
                    status: {
                        $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED]
                    },
                    isArchived: false,
                },
                {
                    $inc: { followupNumber: -1 },
                    $set: { updatedAt: now }
                }
            );
            await this.updateUnsuccessfulRecipientsForRetry(followUp.batchCallId, now);
        }
    }

    private async handleInProcessExpiredFollowUp(followUp: any, now: Date): Promise<void> {
        const pendingFollowUps = await this.collections.BatchCallFollowUps.countDocuments({
            isArchived: false,
            batchCallId: followUp.batchCallId,
            status: {
                $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED]
            }
        });

        Logger.info('In-process follow-up expired', {
            followUpId: followUp._id.toString(),
            pendingFollowUps
        });

        if (pendingFollowUps === 0) {
            await this.finalizeUnsuccessfulRecipients(followUp.batchCallId, now);
        } else {
            await this.collections.BatchCallFollowUps.updateMany(
                {
                    batchCallId: followUp.batchCallId,
                    status: {
                        $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED]
                    },
                    isArchived: false,
                },
                {
                    $inc: { followupNumber: -1 },
                    $set: { updatedAt: now }
                }
            );
            await this.updateUnsuccessfulRecipientsForRetry(followUp.batchCallId, now);
        }
    }

    private async finalizeUnsuccessfulRecipients(batchCallId: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            {
                batchCallId: batchCallId,
                status: RECIPIENTS_CALL_STATUS.UN_SUCCESS
            },
            {
                $set: {
                    status: RECIPIENTS_CALL_STATUS.FAILED,
                    errorMessage: 'Follow-up timeout - no more attempts available',
                    updatedAt: now
                },
                $inc: { maxAttempts: -1 }
            },

        );

        Logger.warn('Unsuccessful recipients finalized as failed', {
            batchCallId: batchCallId.toString(),
            count: result.modifiedCount
        });
    }

    private async updateUnsuccessfulRecipientsForRetry(batchCallId: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            {
                batchCallId: batchCallId,
                status: RECIPIENTS_CALL_STATUS.UN_SUCCESS
            },
            {
                $set: {
                    updatedAt: now,
                    errorMessage: 'Follow-up timeout - will retry in next attempt'
                },
                $inc: { maxAttempts: -  1 }
            }
        );

        Logger.info('Unsuccessful recipients updated for retry', {
            batchCallId: batchCallId.toString(),
            count: result.modifiedCount
        });
    }
}

// ============================================================
// JOB FINDER
// ============================================================

class JobFinder {
    private collections: CollectionsCache;

    constructor(collections: CollectionsCache) {
        this.collections = collections;
    }

    async findNextJob(now: Date): Promise<{ jobType: 'batch' | 'followUp' | null; jobData: any }> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Finding next job to process...');

        try {
            const [batchCalls, followUpBatchCalls] = await Promise.all([
                this.findEligibleBatches(now),
                this.findEligibleFollowUps(now)
            ]);

            const batch = batchCalls[0];
            const followUp = followUpBatchCalls[0];

            Logger.debug('Job search results', {
                hasBatch: !!batch,
                hasFollowUp: !!followUp,
                batchDate: batch?.utcDateTime,
                followUpDate: followUp?.utcDateTime
            });

            const result = this.selectJob(batch, followUp);

            performanceMetrics.track('findNextJob', timer());

            if (result.jobType) {
                Logger.success('Next job found', {
                    jobType: result.jobType,
                    jobId: result.jobData._id.toString(),
                    duration: timer()
                });
            } else {
                Logger.info('No eligible jobs found', { duration: timer() });
            }

            return result;
        } catch (error) {
            performanceMetrics.track('findNextJob', timer(), true);
            Logger.error('Error finding next job', error);
            throw error;
        }
    }

    private async findEligibleBatches(now: Date): Promise<any[]> {
        return this.collections.BatchCall.find({
            callFrom: 'vapi',
            isArchived: false,
            utcDateTime: { $lte: now },
            status: {
                $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.IN_PROCESS]
            },
            $expr: { $lt: ["$processedRecipient", "$totalRecipient"] }
        })
            .sort({ utcDateTime: 1 })
            .limit(1)
            .toArray();
    }

    private async findEligibleFollowUps(now: Date): Promise<any[]> {
        return this.collections.BatchCallFollowUps.find({
            isArchived: false,
            callFrom: 'vapi',
            utcDateTime: { $lte: now },
            status: {
                $in: [
                    BATCH_CALL_STATUS.CREATED,
                    BATCH_CALL_STATUS.IN_PROCESS,
                    BATCH_CALL_STATUS.NOT_STARTED
                ]
            },
            $expr: { $lte: ["$processedRecipient", "$totalRecipient"] }
        })
            .sort({ utcDateTime: 1 })
            .limit(1)
            .toArray();
    }

    private selectJob(batch: any, followUp: any): { jobType: 'batch' | 'followUp' | null; jobData: any } {
        if (batch && followUp) {
            const jobType = batch.utcDateTime <= followUp.utcDateTime ? 'batch' : 'followUp';
            return { jobType, jobData: jobType === 'batch' ? batch : followUp };
        }

        if (batch) return { jobType: 'batch', jobData: batch };
        if (followUp) return { jobType: 'followUp', jobData: followUp };

        return { jobType: null, jobData: null };
    }
}

// ============================================================
// RECIPIENT FILTER
// ============================================================

class RecipientFilter {
    private collections: CollectionsCache;

    constructor(collections: CollectionsCache) {
        this.collections = collections;
    }

    async filterBlacklisted(recipients: any[], companyData: any): Promise<{
        filtered: any[];
        blacklistedCount: number;
    }> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Filtering blacklisted recipients', {
            totalRecipients: recipients.length,
            companyId: companyData._id.toString()
        });

        try {
            const phoneNumbers = recipients.map(r => r.number);

            console.log("Phone Numbers to check:", phoneNumbers);

            const filters = {
                toNumber: { $in: phoneNumbers },
                companyId: companyData._id,
                isArchived: false
            }
            const blacklisted = await this.collections.BlackList.find(filters).toArray();


            // FIX: Add explicit type casting
            const blacklistedSet = new Set<string>(
                blacklisted.map((b: any) => b.toNumber as string)
            );
            const filtered: any[] = [];
            const blacklistedOps: any[] = [];

            for (const rec of recipients) {
                if (blacklistedSet.has(rec.number)) {
                    Logger.debug('Blacklisted recipient found', {
                        recipientId: rec._id.toString(),
                        number: rec.number
                    });

                    blacklistedOps.push({
                        updateOne: {
                            filter: { _id: rec._id },
                            update: {
                                $set: {
                                    status: RECIPIENTS_CALL_STATUS.SKIP,
                                    updatedAt: new Date(),
                                    errorMessage: 'Number is blacklisted'
                                },
                                $inc: { maxAttempts: -1 }
                            }
                        }
                    });
                } else {
                    filtered.push(rec);
                }
            }

            if (blacklistedOps.length > 0) {
                await executeBulkOps(this.collections.Recipients, blacklistedOps);
            }

            performanceMetrics.track('filterBlacklisted', timer());
            Logger.success('Blacklist filtering complete', {
                filtered: filtered.length,
                blacklisted: blacklistedOps.length,
                duration: timer()
            });

            return {
                filtered,
                blacklistedCount: blacklistedOps.length
            };
        } catch (error) {
            performanceMetrics.track('filterBlacklisted', timer(), true);
            Logger.error('Error filtering blacklisted recipients', error);
            throw error;
        }
    }

    // Find this section in the RecipientFilter class (around line 600-650)

    async filterInProcess(recipients: any[], companyData: any, batchCall: any): Promise<{ filtered: any[]; skippedCount: number }> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Filtering in-process and delayed recipients', {
            totalRecipients: recipients.length
        });

        try {
            const phoneNumbers = recipients.map(r => r.number);

            const [googleProcess, processListed, lastCalls] = await Promise.all([
                this.collections.GoogleSheetDataProcess.find({
                    'sheetData.phoneNumber': { $in: phoneNumbers },
                    companyId: companyData._id,
                    callStatus: { $in: [1, 2] },
                }).toArray(),

                this.collections.Recipients.find({
                    batchCallId: { $ne: batchCall._id },
                    number: { $in: phoneNumbers },
                    companyId: companyData._id,
                    isArchived: false,
                    status: RECIPIENTS_CALL_STATUS.IN_PROCESS
                }).toArray(),

                this.collections.Calls.find({
                    batchCallId: { $ne: batchCall._id.toString() },
                    toNumber: { $in: phoneNumbers },
                    companyId: companyData._id
                }).sort({ createdAt: -1 }).toArray()
            ]);

            // FIX: Add explicit type casting
            const googleProcessSet = new Set<string>(
                googleProcess.map((g: any) => g.sheetData.phoneNumber as string)
            );
            const processListedSet = new Set<string>(
                processListed.map((r: any) => r.number as string)
            );
            const lastCallMap = this.buildLastCallMap(lastCalls);

            const delayConfig = {
                'Interested - Meeting Booked': parseInt(companyData.interestedMeetingBooked) || CONFIG.DEFAULT_DELAY_DAYS,
                'Interested - Task': parseInt(companyData.interestedTask) || CONFIG.DEFAULT_DELAY_DAYS,
                'Not Interested': parseInt(companyData.notInterested) || CONFIG.DEFAULT_DELAY_DAYS
            };

            const { filtered, updateOps } = this.applyFilters(
                recipients,
                googleProcessSet,
                processListedSet,
                lastCallMap,
                delayConfig
            );

            if (updateOps.length > 0) {
                await executeBulkOps(this.collections.Recipients, updateOps);
            }

            performanceMetrics.track('filterInProcess', timer());
            Logger.success('In-process filtering complete', {
                filtered: filtered.length,
                skipped: updateOps.length,
                duration: timer()
            });

            return { filtered, skippedCount: updateOps.length };
        } catch (error) {
            performanceMetrics.track('filterInProcess', timer(), true);
            Logger.error('Error filtering in-process recipients', error);
            throw error;
        }
    }

    private buildLastCallMap(lastCalls: any[]): Map<string, any> {
        const map = new Map<string, any>();
        for (const call of lastCalls) {
            if (!map.has(call.toNumber)) {
                map.set(call.toNumber as string, call);
            }
        }
        return map;
    }

    private applyFilters(
        recipients: any[],
        googleProcessSet: Set<string>,
        processListedSet: Set<string>,
        lastCallMap: Map<string, any>,
        delayConfig: any
    ): { filtered: any[]; updateOps: any[] } {
        const filtered: any[] = [];
        const updateOps: any[] = [];
        const now = new Date();

        for (const rec of recipients) {
            if (googleProcessSet.has(rec.number)) {
                Logger.debug('Skipping - in GoogleSheetDataProcess', {
                    recipientId: rec._id.toString(),
                    number: rec.number
                });
                updateOps.push(createSkipOp(rec._id, 'Number is already in process in GoogleSheetDataProcess'));
                continue;
            }

            if (processListedSet.has(rec.number)) {
                Logger.debug('Skipping - already in process', {
                    recipientId: rec._id.toString(),
                    number: rec.number
                });
                updateOps.push(createSkipOp(rec._id, 'Number is already in process in another batch'));
                continue;
            }

            const lastCall = lastCallMap.get(rec.number);
            if (!lastCall) {
                filtered.push(rec);
                continue;
            }

            const leadStatus = lastCall.leadStatus;
            const requiredDelay = delayConfig[leadStatus as keyof typeof delayConfig];

            if (requiredDelay) {
                const lastCallTime = new Date(lastCall.updatedAt);
                const diffDays = Math.floor((now.getTime() - lastCallTime.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays < requiredDelay) {
                    Logger.debug('Skipping - delay not met', {
                        recipientId: rec._id.toString(),
                        number: rec.number,
                        leadStatus,
                        daysSinceLastCall: diffDays,
                        requiredDelay
                    });
                    updateOps.push(createSkipOp(
                        rec._id,
                        `Last call status '${leadStatus}' requires ${requiredDelay} days (${diffDays} days elapsed)`
                    ));
                    continue;
                }
            }

            filtered.push(rec);
        }

        return { filtered, updateOps };
    }
}

// ============================================================
// BATCH PROCESSOR
// ============================================================

class BatchProcessor {
    private collections: CollectionsCache;
    private recipientFilter: RecipientFilter;

    constructor(collections: CollectionsCache) {
        this.collections = collections;
        this.recipientFilter = new RecipientFilter(collections);
    }

    async process(batchId: any, type: 'batch' | 'followUp'): Promise<void> {
        const overallTimer = Logger.startTimer();
        const Collection = type === 'followUp' ? this.collections.BatchCallFollowUps : this.collections.BatchCall;

        Logger.info(`🚀 Starting ${type} processing`, { batchId: batchId.toString() });

        try {
            const batchCall = await Collection.findOne({ _id: batchId });
            if (!batchCall) {
                Logger.error('Batch not found', null, { batchId: batchId.toString() });
                return;
            }

            const mainBatchCallData = type === 'followUp'
                ? await this.collections.BatchCall.findOne({ _id: batchCall.batchCallId })
                : batchCall;

            if (!mainBatchCallData) {
                Logger.error('Main batch not found', null, { batchId: batchId.toString() });
                return;
            }

            const companyData = await this.getCompanyData(batchCall.companyId);
            if (!companyData) return;

            const client = await this.initializeVapiClient(companyData);
            if (!client) return;

            const processingCount = await this.collections.Recipients.countDocuments({
                status: RECIPIENTS_CALL_STATUS.IN_PROCESS,
                callFrom: 'vapi',
            });

            Logger.info('Current processing status', {
                batchId: batchId.toString(),
                processingCount,
                maxProcess: CONFIG.MAX_PROCESS
            });

            if (processingCount >= CONFIG.MAX_PROCESS) {
                Logger.warn('Max concurrent processing limit reached', {
                    current: processingCount,
                    max: CONFIG.MAX_PROCESS
                });
                return;
            }

            const limit = CONFIG.MAX_PROCESS - processingCount;
            const recipients = await this.fetchRecipients(type, batchCall, mainBatchCallData._id, limit);

            if (!recipients.length) {
                Logger.warn('No recipients to process', { batchId: batchId.toString() });
                await this.handleNoRecipients(mainBatchCallData, batchCall, Collection, type);
                return;
            }

            Logger.info('Recipients fetched', {
                batchId: batchId.toString(),
                count: recipients.length
            });

            const { filtered: processFiltered, skippedCount } = await this.recipientFilter.filterInProcess(recipients, companyData, mainBatchCallData);
            if (skippedCount > 0) {
                if (batchCall.processedRecipient < batchCall.totalRecipient) {
                    await Collection.updateOne({ _id: batchId }, { $inc: { processedRecipient: skippedCount } });
                }

                if (!processFiltered.length) {
                    Logger.warn('All recipients skipped due to in-process check', { skippedCount });
                    Logger.warn('All recipients filtered out by in-process check');
                    await this.handleNoRecipients(mainBatchCallData, batchCall, Collection, type);
                    return;
                }

            }

            const { filtered, blacklistedCount } = await this.recipientFilter.filterBlacklisted(processFiltered, companyData);

            if (blacklistedCount > 0) {
                if (batchCall.processedRecipient < batchCall.totalRecipient) {
                    await Collection.updateOne({ _id: batchId }, { $inc: { processedRecipient: blacklistedCount } });
                }
            }

            if (!filtered.length) {
                Logger.warn('All recipients blacklisted', { blacklistedCount });
                await this.handleNoRecipients(mainBatchCallData, batchCall, Collection, type);
                return;
            }

            const customers = buildCustomerPayload(filtered, batchCall, type, mainBatchCallData);

            await this.processCustomersInChunks(
                customers,
                batchCall,
                client,
                Collection,
                type,
                mainBatchCallData
            );

            performanceMetrics.track(`process_${type}`, overallTimer());
            Logger.success(`${type} processing complete`, {
                batchId: batchId.toString(),
                duration: overallTimer()
            });

        } catch (error) {
            performanceMetrics.track(`process_${type}`, overallTimer(), true);
            Logger.error(`Error processing ${type}`, error, { batchId: batchId.toString() });
            throw error;
        }
    }

    private async getCompanyData(companyId: any): Promise<any> {
        const timer = Logger.startTimer();

        try {
            const companyData = await this.collections.Company.findOne({ _id: companyId });

            if (!companyData) {
                Logger.error('Company not found', null, { companyId: companyId.toString() });
                return null;
            }

            performanceMetrics.track('getCompanyData', timer());
            Logger.debug('Company data fetched', {
                companyId: companyId.toString(),
                duration: timer()
            });

            return companyData;
        } catch (error) {
            performanceMetrics.track('getCompanyData', timer(), true);
            Logger.error('Error fetching company data', error);
            throw error;
        }
    }

    private async initializeVapiClient(companyData: any): Promise<any> {
        const vapiProvider = companyData.voiceProviders?.find((p: any) => p.name === "vapi");

        if (!vapiProvider?.api_key_id) {
            Logger.error('VAPI API key not configured', null, {
                companyId: companyData._id.toString()
            });
            return null;
        }

        Logger.debug('VAPI client initialized', {
            companyId: companyData._id.toString()
        });

        return new VapiClient({ token: vapiProvider.api_key_id });
    }

    private async fetchRecipients(
        type: string,
        batchCall: any,
        mainBatchId: any,
        limit: number
    ): Promise<any[]> {
        const timer = Logger.startTimer();

        let filter: any = { batchCallId: mainBatchId };

        if (type === 'followUp') {
            filter.status = RECIPIENTS_CALL_STATUS.UN_SUCCESS;
            filter.attemptLength = { $lte: batchCall.followupNumber };
        } else {
            filter.status = RECIPIENTS_CALL_STATUS.PENDING;
        }

        console.log("Recipient filter:", filter, "Limit:", limit);

        try {
            const recipients = await this.collections.Recipients.find(filter)
                .limit(limit)
                .toArray();

            performanceMetrics.track('fetchRecipients', timer());
            Logger.debug('Recipients fetched from DB', {
                count: recipients.length,
                limit,
                duration: timer()
            });

            return recipients;
        } catch (error) {
            performanceMetrics.track('fetchRecipients', timer(), true);
            Logger.error('Error fetching recipients', error);
            throw error;
        }
    }

    private async handleNoRecipients(mainBatchCallData: any, batchCall: any, Collection: any, type: string): Promise<void> {
        Logger.info('Completing batch - no recipients to process', {
            batchId: batchCall._id.toString()
        });

        let filter: any = { batchCallId: mainBatchCallData?._id };

        if (type === 'followUp') {
            filter.status = RECIPIENTS_CALL_STATUS.IN_PROCESS;
        } else {
            filter.status = { $in: [RECIPIENTS_CALL_STATUS.IN_PROCESS, RECIPIENTS_CALL_STATUS.PENDING, RECIPIENTS_CALL_STATUS.UN_SUCCESS] };
        }
        const recipients = await this.collections.Recipients.countDocuments(filter);

        if (recipients > 0) {
            Logger.info('Batch has recipients still in process or ready for follow-up, not marking as completed', {
                batchId: mainBatchCallData._id.toString(),
                inProcessCount: recipients
            });
            return;
        }

        await Collection.updateOne(
            { _id: batchCall._id },
            {
                $set: {
                    processedRecipient: batchCall?.totalRecipient,
                    status: BATCH_CALL_STATUS.COMPLETED,
                    errorMessage: "Batch completed - no recipients to process.",
                    updatedAt: new Date()
                }
            }
        );
    }

    private async processCustomersInChunks(
        customers: any[],
        batchCall: any,
        client: any,
        Collection: any,
        type: string,
        mainBatchCallData: any
    ): Promise<void> {
        const overallTimer = Logger.startTimer();
        const chunks = chunkArray(customers, CONFIG.MAX_CUSTOMERS_PER_BATCH);
        const batchName = truncateBatchName(batchCall.name || "");

        let successCount = 0;
        let failedCount = 0;

        Logger.info('Starting chunk processing', {
            batchId: batchCall._id.toString(),
            totalCustomers: customers.length,
            totalChunks: chunks.length,
            chunkSize: CONFIG.MAX_CUSTOMERS_PER_BATCH
        });

        for (let i = 0; i < chunks.length; i++) {
            const chunkTimer = Logger.startTimer();
            const chunk = chunks[i];
            const chunkBatchName = chunks.length > 1
                ? `${batchName} (${i + 1}/${chunks.length})`
                : batchName;

            Logger.info(`Processing chunk ${i + 1}/${chunks.length}`, {
                batchId: batchCall._id.toString(),
                chunkSize: chunk.length,
                chunkIndex: i + 1
            });

            try {
                const response: any = await retryWithBackoff(
                    () => client.calls.create({
                        assistantId: mainBatchCallData.assistantId,
                        phoneNumberId: batchCall?.phoneNumberId || mainBatchCallData?.phoneNumberId,
                        customers: chunk,
                        name: chunkBatchName
                    }),
                    CONFIG.MAX_RETRIES,
                    CONFIG.BASE_RETRY_DELAY
                );

                await this.updateRecipients(response?.results ?? []);

                successCount += chunk.length;
                performanceMetrics.track('processChunk', chunkTimer());

                Logger.success(`Chunk ${i + 1}/${chunks.length} processed successfully`, {
                    batchId: batchCall._id.toString(),
                    chunkSize: chunk.length,
                    duration: chunkTimer()
                });

            } catch (error: any) {
                failedCount += chunk.length;
                performanceMetrics.track('processChunk', chunkTimer(), true);

                Logger.error(`Chunk ${i + 1}/${chunks.length} failed`, error, {
                    batchId: batchCall._id.toString(),
                    chunkSize: chunk.length,
                    chunkIndex: i + 1
                });

                await this.markChunkRecipientsFailed(chunk, error);
            }

            if (i < chunks.length - 1) {
                Logger.debug(`Waiting ${CONFIG.CHUNK_DELAY}ms before next chunk...`);
                await sleep(CONFIG.CHUNK_DELAY);
            }
        }

        Logger.success('All chunks processed', {
            batchId: batchCall._id.toString(),
            totalCustomers: customers.length,
            successCount,
            failedCount,
            totalDuration: overallTimer()
        });
    }

    private async updateRecipients(results: any[]): Promise<void> {
        const timer = Logger.startTimer();

        try {
            const recipientBulkOps = results
                .filter(res => res?.customer?.assistantOverrides?.variableValues?.recipientId)
                .map(res => ({
                    updateOne: {
                        filter: { _id: new ObjectId(res.customer.assistantOverrides.variableValues.recipientId) },
                        update: {
                            $set: {
                                status: RECIPIENTS_CALL_STATUS.IN_PROCESS,
                                updatedAt: new Date()
                            },
                            $push: { callResponse: res }
                        }
                    }
                }));

            if (recipientBulkOps.length > 0) {
                await executeBulkOps(this.collections.Recipients, recipientBulkOps);
            }

            performanceMetrics.track('updateRecipients', timer());
            Logger.debug('Recipients updated with call results', {
                count: recipientBulkOps.length,
                duration: timer()
            });
        } catch (error) {
            performanceMetrics.track('updateRecipients', timer(), true);
            Logger.error('Error updating recipients', error);
            throw error;
        }
    }

    private async markChunkRecipientsFailed(customers: any[], error: any): Promise<void> {
        const timer = Logger.startTimer();
        const errMsg = error?.body?.message ?? error?.message ?? "VAPI chunk failed";

        try {
            const recipientIds = customers
                .map(c => c?.assistantOverrides?.variableValues?.recipientId)
                .filter(Boolean);

            if (!recipientIds.length) {
                Logger.warn('No recipient IDs found in failed chunk');
                return;
            }

            await this.collections.Recipients.updateMany(
                { _id: { $in: recipientIds.map(id => new ObjectId(id)) } },
                {
                    $set: {
                        status: RECIPIENTS_CALL_STATUS.FAILED,
                        errorMessage: errMsg,
                        updatedAt: new Date()
                    }
                }
            );

            performanceMetrics.track('markChunkRecipientsFailed', timer());
            Logger.warn('Chunk recipients marked as failed', {
                count: recipientIds.length,
                errorMessage: errMsg,
                duration: timer()
            });
        } catch (err) {
            performanceMetrics.track('markChunkRecipientsFailed', timer(), true);
            Logger.error('Error marking chunk recipients as failed', err);
            throw err;
        }
    }
}

// ============================================================
// MAIN SCHEDULER
// ============================================================

export default async function batchScheduler() {
    const overallTimer = Logger.startTimer();

    try {
        Logger.info('='.repeat(60));
        Logger.info('🚀 Batch Scheduler Started');
        Logger.info('='.repeat(60));

        const collections = CollectionsCache.getInstance();
        await collections.initialize();

        const now = new Date();
        Logger.info('Scheduler tick', { timestamp: now.toISOString() });

        // Handle expired batches and follow-ups
        const expirationHandler = new BatchExpirationHandler(
            collections,
            CONFIG.MAX_HOURS_BATCH_COMPLETE
        );

        await expirationHandler.handleExpiredBatches(now);
        await expirationHandler.handleExpiredFollowUps(now);

        // Find and process next job
        const jobFinder = new JobFinder(collections);
        const { jobType, jobData } = await jobFinder.findNextJob(now);

        if (!jobType) {
            Logger.info('No eligible batches to process');
            Logger.info('='.repeat(60));
            return;
        }

        // Update job status
        const Collection = jobType === 'followUp'
            ? collections.BatchCallFollowUps
            : collections.BatchCall;

        const statusField = jobType === 'followUp' ? 'status' : 'status';
        const recipientCount = jobType === 'followUp'
            ? await collections.Recipients.countDocuments({
                batchCallId: jobData.batchCallId,
                status: RECIPIENTS_CALL_STATUS.UN_SUCCESS
            })
            : await collections.Recipients.countDocuments({
                batchCallId: jobData._id,
                status: RECIPIENTS_CALL_STATUS.PENDING
            });

        Logger.info(`Initializing ${jobType} job`, {
            jobId: jobData._id.toString(),
            recipientCount
        });

        if (recipientCount === 0) {
            Logger.warn('No recipients to process for this job', {
                jobId: jobData._id.toString()
            });
            Logger.info('='.repeat(60));
        }

        await Collection.updateOne(
            { _id: jobData._id, actualStartDateTime: { $in: [null, undefined] } },
            {
                $set: {
                    actualStartDateTime: new Date(),
                    status: BATCH_CALL_STATUS.IN_PROCESS,
                    totalRecipient: recipientCount
                }
            }
        );

        // Process the job
        const processor = new BatchProcessor(collections);
        await processor.process(jobData._id, jobType);

        Logger.success('Scheduler cycle complete', {
            duration: overallTimer()
        });

        //Logger.info(performanceMetrics.getReport());
        Logger.info('='.repeat(60));

    } catch (error) {
        Logger.error('Fatal scheduler error', error, {
            duration: overallTimer()
        });
        Logger.info('='.repeat(60));
        throw error;
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function buildCustomerPayload(
    recipients: any[],
    batchCall: any,
    type: string,
    mainBatchCallData: any
): any[] {
    return recipients.map(rec => ({
        number: rec.number,
        assistantOverrides: {
            variableValues: {
                recipientId: rec._id?.toString(),
                client_id: rec.bmbyId?.toString() || rec.leadContactId?.toString() || '',
                salutation: rec.salutation,
                firstName: rec.firstName,
                lastName: rec.lastName,
                gender: rec.gender,
                email: rec.email,
                number: rec.number,
                country: rec.country,
                batch_name: mainBatchCallData.name,
                batchCallId: mainBatchCallData._id?.toString(),
                createdBy: mainBatchCallData.createdBy?.toString(),
                followupBatchCallId: type === 'followUp' ? batchCall._id?.toString() : null
            }
        }
    }));
}

function createSkipOp(recipientId: any, errorMessage: string) {
    return {
        updateOne: {
            filter: { _id: recipientId },
            update: {
                $set: {
                    status: RECIPIENTS_CALL_STATUS.SKIP,
                    updatedAt: new Date(),
                    errorMessage
                },
                $inc: { maxAttempts: -1 }
            }
        }
    };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = CONFIG.MAX_RETRIES,
    baseDelay = CONFIG.BASE_RETRY_DELAY
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries - 1) {
                Logger.error('Max retries exceeded', error, { maxRetries });
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            Logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
                delay,
                nextAttempt: attempt + 2
            });

            await sleep(delay);
        }
    }
    throw new Error('Max retries exceeded');
}

async function executeBulkOps(collection: any, ops: any[]): Promise<void> {
    if (ops.length === 0) return;

    const timer = Logger.startTimer();
    const chunks = chunkArray(ops, CONFIG.BULK_WRITE_CHUNK_SIZE);

    Logger.debug('Executing bulk operations', {
        totalOps: ops.length,
        chunks: chunks.length
    });

    let successCount = 0;
    let errorCount = 0;

    for (const chunk of chunks) {
        try {
            const result = await collection.bulkWrite(chunk, { ordered: false });
            successCount += result.modifiedCount || 0;
        } catch (err: any) {
            errorCount++;
            Logger.warn('Some bulk operations failed', {
                error: err?.message,
                chunkSize: chunk.length
            });
        }
    }

    performanceMetrics.track('executeBulkOps', timer());
    Logger.debug('Bulk operations complete', {
        totalOps: ops.length,
        successCount,
        errorCount,
        duration: timer()
    });
}

function truncateBatchName(name: string): string {
    return name.length > CONFIG.MAX_BATCH_NAME_LENGTH
        ? name.substring(0, CONFIG.MAX_BATCH_NAME_LENGTH)
        : name;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// EXPORT FOR BACKWARDS COMPATIBILITY
// ============================================================

export async function run(batchId: any, type: string) {
    const collections = CollectionsCache.getInstance();
    await collections.initialize();

    const processor = new BatchProcessor(collections);
    await processor.process(batchId, type as 'batch' | 'followUp');
}