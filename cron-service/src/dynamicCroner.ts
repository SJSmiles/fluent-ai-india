import { Cron, scheduledJobs } from "croner";
import { run } from "./batch-call-runner";
import { connectDB } from "./mongo-connect";
import { getCollection } from "./helpers/ApplicationHelper";
import { Types } from "mongoose";
import dotenv from 'dotenv';
dotenv.config();



const errorHandler = (e: unknown, job: Cron) => {
    console.error('cron error--', e, job);
};

async function createJob(data: any) {
    if (!data?.cronExpression || typeof data.cronExpression !== "string" || !data.cronExpression.trim()) {
        console.error(`❌ Invalid cronExpression for job ${data?._id}:`, data?.cronExpression);
        return; // stop creating job
    }

    try {
        const job = Cron(data.cronExpression, {
            catch: errorHandler,
            name: data._id + "",
        }, async () => {
            console.log("🚀 Cron triggered at:", new Date(), "  : ", data);
            await run(data);
        });

        // ✅ Log next run
        const next = job.nextRun();
        console.log(`⏰ Next run time for ${data._id}:`, next);

    } catch (err: any) {
        console.error(`⚠️ Failed to create cron for ${data?._id}:`, err.message);
    }
}


export async function dynamicCroner() {
    console.log("dynamic Cron has been started")
    await connectDB();
    const cronJob: any = await getCollection('CronJob').find({ isArchived: false }).toArray()
    for (const data of cronJob) {
        await createJob(data);
    }
    console.log('scheduledJobs', scheduledJobs.length);
}

export async function startNewCron(payload: any) {
    console.log("cron starting")
    const {
        cronExpression,
        batchCallId,
        originalBatchCallId,
        followUp,
        companyId,
        userId,
        retry
    } = payload;
    await getCollection('CronJob').updateOne({ batchCallId: new Types.ObjectId(batchCallId), isArchived: false }, {
        $set: { isArchived: true, updatedAt: new Date() }
    })
    const cronInserted = await getCollection('CronJob').insertOne({
        cronExpression: cronExpression,
        batchCallId: new Types.ObjectId(batchCallId),
        originalBatchCallId: new Types.ObjectId(originalBatchCallId),
        followUp: followUp,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        companyId: new Types.ObjectId(companyId),
        userId: new Types.ObjectId(userId),
        failedCallsProcessOnly: false,
        retry: retry,
    });
    console.log("cron inserted")
    const cron = await getCollection('CronJob').findOne({ _id: new Types.ObjectId(cronInserted.insertedId) })
    await createJob(cron)
}

export async function stopCron(id: any) {
    console.log("cron stopping")
    const cronJobForGroup: any = await getCollection('CronJob').findOne({ batchCallId: new Types.ObjectId(id), isArchived: false });
    if (cronJobForGroup) {
        const job = scheduledJobs.find((j: any) => j.name === (cronJobForGroup._id).toString());
        job?.stop();

        await getCollection('CronJob').updateOne({ _id: cronJobForGroup?._id }, {
            $set: { isArchived: true, updatedAt: new Date() }
        })
    }

    return;
}

export async function setUpNewCron(payload: any) {
    if (!payload || !payload?.cronDetails) {
        throw new Error("Invalid payload for setting up cron");
    }

    // Ensure cronDetails is an array
    const cronDetailsArray = Array.isArray(payload.cronDetails)
        ? payload.cronDetails
        : [payload.cronDetails];

    const results = [];

    for (const cronDetail of cronDetailsArray) {
        try {
            // Validate each cron detail object
            if (!cronDetail.cronExpression || !cronDetail.batchCallId) {
                console.warn("Skipping invalid cron detail:", cronDetail);
                continue;
            }

            const {
                cronExpression,
                batchCallId,
                originalBatchCallId,
                followUp,
                companyId,
                userId,
                retry
            } = cronDetail;

            // Archive existing cron job for this batchCallId
            await getCollection('CronJob').updateOne(
                { batchCallId: new Types.ObjectId(batchCallId), isArchived: false },
                {
                    $set: {
                        isArchived: true,
                        updatedAt: new Date()
                    }
                }
            );
            // Insert new cron job
            const cronInserted = await getCollection('CronJob').insertOne({
                cronExpression: cronExpression,
                batchCallId: new Types.ObjectId(batchCallId),
                originalBatchCallId: originalBatchCallId ? new Types.ObjectId(originalBatchCallId) : null,
                followUp: followUp,
                isArchived: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                companyId: new Types.ObjectId(companyId),
                userId: new Types.ObjectId(userId),
                failedCallsProcessOnly: false,
                retry: retry,
            });

            console.log(`Cron inserted for batchCallId: ${batchCallId}`);

            // Find the inserted cron job
            const cron = await getCollection('CronJob').findOne({
                _id: new Types.ObjectId(cronInserted.insertedId)
            });

            // Create the job
            await createJob(cron);

            results.push({
                success: true,
                batchCallId: batchCallId,
                cronId: cronInserted.insertedId,
                message: "Cron job created successfully"
            });

        } catch (error: any) {
            console.error(`Error processing cron detail:`, error);
            results.push({
                success: false,
                batchCallId: cronDetail?.batchCallId || 'unknown',
                error: error.message,
                message: "Failed to create cron job"
            });
        }
    }

    console.log("All cron jobs processed");
    return results;
}

export async function stopCrons(payload: any) {
    console.log("cron stopping start");

    if (!payload || !payload?.cronDetails) {
        throw new Error("Invalid payload for setting up cron");
    }

    // Ensure cronDetails is an array
    const cronDetailsArray = Array.isArray(payload.cronDetails)
        ? payload.cronDetails
        : [payload.cronDetails];
    for (const cronDetail of cronDetailsArray) {
        const cronJobForGroup: any = await getCollection('CronJob').findOne({ batchCallId: new Types.ObjectId(cronDetail.id), isArchived: false });
        if (cronJobForGroup) {
            const job = scheduledJobs.find((j: any) => j.name === (cronJobForGroup._id).toString());
            job?.stop();

            await getCollection('CronJob').updateOne({ _id: cronJobForGroup?._id }, {
                $set: { isArchived: true, updatedAt: new Date() }
            })
        }
    }
    console.log("All cron jobs stopped");
}


export async function processPendingCalls(payload: any) {
    console.log("Cron Start for pending calls");

    if (!payload || !payload?.cronExpression || !payload?.batchCallId || !payload?.followupBatchCallId || !payload.pendingRecipients) {
        throw new Error("Invalid payload for setting up cron");
    }
    const {
        cronExpression,
        batchCallId,
        companyId,
        userId,
        followupBatchCallId,
        pendingRecipients
    } = payload;


    const cronInserted = await getCollection('CronJob').insertOne({
        cronExpression: cronExpression,
        batchCallId: new Types.ObjectId(followupBatchCallId),
        originalBatchCallId: new Types.ObjectId(batchCallId),
        followUp: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        retry: false,
        failedCallsProcessOnly: true,
        companyId: new Types.ObjectId(companyId),
        userId: new Types.ObjectId(userId),
        pendingRecipients: pendingRecipients
    });
    console.log("cron inserted")
    const cron = await getCollection('CronJob').findOne({ _id: new Types.ObjectId(cronInserted.insertedId) })
    await createJob(cron)
}
