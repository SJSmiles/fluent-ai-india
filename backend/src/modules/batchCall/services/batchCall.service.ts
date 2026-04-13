import { Recipient } from '../models/recipient.model';
import { throwError } from '../../../common/app-helper';
import { BatchCall } from '../models/batchCall.model';
import { BatchCallFollowUps } from '../models/batchCallFollowUps.model';
import { Types } from 'mongoose';
import { BATCH_CALL_STATUS } from '../../../config/server-config';
import moment from 'moment-timezone';

class BatchCallService {

  public async create(user: any, payload: any) {
    try {
      const userId = new Types.ObjectId(user.userId);

      // Check duplicate name
      const existing = await BatchCall.findOne({
        createdBy: userId,
        isArchived: false,
        name: payload.name
      });
      if (existing) {
        throw new Error(`Batch call with name '${payload.name}' already exists`);
      }

      const timezone = payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Build utcDateTime from provided date + time
      const utcDateTime = moment
        .tz(`${payload.date}T${payload.time}`, timezone)
        .utc()
        .toDate();

      // Create batch call
      const batchCallResult = await BatchCall.create({
        name: payload.name,
        agentId: new Types.ObjectId(payload.agentMongoId),
        date: payload.date,
        time: payload.time,
        utcDateTime,
        timezone,
        status: BATCH_CALL_STATUS?.CREATED,
        totalRecipient: payload.recipients.length,
        processedRecipient: 0,
        maxAttempts: payload.followUpsDetails?.length > 0 ? payload.followUpsDetails.length + 1 : 1,
        phoneNumber: payload.phoneNumber || null,
        companyId: new Types.ObjectId(user.companyId),
        createdBy: userId,
        updatedBy: userId
      });


      const recipientDocs = payload.recipients.map((contact: any) => {
        // Find phone number field dynamically
        const number = Object.values(contact).find(
          (v: any) => typeof v === 'string' && v.startsWith('+')
        ) as string || '';

        return {
          batchCallId: batchCallResult._id,
          companyId: new Types.ObjectId(user.companyId),
          number: number.replace(/\s+/g, ''),
          // Map remaining fields dynamically
          ...contact,
          maxAttempts: payload.followUpsDetails?.length > 0 ? payload.followUpsDetails.length + 1 : 1,
          attemptLength: 0,
          status: 1, // PENDING
        };
      });

      await Recipient.insertMany(recipientDocs);

      // Create follow-ups if provided
      let followUpResult = null;
      if (payload.followUpsDetails?.length > 0) {
        followUpResult = await this.createFollowUps(user, {
          batchCallId: batchCallResult._id,
          followUpsDetails: payload.followUpsDetails,
          timezone,
          phoneNumber: payload.phoneNumber
        });
      }

      return {
        batchCallId: batchCallResult._id,
        totalRecipients: recipientDocs.length,
        followUps: followUpResult?.totalFollowUps || 0
      };
    } catch (error: any) {
      throw throwError(error.message, { status: 500 }, 'INTERNAL_SERVER_ERROR');
    }
  }

  public async createFollowUps(user: any, payload: {
    batchCallId: any;
    followUpsDetails: any[];
    timezone: string;
    phoneNumber?: string;
  }) {
    try {
      const userId = new Types.ObjectId(user.userId);
      const { batchCallId, followUpsDetails, timezone, phoneNumber } = payload;

      const followUpDocs = followUpsDetails.map((detail: any) => {
        const utcDateTime = moment
          .tz(`${detail.date.trim()}T${detail.time.trim()}`, timezone)
          .utc()
          .toDate();

        return {
          batchCallId: new Types.ObjectId(batchCallId),
          date: detail.date.trim(),
          time: detail.time.trim(),
          utcDateTime,
          timezone,
          phoneNumber: detail.phoneNumber?.trim() || phoneNumber || null,
          status: BATCH_CALL_STATUS?.NOT_STARTED || 1,
          totalRecipient: 0,
          processedRecipient: 0,
          isArchived: false,
          companyId: new Types.ObjectId(user.companyId),
          createdBy: userId,
          updatedBy: userId
        };
      });

      const inserted = await BatchCallFollowUps.insertMany(followUpDocs);

      return {
        totalFollowUps: inserted.length,
        followUps: inserted.map(r => ({
          id: r._id,
          date: r.date,
          time: r.time,
          utcDateTime: r.utcDateTime
        }))
      };
    } catch (error: any) {
      throw throwError(error.message, { status: 500 }, 'INTERNAL_SERVER_ERROR');
    }
  }
}

const batchCallService = new BatchCallService();
export { batchCallService, BatchCallService };