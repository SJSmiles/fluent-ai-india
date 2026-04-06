import Queue, { Job } from 'bull';
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { BATCH_CALL_PROCESS_STATUS, BATCH_CALL_STATUS, CALL_DIRECTION, CALL_STATUS, LEAD_STATUS_FOR_SYNC } from '../config/server-config';
import { rebuildProcessQueue } from '../queues/bmby-process-queue';
import axios from 'axios';



const MONGO_URI: any = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const CRON_SERVICE_URL = process.env.CRON_SERVICE_URL;

let db: Db;
let callLogs: Collection;
let calls: Collection;
let batchCall: Collection;
let user: Collection;
let batchCallFollowUps: Collection;
let recipients: Collection;
let googleSheetDataProcess: Collection;
let companyConfiguration: Collection;
let singleCallCronJob: Collection;
let blackList: Collection;

async function initMongo(): Promise<void> {
    if (db) return;
    const client = await MongoClient.connect(MONGO_URI, {
        useUnifiedTopology: true
    } as any);
    db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    callLogs = db.collection('CallLogs');
    calls = db.collection('Calls');
    batchCall = db.collection('BatchCall');
    batchCallFollowUps = db.collection('BatchCallFollowUps');
    recipients = db.collection('Recipients');
    googleSheetDataProcess = db.collection('GoogleSheetDataProcess');
    user = db.collection('User');
    companyConfiguration = db.collection('CompanyConfiguration');
    singleCallCronJob = db.collection('SingleCallCronJob');
    blackList = db.collection('BlackList');
    console.log('Mongo connected');
}

function isCallSuccessful(disconnectionReason: string, durationMs: number): boolean {
    const successReasons = [
        'user_hangup',
        'agent_hangup'
    ];

    // ✅ Call is successful if it has a success disconnection reason AND duration >= 5 seconds
    return successReasons.includes(disconnectionReason) && durationMs >= 5000;
}

function shouldRetryCall(disconnectionReason: string, durationMs: number): boolean {
    // ✅ PRIORITY CHECK: If user_hangup or agent_hangup with duration >= 5s, it's successful - NO retry
    if ((disconnectionReason === 'user_hangup' || disconnectionReason === 'agent_hangup') && durationMs >= 5000) {
        console.log(`✅ Call successful (${disconnectionReason}, ${durationMs}ms) - No retry needed`);
        return false;
    }

    // ✅ Always retry these failure reasons regardless of duration
    const alwaysRetryReasons = [
        'call_not_answered',
        'voicemail_reached',
        'inactivity',
        'dial_busy',
        'machine_detected',
        'dial_no_answer',
        'no_answer'
    ];

    if (alwaysRetryReasons.includes(disconnectionReason)) {
        return true;
    }

    //Retry if user_hangup/agent_hangup but call was too short (< 5s)
    if ((disconnectionReason === 'user_hangup' || disconnectionReason === 'agent_hangup') && durationMs < 5000) {
        console.log(`🔄 Retry needed - Call too short (${disconnectionReason}, ${durationMs}ms < 5000ms)`);
        return true;
    }

    //Retry any other call that's < 5 seconds
    if (durationMs && durationMs < 5000) {
        return true;
    }

    return false;
}

async function scheduleRetryCall(sheetId: string): Promise<void> {
    try {
        // CHECK FOR EXISTING ACTIVE RETRY CRON BEFORE CREATING NEW ONE
        const existingCron = await singleCallCronJob.findOne({
            sheet_id: sheetId,
            isArchived: false
        });

        if (existingCron) {
            console.log(`Retry already scheduled for sheet ${sheetId}, skipping duplicate`);
            return; // Don't create duplicate
        }

        // Schedule for 2 minutes from now (you can adjust this)
        const nextRunTime = new Date();
        nextRunTime.setHours(nextRunTime.getHours() + 1);

        // Create cron expression for specific time (minute hour day month dayOfWeek)
        const cronExpression = `${nextRunTime.getMinutes()} ${nextRunTime.getHours()} ${nextRunTime.getDate()} ${nextRunTime.getMonth() + 1} *`;


        // Call cron service to setup single call retry - ONLY pass sheet_id
        await axios.post(`${CRON_SERVICE_URL}/single-call-setup`, {
            cronExpression,
            sheet_id: sheetId
        });


    } catch (error: any) {
        console.error(`Error scheduling retry call for sheet ${sheetId}:`, error);
        if (error.response) {
            console.error(`Response status:`, error.response.status);
            console.error(`Response data:`, error.response.data);
        }
        throw error;
    }
}

export async function retellHandleCallUpdate(call_id: string): Promise<void> {
    await initMongo();
    const logs = await callLogs.find({ 'raw_data.call.call_id': call_id }).sort({ _id: 1 }).project({ _id: 1, raw_data: 1 }).toArray();
    const logIds = logs.map(l => l._id.toString());
    const existingCalls = await calls.find({ callId: call_id }).toArray();

    if (existingCalls.length === 1) {
        const existingLogIds = new Set((existingCalls[0].log_ids || []).map((id: any) => String(id)));
        const allMatch = logIds.every(id => existingLogIds.has(id));

        if (allMatch) {
            console.log(`call_id ${call_id} already valid`);
        } else {
            let status = 0;

            const call = logs[logs.length - 1]?.raw_data?.call || {};
            const event_name = logs[logs.length - 1]?.raw_data?.event || '';
            const dynamicVars = call.retell_llm_dynamic_variables || {};
            const custom_analysis_data = call?.call_analysis?.custom_analysis_data || {};

            const clientName =
                dynamicVars.clientName ||
                `${dynamicVars.firstName || ''} ${dynamicVars.lastName || ''} ${dynamicVars.userName || ''}`.trim();

            if (logs[logs.length - 1]?.raw_data.event === 'call_started') status = CALL_STATUS.ONGOING;
            else if (['call_ended', 'call_analyzed'].includes(logs[logs.length - 1]?.raw_data.event)) status = CALL_STATUS.ENDED;
            else if (
                logs[logs.length - 1]?.raw_data.event?.toLowerCase().includes('fail') ||
                logs[logs.length - 1]?.raw_data.event?.toLowerCase().includes('error')
            )
                status = CALL_STATUS.FAILED;

            const requestedMeeting = custom_analysis_data?.requested_meeting;
            const nextAttempt = custom_analysis_data?.next_attempt;

            let nextCallDate: Date | null = null;
            let taskType: string | null = null;

            if (requestedMeeting && !isNaN(new Date(requestedMeeting).getTime())) {
                nextCallDate = new Date(requestedMeeting);
                taskType = 'Appointment';
            } else if (nextAttempt) {
                taskType = 'Task';
            } else {
                nextCallDate = null;
                taskType = null;
            }
            const batch_call_id = call?.batch_call_id || dynamicVars?.batchCallId || null;
            await calls.updateOne(
                { _id: existingCalls[0]._id },
                {
                    $set: {
                        clientName: clientName,
                        status,
                        recordingUrl: call.recording_url,
                        duration: call.duration_ms,
                        disconnectionReason: call.disconnection_reason,
                        direction: call.direction === 'outbound' ? CALL_DIRECTION.OUTBOUND : CALL_DIRECTION.INBOUND,
                        fromNumber: call.from_number,
                        toNumber: call.to_number,
                        agentId: call.agent_id,
                        leadStatus: custom_analysis_data?.lead_status || 'Unclassified',
                        nextCallDate: nextCallDate,
                        taskType: taskType,
                        callInterestStatus: true,
                        callLogs: logs.map(log => ({
                            eventType: log.raw_data.event,
                            callLogId: log._id.toString()
                        })),
                        updatedAt: new Date(),
                    }
                }
            );

            if (custom_analysis_data?.lead_status === 'Do Not Contact') {
                const callData = {
                    callId: call_id,
                    toNumber: call.to_number,
                    createdBy: existingCalls[0].createdBy,
                    clientName: clientName,
                    bmbyId: existingCalls[0].bmbyId,
                    email: existingCalls[0].email
                };
                await addToBlackList(callData);
            }
            if (batch_call_id) {
                // 1. Fetch batch call only once
                const batchCallResponse = await batchCall.findOne({
                    $or: [
                        { responseBatchCallId: batch_call_id },
                        { "responseBatchCalls.responseBatchCallId": batch_call_id }
                    ]
                });
                if (!batchCallResponse) return;

                await callLogs.updateMany({ "raw_data.call.call_id": call_id },
                    { $set: { "createdBy": batchCallResponse?.createdBy } }
                );

                let statusValue = BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE;
                if (
                    BATCH_CALL_PROCESS_STATUS.SUCCESS.includes(call.disconnection_reason) &&
                    call.duration_ms >= BATCH_CALL_PROCESS_STATUS.MIN_TIME_FOR_SUCCESS
                ) {
                    statusValue = BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE;
                }

                const recipient = await recipients.findOne({
                    batchCallId: batchCallResponse._id,
                    number: call.to_number
                });

                const updateOps: Promise<any>[] = [];

                if (recipient) {
                    if (
                        statusValue === BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE &&
                        recipient.attemptLength >= batchCallResponse?.maxAttempts
                    ) {
                        statusValue = BATCH_CALL_PROCESS_STATUS.DEAD;
                    }

                    updateOps.push(
                        recipients.updateOne(
                            { _id: recipient._id },
                            {
                                $set: {
                                    status: statusValue,
                                    updatedAt: new Date()
                                }
                            }
                        )
                    );
                }

                const completion = await recipients.aggregate([
                    { $match: { batchCallId: batchCallResponse._id } },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: 1 },
                            completed: {
                                $sum: {
                                    $cond: [
                                        { $in: ["$status", [BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE, BATCH_CALL_PROCESS_STATUS.DEAD]] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]).toArray();

                if (completion.length && completion[0].total > 0 && completion[0].total === completion[0].completed) {
                    updateOps.push(
                        batchCall.updateOne(
                            { _id: batchCallResponse._id },
                            {
                                $set: {
                                    status: BATCH_CALL_STATUS.COMPLETED,
                                    updatedAt: new Date()
                                }
                            }
                        )
                    );
                }

                if (updateOps.length) {
                    await Promise.all(updateOps);
                }
            }

            // Handle Google Sheet retry logic for existing calls
            if (event_name === 'call_analyzed' || event_name === 'call_ended') {
                if (dynamicVars?.sheet_id) {
                    const sheetData = await googleSheetDataProcess.findOne({ _id: new ObjectId(dynamicVars.sheet_id) });
                    if (sheetData) {
                        const currentAttemptLength = dynamicVars.attemptLength || 1;
                        const maxAttempts = dynamicVars.maxAttempts || 3;

                        // Determine if call was successful
                        const callSuccessful = isCallSuccessful(call.disconnection_reason, call.duration_ms);

                        // Check if call should be retried
                        const shouldRetry = shouldRetryCall(call.disconnection_reason, call.duration_ms);

                        if (shouldRetry && currentAttemptLength < maxAttempts) {
                            console.log(`Call ${call_id} needs retry. Attempt ${currentAttemptLength}/${maxAttempts}`);

                            await googleSheetDataProcess.updateOne(
                                { _id: new ObjectId(dynamicVars.sheet_id) },
                                {
                                    $set: {
                                        callStatus: 3,
                                        status: 'unsuccessful',
                                        lastCallId: call_id,
                                        lastCallCompletedAt: new Date(),
                                        updatedAt: new Date()
                                    }
                                }
                            );

                            console.log(shouldRetry)

                            // Schedule retry via cron
                            await scheduleRetryCall(dynamicVars.sheet_id);
                        } else {
                            // Call completed - set final status
                            const finalStatus = callSuccessful ? 'successful' : 'unsuccessful';

                            await googleSheetDataProcess.updateOne(
                                { _id: new ObjectId(dynamicVars.sheet_id) },
                                {
                                    $set: {
                                        callStatus: 3,
                                        status: finalStatus,
                                        callCompletedAt: new Date(),
                                        callId: call_id,
                                        updatedAt: new Date()
                                    }
                                }
                            );
                        }
                    }
                }

                // Handle bmby sync (existing code)
                let createdById = call?.createdBy || dynamicVars?.createdBy;
                if (typeof createdById === 'string') {
                    try {
                        createdById = new ObjectId(createdById);
                    } catch (err) {
                        console.warn('Invalid ObjectId for createdBy:', createdById);
                    }
                }

                const userDoc = await user.findOne(
                    { _id: createdById },
                    { projection: { bmbyConfig: 1 } }
                );

                if (userDoc?.bmbyConfig === true && LEAD_STATUS_FOR_SYNC.includes(custom_analysis_data?.lead_status)) {
                    await rebuildProcessQueue.add(
                        { id: call_id },
                        { jobId: call_id + '_process', removeOnComplete: true }
                    );
                }
            }
        }
    } else {
        // Creating new call
        if (existingCalls.length > 0) {
            await calls.deleteMany({ callId: call_id });
            console.log(`Removed duplicates for call_id ${call_id}`);
        }

        const call = logs[logs.length - 1]?.raw_data?.call || {};
        const event_name = logs[logs.length - 1]?.raw_data?.event || '';
        const dynamicVars = call.retell_llm_dynamic_variables || {};
        const custom_analysis_data = call?.call_analysis?.custom_analysis_data || {};

        let status = 0;

        if (logs[logs.length - 1]?.raw_data.event === 'call_started') status = CALL_STATUS.ONGOING;
        else if (['call_ended', 'call_analyzed'].includes(logs[logs.length - 1]?.raw_data.event)) status = CALL_STATUS.ENDED;
        else if (
            logs[logs.length - 1]?.raw_data.event?.toLowerCase().includes('fail') ||
            logs[logs.length - 1]?.raw_data.event?.toLowerCase().includes('error')
        )
            status = CALL_STATUS.FAILED;

        const clientName =
            dynamicVars.clientName ||
            `${dynamicVars.firstName || ''} ${dynamicVars.lastName || ''} ${dynamicVars.userName || ''}`.trim();

        const requestedMeeting = custom_analysis_data?.requested_meeting;
        const nextAttempt = custom_analysis_data?.next_attempt;

        let nextCallDate: Date | null = null;
        let taskType: string | null = null;

        if (requestedMeeting && !isNaN(new Date(requestedMeeting).getTime())) {
            nextCallDate = new Date(requestedMeeting);
            taskType = 'Appointment';
        } else if (nextAttempt) {
            taskType = 'Task';
        } else {
            nextCallDate = null;
            taskType = null;
        }

        let callCreatedFrom = 'batch-call';
        let maxAttempts = 1; // default
        let createdById = null;
        createdById = dynamicVars?.createdBy ? new ObjectId(dynamicVars.createdBy) : null;
        const batch_call_id = call?.batch_call_id || dynamicVars?.batchCallId || null;
        const followup_call_id = dynamicVars?.followupBatchCallId || null;


        if (dynamicVars?.sheet_id) {
            callCreatedFrom = 'sheet';
            maxAttempts = 3;


            // Get maxAttempts from company configuration
            if (createdById) {
                const userDoc = await user.findOne({ _id: createdById }, { projection: { companyId: 1 } });
                if (userDoc?.companyId) {
                    const companyConfig = await companyConfiguration.findOne(
                        { companyId: userDoc.companyId },
                        { projection: { maxCallAttempts: 1 } }
                    );
                    if (companyConfig?.maxCallAttempts) {
                        maxAttempts = companyConfig.maxCallAttempts;
                    }
                }
            }
        } else if (batch_call_id) {
            const batchCallDoc = await batchCall.findOne({
                $or: [
                    { responseBatchCallId: batch_call_id },
                    { "responseBatchCalls.responseBatchCallId": batch_call_id }
                ]
            });
            if (batchCallDoc?.maxAttempts) {
                maxAttempts = batchCallDoc.maxAttempts;
            }
        }


        const callData: any = {
            callId: call_id,
            clientName: clientName,
            status,
            recordingUrl: call.recording_url,
            syncInBmby: false,
            duration: call.duration_ms,
            disconnectionReason: call.disconnection_reason,
            direction: call.direction === 'outbound' ? CALL_DIRECTION.OUTBOUND : CALL_DIRECTION.INBOUND,
            fromNumber: call.from_number,
            toNumber: call.to_number,
            leadStatus: custom_analysis_data?.lead_status || 'Unclassified',
            nextCallDate: nextCallDate,
            callInterestStatus: true,
            taskType: taskType,
            agentId: call.agent_id,
            callLogs: logs.map(log => ({
                eventType: log.raw_data.event,
                callLogId: log._id.toString()
            })),
            batchCallId: batch_call_id || null,
            followup_call_id: followup_call_id || null,
            callCreatedFrom: callCreatedFrom,
            maxAttempts: maxAttempts,
            attemptLength: dynamicVars?.attemptLength || 1,
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
        };

        await calls.insertOne(callData);

        if (callData.leadStatus === 'Do Not Contact') {
            await addToBlackList(callData);
        }

        if (batch_call_id) {
            try {
                let updatedBatch: any = null;
                const [incrementResult, arrayIncrementResult] = await Promise.all([
                    batchCall.updateOne(
                        { responseBatchCallId: batch_call_id },
                        { $inc: { processedRecipient: 1 } }
                    ),
                    batchCall.updateOne(
                        { "responseBatchCalls.responseBatchCallId": batch_call_id },
                        { $inc: { "responseBatchCalls.$.totalProcess": 1 } }
                    ),
                    batchCallFollowUps.updateOne(
                        { responseBatchCallId: batch_call_id },
                        { $inc: { totalProcess: 1 } }
                    )
                ]);

                if (incrementResult.modifiedCount > 0 || arrayIncrementResult.modifiedCount > 0) {
                    updatedBatch = await batchCall.findOne({
                        $or: [
                            { responseBatchCallId: batch_call_id },
                            { "responseBatchCalls.responseBatchCallId": batch_call_id }
                        ]
                    });
                    console.log('updatedBatch', updatedBatch);
                    if (!updatedBatch) return;

                    await callLogs.updateMany({ "raw_data.call.call_id": call_id },
                        { $set: { "createdBy": updatedBatch?.createdBy } }
                    );

                    const statusUpdates: Promise<any>[] = [];

                    const nestedBatch = updatedBatch.responseBatchCalls?.find(
                        (bc: { responseBatchCallId: string }) => bc.responseBatchCallId === batch_call_id
                    );
                    if (nestedBatch && nestedBatch.totalRecord === nestedBatch.totalProcess) {
                        statusUpdates.push(
                            batchCall.updateOne(
                                { "responseBatchCalls.responseBatchCallId": batch_call_id },
                                { $set: { "responseBatchCalls.$.status": BATCH_CALL_STATUS.COMPLETED, updatedAt: new Date() } }
                            ),
                            batchCallFollowUps.updateOne(
                                { responseBatchCallId: batch_call_id },
                                { $set: { status: BATCH_CALL_STATUS.COMPLETED, updatedAt: new Date() } }
                            )
                        );
                    }

                    const recipient = await recipients.findOne({
                        batchCallId: updatedBatch._id,
                        number: call.to_number
                    });

                    if (recipient) {
                        let statusValue = BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE;
                        if (
                            BATCH_CALL_PROCESS_STATUS.SUCCESS.includes(call.disconnection_reason) &&
                            call.duration_ms >= BATCH_CALL_PROCESS_STATUS.MIN_TIME_FOR_SUCCESS
                        ) {
                            statusValue = BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE;
                        }

                        const newAttemptLength = recipient.attemptLength + 1;

                        if (
                            statusValue === BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE &&
                            newAttemptLength >= updatedBatch?.maxAttempts
                        ) {
                            statusValue = BATCH_CALL_PROCESS_STATUS.DEAD;
                        }

                        statusUpdates.push(
                            recipients.updateOne(
                                { _id: recipient._id },
                                {
                                    $set: { status: statusValue, updatedAt: new Date() },
                                    $inc: { attemptLength: 1 }
                                }
                            )
                        );

                        if (recipient.bmbyId) {
                            statusUpdates.push(
                                calls.updateOne(
                                    { batchCallId: batch_call_id, toNumber: call.to_number },
                                    {
                                        $set: {
                                            bmbyId: recipient.bmbyId,
                                            updatedAt: new Date(),
                                            createdBy: updatedBatch?.createdBy,
                                            availableInBmby: true,
                                            firstName: recipient?.firstName,
                                            lastName: recipient?.lastName,
                                            email: recipient?.email,
                                            country: recipient?.country,
                                            gender: recipient?.gender,
                                            number: recipient?.number,
                                            attemptLength: recipient?.attemptLength + 1,
                                        }
                                    }
                                )
                            );
                        }
                    }

                    await Promise.all(statusUpdates);

                    const completionCheck = await recipients.aggregate([
                        { $match: { batchCallId: updatedBatch._id } },
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                completed: {
                                    $sum: {
                                        $cond: [
                                            { $in: ["$status", [BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE, BATCH_CALL_PROCESS_STATUS.DEAD]] },
                                            1,
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ]).toArray();

                    if (completionCheck.length && completionCheck[0].total === completionCheck[0].completed) {
                        await batchCall.updateOne(
                            { _id: updatedBatch._id },
                            { $set: { status: BATCH_CALL_STATUS.COMPLETED, updatedAt: new Date() } }
                        );
                    }
                }
            } catch (error) {
                console.error('Error processing batch call:', error);
                throw error;
            }
        }

        // Handle Google Sheet call completion and retry logic
        if (event_name === 'call_analyzed' || event_name === 'call_ended') {
            if (dynamicVars?.sheet_id) {
                try {
                    const currentAttemptLength = dynamicVars.attemptLength || 1;

                    // Check if this is a call_analyzed or call_ended event
                    const isCallAnalyzedOrEnded = event_name === 'call_analyzed' || event_name === 'call_ended';

                    // Determine if call was successful
                    const callSuccessful = isCallSuccessful(call.disconnection_reason, call.duration_ms);
                    const shouldRetry = shouldRetryCall(call.disconnection_reason, call.duration_ms);

                    if (shouldRetry && currentAttemptLength < maxAttempts) {
                        console.log(`New call ${call_id} needs retry. Attempt ${currentAttemptLength}/${maxAttempts}`);

                        // Update sheet with retry status and unsuccessful
                        const updateData: any = {
                            status: 'unsuccessful', // Mark as unsuccessful
                            attemptLength: currentAttemptLength,
                            lastCallId: call_id,
                            lastCallCompletedAt: new Date(),
                            updatedAt: new Date()
                        };

                        // Only set callStatus to 3 if call is analyzed or ended
                        if (isCallAnalyzedOrEnded) {
                            updateData.callStatus = 3;
                        } else {
                            updateData.callStatus = 2; // retry pending
                        }

                        await googleSheetDataProcess.updateOne(
                            { _id: new ObjectId(dynamicVars.sheet_id) },
                            { $set: updateData }
                        );

                        // Schedule retry
                        await scheduleRetryCall(dynamicVars.sheet_id);
                    } else {
                        // Final status
                        const finalStatus = callSuccessful ? 'successful' : 'unsuccessful';

                        const updateData: any = {
                            status: finalStatus,
                            callCompletedAt: new Date(),
                            callId: call_id,
                            attemptLength: currentAttemptLength,
                            updatedAt: new Date()
                        };

                        // Only set callStatus to 3 if call is analyzed or ended
                        if (isCallAnalyzedOrEnded) {
                            updateData.callStatus = 3;
                        }

                        await googleSheetDataProcess.updateOne(
                            { _id: new ObjectId(dynamicVars.sheet_id) },
                            { $set: updateData }
                        );

                        console.log(`✅ New call ${call_id} final status: ${finalStatus} (attempt ${currentAttemptLength}/${maxAttempts})`);
                    }
                } catch (error) {
                    console.error(`Error updating GoogleSheetDataProcess for sheet_id ${dynamicVars.sheet_id}:`, error);
                }
            }

            // Handle bmby sync
            const userDoc = await user.findOne(
                { _id: callData?.createdBy },
                { projection: { bmbyConfig: 1 } }
            );

            if (userDoc?.bmbyConfig === true && LEAD_STATUS_FOR_SYNC.includes(custom_analysis_data?.lead_status)) {
                await rebuildProcessQueue.add(
                    { id: call_id },
                    { jobId: call_id + '_process', removeOnComplete: true }
                );
            }
        }

        console.log(`Inserted fresh call_id ${call_id}`);
    }
}

async function addToBlackList(callData: any): Promise<void> {
    try {
        // Get companyId from user
        let companyId = null;
        if (callData.createdBy) {
            const userDoc = await user.findOne(
                { _id: callData.createdBy },
                { projection: { companyId: 1 } }
            );
            companyId = userDoc?.companyId || null;
        }

        if (!companyId) {
            console.warn(`Cannot add to blacklist - no companyId found for user ${callData.createdBy}`);
            return;
        }

        // Check if already blacklisted
        const existing = await blackList.findOne({
            toNumber: callData.toNumber,
            companyId: companyId,
            isArchived: false
        });

        if (existing) {
            console.log(`Number ${callData.toNumber} already in blacklist for company ${companyId}`);
            return;
        }

        // Add to blacklist
        const blackListEntry = {
            toNumber: callData.toNumber,
            companyId: companyId,
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

        await blackList.insertOne(blackListEntry);
        console.log(`Added ${callData.toNumber} to blacklist for company ${companyId}`);

    } catch (error: any) {
        // Handle duplicate key error gracefully
        if (error.code === 11000) {
            console.log(`Number ${callData.toNumber} already in blacklist (duplicate key)`);
        } else {
            console.error('Error adding to blacklist:', error);
        }
    }
}
