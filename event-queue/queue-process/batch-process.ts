
import Queue, { Job } from 'bull';
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const CRON_SERVICE_URL = process.env.CRON_SERVICE_URL;

import {
    BATCH_CALL_STATUS,
    RECIPIENTS_CALL_STATUS,
} from '../helpers/constants';

import { VapiClient } from "@vapi-ai/server-sdk";
import axios from 'axios';
const MONGO_URI: any = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

let db: Db;
let Calls: Collection;
let GoogleSheetDataProcess: Collection;
let BatchCall: Collection;
let FollowUpBatchCall: Collection;
let Recipients: Collection;
let BlackList: Collection;
let Company: Collection;
let CronJob: Collection;


const batchProcessQueue = new Queue('batch-process', {
    redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
    },
    // Limit settings ensure proper FIFO sequential processing
    limiter: {
        max: 1,        // Process only 1 job at a time
        duration: 1000 // Per second (adjust as needed)
    },
    settings: {
        lockDuration: 600000,  // 10 minutes lock (adjust based on your job duration)
        maxStalledCount: 2,    // Retry stalled jobs twice
        stalledInterval: 30000 // Check for stalled jobs every 30 seconds
    }
});

const rebuildQueue = new Queue('rebuild-calls', {
    redis: {
        host: REDIS_HOST, port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
    },
});

// ============================================
// QUEUE EVENT HANDLERS FOR MONITORING
// ============================================
batchProcessQueue.on('completed', (job, result) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

batchProcessQueue.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

batchProcessQueue.on('stalled', (job) => {
    console.warn(`⚠️ Job ${job.id} stalled`);
});

batchProcessQueue.on('active', (job) => {
    console.log(`🔄 Job ${job.id} is now active`);
});

/**
 * Utility: chunk an array into smaller arrays
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries - 1) throw error;
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`⚠️ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries exceeded');
}

async function initMongo(): Promise<void> {
    if (db) return;
    const client = await MongoClient.connect(MONGO_URI, {
        useUnifiedTopology: true
    } as any);
    db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    Calls = db.collection('Calls');
    GoogleSheetDataProcess = db.collection('GoogleSheetDataProcess');
    BatchCall = db.collection('BatchCall');
    FollowUpBatchCall = db.collection('BatchCallFollowUps');
    Recipients = db.collection('Recipients');
    Company = db.collection('Company');
    CronJob = db.collection('CronJob');
    BlackList = db.collection('BlackList');
    console.log('Mongo connected');
}

export async function run(cronId: any) {
    await initMongo();
    const cronData: any = await CronJob.findOne({ _id: new ObjectId(cronId), isArchived: false });

    if (!cronData) {
        console.error("❌ Cron job not found.");
        return;
    }
    const companyData: any = await Company.findOne({ _id: cronData.companyId });
    if (!companyData) {
        console.error("❌ Company job not found.");
        return;
    }

    const client = new VapiClient({
        token: cronData?.apiKeyId,
    });

    const batchCall: any = await BatchCall.findOne({ _id: cronData.originalBatchCallId });

    if (!batchCall) {
        console.error("❌ Batch call not found.");
        return;
    }

    console.log(`▶ Processing batch call: ${batchCall._id} (followUp=${!!cronData.followUp})`);
    let filter: any = { batchCallId: batchCall._id }
    let statusFilter = [RECIPIENTS_CALL_STATUS.PENDING, RECIPIENTS_CALL_STATUS.UN_SUCCESS];
    if (cronData?.failedCallsProcessOnly) {
        statusFilter = [RECIPIENTS_CALL_STATUS.PENDING];
        if (cronData?.pendingRecipients && cronData?.pendingRecipients.length > 0) {
            const recipientObjectIds = (cronData?.pendingRecipients || [])
                .map((id: string) => new ObjectId(id));
            console.log('recipientObjectIds', recipientObjectIds)
            if (!recipientObjectIds.length) {
                await handleNoRecipients(cronData, FollowUpBatchCall, BatchCall);
                return {
                    message: "No valid recipient IDs provided.",
                    recipients: []
                };
            }

            filter._id = { $in: recipientObjectIds }
        }
    }

    filter.status = { $in: statusFilter };

    console.log('filter', filter);

    const recipients = await Recipients.find(filter).toArray();

    if (!recipients.length) {
        console.log("⚠ No recipients to process.");
        await handleNoRecipients(cronData, FollowUpBatchCall, BatchCall);
        return;
    }

    // Blacklist filtering
    const { filteredForCallRecipients } = await filterProcessListedRecipients(
        recipients,
        Calls,
        Recipients,
        cronData,
        companyData,
        GoogleSheetDataProcess
    );
    if (!filteredForCallRecipients.length) {
        await handleNoRecipients(cronData, FollowUpBatchCall, BatchCall);
        return;
    }

    // Blacklist filtering
    const { filteredRecipients, blacklistedCount } = await filterBlacklistedRecipients(
        filteredForCallRecipients,
        BlackList,
        Recipients,
        cronData
    );

    if (!filteredRecipients.length) {
        console.log(`⚠ All ${blacklistedCount} recipients were blacklisted.`);
        await handleNoRecipients(cronData, FollowUpBatchCall, BatchCall);
        return;
    }

    // Build customer payload
    const customers = buildCustomerPayload(filteredRecipients, cronData, batchCall);

    if (!customers.length) {
        console.log("⚠ No customers to process.");
        await stopCron(cronData.batchCallId);
        return;
    }

    // Process in chunks
    await processCustomersInChunks(
        customers,
        batchCall,
        cronData,
        client,
        Recipients,
        FollowUpBatchCall,
        BatchCall
    );
}

/**
 * Handle cases where no recipients need processing
 */
async function handleNoRecipients(cronData: any, FollowUpBatchCall: any, BatchCall: any) {
    await stopCron(cronData.batchCallId);

    const followUps = await FollowUpBatchCall.find({
        batchCallId: cronData.originalBatchCallId
    }).toArray();

    if (!followUps || followUps.length === 0) {
        await BatchCall.updateOne(
            { _id: cronData.originalBatchCallId },
            {
                $set: {
                    status: BATCH_CALL_STATUS.COMPLETED,
                    errorMessage: 'Batch completed - no recipients to process.',
                    updatedAt: new Date()
                }
            }
        );
    }

    if (cronData.followUp) {
        await FollowUpBatchCall.updateOne(
            { _id: cronData.batchCallId },
            {
                $set: {
                    status: BATCH_CALL_STATUS.COMPLETED,
                    errorMessage: 'Batch completed - no recipients to process.',
                    updatedAt: new Date()
                }
            }
        );
    }
}

/**
 * Filter out blacklisted recipients
 */
async function filterBlacklistedRecipients(
    recipients: any[],
    BlackList: any,
    Recipients: any,
    cronData: any
) {
    const phoneNumbers = recipients.map(r => r.number);
    const blacklisted = await BlackList.find({
        toNumber: { $in: phoneNumbers },
        companyId: cronData?.companyId,
        isArchived: false
    }).toArray();

    const blacklistedSet = new Set(blacklisted.map((b: { toNumber: any; }) => b.toNumber));
    const filteredRecipients: any[] = [];

    // Batch update blacklisted recipients
    const blacklistedOps: any[] = [];

    for (const rec of recipients) {
        if (blacklistedSet.has(rec.number)) {
            console.log(`⚠ Recipient ${rec.number} is blacklisted. Skipping.`);
            blacklistedOps.push({
                updateOne: {
                    filter: { _id: rec._id },
                    update: {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.SKIP,
                            updatedAt: new Date(),
                            errorMessage: 'Number is blacklisted'
                        },
                        $inc: { attemptLength: 1 }
                    }
                }
            });
        } else {
            filteredRecipients.push(rec);
        }
    }

    // Execute blacklisted updates in bulk
    if (blacklistedOps.length > 0) {
        const chunks = chunkArray(blacklistedOps, 500);
        for (const chunk of chunks) {
            try {
                await Recipients.bulkWrite(chunk, { ordered: false });
            } catch (err: any) {
                console.warn('⚠ Some blacklist updates failed:', err?.message ?? err);
            }
        }
    }

    return {
        filteredRecipients,
        blacklistedCount: blacklistedOps.length
    };
}


/**
 * Filter out in-process recipients + filter based on latest Call + lead status delay
 * Also checks GoogleSheetDataProcess for in-process numbers
 */
async function filterProcessListedRecipients(
    recipients: any[],
    Calls: any,
    Recipients: any,
    cronData: any,
    companyData: any,
    GoogleSheetDataProcess: any
) {
    const interestedMeetingBookedDelay = companyData?.interestedMeetingBooked ? parseInt(companyData?.interestedMeetingBooked) : 2;
    const interestedTaskDelay = companyData?.interestedTask ? parseInt(companyData?.interestedTask) : 2;
    const notInterestedDelay = companyData?.notInterested ? parseInt(companyData?.notInterested) : 2;

    const phoneNumbers = recipients.map(r => r.number);

    /* ---------------------------------------------------------
       0️⃣  CHECK — GoogleSheetDataProcess (IN-PROCESS)
    ----------------------------------------------------------*/
    const googleProcess = await GoogleSheetDataProcess.find({
        'sheetData.phoneNumber': { $in: phoneNumbers },
        companyId: cronData?.companyId,
        isArchived: false,
        callStatus: 1 // IN_PROCESS
    }).toArray();

    const googleProcessSet = new Set(
        googleProcess.map((g: any) => g.sheetData.phoneNumber)
    );

    /* ---------------------------------------------------------
       1️⃣  CHECK — Recipients IN-PROCESS
    ----------------------------------------------------------*/
    const processListed = await Recipients.find({
        number: { $in: phoneNumbers },
        companyId: cronData?.companyId,
        isArchived: false,
        status: RECIPIENTS_CALL_STATUS.IN_PROCESS
    }).toArray();

    const processListedSet = new Set(
        processListed.map((r: any) => r.number)
    );

    /* ---------------------------------------------------------
       Prepare arrays
    ----------------------------------------------------------*/
    const filteredRecipients: any[] = [];
    const updateOps: any[] = [];

    /* ---------------------------------------------------------
       2️⃣ Process Recipients One-by-One
    ----------------------------------------------------------*/
    for (const rec of recipients) {

        /* -----------------------------------------------------
            (A) GoogleSheetDataProcess - Already IN_PROCESS
        ------------------------------------------------------*/
        if (googleProcessSet.has(rec.number)) {
            updateOps.push({
                updateOne: {
                    filter: { _id: rec._id },
                    update: {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.SKIP,
                            updatedAt: new Date(),
                            errorMessage: 'Number is already in process in GoogleSheetDataProcess'
                        },
                        $inc: { attemptLength: 1 }
                    }
                }
            });
            continue;
        }

        /* -----------------------------------------------------
            (B) Recipients - Already IN_PROCESS
        ------------------------------------------------------*/
        if (processListedSet.has(rec.number)) {
            updateOps.push({
                updateOne: {
                    filter: { _id: rec._id },
                    update: {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.SKIP,
                            updatedAt: new Date(),
                            errorMessage: 'Number is already in process in another batch'
                        },
                        $inc: { attemptLength: 1 }
                    }
                }
            });
            continue;
        }

        /* -----------------------------------------------------
            (C) Fetch last call record
        ------------------------------------------------------*/
        const lastCall = await Calls.findOne(
            {
                toNumber: rec.number,
                companyId: cronData?.companyId
            },
            { sort: { createdAt: -1 } }
        );

        if (!lastCall) {
            filteredRecipients.push(rec);
            continue;
        }

        /* -----------------------------------------------------
            (D) Delay Based on Lead Status
        ------------------------------------------------------*/
        const leadStatus = lastCall.leadStatus;
        const lastCallTime = new Date(lastCall.updatedAt);
        const now = new Date();

        const diffDays = Math.floor((now.getTime() - lastCallTime.getTime()) / (1000 * 60 * 60 * 24));

        let allowed = true;
        let requiredDelay = 0;

        if (leadStatus === "Interested - Meeting Booked") {
            requiredDelay = interestedMeetingBookedDelay;
            if (diffDays < requiredDelay) allowed = false;
        }
        else if (leadStatus === "Interested - Task") {
            requiredDelay = interestedTaskDelay;
            if (diffDays < requiredDelay) allowed = false;
        }
        else if (leadStatus === "Not Interested") {
            requiredDelay = notInterestedDelay;
            if (diffDays < requiredDelay) allowed = false;
        }

        if (!allowed) {
            updateOps.push({
                updateOne: {
                    filter: { _id: rec._id },
                    update: {
                        $set: {
                            status: RECIPIENTS_CALL_STATUS.SKIP,
                            updatedAt: new Date(),
                            errorMessage: `Last call status '${leadStatus}' requires ${requiredDelay} days`
                        },
                        $inc: { attemptLength: 1 }
                    }
                }
            });
            continue;
        }

        /* -----------------------------------------------------
            (E) Passed all checks → Allow recipient
        ------------------------------------------------------*/
        filteredRecipients.push(rec);
    }

    /* ---------------------------------------------------------
       3️⃣ Apply all SKIP updates in bulk (chunked)
    ----------------------------------------------------------*/
    if (updateOps.length > 0) {
        const chunks = chunkArray(updateOps, 500);
        for (const chunk of chunks) {
            try {
                await Recipients.bulkWrite(chunk, { ordered: false });
            } catch (err: any) {
                console.warn("⚠ Bulk update error:", err?.message ?? err);
            }
        }
    }

    return {
        filteredForCallRecipients: filteredRecipients,
        removedCount: updateOps.length
    };
}



/**
 * Build customer payload for VAPI
 */
function buildCustomerPayload(recipients: any[], cronData: any, batchCall: any) {
    return recipients.map(rec => ({
        number: rec.number,
        assistantOverrides: {
            variableValues: {
                uniqueId: rec._id?.toString() + '_' + cronData?._id.toString(),
                recipientId: rec._id?.toString(),
                client_id: rec.bmbyId?.toString(),
                salutation: rec.salutation,
                firstName: rec.firstName,
                lastName: rec.lastName,
                gender: rec.gender,
                email: rec.email,
                number: rec.number,
                country: rec.country,
                batch_name: batchCall.name,
                batchCallId: batchCall._id?.toString(),
                createdBy: batchCall.createdBy?.toString(),
                followupBatchCallId: cronData?.followUp ? String(cronData.batchCallId) : null,
                pendingCallsProcess: cronData?.failedCallsProcessOnly ? 'Yes' : null
            }
        }
    }));
}

/**
 * Process customers in chunks with retry logic
 */
async function processCustomersInChunks(
    customers: any[],
    batchCall: any,
    cronData: any,
    client: any,
    Recipients: any,
    FollowUpBatchCall: any,
    BatchCall: any
) {
    const MAX_CUSTOMERS_PER_BATCH = 10;
    const customerChunks: any[] = [];

    for (let i = 0; i < customers.length; i += MAX_CUSTOMERS_PER_BATCH) {
        customerChunks.push(customers.slice(i, i + MAX_CUSTOMERS_PER_BATCH));
    }

    console.log(`📦 Total customers: ${customers.length}, Split into ${customerChunks.length} chunk(s)`);

    let batchName = batchCall.name || "";
    if (batchName.length > 30) batchName = batchName.substring(0, 30);

    try {
        const allResults: any[] = [];


        for (let chunkIndex = 0; chunkIndex < customerChunks.length; chunkIndex++) {
            const chunk = customerChunks[chunkIndex];
            const chunkBatchName = customerChunks.length > 1
                ? `${batchName} (${chunkIndex + 1}/${customerChunks.length})`
                : batchName;

            console.log(`📞 Sending chunk ${chunkIndex + 1}/${customerChunks.length} with ${chunk.length} customers...`);

            try {
                // Retry logic for API calls
                const response: any = await retryWithBackoff(async () => {
                    return await client.calls.create({
                        assistantId: batchCall.assistantId,
                        phoneNumberId: batchCall.phoneNumberId,
                        customers: chunk,
                        name: chunkBatchName
                    });
                }, 3, 2000);
                await updateChunkStatus(cronData, batchCall, FollowUpBatchCall, BatchCall, customerChunks.length, (chunkIndex + 1));

                console.log(`✅ VAPI Chunk ${chunkIndex + 1} Response received`);

                const chunkResults = response?.results ?? [];
                allResults.push(...chunkResults);

                // Delay between chunks
                if (chunkIndex < customerChunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (err: any) {
                console.error(`❌ Chunk ${chunkIndex + 1} failed after retries:`, err?.message);
                throw err;
            }
        }

        console.log(`✅ All chunks processed. Total results: ${allResults.length}`);

        await stopCron(cronData.batchCallId);
        await updateRecipients(allResults, Recipients);
        await updateBatchStatus(cronData, batchCall, customers.length, FollowUpBatchCall, BatchCall);

    } catch (error: any) {
        console.error("🔥 Error processing batch:", error?.body ?? error?.message ?? error);
        await handleBatchError(error, cronData, batchCall, FollowUpBatchCall, BatchCall);
    }
}

/**
 * Update recipients with call results
 */
async function updateRecipients(results: any[], Recipients: any) {
    const recipientBulkOps: any[] = [];

    for (const res of results) {
        const recId = res?.customer?.assistantOverrides?.variableValues?.recipientId;

        if (recId) {
            recipientBulkOps.push({
                updateOne: {
                    filter: { _id: new ObjectId(recId) },
                    update: {
                        $set: { status: RECIPIENTS_CALL_STATUS.IN_PROCESS, updatedAt: new Date() },
                        $push: { callResponse: res }
                    }
                }
            });
        }
    }

    if (recipientBulkOps.length > 0) {
        const chunks = chunkArray(recipientBulkOps, 500);
        for (const chunk of chunks) {
            try {
                await Recipients.bulkWrite(chunk, { ordered: false });
            } catch (err: any) {
                console.warn('⚠ Some recipient bulk ops failed:', err?.message ?? err);
            }
        }
    }
}

/**
 * Update batch call status
 */
async function updateBatchStatus(
    cronData: any,
    batchCall: any,
    customerCount: number,
    FollowUpBatchCall: any,
    BatchCall: any
) {
    if (!cronData.followUp) {
        const batchUpdateData = {
            responseBatchCallId: batchCall._id?.toString(),
            processedRecipient: 0,
            updatedAt: new Date(),
            updatedBy: batchCall.createdBy,
            totalRecipient: customerCount
        };

        await BatchCall.updateOne(
            { _id: batchCall._id },
            { $set: batchUpdateData }
        );
    } else {
        const followUpName = `${batchCall.name} - Follow Up Call`;
        const batchUpdateData = {
            batchName: followUpName,
            responseBatchCallId: cronData.batchCallId?.toString(),
            processedRecipient: 0,
            updatedAt: new Date(),
            updatedBy: batchCall.createdBy,
            totalRecipient: customerCount
        };

        await FollowUpBatchCall.updateOne(
            { _id: cronData.batchCallId },
            { $set: batchUpdateData }
        );
    }
}


/**
 * Update batch call status
 */
async function updateChunkStatus(
    cronData: any,
    batchCall: any,
    FollowUpBatchCall: any,
    BatchCall: any,
    totalChunk: any,
    completedChunk: any,
) {
    if (!cronData.followUp) {
        const batchUpdateData: any = {
            totalChunk: totalChunk,
            companyId: cronData?.companyId,
            completedChunk: completedChunk,
            updatedAt: new Date()
        };

        if (completedChunk === 1) {
            batchUpdateData.status = BATCH_CALL_STATUS.IN_PROCESS;
            batchUpdateData.actualStartDateTime = new Date();
        }

        await BatchCall.updateOne(
            { _id: batchCall._id },
            { $set: batchUpdateData }
        );
    } else {
        const batchUpdateData: any = {
            totalChunk: totalChunk,
            companyId: cronData?.companyId,
            completedChunk: completedChunk,
            updatedAt: new Date()
        };

        if (completedChunk === 1) {
            batchUpdateData.status = BATCH_CALL_STATUS.IN_PROCESS;
            batchUpdateData.actualStartDateTime = new Date();

        }

        await FollowUpBatchCall.updateOne(
            { _id: cronData.batchCallId },
            { $set: batchUpdateData }
        );
    }
}

/**
 * Handle batch processing errors
 */
async function handleBatchError(
    error: any,
    cronData: any,
    batchCall: any,
    FollowUpBatchCall: any,
    BatchCall: any
) {
    await stopCron(cronData.batchCallId);
    const errMsg = error?.body?.message ?? error?.message ?? 'Unknown error';

    if (!cronData.followUp) {
        if (!cronData?.failedCallsProcessOnly) {
            await BatchCall.updateOne(
                { _id: batchCall._id },
                {
                    $set: { updatedAt: new Date() },
                    $push: { errorResponseBatchCalls: error?.body ?? errMsg }
                }
            );

            await BatchCall.updateOne(
                { _id: cronData.originalBatchCallId },
                {
                    $set: {
                        status: BATCH_CALL_STATUS.FAILED,
                        errorMessage: errMsg,
                        updatedAt: new Date()
                    }
                }
            );

            await failFollowUpBatches(cronData, FollowUpBatchCall, errMsg);
        }
    } else {
        await FollowUpBatchCall.updateOne(
            { _id: cronData.batchCallId },
            {
                $set: { updatedAt: new Date() },
                $push: { errorResponseBatchCalls: error?.body ?? errMsg }
            }
        );

        await FollowUpBatchCall.updateOne(
            { _id: cronData.batchCallId },
            {
                $set: {
                    status: BATCH_CALL_STATUS.FAILED,
                    errorMessage: errMsg,
                    updatedAt: new Date()
                }
            }
        );

        await failRemainingFollowUps(cronData, FollowUpBatchCall, errMsg);
    }
}

/**
 * Fail all follow-up batches
 */
async function failFollowUpBatches(cronData: any, FollowUpBatchCall: any, errMsg: string) {
    const followUps = await FollowUpBatchCall.find({
        batchCallId: cronData.originalBatchCallId
    }).toArray();

    if (followUps && followUps.length > 0) {
        const followUpBulk = followUps.map((fu: { _id: any; }) => ({
            updateOne: {
                filter: { _id: fu._id },
                update: {
                    $set: {
                        status: BATCH_CALL_STATUS.FAILED,
                        errorMessage: `Original batch call failed: ${errMsg}`,
                        updatedAt: new Date()
                    }
                }
            }
        }));

        try {
            await FollowUpBatchCall.bulkWrite(followUpBulk, { ordered: false });
            await axios.post(`${CRON_SERVICE_URL}/stop-crons`, {
                cronDetails: followUps.map((fu: { _id: { toString: () => any; }; }) => ({ id: fu._id.toString() }))
            });
        } catch (err: any) {
            console.warn('⚠ Follow-up batch updates failed:', err?.message ?? err);
        }
    }
}

/**
 * Fail remaining follow-up batches
 */
async function failRemainingFollowUps(cronData: any, FollowUpBatchCall: any, errMsg: string) {
    const remainingFollowUps = await FollowUpBatchCall.find({
        _id: { $ne: cronData.batchCallId },
        batchCallId: cronData.originalBatchCallId,
        status: BATCH_CALL_STATUS.NOT_STARTED
    }).toArray();

    if (remainingFollowUps.length > 0) {
        const remBulk = remainingFollowUps.map((r: { _id: any; }) => ({
            updateOne: {
                filter: { _id: r._id },
                update: {
                    $set: {
                        status: BATCH_CALL_STATUS.FAILED,
                        errorMessage: `Previous follow-up failed: ${errMsg}`,
                        updatedAt: new Date()
                    }
                }
            }
        }));

        try {
            await FollowUpBatchCall.bulkWrite(remBulk, { ordered: false });
            await axios.post(`${CRON_SERVICE_URL}/stop-crons`, {
                cronDetails: remainingFollowUps.map((r: { _id: { toString: () => any; }; }) => ({ id: r._id.toString() }))
            });
        } catch (err: any) {
            console.warn('⚠ Remaining follow-up updates failed:', err?.message ?? err);
        }
    }
}

/**
 * Stop cron job
 */
async function stopCron(batchCallId: string) {
    try {
        console.log(`⚠ Stop cron for ${batchCallId}`);
        await axios.post(`${CRON_SERVICE_URL}/stop-cron`, { id: batchCallId });
    } catch (err: any) {
        console.warn('⚠ Stop cron failed:', err?.message ?? err);
    }
}

// ============================================
// WORKER PROCESS - STRICTLY SEQUENTIAL
// ============================================
batchProcessQueue.process(1, async (job: Job<{ _id: string }>) => {
    try {
        console.log('job.data', job.data);
        const { _id } = job.data;
        console.log(`🔄 Worker received job ${job.id} for cron_id: ${_id}`);
        await run(_id);
        console.log(`✅ Worker completed job ${job.id}`);
    } catch (err) {
        console.error(`❌ Worker job ${job.id} failed:`, err);
        throw err;
    }
});

console.log('🚀 Worker listening for jobs in FIFO mode...');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, closing queue gracefully...');
    await batchProcessQueue.close();
    process.exit(0);
});


