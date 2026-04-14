import { Recipient } from '../models/recipient.model';
import { throwError } from '../../../common/app-helper';
import { BatchCall } from '../models/batchCall.model';
import { BatchCallFollowUps } from '../models/batchCallFollowUps.model';
import { Types } from 'mongoose';
import { BATCH_CALL_PROCESS_STATUS, BATCH_CALL_STATUS } from '../../../config/server-config';
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

  public async listing(
    user: any,
    request: any
  ) {

    const { skip, limit, sortBy, searchStr, status, agentId, userId, companyId } = request
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
      let targetAgentId = agentId ? new Types.ObjectId(agentId) : null;
      let targetUserId = userId ? new Types.ObjectId(userId) : null;;


      // Step 1: Determine target users
      if (isSuperAdmin && user.isAdmin) {
        if (companyId) {
          const targetCompanyId = new Types.ObjectId(companyId);
          const isOwnSuperAdminCompany = targetCompanyId.toString() === SUPER_ADMIN_COMPANY_ID;
          if (isOwnSuperAdminCompany) {
            targetUserId = userId ? new Types.ObjectId(userId) : user.userId ? new Types.ObjectId(user.userId) : user._id;
          } else {
            targetUserId = userId ? new Types.ObjectId(userId) : user.userId ? new Types.ObjectId(user.userId) : user._id;
          }
        } else {
          targetUserId = userId ? new Types.ObjectId(userId) : user.userId ? new Types.ObjectId(user.userId) : user._id;
        }
      } else if (user.isAdmin && userId) {
        targetUserId = userId ? new Types.ObjectId(userId) : user.userId ? new Types.ObjectId(user.userId) : user._id;
      } else {
        targetUserId = userId ? new Types.ObjectId(userId) : user.userId ? new Types.ObjectId(user.userId) : user._id;
      }

      // Step 2: Build match condition
      const matchCondition: any = {
        isArchived: false
      };

      if (targetAgentId) {
        matchCondition.agentId = targetAgentId;
      }

      if (targetUserId) {
        matchCondition.createdBy = targetUserId;
      }

      if (status) {
        if (parseInt(status) === 10) {
          matchCondition.schedule = true;
        }
        matchCondition.status = parseInt(status);
      }

      if (searchStr?.trim()) {
        const searchRegex = new RegExp(searchStr.trim(), 'i');
        matchCondition.$or = [
          { name: { $regex: searchRegex } },
          { outboundNumber: { $regex: searchRegex } }
        ];
      }

      // Step 3: Sorting
      let $sort: any = { createdAt: -1 };
      if (sortBy) {
        const [field, order] = sortBy.split(' ');
        if (field && order) $sort = { [field]: order.toLowerCase() === 'asc' ? 1 : -1 };
      }

      // Step 4: Aggregation pipeline
      const result = await BatchCall.aggregate([
        { $match: matchCondition },
        // Lookup agent info
        {
          $lookup: {
            from: 'Agent',
            localField: 'agentId',
            foreignField: '_id',
            as: 'agent',
            pipeline: [{ $project: { _id: 1, agentName: 1 } }]
          }
        },
        { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
        // Lookup followups
        {
          $lookup: {
            from: 'BatchCallFollowUps',
            localField: '_id',
            foreignField: 'batchCallId',
            as: 'followups',
            pipeline: [
              { $match: { isArchived: false } },
              { $sort: { utcDateTime: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'Recipients',
            let: { batchId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$batchCallId', '$$batchId'] },
                      { $eq: ['$status', BATCH_CALL_PROCESS_STATUS.FAILED] }
                    ]
                  }
                }
              },
              {
                $project: {
                  _id: 1,
                  attemptLength: 1,
                  number: 1,
                  status: 1,
                  errorMessage: 1,
                  updatedAt: 1
                }
              }
            ],
            as: 'errorRecipients'
          }
        },
        {
          $addFields: {
            errorRecipientCount: {
              $ifNull: [{ $arrayElemAt: ['$errorRecipients.count', 0] }, 0]
            }
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            agentId: 1,
            agentName: '$agent.name',
            schedule: 1,
            timezone: 1,
            date: 1,
            time: 1,
            utcDateTime: 1,
            actualStartDateTime: 1,
            status: 1,
            totalRecipient: 1,
            processedRecipient: 1,
            followups: 1,
            errorMessage: 1,
            createdBy: 1,
            isArchived: 1,
            createdAt: 1,
            updatedAt: 1,
            errorRecipients: 1,
          }
        },
        { $sort },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'count' }]
          }
        }
      ]);

      const batchCalls = result[0]?.data || [];
      const totalCount = result[0]?.totalCount[0]?.count || 0;

      return {
        status: true,
        message: 'Batch calls retrieved successfully',
        data: batchCalls,
        totalCount,
        isSuperAdmin
      };
    } catch (err) {
      console.error('Error in listing batch calls:', err);
      throwError('Failed to fetch batch calls', err);
    }
  }
}

const batchCallService = new BatchCallService();
export { batchCallService, BatchCallService };