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


  public async batchCallDetails(user: any, payload: any) {
    const {
      batchIds,
      searchStr = '',
      sortBy = 'createdAt DESC',
      skip = 0,
      limit = 10,
      statusFilter = ""
    } = payload;

    // Sort parsing
    const sortParts = sortBy.trim().split(' ');
    const sortField = sortParts[0] || 'createdAt';
    const direction = sortParts[1] || 'DESC';
    const sortDirection = direction.toLowerCase() === 'asc' ? 1 : -1;

    // Search regex
    const searchRegex = searchStr
      ? {
        $regex: searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i'
      }
      : null;

    // ✅ Separate filters
    let statusMatch: any = {};
    let callDataMatch: any = {};

    switch (statusFilter) {
      case "complete":
        statusMatch = { status: { $in: [3, 4] } };
        break;

      case "skip":
        statusMatch = { status: 5 };
        break;

      case "meeting":
        callDataMatch = {
          "callData.leadStatus": { $eq: "Interested - Meeting Booked" }
        };
        break;

      case "failed":
        statusMatch = { status: 7 };
        break;

      case "processing":
        statusMatch = { status: 6 };
        break;

      case "queued":
        statusMatch = { status: 1 };
        break;

      case "followUps":
        statusMatch = { status: 2 };
        break;

      default:
        break;
    }

    const pipeline: any[] = [
      // ✅ Base match (only DB fields)
      {
        $match: {
          batchCallId: new Types.ObjectId(batchIds),
          ...statusMatch
        }
      },

      // Batch lookup
      {
        $lookup: {
          from: 'BatchCall',
          localField: 'batchCallId',
          foreignField: '_id',
          as: 'batch',
          pipeline: [
            {
              $project: {
                name: 1,
                status: 1,
                outboundNumber: 1,
                utcDateTime: 1,
                actualStartDateTime: 1,
                totalRecipient: 1,
                updatedAt: 1
              }
            }
          ]
        }
      },

      { $match: { 'batch.0': { $exists: true } } },
      { $unwind: '$batch' },

      // Latest call data
      {
        $lookup: {
          from: 'Calls',
          let: {
            batchCallId: { $toString: '$batchCallId' },
            recipientNumber: '$number'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$batchCallId', '$$batchCallId'] },
                    { $eq: ['$toNumber', '$$recipientNumber'] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                status: 1,
                duration: 1,
                disconnectionReason: 1,
                leadStatus: 1,
                createdAt: 1,
                updatedAt: 1,
                attemptLength: 1
              }
            }
          ],
          as: 'callData'
        }
      },

      // All call history
      {
        $lookup: {
          from: 'Calls',
          let: {
            batchCallId: { $toString: '$batchCallId' },
            recipientNumber: '$number'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$batchCallId', '$$batchCallId'] },
                    { $eq: ['$toNumber', '$$recipientNumber'] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            {
              $project: {
                attemptLength: 1,
                createdAt: 1,
                leadStatus: 1,
                duration: 1,
                disconnectionReason: 1
              }
            }
          ],
          as: 'allCallData'
        }
      },

      // Extract latest call
      {
        $addFields: {
          callData: { $arrayElemAt: ['$callData', 0] }
        }
      },

      // ✅ FIX: Apply meeting filter AFTER lookup
      ...(Object.keys(callDataMatch).length
        ? [{ $match: callDataMatch }]
        : []),

      // Search
      ...(searchRegex
        ? [
          {
            $match: {
              $or: [
                { firstName: searchRegex },
                { number: searchRegex },
                { 'batch.name': searchRegex }
              ]
            }
          }
        ]
        : []),

      // Sorting
      { $sort: { [sortField]: sortDirection, _id: 1 } },

      // Pagination + Projection
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                recipientId: '$_id',
                errorMessage: '$errorMessage',
                errorMessages: '$errorMessages',
                recipientName: '$name',
                recipientNumber: '$number',
                recipientFirstName: '$firstName',
                recipientLastName: '$lastName',
                recipientGender: '$gender',
                recipientEmail: '$email',
                recipientStatus: '$status',
                recipientCreatedAt: '$createdAt',
                recipientUpdatedAt: '$updatedAt',
                callAttempt: '$attemptLength',

                batchId: '$batch._id',
                batchName: '$batch.name',
                batchStatus: '$batch.status',
                utcDateTime: '$batch.utcDateTime',
                actualStartDateTime: '$batch.actualStartDateTime',
                outboundNumber: '$batch.outboundNumber',
                totalRecipient: '$batch.totalRecipient',
                updatedAt: '$batch.updatedAt',

                callStatus: { $ifNull: ['$callData.status', null] },
                callDuration: { $ifNull: ['$callData.duration', null] },
                callDisconnectionReason: { $ifNull: ['$callData.disconnectionReason', ''] },
                callLeadStatus: { $ifNull: ['$callData.leadStatus', ''] },
                callCreatedAt: { $ifNull: ['$callData.createdAt', null] },
                callUpdatedAt: { $ifNull: ['$callData.updatedAt', null] },

                callHistory: {
                  $cond: {
                    if: { $isArray: '$allCallData' },
                    then: {
                      $map: {
                        input: '$allCallData',
                        as: 'call',
                        in: {
                          attemptNumber: { $ifNull: ['$$call.attemptLength', 0] },
                          datetime: { $ifNull: ['$$call.createdAt', null] },
                          status: { $ifNull: ['$$call.leadStatus', ''] },
                          duration: { $ifNull: ['$$call.duration', 0] },
                          disconnectionReason: { $ifNull: ['$$call.disconnectionReason', ''] }
                        }
                      }
                    },
                    else: []
                  }
                }
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    try {
      const result = await Recipient.aggregate(pipeline).exec();
      const analysis = await this.getBatchDetailsCounts(payload);

      return {
        analysis,
        data: result[0]?.data || [],
        totalCount: result[0]?.totalCount[0]?.count || 0
      };
    } catch (error: any) {
      console.error("Error in batchCallDetails:", {
        message: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to fetch batch call details: ${error.message}`);
    }
  }


  public async getBatchDetailsCounts(payload: any) {
    const { batchIds } = payload;

    const batchObjectId = new Types.ObjectId(batchIds);

    const result = await Recipient.aggregate([
      {
        $match: {
          batchCallId: batchObjectId
        }
      },

      // Get latest call per recipient
      {
        $lookup: {
          from: "Calls",
          let: {
            batchCallId: { $toString: "$batchCallId" },
            recipientNumber: "$number"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$batchCallId", "$$batchCallId"] },
                    { $eq: ["$toNumber", "$$recipientNumber"] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                leadStatus: 1
              }
            }
          ],
          as: "callData"
        }
      },

      {
        $addFields: {
          callData: { $arrayElemAt: ["$callData", 0] }
        }
      },

      // Group counts
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          complete: {
            $sum: {
              $cond: [{ $in: ["$status", [3, 4]] }, 1, 0]
            }
          },

          processing: {
            $sum: {
              $cond: [{ $eq: ["$status", 6] }, 1, 0]
            }
          },

          queued: {
            $sum: {
              $cond: [{ $eq: ["$status", 1] }, 1, 0]
            }
          },

          followUps: {
            $sum: {
              $cond: [{ $eq: ["$status", 2] }, 1, 0]
            }
          },

          skip: {
            $sum: {
              $cond: [{ $eq: ["$status", 5] }, 1, 0]
            }
          },

          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", 7] }, 1, 0]
            }
          },

          // ✅ FIXED meeting count
          meeting: {
            $sum: {
              $cond: [
                { $eq: ["$callData.leadStatus", "Interested - Meeting Booked"] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const counts = result[0] || {
      total: 0,
      complete: 0,
      processing: 0,
      queued: 0,
      meeting: 0,
      followUps: 0,
      skip: 0,
      failed: 0
    };

    return counts;
  }
}

const batchCallService = new BatchCallService();
export { batchCallService, BatchCallService };