import { getCollection } from "../database/mongo-connect.js";
import { BATCH_CALL_STATUS, RECIPIENTS_CALL_STATUS } from "./helper.js";
import dotenv from 'dotenv';
dotenv.config();
import plivo from 'plivo';
import jwt from 'jsonwebtoken';



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
// PLIVO RATE LIMITER
// Max 2 calls per second, enforced via token bucket
// ============================================================

class PlivoRateLimiter {
    private readonly maxCallsPerSecond: number;
    private tokens: number;
    private lastRefillTime: number;

    constructor(maxCallsPerSecond: number = 2) {
        this.maxCallsPerSecond = maxCallsPerSecond;
        this.tokens = maxCallsPerSecond;
        this.lastRefillTime = Date.now();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefillTime;
        const tokensToAdd = Math.floor((elapsed / 1000) * this.maxCallsPerSecond);

        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.maxCallsPerSecond, this.tokens + tokensToAdd);
            this.lastRefillTime = now;
        }
    }

    async acquire(): Promise<void> {
        this.refill();

        if (this.tokens > 0) {
            this.tokens--;
            return;
        }

        // Wait until next token is available
        const waitMs = Math.ceil(1000 / this.maxCallsPerSecond);
        Logger.debug(`Rate limiter waiting ${waitMs}ms for next token`);
        await sleep(waitMs);
        this.tokens = Math.max(0, this.tokens - 1);
    }
}

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================

const CONFIG = {
    MAX_CALLS_PER_SECOND: 2,          // Plivo rate limit: 2 calls/sec
    MAX_IN_PROCESS: 50,               // Max 50 concurrent in-process calls
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY: 2000,
    CHUNK_DELAY: 500,                 // 500ms between chunks (≤ 2/sec)
    BULK_WRITE_CHUNK_SIZE: 500,
    DEFAULT_DELAY_DAYS: 2,
    MAX_BATCH_NAME_LENGTH: 30,
    MAX_HOURS_BATCH_COMPLETE: Number(process.env.MAX_HOURS_BATCH_COMPLETE || 2),
} as const;

// ============================================================
// COLLECTIONS CACHE
// ============================================================

class CollectionsCache {
    private static instance: CollectionsCache;
    private initialized: boolean = false;
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
                this.Recipients,
                this.Company,
                this.BlackList,
                this.BatchCall,
                this.BatchCallFollowUps
            ] = await Promise.all([
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
    }

    async handleExpiredBatches(now: Date): Promise<void> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Checking for expired batches...');

        try {
            const expiredBatches = await this.collections.BatchCall.find({
                isArchived: false,
                callFrom: 'plivo',
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

        const followUpsCount = await this.collections.BatchCallFollowUps.countDocuments({
            batchCallId: batch._id,
            isArchived: false,
        });

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
                    $inc: { maxAttempts: -decrementBy }
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

        Logger.info('In-process batch expired', { batchId, pendingFollowUps });

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
                $inc: { maxAttempts: -1 }
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

        const inProcessCount = await this.collections.Recipients.countDocuments({
            batchCallId: batch._id,
            status: { $in: [RECIPIENTS_CALL_STATUS.IN_PROCESS] }
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
                callFrom: 'plivo',
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

            Logger.success('Expired follow-up processed', { followUpId });
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
                }
            }
        );

        await this.collections.BatchCall.updateOne(
            { _id: followUp.batchCallId },
            { $inc: { maxAttempts: -1 }, $set: { updatedAt: now } }
        );

        const pendingFollowUps = await this.collections.BatchCallFollowUps.countDocuments({
            isArchived: false,
            batchCallId: followUp.batchCallId,
            status: { $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED] }
        });

        if (pendingFollowUps === 0) {
            await this.finalizeUnsuccessfulRecipients(followUp.batchCallId, now);
        } else {
            await this.collections.BatchCallFollowUps.updateMany(
                {
                    batchCallId: followUp.batchCallId,
                    status: { $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED] },
                    isArchived: false,
                },
                { $inc: { followupNumber: -1 }, $set: { updatedAt: now } }
            );
            await this.updateUnsuccessfulRecipientsForRetry(followUp.batchCallId, now);
        }
    }

    private async handleInProcessExpiredFollowUp(followUp: any, now: Date): Promise<void> {
        const pendingFollowUps = await this.collections.BatchCallFollowUps.countDocuments({
            isArchived: false,
            batchCallId: followUp.batchCallId,
            status: { $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED] }
        });

        if (pendingFollowUps === 0) {
            await this.finalizeUnsuccessfulRecipients(followUp.batchCallId, now);
        } else {
            await this.collections.BatchCallFollowUps.updateMany(
                {
                    batchCallId: followUp.batchCallId,
                    status: { $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.NOT_STARTED] },
                    isArchived: false,
                },
                { $inc: { followupNumber: -1 }, $set: { updatedAt: now } }
            );
            await this.updateUnsuccessfulRecipientsForRetry(followUp.batchCallId, now);
        }
    }

    private async finalizeUnsuccessfulRecipients(batchCallId: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            { batchCallId, status: RECIPIENTS_CALL_STATUS.UN_SUCCESS },
            {
                $set: {
                    status: RECIPIENTS_CALL_STATUS.FAILED,
                    errorMessage: 'Follow-up timeout - no more attempts available',
                    updatedAt: now
                },
                $inc: { maxAttempts: -1 }
            }
        );

        Logger.warn('Unsuccessful recipients finalized as failed', {
            batchCallId: batchCallId.toString(),
            count: result.modifiedCount
        });
    }

    private async updateUnsuccessfulRecipientsForRetry(batchCallId: any, now: Date): Promise<void> {
        const result = await this.collections.Recipients.updateMany(
            { batchCallId, status: RECIPIENTS_CALL_STATUS.UN_SUCCESS },
            {
                $set: {
                    updatedAt: now,
                    errorMessage: 'Follow-up timeout - will retry in next attempt'
                },
                $inc: { maxAttempts: -1 }
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
            isArchived: false,
            utcDateTime: { $lte: now },
            status: { $in: [BATCH_CALL_STATUS.CREATED, BATCH_CALL_STATUS.IN_PROCESS] },
            $expr: { $lt: ["$processedRecipient", "$totalRecipient"] }
        })
            .sort({ utcDateTime: 1 })
            .limit(1)
            .toArray();
    }

    private async findEligibleFollowUps(now: Date): Promise<any[]> {
        return this.collections.BatchCallFollowUps.find({
            isArchived: false,
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

            const blacklisted = await this.collections.BlackList.find({
                toNumber: { $in: phoneNumbers },
                companyId: companyData._id,
                isArchived: false
            }).toArray();

            const blacklistedSet = new Set<string>(
                blacklisted.map((b: any) => b.toNumber as string)
            );

            const filtered: any[] = [];
            const blacklistedOps: any[] = [];

            for (const rec of recipients) {
                if (blacklistedSet.has(rec.number)) {
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

            return { filtered, blacklistedCount: blacklistedOps.length };
        } catch (error) {
            performanceMetrics.track('filterBlacklisted', timer(), true);
            Logger.error('Error filtering blacklisted recipients', error);
            throw error;
        }
    }

    async filterInProcess(recipients: any[], companyData: any, batchCall: any): Promise<{ filtered: any[]; skippedCount: number }> {
        const timer = Logger.startTimer();
        Logger.info('🔍 Filtering in-process and delayed recipients', {
            totalRecipients: recipients.length
        });

        try {
            const phoneNumbers = recipients.map(r => r.number);

            const [processListed] = await Promise.all([
                this.collections.Recipients.find({
                    batchCallId: { $ne: batchCall._id },
                    number: { $in: phoneNumbers },
                    companyId: companyData._id,
                    isArchived: false,
                    status: RECIPIENTS_CALL_STATUS.IN_PROCESS
                }).toArray(),


            ]);

            const processListedSet = new Set<string>(
                processListed.map((r: any) => r.number as string)
            );


            const { filtered, updateOps } = this.applyFilters(
                recipients,
                processListedSet,
            );

            if (updateOps.length > 0) {
                await executeBulkOps(this.collections.Recipients, updateOps);
            }

            performanceMetrics.track('filterInProcess', timer());

            return { filtered, skippedCount: updateOps.length };
        } catch (error) {
            performanceMetrics.track('filterInProcess', timer(), true);
            Logger.error('Error filtering in-process recipients', error);
            throw error;
        }
    }


    private applyFilters(
        recipients: any[],
        processListedSet: Set<string>,
    ): { filtered: any[]; updateOps: any[] } {
        const filtered: any[] = [];
        const updateOps: any[] = [];
        const now = new Date();

        for (const rec of recipients) {
            if (processListedSet.has(rec.number)) {
                updateOps.push(createSkipOp(rec._id, 'Number is already in process in another batch'));
                continue;
            }
            filtered.push(rec);
        }

        return { filtered, updateOps };
    }
}

// ============================================================
// PLIVO CALL DISPATCHER
// Sends individual calls via Plivo with rate limiting (2/sec)
// and respects MAX_IN_PROCESS (50) global cap
// ============================================================

class PlivoCallDispatcher {
    private rateLimiter: PlivoRateLimiter;
    private collections: CollectionsCache;

    constructor(collections: CollectionsCache) {
        this.collections = collections;
        this.rateLimiter = new PlivoRateLimiter(CONFIG.MAX_CALLS_PER_SECOND);
    }

    /**
     * Dispatch calls one-by-one with:
     *   - 2 calls/second rate limiting (token bucket)
     *   - Global MAX_IN_PROCESS (50) cap checked before each call
     */
    async dispatchAll(
        recipients: any[],
        plivoClient: any,
        batchCall: any,
        mainBatchCallData: any,
        agentId: string
    ): Promise<{ successCount: number; failedCount: number }> {
        const overallTimer = Logger.startTimer();
        let successCount = 0;
        let failedCount = 0;

        Logger.info('Starting Plivo call dispatch', {
            batchId: batchCall._id.toString(),
            totalRecipients: recipients.length,
            maxCallsPerSecond: CONFIG.MAX_CALLS_PER_SECOND,
            maxInProcess: CONFIG.MAX_IN_PROCESS
        });

        for (let i = 0; i < recipients.length; i++) {
            const rec = recipients[i];

            // --- Check global in-process cap before each call ---
            const inProcessCount = await this.collections.Recipients.countDocuments({
                status: RECIPIENTS_CALL_STATUS.IN_PROCESS,
                companyId: mainBatchCallData.companyId
            });

            if (inProcessCount >= CONFIG.MAX_IN_PROCESS) {
                Logger.warn('MAX_IN_PROCESS cap reached, stopping dispatch', {
                    current: inProcessCount,
                    max: CONFIG.MAX_IN_PROCESS,
                    remainingRecipients: recipients.length - i
                });
                // Mark remaining as pending so they're picked up next tick
                break;
            }

            // --- Acquire rate-limit token (max 2/sec) ---
            await this.rateLimiter.acquire();

            try {
                const callUuid = await this.dispatchSingleCall(
                    rec,
                    plivoClient,
                    batchCall,
                    mainBatchCallData,
                    agentId
                );

                // Mark recipient as IN_PROCESS with Plivo call UUID
                await this.collections.Recipients.updateOne(
                    { _id: rec._id },
                    {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.IN_PROCESS,
                            updatedAt: new Date()
                        },
                        $push: { callResponse: { callUuid, dispatchedAt: new Date() } }
                    }
                );

                successCount++;
                Logger.success(`Call dispatched [${i + 1}/${recipients.length}]`, {
                    recipientId: rec._id.toString(),
                    number: rec.number,
                    callUuid
                });

            } catch (error: any) {
                failedCount++;
                const errMsg = error?.message || 'Plivo call creation failed';
                Logger.error(`Call failed [${i + 1}/${recipients.length}]`, error, {
                    recipientId: rec._id.toString(),
                    number: rec.number
                });

                await this.collections.Recipients.updateOne(
                    { _id: rec._id },
                    {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.FAILED,
                            errorMessage: errMsg,
                            updatedAt: new Date()
                        },
                        $inc: { maxAttempts: -1 }
                    }
                );
            }
        }

        Logger.success('Dispatch complete', {
            batchId: batchCall._id.toString(),
            successCount,
            failedCount,
            duration: overallTimer()
        });

        return { successCount, failedCount };
    }

    private async dispatchSingleCall(
        rec: any,
        plivoClient: any,
        batchCall: any,
        mainBatchCallData: any,
        agentId: string
    ): Promise<string> {
        const baseUrl = process.env.NGROK_URL;
        if (!baseUrl) throw new Error('NGROK_URL env variable not set');

        const payload = {
            agentId: agentId,
            userId: batchCall.createdBy?.toString(),
            recipientId: rec?._id?.toString(),
            batchCallId: mainBatchCallData._id.toString(),
            followupBatchCallId: batchCall.followupNumber
                ? batchCall._id.toString()
                : ''
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
            expiresIn: '1h' // optional but recommended
        });

        const answerUrl = `${baseUrl}/webhook/incoming-call?token=${encodeURIComponent(token)}&direction=outbound`;
        const statusUrl = `${baseUrl}/webhook/call-status?token=${encodeURIComponent(token)}`;


        const fromNumber = batchCall.phoneNumber || mainBatchCallData.phoneNumber;
        if (!fromNumber) throw new Error('No from-number (phoneNumber) configured for this batch');

        const response: any = await retryWithBackoff(
            () => plivoClient.calls.create(
                fromNumber,
                rec.number,
                answerUrl,
                {
                    answerMethod: 'POST',
                    record: 'true',
                    recordCallbackUrl: statusUrl,
                    recordCallbackMethod: 'POST',
                    hangupUrl: statusUrl,
                    hangupMethod: 'POST',
                }
            ),
            CONFIG.MAX_RETRIES,
            CONFIG.BASE_RETRY_DELAY
        );

        return response.requestUuid || response.callUuid || response.message || 'unknown-uuid';
    }
}

// ============================================================
// BATCH PROCESSOR
// ============================================================

class BatchProcessor {
    private collections: CollectionsCache;
    private recipientFilter: RecipientFilter;
    private dispatcher: PlivoCallDispatcher;

    constructor(collections: CollectionsCache) {
        this.collections = collections;
        this.recipientFilter = new RecipientFilter(collections);
        this.dispatcher = new PlivoCallDispatcher(collections);
    }

    async process(batchId: any, type: 'batch' | 'followUp'): Promise<void> {
        const overallTimer = Logger.startTimer();
        const Collection = type === 'followUp'
            ? this.collections.BatchCallFollowUps
            : this.collections.BatchCall;

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

            const plivoClient = this.initializePlivoClient(companyData);
            if (!plivoClient) return;

            // --- Global in-process cap check ---
            const processingCount = await this.collections.Recipients.countDocuments({
                status: RECIPIENTS_CALL_STATUS.IN_PROCESS,
            });

            Logger.info('Current processing status', {
                batchId: batchId.toString(),
                processingCount,
                maxInProcess: CONFIG.MAX_IN_PROCESS
            });

            if (processingCount >= CONFIG.MAX_IN_PROCESS) {
                Logger.warn('Max in-process limit reached, skipping this tick', {
                    current: processingCount,
                    max: CONFIG.MAX_IN_PROCESS
                });
                return;
            }

            // How many more we can dispatch right now
            const limit = CONFIG.MAX_IN_PROCESS - processingCount;

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

            // Filter: in-process
            const { filtered: processFiltered, skippedCount } = await this.recipientFilter.filterInProcess(
                recipients, companyData, mainBatchCallData
            );

            if (skippedCount > 0 && batchCall.processedRecipient < batchCall.totalRecipient) {
                await Collection.updateOne({ _id: batchId }, { $inc: { processedRecipient: skippedCount } });
            }

            if (!processFiltered.length) {
                Logger.warn('All recipients filtered out by in-process check', { skippedCount });
                await this.handleNoRecipients(mainBatchCallData, batchCall, Collection, type);
                return;
            }

            // Filter: blacklist
            const { filtered, blacklistedCount } = await this.recipientFilter.filterBlacklisted(
                processFiltered, companyData
            );

            if (blacklistedCount > 0 && batchCall.processedRecipient < batchCall.totalRecipient) {
                await Collection.updateOne({ _id: batchId }, { $inc: { processedRecipient: blacklistedCount } });
            }

            if (!filtered.length) {
                Logger.warn('All recipients blacklisted', { blacklistedCount });
                await this.handleNoRecipients(mainBatchCallData, batchCall, Collection, type);
                return;
            }

            // Retrieve agentId from main batch
            const agentId = mainBatchCallData.assistantId || mainBatchCallData.agentId;
            if (!agentId) {
                Logger.error('No agentId on batch', null, { batchId: batchId.toString() });
                return;
            }

            // Dispatch calls via Plivo (2/sec, max 50 in-process)
            const { successCount, failedCount } = await this.dispatcher.dispatchAll(
                filtered,
                plivoClient,
                batchCall,
                mainBatchCallData,
                agentId
            );

            // Update processed count
            const totalHandled = successCount + failedCount + blacklistedCount + skippedCount;
            if (totalHandled > 0) {
                await Collection.updateOne(
                    { _id: batchId },
                    { $inc: { processedRecipient: totalHandled } }
                );
            }

            performanceMetrics.track(`process_${type}`, overallTimer());
            Logger.success(`${type} processing complete`, {
                batchId: batchId.toString(),
                successCount,
                failedCount,
                duration: overallTimer()
            });

        } catch (error) {
            performanceMetrics.track(`process_${type}`, overallTimer(), true);
            Logger.error(`Error processing ${type}`, error, { batchId: batchId.toString() });
            throw error;
        }
    }

    private async getCompanyData(companyId: any): Promise<any> {
        const companyData = await this.collections.Company.findOne({ _id: companyId });

        if (!companyData) {
            Logger.error('Company not found', null, { companyId: companyId.toString() });
            return null;
        }

        return companyData;
    }

    private initializePlivoClient(companyData: any): any {
        if (!companyData?.plivoAuthId || !companyData?.plivoAuthToken) {
            Logger.error('Plivo credentials not configured', null, {
                companyId: companyData._id.toString()
            });
            return null;
        }

        Logger.debug('Plivo client initialized', { companyId: companyData._id.toString() });
        return new plivo.Client(companyData.plivoAuthId, companyData.plivoAuthToken);
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

        try {
            const recipients = await this.collections.Recipients.find(filter)
                .limit(limit)
                .toArray();

            performanceMetrics.track('fetchRecipients', timer());
            Logger.debug('Recipients fetched from DB', { count: recipients.length, limit });

            return recipients;
        } catch (error) {
            performanceMetrics.track('fetchRecipients', timer(), true);
            Logger.error('Error fetching recipients', error);
            throw error;
        }
    }

    private async handleNoRecipients(
        mainBatchCallData: any,
        batchCall: any,
        Collection: any,
        type: string
    ): Promise<void> {
        Logger.info('Completing batch - no recipients to process', {
            batchId: batchCall._id.toString()
        });

        let filter: any = { batchCallId: mainBatchCallData?._id };

        if (type === 'followUp') {
            filter.status = RECIPIENTS_CALL_STATUS.IN_PROCESS;
        } else {
            filter.status = {
                $in: [
                    RECIPIENTS_CALL_STATUS.IN_PROCESS,
                    RECIPIENTS_CALL_STATUS.PENDING,
                    RECIPIENTS_CALL_STATUS.UN_SUCCESS
                ]
            };
        }

        const remaining = await this.collections.Recipients.countDocuments(filter);

        if (remaining > 0) {
            Logger.info('Batch has recipients still active, not marking as completed', {
                batchId: mainBatchCallData._id.toString(),
                remaining
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
}

// ============================================================
// MAIN SCHEDULER
// ============================================================

export default async function batchScheduler() {
    const overallTimer = Logger.startTimer();

    try {
        Logger.info('='.repeat(60));
        Logger.info('🚀 Batch Scheduler Started (Plivo)');
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

        // Find and process next eligible job
        const jobFinder = new JobFinder(collections);
        const { jobType, jobData } = await jobFinder.findNextJob(now);

        if (!jobType) {
            Logger.info('No eligible batches to process');
            Logger.info('='.repeat(60));
            return;
        }

        const Collection = jobType === 'followUp'
            ? collections.BatchCallFollowUps
            : collections.BatchCall;

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
            Logger.warn('No recipients to process for this job', { jobId: jobData._id.toString() });
            Logger.info('='.repeat(60));
            return;
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

        const processor = new BatchProcessor(collections);
        await processor.process(jobData._id, jobType);

        Logger.success('Scheduler cycle complete', { duration: overallTimer() });
        Logger.info('='.repeat(60));

    } catch (error) {
        Logger.error('Fatal scheduler error', error, { duration: overallTimer() });
        Logger.info('='.repeat(60));
        throw error;
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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
            Logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, { delay });
            await sleep(delay);
        }
    }
    throw new Error('Max retries exceeded');
}

async function executeBulkOps(collection: any, ops: any[]): Promise<void> {
    if (ops.length === 0) return;

    const timer = Logger.startTimer();
    const chunks = chunkArray(ops, 500);

    for (const chunk of chunks) {
        try {
            await collection.bulkWrite(chunk, { ordered: false });
        } catch (err: any) {
            Logger.warn('Some bulk operations failed', { error: err?.message });
        }
    }

    Logger.debug('Bulk operations complete', {
        totalOps: ops.length,
        duration: timer()
    });
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