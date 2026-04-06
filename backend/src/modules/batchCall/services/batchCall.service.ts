import { Recipient } from "../models/recipient.model";
import { throwError } from "../../../common/app-helper";
import { BatchCall } from "../models/batchCall.model";
import { Types } from "mongoose";
import { BATCH_CALL_PROCESS_STATUS, BATCH_CALL_START_AFTER, BATCH_CALL_STATUS, TIME_DIFF } from "../../../config/server-config";
import moment from 'moment-timezone';
import { BatchCallFollowUps } from "../models/batchCallFollowUps.model";
import { User } from "../../users/models/user.model";
import { UserAgent } from "../../agent/model/user-agent.model";
class BatchCallService {
  public async create(user: any, payload: any) {
    try {
      const userId = new Types.ObjectId(user.userId);
      let matchCondition: any = {
        createdBy: userId,
        isArchived: false,
        name: payload?.name
      };

      const existingBatchCall = await BatchCall.findOne(matchCondition);
      if (existingBatchCall) {
        throw new Error(`Batch call with name '${payload.name}' already exists`);
      }



      let batchCall: any = {
        name: payload?.name,
        status: payload?.status || 0,
        assistantId: payload?.assistantId,
        agentId: payload?.agentMongoId,
        phoneNumberId: payload?.phoneNumberId,
        retellPhoneNumberId: payload?.retellPhoneNumberId,
        voiceProvider: payload?.voiceProvider,
        schedule: payload?.schedule,
        totalRecord: payload?.recipients?.length,
        totalProcess: 0,
        totalRecipient: payload?.recipients?.length || 0,
        createdBy: user?.userId,
        updatedBy: user?.userId,
        callFrom: payload?.voiceProvider,
        companyId: user?.companyId,
        isContactSheet: payload?.isContactSheet || false
      };

      if (payload?.schedule) {
        batchCall.timezone = payload?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        batchCall.date = payload?.date;
        batchCall.time = payload?.time;
        const dateTimeString = `${payload.date} ${payload.time}`;
        batchCall.utcDateTime = moment.tz(dateTimeString, batchCall.timezone).utc().toDate();
      } else {
        const timezone = payload?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = moment.tz(timezone).add(BATCH_CALL_START_AFTER.DIFF_VALUE, BATCH_CALL_START_AFTER.DIFF_IN);
        batchCall.timezone = timezone;
        batchCall.date = now.format('YYYY-MM-DD');
        batchCall.time = now.format('HH:mm');
        batchCall.utcDateTime = now.utc().toDate();
      }

      if (batchCall.utcDateTime) {
        batchCall.cronExpression = await this.generateCronExpression(batchCall.utcDateTime);
      }
      const batchCallResult = await BatchCall.create(batchCall);

      const result: any = await Recipient.insertMany(
        payload.recipients.map((contact: any) => ({
          companyId: user?.companyId,
          callFrom: payload?.voiceProvider,
          batchCallId: batchCallResult._id,
          ...contact,
          number: contact.number?.replace(/\s+/g, '')  // remove spaces
        }))
      );

      if (payload?.status === BATCH_CALL_STATUS.CREATED && batchCall.cronExpression) {
        try {

          // await axios.post(Environment.dynamicCronApis.start, {
          //   cronExpression: batchCall.cronExpression,
          //   batchCallId: batchCallResult._id,
          //   originalBatchCallId: batchCallResult._id,
          //   followUp: false,
          //   retry: false,
          //   companyId: user.companyId,
          //   userId: user?.userId
          // });
        } catch (cronError: any) {
          console.error('✗ Error calling cron API:', cronError.message);
        }
      }

      if (payload?.followUpsDetails && payload?.followUpsDetails.length > 0) {
        await this.batchCallsFollowUp(user, {
          batchCallId: batchCallResult._id,
          followUpsDetails: payload.followUpsDetails,
          timezone: batchCall.timezone,
          status: payload?.status,
          callFrom: payload?.voiceProvider,
          phoneNumberId: batchCall.phoneNumberId,
        });
      }
      return {
        batchCallId: batchCallResult._id,
        recipients: result.length,
        cronExpression: batchCall.cronExpression
      };
    } catch (err: any) {
      throwError(err);
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
            agentName: '$agent.agentName', // get agentName from Agent model
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


  public async batchListing(
    user: any,
    selectedUserId?: any,
    selectedCompanyId?: any // Add companyId parameter
  ) {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      console.log('BatchListing - User info:', {
        userId: user._id,
        isAdmin: user.isAdmin,
        isSuperAdmin: isSuperAdmin,
        companyId: user.companyId,
        selectedUserId: selectedUserId,
        selectedCompanyId: selectedCompanyId
      });

      let targetUserIds: any[] = [];

      // Super Admin Logic
      if (isSuperAdmin) {
        if (selectedCompanyId) {
          // Super admin filtering by specific company
          const targetCompanyId = new Types.ObjectId(selectedCompanyId);

          // Get all users from that company
          const companyUsers = await User.find({
            companyId: targetCompanyId,
            isArchived: false
          }).select('_id').lean();

          targetUserIds = companyUsers.map(u => u._id);

          // If userId is also provided, filter to that specific user
          if (selectedUserId) {
            targetUserIds = targetUserIds.filter(id =>
              id.toString() === selectedUserId
            );
          }
        } else {
          // Super admin without company filter - get all companies (excluding super admin company)
          const allUsers = await User.find({
            companyId: { $ne: new Types.ObjectId(SUPER_ADMIN_COMPANY_ID) },
            isArchived: false
          }).select('_id').lean();

          targetUserIds = allUsers.map(u => u._id);
        }
      }
      // Company Admin Logic
      else if (user.isAdmin && selectedUserId) {
        // Admin provided specific userId filter (within their company)
        targetUserIds = [new Types.ObjectId(selectedUserId)];
      }
      // Regular User or Admin without userId filter
      else {
        targetUserIds = [user.userId ? new Types.ObjectId(user.userId) : user._id];
      }

      console.log('BatchListing - Target User IDs:', targetUserIds);

      if (targetUserIds.length === 0) {
        console.log('No users found for the filter criteria');
        return {
          status: true,
          message: 'No users found for this filter',
          data: []
        };
      }

      // Build match condition
      let matchCondition: any = {
        createdBy: { $in: targetUserIds },
        isArchived: false
      };

      let $sort: any = { name: 1 };

      const result = await BatchCall.find(matchCondition, '_id name')
        .sort($sort)
        .lean()
        .exec();
      return {
        status: true,
        message: "Batch calls retrieved successfully",
        data: result
      };
    } catch (err) {
      console.error('Error in batchListing batch calls:', err);
      throwError('Failed to fetch batch calls', err);
    }
  }

  public async getDetail(user: any, batchCallId: string) {
    try {
      const userId = new Types.ObjectId(user.userId);
      const batchCall: any = await BatchCall.findOne({ _id: new Types.ObjectId(batchCallId), createdBy: userId, isArchived: false });

      if (!batchCall) throwError('BatchCall not found');
      const recipients = await Recipient.find({ batchCallId }).lean();

      return {
        ...batchCall,
        recipients
      };
    } catch (err) {
      throwError('Failed to fetch batch call detail', err);
    }
  }

  public async batchCallStart(user: any, batchCallId: string, payload: any) {
    const userId = new Types.ObjectId(user.userId);
    const batchCall: any = await BatchCall.findOne({ _id: new Types.ObjectId(batchCallId), createdBy: userId, isArchived: false });
    const dateTimeString = `${payload.date} ${payload.time}`;
    const utcDateTime = moment.tz(dateTimeString, batchCall.timezone).utc().toDate();

    await BatchCall.updateOne({ _id: batchCall?._id }, {
      $set: {
        date: payload?.date,
        time: payload?.time,
        utcDateTime: utcDateTime,
        status: BATCH_CALL_STATUS.START_CALLING
      }
    });

    if (utcDateTime) {
      batchCall.cronExpression = await this.generateCronExpression(utcDateTime);
    }

    // await axios.post(Environment.dynamicCronApis.start, {
    //   cronExpression: batchCall.cronExpression,
    //   batchCallId: batchCall._id,
    //   originalBatchCallId: batchCall._id,
    //   companyId: user.companyId,
    //   userId: user?.userId,
    //   followUp: false,
    //   retry: false,
    // });
    const batchCallFollowUps: any = await BatchCallFollowUps.find({ batchCallId: new Types.ObjectId(batchCallId) }).lean().exec();
    if (batchCallFollowUps && batchCallFollowUps.length > 0) {
      const cronsDetails = batchCallFollowUps.map((record: { cronExpression: any; _id: any; }) => ({
        cronExpression: record.cronExpression,
        batchCallId: record._id,
        originalBatchCallId: batchCallId,
        companyId: user.companyId,
        userId: user?.userId,
        followUp: true,
        retry: false,
      }));
      // const results = await axios.post(Environment.dynamicCronApis.setupCrons, {
      //   cronDetails: cronsDetails
      // });
    }
    return {
      message: "Batch call started successfully",
      batchCallId: batchCall._id
    };
  }

  // public async batchCallDetails(user: any, payload: any) {
  //   const {
  //     batchIds,
  //     searchStr = '',
  //     sortBy = 'createdAt DESC',
  //     skip = 0,
  //     limit = 10,
  //     statusFilter = ""
  //   } = payload;

  //   // Sort parsing
  //   const sortParts = sortBy.trim().split(' ');
  //   const sortField = sortParts[0] || 'createdAt';
  //   const direction = sortParts[1] || 'DESC';
  //   const sortDirection = direction.toLowerCase() === 'asc' ? 1 : -1;

  //   // Search regex
  //   const searchRegex = searchStr
  //     ? {
  //       $regex: searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  //       $options: 'i'
  //     }
  //     : null;

  //   // ⭐ STATUS FILTER LOGIC
  //   let statusMatch: any = {};

  //   switch (statusFilter) {
  //     case "complete":
  //       statusMatch = { status: { $in: [3, 4] } };
  //       break;

  //     case "skip":
  //       statusMatch = { status: 5 };
  //       break;

  //     case "meeting":
  //       statusMatch = { "callData.leadStatus": "Interested - Meeting Booked" };
  //       break;

  //     case "failed":
  //       statusMatch = { status: 7 };
  //       break;

  //     case "processing":
  //       statusMatch = { status: 6 };
  //       break;

  //     case "queued":
  //       statusMatch = { status: 1 };
  //       break;

  //     case "followUps":
  //       statusMatch = { status: 2 };
  //       break;

  //     default:
  //       statusMatch = {}; // no filter
  //   }

  //   const pipeline: any[] = [
  //     // Match batch id
  //     { $match: { batchCallId: new Types.ObjectId(batchIds), ...statusMatch } },

  //     // Lookup batch
  //     {
  //       $lookup: {
  //         from: 'BatchCall',
  //         localField: 'batchCallId',
  //         foreignField: '_id',
  //         as: 'batch',
  //         pipeline: [
  //           {
  //             $project: {
  //               name: 1,
  //               status: 1,
  //               outboundNumber: 1,
  //               utcDateTime: 1,
  //               actualStartDateTime: 1,
  //               totalRecipient: 1,
  //               updatedAt: 1
  //             }
  //           }
  //         ]
  //       }
  //     },

  //     { $match: { 'batch.0': { $exists: true } } },
  //     { $unwind: '$batch' },

  //     // Search filter
  //     ...(searchRegex
  //       ? [
  //         {
  //           $match: {
  //             $or: [
  //               { firstName: searchRegex },
  //               { number: searchRegex },
  //               { 'batch.name': searchRegex }
  //             ]
  //           }
  //         }
  //       ]
  //       : []),

  //     // Sorting
  //     { $sort: { [sortField]: sortDirection, _id: 1 } },

  //     // Pagination + Projection
  //     {
  //       $facet: {
  //         data: [
  //           { $skip: skip },
  //           { $limit: limit },
  //           {
  //             $project: {
  //               recipientId: '$_id',
  //               errorMessage: '$errorMessage',
  //               errorMessages: '$errorMessages',
  //               recipientName: '$name',
  //               recipientNumber: '$number',
  //               recipientFirstName: '$firstName',
  //               recipientLastName: '$lastName',
  //               recipientGender: '$gender',
  //               recipientEmail: '$email',
  //               recipientStatus: '$status',
  //               recipientCreatedAt: '$createdAt',
  //               recipientUpdatedAt: '$updatedAt',
  //               callAttempt: '$attemptLength',

  //               batchId: '$batch._id',
  //               batchName: '$batch.name',
  //               batchStatus: '$batch.status',
  //               utcDateTime: '$batch.utcDateTime',
  //               actualStartDateTime: '$batch.actualStartDateTime',
  //               outboundNumber: '$batch.outboundNumber',
  //               totalRecipient: '$batch.totalRecipient',
  //               updatedAt: '$batch.updatedAt',

  //               callStatus: { $ifNull: ['$callData.status', null] },
  //               callDuration: { $ifNull: ['$callData.duration', null] },
  //               callDisconnectionReason: { $ifNull: ['$callData.disconnectionReason', ''] },
  //               callLeadStatus: { $ifNull: ['$callData.leadStatus', ''] },
  //               callCreatedAt: { $ifNull: ['$callData.createdAt', null] },
  //               callUpdatedAt: { $ifNull: ['$callData.updatedAt', null] },

  //               callHistory: {
  //                 $cond: {
  //                   if: { $isArray: '$allCallData' },
  //                   then: {
  //                     $map: {
  //                       input: '$allCallData',
  //                       as: 'call',
  //                       in: {
  //                         attemptNumber: { $ifNull: ['$$call.attemptLength', 0] },
  //                         datetime: { $ifNull: ['$$call.createdAt', null] },
  //                         status: { $ifNull: ['$$call.leadStatus', ''] },
  //                         duration: { $ifNull: ['$$call.duration', 0] },
  //                         disconnectionReason: { $ifNull: ['$$call.disconnectionReason', ''] }
  //                       }
  //                     }
  //                   },
  //                   else: []
  //                 }
  //               }
  //             }
  //           }
  //         ],
  //         totalCount: [{ $count: 'count' }]
  //       }
  //     }
  //   ];

  //   try {
  //     const result = await Recipient.aggregate(pipeline).exec();
  //     const analysis = await this.getBatchDetailsCounts(payload);

  //     return {
  //       analysis,
  //       data: result[0]?.data || [],
  //       totalCount: result[0]?.totalCount[0]?.count || 0
  //     };
  //   } catch (error: any) {
  //     console.error("Error in batchCallDetails:", {
  //       message: error.message,
  //       stack: error.stack
  //     });
  //     throw new Error(`Failed to fetch batch call details: ${error.message}`);
  //   }
  // }


  // public async batchCallDetails(user: any, payload: any) {
  //   const {
  //     batchIds,
  //     searchStr = '',
  //     sortBy = 'createdAt DESC',
  //     skip = 0,
  //     limit = 10,
  //     statusFilter = ""
  //   } = payload;

  //   // Sort parsing
  //   const sortParts = sortBy.trim().split(' ');
  //   const sortField = sortParts[0] || 'createdAt';
  //   const direction = sortParts[1] || 'DESC';
  //   const sortDirection = direction.toLowerCase() === 'asc' ? 1 : -1;

  //   // Search regex
  //   const searchRegex = searchStr
  //     ? {
  //       $regex: searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  //       $options: 'i'
  //     }
  //     : null;

  //   // ⭐ STATUS FILTER LOGIC
  //   let statusMatch: any = {};

  //   switch (statusFilter) {
  //     case "complete":
  //       statusMatch = { status: { $in: [3, 4] } };
  //       break;

  //     case "skip":
  //       statusMatch = { status: 5 };
  //       break;

  //     case "meeting":
  //       statusMatch = { "callData.leadStatus": "Interested - Meeting Booked" };
  //       break;

  //     case "failed":
  //       statusMatch = { status: 7 };
  //       break;

  //     case "processing":
  //       statusMatch = { status: 6 };
  //       break;

  //     case "queued":
  //       statusMatch = { status: 1 };
  //       break;

  //     case "followUps":
  //       statusMatch = { status: 2 };
  //       break;

  //     default:
  //       statusMatch = {}; // no filter
  //   }

  //   const pipeline: any[] = [
  //     // Match batch id
  //     { $match: { batchCallId: new Types.ObjectId(batchIds), ...statusMatch } },

  //     // Lookup batch
  //     {
  //       $lookup: {
  //         from: 'BatchCall',
  //         localField: 'batchCallId',
  //         foreignField: '_id',
  //         as: 'batch',
  //         pipeline: [
  //           {
  //             $project: {
  //               name: 1,
  //               status: 1,
  //               outboundNumber: 1,
  //               utcDateTime: 1,
  //               actualStartDateTime: 1,
  //               totalRecipient: 1,
  //               updatedAt: 1
  //             }
  //           }
  //         ]
  //       }
  //     },

  //     { $match: { 'batch.0': { $exists: true } } },
  //     { $unwind: '$batch' },

  //     // ⭐ Lookup latest call data from Calls collection
  //     {
  //       $lookup: {
  //         from: 'Calls',
  //         let: {
  //           batchCallId: { $toString: '$batchCallId' },
  //           recipientNumber: '$number'
  //         },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: {
  //                 $and: [
  //                   { $eq: ['$batchCallId', '$$batchCallId'] },
  //                   { $eq: ['$toNumber', '$$recipientNumber'] }
  //                 ]
  //               }
  //             }
  //           },
  //           { $sort: { createdAt: -1 } },
  //           { $limit: 1 },
  //           {
  //             $project: {
  //               status: 1,
  //               duration: 1,
  //               disconnectionReason: 1,
  //               leadStatus: 1,
  //               createdAt: 1,
  //               updatedAt: 1,
  //               attemptLength: 1
  //             }
  //           }
  //         ],
  //         as: 'callData'
  //       }
  //     },

  //     // ⭐ Lookup all call history from Calls collection
  //     {
  //       $lookup: {
  //         from: 'Calls',
  //         let: {
  //           batchCallId: { $toString: '$batchCallId' },
  //           recipientNumber: '$number'
  //         },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: {
  //                 $and: [
  //                   { $eq: ['$batchCallId', '$$batchCallId'] },
  //                   { $eq: ['$toNumber', '$$recipientNumber'] }
  //                 ]
  //               }
  //             }
  //           },
  //           { $sort: { createdAt: -1 } },
  //           {
  //             $project: {
  //               attemptLength: 1,
  //               createdAt: 1,
  //               leadStatus: 1,
  //               duration: 1,
  //               disconnectionReason: 1
  //             }
  //           }
  //         ],
  //         as: 'allCallData'
  //       }
  //     },

  //     // Unwind callData for easier access (optional, keeps it as array if not present)
  //     {
  //       $addFields: {
  //         callData: { $arrayElemAt: ['$callData', 0] }
  //       }
  //     },

  //     // Search filter
  //     ...(searchRegex
  //       ? [
  //         {
  //           $match: {
  //             $or: [
  //               { firstName: searchRegex },
  //               { number: searchRegex },
  //               { 'batch.name': searchRegex }
  //             ]
  //           }
  //         }
  //       ]
  //       : []),

  //     // Sorting
  //     { $sort: { [sortField]: sortDirection, _id: 1 } },

  //     // Pagination + Projection
  //     {
  //       $facet: {
  //         data: [
  //           { $skip: skip },
  //           { $limit: limit },
  //           {
  //             $project: {
  //               recipientId: '$_id',
  //               errorMessage: '$errorMessage',
  //               errorMessages: '$errorMessages',
  //               recipientName: '$name',
  //               recipientNumber: '$number',
  //               recipientFirstName: '$firstName',
  //               recipientLastName: '$lastName',
  //               recipientGender: '$gender',
  //               recipientEmail: '$email',
  //               recipientStatus: '$status',
  //               recipientCreatedAt: '$createdAt',
  //               recipientUpdatedAt: '$updatedAt',
  //               callAttempt: '$attemptLength',

  //               batchId: '$batch._id',
  //               batchName: '$batch.name',
  //               batchStatus: '$batch.status',
  //               utcDateTime: '$batch.utcDateTime',
  //               actualStartDateTime: '$batch.actualStartDateTime',
  //               outboundNumber: '$batch.outboundNumber',
  //               totalRecipient: '$batch.totalRecipient',
  //               updatedAt: '$batch.updatedAt',

  //               callStatus: { $ifNull: ['$callData.status', null] },
  //               callDuration: { $ifNull: ['$callData.duration', null] },
  //               callDisconnectionReason: { $ifNull: ['$callData.disconnectionReason', ''] },
  //               callLeadStatus: { $ifNull: ['$callData.leadStatus', ''] },
  //               callCreatedAt: { $ifNull: ['$callData.createdAt', null] },
  //               callUpdatedAt: { $ifNull: ['$callData.updatedAt', null] },

  //               callHistory: {
  //                 $cond: {
  //                   if: { $isArray: '$allCallData' },
  //                   then: {
  //                     $map: {
  //                       input: '$allCallData',
  //                       as: 'call',
  //                       in: {
  //                         attemptNumber: { $ifNull: ['$$call.attemptLength', 0] },
  //                         datetime: { $ifNull: ['$$call.createdAt', null] },
  //                         status: { $ifNull: ['$$call.leadStatus', ''] },
  //                         duration: { $ifNull: ['$$call.duration', 0] },
  //                         disconnectionReason: { $ifNull: ['$$call.disconnectionReason', ''] }
  //                       }
  //                     }
  //                   },
  //                   else: []
  //                 }
  //               }
  //             }
  //           }
  //         ],
  //         totalCount: [{ $count: 'count' }]
  //       }
  //     }
  //   ];

  //   try {
  //     const result = await Recipient.aggregate(pipeline).exec();
  //     const analysis = await this.getBatchDetailsCounts(payload);

  //     return {
  //       analysis,
  //       data: result[0]?.data || [],
  //       totalCount: result[0]?.totalCount[0]?.count || 0
  //     };
  //   } catch (error: any) {
  //     console.error("Error in batchCallDetails:", {
  //       message: error.message,
  //       stack: error.stack
  //     });
  //     throw new Error(`Failed to fetch batch call details: ${error.message}`);
  //   }
  // }

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





  // public async getBatchDetailsCounts(payload: any) {
  //   const { batchIds } = payload;

  //   // Fetch batch data
  //   const batchData = await BatchCall.findById(new Types.ObjectId(batchIds));

  //   // Fetch all recipients for this batch
  //   const recipients: any = await Recipient.find({
  //     batchCallId: new Types.ObjectId(batchIds)
  //   });

  //   // Initialize counts
  //   const total = batchData?.totalRecipient || 0;
  //   let complete = 0;
  //   let processing = 0;
  //   let queued = 0;
  //   let meeting = 0;
  //   let followUps = 0;
  //   let skip = 0;
  //   let failed = 0;

  //   recipients.forEach((recipient: { status: any; callData: { leadStatus: string; }; }) => {
  //     switch (recipient.status) {
  //       case 3:
  //       case 4:
  //         complete++;
  //         break;
  //       case 6:
  //         processing++;
  //         break;
  //       case 1:
  //         queued++;
  //         break;
  //       case 2:
  //         followUps++;
  //         break;
  //       case 5:
  //         skip++;
  //         break;
  //       case 7:
  //         failed++;
  //         break;
  //     }

  //     if (recipient.callData?.leadStatus === 'Interested - Meeting Booked') {
  //       meeting++;
  //     }
  //   });

  //   return {
  //     total,
  //     complete,
  //     processing,
  //     queued,
  //     meeting,
  //     followUps,
  //     skip,
  //     failed
  //   };
  // }

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




  public async batchCallsFollowUp(user: any, payload: any) {
    const userId = new Types.ObjectId(user.userId);
    const { batchCallId, followUpsDetails, status } = payload;

    try {
      const followUpRecords = [];
      const timezone = payload?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      for (let i = 0; i < followUpsDetails.length; i++) {
        const detail = followUpsDetails[i];

        // Create UTC datetime from date, time and timezone
        const dateTimeString = `${detail.date.trim()}T${detail.time.trim()}`;
        const utcDateTime = moment.tz(dateTimeString, timezone).utc().toDate();
        // Generate cron expression (assuming you have a utility function)
        const cronExpression = await this.generateCronExpression(utcDateTime);


        const followUpRecord = {
          batchCallId: new Types.ObjectId(batchCallId),
          timezone: timezone,
          date: detail.date.trim(),
          time: detail.time.trim(),
          utcDateTime: utcDateTime,
          status: BATCH_CALL_STATUS.NOT_STARTED, // Initial status
          cronExpression: cronExpression,
          isArchived: false,
          createdBy: userId,
          updatedBy: userId,
          companyId: user?.companyId,
          followupNumber: i + 1,
          callFrom: payload?.voiceProvider,
          phoneNumberId: detail.phoneNumberId?.trim() || payload?.phoneNumberId,
        };

        followUpRecords.push(followUpRecord);
      }

      // Insert all follow-up records
      const insertedRecords = await BatchCallFollowUps.insertMany(followUpRecords);
      // Create cron jobs for each inserted follow-up
      if (status === BATCH_CALL_STATUS.CREATED) {
        // Create cron jobs for each inserted follow-up
        const cronsDetails = insertedRecords.map((record: { cronExpression: any; _id: any; }) => ({
          cronExpression: record.cronExpression,
          batchCallId: record._id,
          originalBatchCallId: batchCallId,
          followUp: true,
          retry: false,
          companyId: user.companyId,
          userId: user.userId
        }));
        // const results = await axios.post(Environment.dynamicCronApis.setupCrons, {
        //   cronDetails: cronsDetails
        // });
      }
      // update also logs in batch
      BatchCall.updateOne(
        { _id: new Types.ObjectId(batchCallId) },
        {
          $set: {
            maxAttempts: followUpRecords.length + 1,
            updatedBy: userId,
            updatedAt: new Date()
          }
        }
      ).exec();

      Recipient.updateMany(
        { batchCallId: new Types.ObjectId(batchCallId) },
        {
          $set: {
            maxAttempts: followUpRecords.length + 1,
            updatedBy: userId,
            updatedAt: new Date()
          }
        }
      ).exec();

      return {
        success: true,
        message: 'Follow-up calls scheduled successfully',
        data: {
          totalFollowUps: insertedRecords.length,
          followUps: insertedRecords.map(record => ({
            id: record._id,
            date: record.date,
            time: record.time,
            timezone: record.timezone,
            utcDateTime: record.utcDateTime,
          }))
        }
      };

    } catch (error) {
      console.error('Error creating batch call follow-ups:', error);
      throw error;
    }
  }


  public async deleteCalls(user: any, params: any) {
    try {
      if (params.type === 'batch') {
        // Get batch and all its followups
        const batch: any = await BatchCall.findById(params.id);
        const followUps = await BatchCallFollowUps.find({ batchCallId: params.id });
        if (batch?.status !== BATCH_CALL_STATUS.DRAFT) {
          // Prepare cron details for stopping all crons
          const cronDetails = [];

          // Add batch cron if it has one
          if (batch && batch.cronExpression) {
            cronDetails.push({
              id: batch._id,
              cronExpression: batch.cronExpression,
              type: 'batch'
            });
          }

          // Add followup crons
          followUps.forEach(followUp => {
            if (followUp.cronExpression) {
              cronDetails.push({
                id: followUp._id,
                cronExpression: followUp.cronExpression,
                type: 'followup'
              });
            }
          });

          // Stop all crons for batch and followups
          if (cronDetails.length > 0) {
            // await axios.post(Environment.dynamicCronApis.stopCrons, {
            //   cronDetails: cronDetails
            // });
          }

        }

        // Archive batch and all followups
        await BatchCall.findByIdAndUpdate(params.id, { isArchived: true });
        await BatchCallFollowUps.updateMany(
          { batchCallId: params.id },
          { isArchived: true }
        );

        await Recipient.updateMany(
          { batchCallId: params.id },
          { isArchived: true }
        );

      } else if (params.type === 'followups') {
        // Get the specific followup
        const followUp: any = await BatchCallFollowUps.findById(params.id);
        const batch: any = await BatchCall.findById(followUp.batchCallId);
        if (batch && batch?.status !== BATCH_CALL_STATUS.DRAFT && followUp && followUp.cronExpression) {
          // Stop single cron for followup
          // await axios.post(Environment.dynamicCronApis.stop, {
          //   id: params.id
          // });
        }
        // Archive the followup
        await BatchCallFollowUps.findByIdAndUpdate(params.id, { isArchived: true });
        const followupsCalls = await BatchCallFollowUps.find({ batchCallId: batch?._id, isArchived: false, status: BATCH_CALL_STATUS.NOT_STARTED }).lean();
        if (followupsCalls.length === 0) {

          // all Unsuccess Recipient Mark  Dead
          await Recipient.updateMany(
            {
              batchCallId: batch?._id,
              status: 2
            },
            {
              $set: {
                status: 4,
                updatedAt: new Date()
              },
              $inc: { maxAttempts: - 1 }
            }
          );

          const pendingRecipient = await Recipient.countDocuments(
            {
              batchCallId: batch?._id,
              status: 1
            },
          );
          const newAttempt = batch?.maxAttempts - 1;
          await BatchCall.findByIdAndUpdate(batch?._id, { maxAttempts: newAttempt, status: batch.status === BATCH_CALL_STATUS.IN_PROCESS && pendingRecipient === 0 ? BATCH_CALL_STATUS.COMPLETED : batch.status });
        } else {
          const newAttempt = batch?.maxAttempts - 1;
          await BatchCall.findByIdAndUpdate(batch?._id, { maxAttempts: newAttempt });
        }
      }
      return true;
    } catch (error) {
      console.error('Error in deleteCalls service:', error);
      throw error;
    }
  }



  public async deleteBatchAndFollowUps(user: any, params: any) {
    try {
      if (params.type === 'batch') {
        const batch: any = await BatchCall.findById(params.id);
        if (!batch) return true;

        await BatchCall.findByIdAndUpdate(params.id, { isArchived: true });

        await BatchCallFollowUps.updateMany(
          { batchCallId: params.id },
          { $set: { isArchived: true } }
        );

        await Recipient.updateMany(
          { batchCallId: params.id },
          { isArchived: true }
        );

      } else if (params.type === 'followups') {

        /* =======================
           FOLLOW-UP DELETE
        ======================== */

        const followUp: any = await BatchCallFollowUps.findById(params.id);
        if (!followUp) return true;

        const batch: any = await BatchCall.findById(followUp.batchCallId);

        const archivedFollowupNumber = followUp.followupNumber;

        // 1️⃣ Archive selected follow-up
        await BatchCallFollowUps.findByIdAndUpdate(
          params.id,
          {
            $set: {
              isArchived: true,
              updatedAt: new Date()
            }
          }
        );

        // 2️⃣ Reorder future follow-ups
        await BatchCallFollowUps.updateMany(
          {
            batchCallId: followUp.batchCallId,
            followupNumber: { $gt: archivedFollowupNumber },
            isArchived: false
          },
          {
            $inc: { followupNumber: -1 },
            $set: { updatedAt: new Date() }
          }
        );

        // 3️⃣ Existing logic (unchanged)
        const followupsCalls = await BatchCallFollowUps.find({
          batchCallId: batch?._id,
          isArchived: false,
          status: BATCH_CALL_STATUS.NOT_STARTED
        }).lean();

        if (followupsCalls.length === 0) {
          await Recipient.updateMany(
            {
              batchCallId: batch?._id,
              status: 2
            },
            {
              $set: {
                status: 4,
                updatedAt: new Date()
              },
              $inc: { maxAttempts: -1 }
            }
          );

          const pendingRecipient = await Recipient.countDocuments({
            batchCallId: batch?._id,
            status: 1
          });

          const newAttempt = batch?.maxAttempts - 1;
          await BatchCall.findByIdAndUpdate(
            batch?._id,
            {
              maxAttempts: newAttempt,
              status:
                batch.status === BATCH_CALL_STATUS.IN_PROCESS &&
                  pendingRecipient === 0
                  ? BATCH_CALL_STATUS.COMPLETED
                  : batch.status
            }
          );

        } else {
          const newAttempt = batch?.maxAttempts - 1;
          await BatchCall.findByIdAndUpdate(batch?._id, {
            maxAttempts: newAttempt
          });
        }
      }

      return true;

    } catch (error) {
      console.error('Error in deleteCalls service:', error);
      throw error;
    }
  }

  private generateCronExpression = async function (utcDateTime: Date) {
    const utcSecond = utcDateTime.getSeconds();
    const utcMinute = utcDateTime.getMinutes();
    const utcHour = utcDateTime.getHours();
    const utcDay = utcDateTime.getDate();
    const utcMonth = utcDateTime.getMonth() + 1;
    return `${utcSecond} ${utcMinute} ${utcHour} ${utcDay} ${utcMonth} *`;
  }



  private validateFollowupTimes(mainUtc: Date, followups: any[], followupsUpdateWithMain = false) {
    if (!mainUtc || isNaN(mainUtc.getTime())) {
      throw new Error("Invalid main batch date/time");
    }
    if (followupsUpdateWithMain) {
      const now = new Date();
      if (mainUtc <= now) {
        throw new Error("Main batch date/time must be greater than current time");
      }
    }


    let lastTime = mainUtc;

    followups.forEach((f, index) => {
      const dateTimeStr = `${f.date} ${f.time}`;
      const timezone =
        f.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const followupUtc = moment.tz(dateTimeStr, timezone).utc().toDate();

      if (followupUtc <= lastTime) {
        throw new Error(
          `Follow-up #${index + 1} time must be greater than previous one`
        );
      }

      const diffMinutes =
        (followupUtc.getTime() - lastTime.getTime()) / (1000 * 60);

      if (diffMinutes < TIME_DIFF.RETRY_BATCH_CALL) {
        throw new Error(
          `Follow-up #${index + 1} must be at least ${TIME_DIFF.RETRY_BATCH_CALL} minutes after previous one`
        );
      }

      lastTime = followupUtc;
    });
  }


  public async retryBatchCall(user: any, payload: any) {
    try {
      const userId = new Types.ObjectId(user.userId);

      const existingBatchCall: any = await BatchCall.findOne({
        _id: new Types.ObjectId(payload?.id),
        status: { $in: [BATCH_CALL_STATUS.FAILED] },
      });

      if (!existingBatchCall) {
        throw new Error(
          `Batch call with id '${payload.id}' not exists or not in FAILED status`
        );
      }
      let mappedAgent: any;
      if (existingBatchCall?.agentId) {
        mappedAgent = await UserAgent.findOne({ 'agentId': existingBatchCall?.agentId, isArchived: false });
        if (!mappedAgent) {
          throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
        }
      } else {
        throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
      }

      // ------- MAIN BATCH UTC DATETIME ----------
      const timezone =
        existingBatchCall?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone;

      const mainUTC = moment
        .tz(`${payload.date} ${payload.time}`, timezone)
        .utc()
        .toDate();

      // Validate main batch + followups
      this.validateFollowupTimes(mainUTC, payload.followupDetails || [], true);

      // ----------- Build Retry Object ----------
      let retryObj: any = {
        date: payload?.date,
        time: payload?.time,
        utcDateTime: mainUTC,
        timezone,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      };

      retryObj.cronExpression = await this.generateCronExpression(mainUTC);

      if (payload?.followupDetails?.length > 0) {
        for (let index = 0; index < payload.followupDetails.length; index++) {
          const followUps = payload.followupDetails[index];

          const existingFollowupsCall: any = await BatchCallFollowUps.findOne({
            _id: new Types.ObjectId(followUps?.id),
            status: { $in: [BATCH_CALL_STATUS.FAILED] },
          });

          if (!existingFollowupsCall) {
            throw new Error(
              `Follow-up with id '${followUps.id}' not exists or not in FAILED status at row ${index + 1
              }`
            );
          }

          let retryFollowupObj: any = {
            date: followUps?.date,
            time: followUps?.time,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
          };

          retryFollowupObj.timezone =
            followUps?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone;

          const followupUTC = moment
            .tz(`${followUps.date} ${followUps.time}`, retryFollowupObj.timezone)
            .utc()
            .toDate();

          retryFollowupObj.utcDateTime = followupUTC;
          retryFollowupObj.cronExpression =
            await this.generateCronExpression(followupUTC);

          await BatchCallFollowUps.updateOne(
            { _id: new Types.ObjectId(followUps.id) },
            {
              $set: {
                status: BATCH_CALL_STATUS.NOT_STARTED,
                date: followUps?.date,
                time: followUps?.time,
                utcDateTime: followupUTC,
                callAttemptLength: 0,
              },
              $push: { retryDetails: retryFollowupObj },
            }
          )

          // insertedRecords.push({
          //   _id: followUps.id,
          //   cronExpression: retryFollowupObj.cronExpression,
          // });
        }

        const existingFollowupsCallCount: any = await BatchCallFollowUps.countDocuments(
          { batchCallId: new Types.ObjectId(payload.id), status: BATCH_CALL_STATUS.NOT_STARTED, isArchived: false }
        )

        await Recipient.updateMany(
          { batchCallId: new Types.ObjectId(payload.id) },
          {
            $set: {
              status: BATCH_CALL_PROCESS_STATUS.PENDING,
              errorMessage: "",
              attemptLength: 0,
              maxAttempts: (1 + existingFollowupsCallCount)
            },

          }
        );

        await BatchCall.updateOne(
          { _id: new Types.ObjectId(payload.id) },
          {
            $set: {
              status: BATCH_CALL_STATUS.CREATED,
              schedule: true,
              date: payload?.date,
              time: payload?.time,
              callAttemptLength: 0,
              utcDateTime: mainUTC,
              maxAttempts: (1 + existingFollowupsCallCount)
            },
            $push: { retryDetails: retryObj },
          }
        );

        // ----------- Create followup crons -----------
        // await axios.post(Environment.dynamicCronApis.setupCrons, {
        //   cronDetails: insertedRecords.map((record) => ({
        //     cronExpression: record.cronExpression,
        //     batchCallId: record._id,
        //     originalBatchCallId: payload.id,
        //     followUp: true,
        //     retry: true,
        //     companyId: mappedAgent?.companyId?.toString(),
        //     userId: mappedAgent?.userId?.toString(),
        //   })),
        // });
      } else {
        await Recipient.updateMany(
          { batchCallId: new Types.ObjectId(payload.id) },
          {
            $set: {
              status: BATCH_CALL_PROCESS_STATUS.PENDING,
              errorMessage: "",
              attemptLength: 0,
              maxAttempts: 1,
            },

          }
        );

        // ----------- Update Main Batch ----------
        await BatchCall.updateOne(
          { _id: new Types.ObjectId(payload.id) },
          {
            $set: {
              status: BATCH_CALL_STATUS.CREATED,
              schedule: true,
              date: payload?.date,
              time: payload?.time,
              callAttemptLength: 0,
              utcDateTime: mainUTC,
              maxAttempts: 1,
            },
            $push: { retryDetails: retryObj },

          }
        );
      }

      // ----------- Start Main Batch Cron -----------
      // if (retryObj.cronExpression) {
      //   try {
      //     // await axios.post(Environment.dynamicCronApis.start, {
      //     //   cronExpression: retryObj.cronExpression,
      //     //   batchCallId: existingBatchCall._id,
      //     //   originalBatchCallId: existingBatchCall._id,
      //     //   followUp: false,
      //     //   retry: true,
      //     //   companyId: mappedAgent?.companyId?.toString(),
      //     //   userId: mappedAgent?.userId?.toString(),
      //     // });
      //   } catch (cronError: any) {
      //     console.error("Error calling cron API:", cronError.message);
      //   }
      // }

      return { success: true, message: "Batch calls retried successfully" };
    } catch (err: any) {
      throwError(err);
    }
  }


  public async retryFollowupsBatchCall(user: any, payload: any) {
    try {
      const userId = new Types.ObjectId(user.userId);

      const existingBatchCall: any = await BatchCall.findOne({
        _id: new Types.ObjectId(payload?.id),
        status: { $in: [BATCH_CALL_STATUS.IN_PROCESS] },
      });

      if (!existingBatchCall) {
        throw new Error(
          `Batch call with id '${payload.id}' not exists or not in IN_PROCESS status`
        );
      }
      let mappedAgent: any;
      if (existingBatchCall?.agentId) {
        mappedAgent = await UserAgent.findOne({ 'agentId': existingBatchCall?.agentId, isArchived: false });
        if (!mappedAgent) {
          throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
        }
      } else {
        throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
      }

      if (!payload.followupDetails?.length) {
        throw new Error("No followup details provided for retry");
      }

      // Validate followups relative to main batch UTC
      this.validateFollowupTimes(
        existingBatchCall.utcDateTime,
        payload.followupDetails,
        false
      );

      // -------- PROCESS FOLLOWUPS --------
      // let insertedRecords = [];

      for (let index = 0; index < payload.followupDetails.length; index++) {
        const followUps = payload.followupDetails[index];

        const existingFollowupsCall: any = await BatchCallFollowUps.findOne({
          _id: new Types.ObjectId(followUps?.id),
          status: { $in: [BATCH_CALL_STATUS.FAILED] },
        });

        if (!existingFollowupsCall) {
          throw new Error(
            `Follow-up with id '${followUps.id}' not exists or not in FAILED status at row ${index + 1
            }`
          );
        }

        let retryObj: any = {
          date: followUps?.date,
          time: followUps?.time,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
          updatedBy: userId,
        };

        retryObj.timezone =
          followUps?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone;

        const followupUTC = moment
          .tz(`${followUps.date} ${followUps.time}`, retryObj.timezone)
          .utc()
          .toDate();

        retryObj.utcDateTime = followupUTC;
        retryObj.cronExpression = await this.generateCronExpression(followupUTC);

        await BatchCallFollowUps.updateOne(
          { _id: new Types.ObjectId(followUps.id) },
          {
            $set: {
              status: BATCH_CALL_STATUS.NOT_STARTED,
              date: followUps?.date,
              time: followUps?.time,
              utcDateTime: followupUTC,
              callAttemptLength: 0,
            },
            $push: { retryDetails: retryObj },
          }
        );

        // insertedRecords.push({
        //   _id: followUps.id,
        //   cronExpression: retryObj.cronExpression,
        // });
      }

      // ----------- Create followup crons -----------
      // await axios.post(Environment.dynamicCronApis.setupCrons, {
      //   cronDetails: insertedRecords.map((record) => ({
      //     cronExpression: record.cronExpression,
      //     batchCallId: record._id,
      //     originalBatchCallId: payload.id,
      //     followUp: true,
      //     retry: true,
      //     companyId: mappedAgent?.companyId?.toString(),
      //     userId: mappedAgent?.userId?.toString(),
      //   })),
      // });

      return { success: true, message: "Follow-up calls retried successfully" };
    } catch (err: any) {
      throwError(err);
    }
  }


  public async processPendingBatchCall(user: any, payload: any) {
    try {
      // 1️⃣ Validate BatchCall
      const batchCallId = new Types.ObjectId(payload?.id);

      const existingBatchCall = await BatchCall.findOne({ _id: batchCallId });
      if (!existingBatchCall) {
        throw new Error(`Batch call with id '${payload?.id}' does not exist`);
      }
      let mappedAgent: any
      if (existingBatchCall?.agentId) {
        mappedAgent = await UserAgent.findOne({ 'agentId': existingBatchCall?.agentId, isArchived: false });
        if (!mappedAgent) {
          throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
        }
      } else {
        throw new Error(`Mapped agent with batch not found in system pls create new batch for start calling`);
      }

      console.log("✔ Allowed to process pending calls.");

      // 2️⃣ Convert recipient IDs → ObjectId[]
      const recipientObjectIds = (payload?.recipientsIds || [])
        .filter((id: string) => Types.ObjectId.isValid(id))
        .map((id: string) => new Types.ObjectId(id));
      if (!recipientObjectIds.length) {
        return {
          message: "No valid recipient IDs provided.",
          recipients: []
        };
      }


      // 3️⃣ Fetch recipients in IN_PROCESS
      const pendingRecipients = await Recipient.find({
        batchCallId,
        status: BATCH_CALL_PROCESS_STATUS.FAILED,
        _id: { $in: recipientObjectIds }
      });

      if (!pendingRecipients.length) {
        return { message: "No pending recipients found.", recipients: [] };
      }

      console.log(`✔ Found ${pendingRecipients.length} pending recipients`);

      // 4️⃣ Validate date & time
      if (!payload?.date || !payload?.time) {
        throw new Error("Date and Time are required for scheduling");
      }

      // 5️⃣ Create UTC datetime (safe timezone fallback)
      const timezone = existingBatchCall.timezone || "UTC";
      const dateTimeString = `${payload.date.trim()}T${payload.time.trim()}`;

      const utcDateTime = moment
        .tz(dateTimeString, timezone)
        .utc()
        .toDate();

      // 6️⃣ Generate cron expression
      const cronExpression = await this.generateCronExpression(utcDateTime);

      // 7️⃣ Create BatchCallFollowUp
      const followupBatchCall = await BatchCallFollowUps.create({
        batchCallId,
        timezone,
        date: payload.date.trim(),
        time: payload.time.trim(),
        utcDateTime,
        retry: true,
        status: BATCH_CALL_STATUS.NOT_STARTED,
        cronExpression,
        totalRecipient: pendingRecipients.length,
        isArchived: false,
        createdBy: existingBatchCall?.createdBy,
        updatedBy: existingBatchCall?.createdBy,
        companyId: existingBatchCall?.companyId
      });

      console.log("✔ BatchCallFollowUp created:", followupBatchCall._id);

      // 8️⃣ Prepare log entry
      const logEntry = {
        action: "PROCESS_ATTEMPT",
        message: "User attempted to process this recipient",
        attemptedAt: utcDateTime,
        userId: user?.userId,
        cronExpression,
        recipientCount: pendingRecipients.length
      };

      const recipientIds = pendingRecipients.map(r => r._id);

      // 9️⃣ Update recipients (ONE DB call)
      await Recipient.updateMany(
        { _id: { $in: recipientIds } },
        {
          $push: { logs: logEntry },
          $set: {
            status: BATCH_CALL_PROCESS_STATUS.UN_SUCCESS_VALUE,
            errorMessage: "",
            updatedAt: new Date()
          },
          $inc: { maxAttempts: 1 }
        }
      );

      console.log("✔ Recipients updated to PENDING");

      // 🔟 Trigger cron service
      try {
        // await axios.post(
        //   Environment.dynamicCronApis.processPendingCalls,
        //   {
        //     cronExpression,
        //     batchCallId: batchCallId.toString(),
        //     companyId: mappedAgent?.companyId?.toString(),
        //     userId: mappedAgent?.userId?.toString(),
        //     pendingRecipients: recipientIds.map(id => id.toString()),
        //     followupBatchCallId: followupBatchCall._id.toString()
        //   }
        // );

        //console.log("✔ Cron job scheduled");
        let newStatus = existingBatchCall.status;
        if (existingBatchCall.status === BATCH_CALL_STATUS.COMPLETED || existingBatchCall.status === BATCH_CALL_STATUS.FAILED) {
          newStatus = BATCH_CALL_STATUS.IN_PROCESS;
        }
        if (existingBatchCall.status === BATCH_CALL_STATUS.COMPLETED || existingBatchCall.status === BATCH_CALL_STATUS.FAILED) {
          newStatus = BATCH_CALL_STATUS.IN_PROCESS;
        }
        await BatchCall.updateOne({ _id: batchCallId }, {
          $set: {
            status: newStatus
          }
        });
      } catch (cronErr) {
        console.error("❌ Cron scheduling failed:", cronErr);
        throw new Error("Failed to schedule cron job");
      }

      return {
        message: "Pending recipients scheduled successfully.",
        recipients: pendingRecipients
      };

    } catch (err: any) {
      throwError(err);
    }
  }

}




const batchCallService = new BatchCallService();
export { batchCallService, BatchCallService };