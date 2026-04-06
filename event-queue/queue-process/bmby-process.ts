
import Queue, { Job } from 'bull';
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, } from 'mongodb';
import { analyzeCallsDataForBmbyUpdate } from '../services/bmby.service';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const rebuildProcessQueue = new Queue('rebuild-calls-process', {
    redis: {
        host: REDIS_HOST, port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
    },
});

const MONGO_URI: any = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

let db: Db;
let calls: Collection;
let users: Collection;

async function initMongo(): Promise<void> {
    if (db) return;
    const client = await MongoClient.connect(MONGO_URI, {
        useUnifiedTopology: true
    } as any);
    db = client.db(DB_NAME);
    calls = db.collection('Calls');
    users = db.collection('User');

    console.log('Mongo connected');
}

async function handleCallUpdate(id: string): Promise<void> {

    await initMongo();
    try {
        // Use more efficient query with projection if only specific fields are needed
        const existingCalls = await calls.aggregate([
            {
                $match: {
                    callId: id,
                }
            },
            { $sort: { updatedAt: -1 } },
            {
                $group: {
                    _id: "$bmbyId",
                    latestCall: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$latestCall" } },
            {
                $lookup: {
                    from: "CallLogs",
                    let: { callLogIds: "$callLogs.callLogId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: [
                                        "$_id",
                                        {
                                            $map: {
                                                input: "$$callLogIds",
                                                as: "id",
                                                in: { $toObjectId: "$$id" }
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "callLogsDetails"
                }
            },
            {
                $match: {
                    "callLogsDetails.raw_data.event": "call_analyzed"
                }
            }
        ]).toArray();;

        if (existingCalls.length === 0) {
            console.warn(`No calls found for callId: ${id}`);
            return;
        }

        const userProfile = await users.findOne({ _id: existingCalls[0].createdBy })

        console.log(`Processing ${existingCalls.length} calls for callId: ${id}`);
        // Retry logic
        const maxRetries = 2;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                await analyzeCallsDataForBmbyUpdate(existingCalls, calls, userProfile);
                console.log("analyzeCallsDataForBmbyUpdate succeeded ✅");
                break; // Exit loop if success
            } catch (err) {
                attempt++;
                console.error(`Attempt ${attempt} failed:`, err);

                if (attempt >= maxRetries) {
                    console.error("All retries failed ❌");
                    throw err; // rethrow after max retries
                }
            }
        }

    } catch (error) {
        console.error(`Error processing calls for callId ${id}:`, error);
        throw error;
    }
}

rebuildProcessQueue.process(async (job: Job<{ id: string }>) => {
    try {
        const { id } = job.data;
        console.log(`Worker received job for call_id: ${id}`);
        await handleCallUpdate(id);
    } catch (err) {
        console.error('Worker job failed', err);
        throw err;
    }
});

console.log('Worker Process listening for jobs...');

