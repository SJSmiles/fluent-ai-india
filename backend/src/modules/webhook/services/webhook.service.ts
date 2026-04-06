import Logger from '../../../logger/logger';
import { Call } from '../models/call.model';
import { CallLog } from '../models/callLogs.model';
import { CALL_DIRECTION, CALL_STATUS } from '../../../config/server-config';
import { GoogleSheetDataProcess } from '../../google-sheet/models/google-sheet.model';
import { rebuildSheetProcessQueue } from '../google-sheet-queue/queue';
import { v4 as uuidv4 } from 'uuid';
export class WebhookService {

  public async saveCallLog(rawData: any, headers?: any): Promise<any> {
    try {
      return await CallLog.create({
        raw_data: rawData,
        headers: headers || {},
        received_at: new Date()
      });
    } catch (err) {
      Logger.error('Error saving call log', err);
    }
  }

  public async handleWebhook(data: any, callLogId: any): Promise<any> {
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
    await this.saveCallFromWebhook(parsedData, callLogId);
    return { success: true };
  }

  private async saveCallFromWebhook(webhookData: any, callLogId: any): Promise<void> {
    const call = webhookData.call || {};
    const callId = call.call_id || webhookData.call_id || webhookData.id;

    if (!callId) {
      Logger.warn('No call_id found in webhook data');
      return;
    }

    const eventType = webhookData.event || webhookData.event_type;
    let status = 0;

    if (eventType === 'call_started') status = CALL_STATUS.ONGOING;
    else if (['call_ended', 'call_analyzed'].includes(eventType)) status = CALL_STATUS.ENDED;
    else if (
      eventType?.toLowerCase().includes('fail') ||
      eventType?.toLowerCase().includes('error')
    )
      status = CALL_STATUS.FAILED;

    const dynamicVars = call.retell_llm_dynamic_variables || {};
    const clientName =
      dynamicVars.client_name ||
      `${dynamicVars.first_name || ''} ${dynamicVars.last_name || ''} ${dynamicVars.user_name || ''}`.trim();

    const callData: any = {
      callId: callId,
      clientName: clientName,
      status,
      recordingUrl: call.recording_url,
      duration: call.duration_ms,
      disconnectionReason: call.disconnection_reason,
      direction: call.direction === 'outbound' ? CALL_DIRECTION.OUTBOUND : CALL_DIRECTION.INBOUND,
      fromNumber: call.from_number,
      toNumber: call.to_number,
      agentId: call.agent_id
    };

    let existingCall: any = await Call.findOne({ callId: callId });
    if (existingCall) {
      Logger.info(`Updating call ${callId}`);
      const updatedLogs = [
        ...(existingCall.callLogs || []),
        {
          eventType: eventType,
          callLogId: callLogId
        }
      ];
      callData.callLogs = updatedLogs;

      existingCall = Object.assign(existingCall, callData);
      await existingCall.save();
    } else {
      Logger.info(`Creating new call ${callId}`);
      const callLogs = [
        {
          eventType: eventType,
          callLogId: callLogId
        }
      ];
      callData.callLogs = callLogs;
      const newCall = new Call(callData);
      await newCall.save();
    }
  }
  public async saveGoogleSheetRecord(sheetRecord: any) {
    console.log('Saving Google Sheet record:', sheetRecord);
    try {
      // -------------------------------------------------------
      // STEP 1: Prevent duplicate webhook hits (2-second window)
      // -------------------------------------------------------
      const existingRecent: any = await GoogleSheetDataProcess.findOne({
        companyId: sheetRecord.companyId,
        createdBy: sheetRecord.createdBy,
        agentId: sheetRecord.agentId,
        "sheetData.rowNumber": sheetRecord.sheetData.rowNumber,
        "sheetData.phoneNumber": sheetRecord.sheetData.phoneNumber,
        callStatus: 1
      });

      if (existingRecent) {
        const lastUpdate = new Date(existingRecent.updatedAt).getTime();
        if (Date.now() - lastUpdate < 2000) {
          console.log(
            `⚠️ Duplicate webhook within 2s for row ${sheetRecord.sheetData.rowNumber} — SKIPPING`
          );
          return existingRecent;
        }
      }

      // -------------------------------------------------------
      // STEP 2: Prepare delay values (your original logic)
      // -------------------------------------------------------
      const delayMinutes = 2;
      const delayMs = delayMinutes * 60 * 1000;
      delete sheetRecord.queueProcessInMinutes;

      let existing = existingRecent;
      let doc;

      // -------------------------------------------------------
      // STEP 3: Update or Insert sheet record
      // -------------------------------------------------------
      if (existing) {
        // Keep uniqueRowId
        sheetRecord.sheetData.uniqueRowId = existing.sheetData.uniqueRowId;

        // Update fields
        existing.sheetData = sheetRecord.sheetData;
        existing.reason = sheetRecord.reason;
        existing.markModified("sheetData");
        doc = await existing.save();

        console.log(`Updated existing record for row ${sheetRecord.sheetData.rowNumber}`);
      } else {
        sheetRecord.sheetData.uniqueRowId = uuidv4();

        doc = new GoogleSheetDataProcess({
          ...sheetRecord,
          callStatus: 1,
          attemptLength: 0,
        });

        await doc.save();

        console.log(`Created new record for row ${sheetRecord.sheetData.rowNumber}`);
      }

      // -------------------------------------------------------
      // STEP 4: Prevent duplicate queue jobs
      // -------------------------------------------------------
      const jobId = `${doc._id}_rebuild`;

      const existingJob = await rebuildSheetProcessQueue.getJob(jobId);
      if (existingJob) {
        console.log(`⚠️ Queue job already exists for ${doc._id} — SKIPPING`);
        return doc;
      }

      // -------------------------------------------------------
      // STEP 5: Add queue job safely
      // -------------------------------------------------------
      await rebuildSheetProcessQueue.add(
        { _id: doc._id },
        {
          jobId,
          delay: delayMs,
          removeOnComplete: true,
        }
      );

      const count = await rebuildSheetProcessQueue.count();
      console.log(`✅ Queue initialized with ${count} pending jobs.`);

      console.log("Added job to rebuildSheetProcessQueue", {
        recordId: doc._id,
        rowNumber: sheetRecord.sheetData.rowNumber,
        delayMinutes,
      });

      return doc;

    } catch (err: any) {
      Logger.error("❌ Error saving Google Sheet record", err);
      throw err;
    }
  }


  async findRecordByUniqueRowId(uniqueRowId: string, companyId: string) {
    return await GoogleSheetDataProcess.findOne({
      'sheetData.uniqueRowId': uniqueRowId,
      companyId: companyId
    }).lean();
  }
}

