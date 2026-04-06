import Queue, { Job } from 'bull';
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { VapiClient } from '@vapi-ai/server-sdk';


/* ----------------------------------------------
   QUEUE
----------------------------------------------- */
const rebuildSheetProcessQueue = new Queue('rebuild-google-sheet-process', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD
    }
});

/* ----------------------------------------------
   DB HANDLES
----------------------------------------------- */
let db: Db;
let googleSheetDataProcess: Collection;
let company: Collection;
let agentColl: Collection;
let blackList: Collection;
let callsCollection: Collection;
let recipientsCollection: Collection;

/* ----------------------------------------------
   MONGO INIT
----------------------------------------------- */
async function initMongo() {
    if (db) return;

    const client = await MongoClient.connect(process.env.MONGO_URI as string);
    db = client.db(process.env.DB_NAME);

    googleSheetDataProcess = db.collection('GoogleSheetDataProcess');
    company = db.collection('Company');
    agentColl = db.collection('Agent');
    blackList = db.collection('BlackList');
    callsCollection = db.collection('Calls');
    recipientsCollection = db.collection('Recipients');
}

/* ----------------------------------------------
   HELPERS
----------------------------------------------- */
const splitFullName = (fullName: string = "") => {
    const parts = fullName.trim().split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") ?? "" };
};

const daysDiff = (now: Date, oldDate: Date) =>
    Math.floor((now.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));

/* ----------------------------------------------
   BLACKLIST CHECK
----------------------------------------------- */
async function isBlacklisted(companyId: string, phone: string) {
    return blackList.findOne({ toNumber: phone, companyId, isArchived: false });
}

/* ----------------------------------------------
   MERGED IN-PROCESS CHECK (GoogleSheet + Recipients)
----------------------------------------------- */
async function checkIfNumberAlreadyProcessingAll(companyId: string, phone: string) {
    await initMongo();

    // 1️⃣ Check GoogleSheetDataProcess
    const gsProcess = await googleSheetDataProcess.findOne({
        "sheetData.phoneNumber": phone,
        companyId,
        isArchived: false,
        callStatus: 1 // IN_PROCESS
    });

    if (gsProcess) {
        return { found: true, source: "GoogleSheetDataProcess", data: gsProcess };
    }

    // 2️⃣ Check Recipients
    const recProcess = await recipientsCollection.findOne({
        number: phone,
        companyId,
        isArchived: false,
        status: 6 // IN_PROCESS
    });

    if (recProcess) {
        return { found: true, source: "Recipients", data: recProcess };
    }

    return { found: false };
}

/* ----------------------------------------------
   LEAD STATUS DELAY VALIDATION
----------------------------------------------- */
async function isCallAllowed(companyId: string, phone: string, companyObj: any) {
    const lastCall = await callsCollection.findOne(
        { toNumber: phone, companyId },
        { sort: { createdAt: -1 } }
    );

    if (!lastCall) return { allowed: true };

    const leadStatus = lastCall?.leadStatus;
    const diff = daysDiff(new Date(), new Date(lastCall.updatedAt));

    const delayMap: any = {
        "Interested - Meeting Booked": Number(companyObj?.interestedMeetingBooked || 2),
        "Interested - Task": Number(companyObj?.interestedTask || 2),
        "Not Interested": Number(companyObj?.notInterested || 2)
    };

    if (delayMap[leadStatus] && diff < delayMap[leadStatus]) {
        return {
            allowed: false,
            reason: `Lead status '${leadStatus}' requires ${delayMap[leadStatus]} days, only ${diff} passed`
        };
    }

    return { allowed: true };
}


/* ----------------------------------------------
   VAPI CALL
----------------------------------------------- */
async function createVapiPhoneCall(record: any, apiKey: string) {
    const vapi = new VapiClient({ token: apiKey });

    const sheet = record.sheetData;
    const { firstName, lastName } = sheet.firstName
        ? { firstName: sheet.firstName, lastName: sheet.lastName }
        : splitFullName(sheet.fullName);

    return vapi.calls.create({
        assistantId: record.assistantId,
        phoneNumberId: record.phoneNumberId,
        customer: {
            number: sheet.phoneNumber,
            assistantOverrides: {
                variableValues: {
                    ...sheet.additionalInformation,
                    firstName,
                    lastName,
                    email: sheet.email,
                    number: sheet.phoneNumber,
                    sheet_id: String(record._id)
                }
            }
        }
    });
}

/* ----------------------------------------------
   MAIN PROCESSOR
----------------------------------------------- */
async function handleSheetRecordUpdate(_id: string) {
    await initMongo();

    const record = await googleSheetDataProcess.findOne({ _id: new ObjectId(_id) });
    if (!record) return;

    const phone = record.sheetData.phoneNumber;

    /* 1️⃣ BLACKLIST CHECK */
    if (await isBlacklisted(record.companyId, phone)) {
        console.log(`🚫 Blacklisted: ${phone}`);
        return googleSheetDataProcess.updateOne(
            { _id: record._id },
            {
                $set: { callStatus: 4, updatedAt: new Date() },
                $push: { errorResponse: "Blacklisted number" }
            }
        );
    }

    /* 2️⃣ IN-PROCESS CHECK (GoogleSheetDataProcess + Recipients) */
    const procCheck = await checkIfNumberAlreadyProcessingAll(record.companyId, phone);
    if (procCheck.found) {
        console.log(`⛔ Already in process in ${procCheck.source}: ${phone}`);
        return googleSheetDataProcess.updateOne(
            { _id: record._id },
            {
                $set: {
                    callStatus: 4,
                    updatedAt: new Date(),
                    errorMessage: `Already in process in ${procCheck.source}`
                },
                $inc: { callAttemptLength: 1 }
            }
        );
    }

    /* 3️⃣ LEAD STATUS CHECK */
    const comp: any = await company.findOne({ _id: new ObjectId(record.companyId) });
    const leadCheck = await isCallAllowed(record.companyId, phone, comp);

    if (!leadCheck.allowed) {
        console.log(`🚫 Delay Restriction: ${phone} - ${leadCheck.reason}`);
        return googleSheetDataProcess.updateOne(
            { _id: record._id },
            {
                $set: {
                    callStatus: 4,
                    updatedAt: new Date(),
                    errorMessage: leadCheck.reason
                },
                $inc: { callAttemptLength: 1 }
            }
        );
    }

    /* 4️⃣ PROCEED WITH CALL */
    const agent = await agentColl.findOne({ _id: record.agentId });
    const provider = agent?.voiceProvider?.toLowerCase();

    const apiKeyId =
        comp.voiceProviders?.find((vp: any) => vp.name?.toLowerCase() === provider)?.api_key_id ||
        comp.api_key_id;

    try {
        await googleSheetDataProcess.updateOne(
            { _id: record._id },
            { $set: { callStatus: 1, updatedAt: new Date() } } // IN_PROCESS
        );

        let res: any;

        if (provider === "retell") {
            // TODO
        } else {
            res = await createVapiPhoneCall(record, apiKeyId);
        }

        return googleSheetDataProcess.updateOne(
            { _id: record._id },
            {
                $set: {
                    callId: res.id,
                    callStatus: 2,
                    updatedAt: new Date()
                },
                $inc: { callAttemptLength: 1 },
                $push: { callResponse: res }
            }
        );

    } catch (err: any) {
        console.log("❌ Call Error:", err.message);

        return googleSheetDataProcess.updateOne(
            { _id: record._id },
            {
                $set: { callStatus: 4, updatedAt: new Date() },
                $inc: { callAttemptLength: 1 },
                $push: { errorResponse: err.message }
            }
        );
    }
}

/* ----------------------------------------------
   QUEUE LISTENER
----------------------------------------------- */
rebuildSheetProcessQueue.process(async (job: Job<{ _id: string }>) => {
    console.log("▶ Processing:", job.data._id);
    await handleSheetRecordUpdate(job.data._id);
});

console.log("✅ Google Sheet Worker Running...");
