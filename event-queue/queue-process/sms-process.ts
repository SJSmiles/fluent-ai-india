// smsQueueTest.ts
import Queue, { Job } from 'bull';
import { MongoClient, Db, ObjectId } from 'mongodb';
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();


const MONGO_URI = process.env.MONGO_URI as string;
const DB_NAME = process.env.DB_NAME as string;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID as string;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN as string;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER as string; // Your Twilio number

const TEST_MODE = false; // set true to skip Twilio sending (for testing DB updates)

// ================= TWILIO CLIENT =================
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ================= MONGODB =================
let db: Db;
async function connectDB() {
    if (!db) {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ MongoDB connected');
    }
    return db;
}

/* ----------------------------------------------
   QUEUE
----------------------------------------------- */
const smsQueue = new Queue('rebuild-sms-process', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD
    }
});



// ================= QUEUE PROCESSOR =================
smsQueue.process(async (job: Job) => {
    console.log(`🚀 Starting SMS process for Job ${job.id}`);
    console.log('Job data:', job.data);
    const { id, message, toNumber, fromNumber } = job.data;

    if (!message || !toNumber || !fromNumber) {
        throw new Error('Required job data missing');
    }

    const db = await connectDB();
    const messagesCollection = db.collection('Messages'); // Correct case

    try {
        let responseSid = 'TEST_SID_' + Date.now();

        if (!TEST_MODE) {
            // 1️⃣ Send SMS via Twilio
            const response = await twilioClient.messages.create({
                body: message,
                from: fromNumber || TWILIO_FROM_NUMBER,
                to: toNumber
            });
            responseSid = response.sid;
            console.log(`✅ SMS sent, Twilio SID: ${responseSid}`);
        } else {
            console.log(`📨 [TEST MODE] Skipping Twilio SMS to ${toNumber}`);
        }

        // 2️⃣ Update DB as sent
        const updateResult = await messagesCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'delivered',
                    responseId: responseSid,
                    updatedAt: new Date()
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            console.warn(`⚠️ Message ID ${id} not found in DB`);
        } else {
            console.log(`✅ Message ID ${id} updated in DB`);
        }

        return { success: true, sid: responseSid };
    } catch (error: any) {
        console.error('❌ SMS sending failed:', error.message);

        // 3️⃣ Update DB as failed
        try {
            await messagesCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'failed',
                        error: error.message,
                        updatedAt: new Date()
                    }
                }
            );
            console.log(`⚠️ Message ID ${id} marked as failed in DB`);
        } catch (dbError) {
            console.error('❌ Failed to update DB after SMS failure:', dbError);
        }

        throw error;
    }
});

// ================= QUEUE EVENTS =================
smsQueue.on('completed', (job) => console.log(`✅ Job ${job.id} completed`));
smsQueue.on('failed', (job, err) => console.error(`❌ Job ${job?.id} failed:`, err?.message));

// // ================= ADD TEST JOB =================
// (async () => {
//     const testMessageId = '69a68c3f5f4043aaa4643f64'; // Your existing message _id

//     await smsQueue.add(
//         {
//             id: testMessageId,
//             message: `Hi Sanjay Yadav,
// I tried calling you regarding real estate opportunities.

// I’m Jai from Go Tech, and we deal in premium residential and commercial real estate projects.

// Please let me know a convenient time to connect. I’ll be happy to assist you.`,
//             toNumber: '+4917645181810',
//             fromNumber: '+12532151864' // Your Twilio number
//         },
//         {
//             jobId: testMessageId + '_sms_process_' + Date.now(),
//             removeOnComplete: true
//         }
//     );

//     console.log('✅ Test SMS job added to queue');
// })();