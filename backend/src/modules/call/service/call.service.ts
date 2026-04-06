import { Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { Agent } from '../../agent/model/agent.model';

import { Call } from '../../webhook/models/call.model';
import {
  IFilterPayload,
  ICallGroup,
  IGroupedCallResponse,
  ICallInGroup,
  IPhoneDetailPayload,
  IPhoneDetailResponse,
  IPhoneDetailCall,
  IPhoneDetailLeadStatusHistory,
  IPhoneDetailComment,
  ITranscriptMessage,
  IPhoneDetailFollowup
} from '../interface/call.interface';
import { CALL_STATUS, LEAD_STATUS_FOR_SYNC, SMS, SYNC_NOT_ALLOWED_AGENTS } from '../../../config/server-config';
import RetellService from './retall.service';
import { decryptPassword } from '../../users/helper/helper';
import {
  mapStringStatusToNumber,
  mapNumberStatusToString,
  filterCallsByDate,
  extractFirstNSentences
} from '../helper/helper';
import { formatDuration, toTitleCaseWithSpaces } from '../../../common/format-helper';
import { Environment } from '../../../config/environment';
import { User } from '../../users/models/user.model';
import moment from 'moment';
import { BlackList } from '../../black-list/models/black-list.model';
import { Recipient } from '../../batchCall/models/recipient.model';
import { LeadStatusHistory } from '../models/leadStatusHistory.model'; // ✅ Added
import { Comment } from '..//models/comment.model'; // ✅ Added
import { CallLog } from '../../webhook/models/callLogs.model';
import { BatchCallFollowUps } from '../../batchCall/models/batchCallFollowUps.model';
import { rebuildSMSQueue } from '../queue/sms-process-queue';
import { Messages } from '../../message/models/messages.model';

export class CallService {
  public async escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  private getLeadStatusFilterValues(leadStatus: string): any {
    const STATUS_GROUPS: Record<string, string[]> = {
      "Human Action Needed - Task": [
        "Ask Human Call",
        "Human Action Needed - Task",
        "Human Call Needed",
        "Human Review Needed",
        "Escalation",
        "will join session"
      ],
      "Interested - Meeting Booked": [
        "Interested - Meeting Booked",
        "Interested – Meeting Booked"
      ],
      "Interested - Task": [
        "Interested - Task",
        "Interested – Task",
        "Interested - Meeting",
        "Interested Meeting",
        "Interested Task",
        "callback requested",
        "interested but cannot join"
      ],
      "Not Interested": [
        "Not Interested",
        "Not Interested - For Now",
        "Changed Interest",
        "not interested"
      ],
      "No Human Detected": [
        "No Human Detected",
        "Pending"
      ],
      "Already Bought": ["Already Bought"],
      "Do Not Contact": ["Do Not Contact"],
      "Invalid Lead": ["Invalid Lead"],
      "Unclassified": ["Unclassified", "unclassified"]
    };

    let statuses: string[] = [];
    const leadStatusParts = leadStatus.split(',');

    for (const part of leadStatusParts) {
      const trimmedPart = part.trim();
      if (STATUS_GROUPS[trimmedPart]) {
        statuses = statuses.concat(STATUS_GROUPS[trimmedPart]);
      } else if (['Interested - Task', 'Interested Task'].includes(trimmedPart)) {
        statuses.push('Interested - Task', 'Interested Task');
      } else if (['Interested - Meeting', 'Interested Meeting'].includes(trimmedPart)) {
        statuses.push('Interested - Meeting', 'Interested Meeting');
      } else {
        statuses.push(trimmedPart);
      }
    }

    return { $in: [...new Set(statuses)] };
  }

  public async getCallListing(user: any, payload: IFilterPayload): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const filter: any = {};
      const statusCountsFilter: any = {};

      // Company Filter Logic
      const shouldApplyCompanyFilter = !isSuperAdmin || payload?.companyId;
      if (shouldApplyCompanyFilter) {
        const targetCompanyId = isSuperAdmin ? payload.companyId : user?.companyId;
        if (targetCompanyId) {
          const companyObjId =
            targetCompanyId instanceof Types.ObjectId
              ? targetCompanyId
              : new Types.ObjectId(targetCompanyId);

          const companyFilterCondition = [
            { companyId: companyObjId },
            { companyId: { $exists: false } },
            { companyId: null }
          ];

          filter.$or = companyFilterCondition;
          statusCountsFilter.$or = companyFilterCondition;
        }
      }

      let targetUserId = null;
      let targetAgentId = payload?.agentId ? payload.agentId : null;

      if (isSuperAdmin) {
        if (payload?.userId) {
          // SuperAdmin filtering by specific user
          targetUserId = new Types.ObjectId(payload.userId);
        } else if (!payload?.companyId) {
          targetUserId =
            user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
          console.log('SuperAdmin viewing their own calls:', targetUserId);
        }
        // else: SuperAdmin with companyId but no userId - show all calls for that company (no user filter)
      } else if (user?.isAdmin && payload?.userId) {
        targetUserId = new Types.ObjectId(payload.userId);
      } else if (!user?.isAdmin && user?.userId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      } else if (!payload?.companyId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      }

      if (targetUserId) {
        // Merge user filter with existing filters
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { createdBy: targetUserId }];
          delete filter.$or;
        } else {
          filter.createdBy = targetUserId;
        }

        if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, { createdBy: targetUserId }];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.createdBy = targetUserId;
        }
      }
      if (targetAgentId) {
        // Merge user filter with existing filters
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { agentId: targetAgentId }];
          delete filter.$or;
        } else {
          filter.agentId = targetAgentId;
        }

        if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, { agentId: targetAgentId }];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.agentId = targetAgentId;
        }
      }

      //Date Filter
      if (payload.startDate && payload.endDate) {
        const dateFilter = {
          $gte: new Date(payload.startDate),
          $lte: new Date(payload.endDate)
        };
        filter.createdAt = dateFilter;
        statusCountsFilter.createdAt = dateFilter;
      }

      //Status Filter
      if (payload?.status) {
        const statusValue = Number(payload.status);
        // filter.status = statusValue === CALL_STATUS.FAILED
        //   ? { $in: [CALL_STATUS.FAILED, CALL_STATUS.ERROR] }
        //   : statusValue;
      }

      // Search Filter
      if (payload?.search) {
        const escapedSearch = await this.escapeRegex(payload.search.trim());
        const searchRegex = new RegExp(escapedSearch, 'i');
        const isNumber = !isNaN(Number(payload.search.trim()));

        const searchFilter = {
          $or: [
            { clientName: { $regex: searchRegex } },
            { toNumber: { $regex: searchRegex } },
            { fromNumber: { $regex: searchRegex } },
            ...(isNumber ? [{ bmbyId: Number(payload.search.trim()) }] : [])
          ]
        };

        if (filter.$and) {
          filter.$and.push(searchFilter);
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, searchFilter];
          delete filter.$or;
        } else {
          Object.assign(filter, searchFilter);
        }

        if (statusCountsFilter.$and) {
          statusCountsFilter.$and.push(searchFilter);
        } else if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, searchFilter];
          delete statusCountsFilter.$or;
        } else {
          Object.assign(statusCountsFilter, searchFilter);
        }
      }

      //Lead Status Filter
      if (payload?.leadStatus) {
        const leadStatusValues = this.getLeadStatusFilterValues(payload.leadStatus);
        const leadFilter = { leadStatus: leadStatusValues };

        // Merge lead filter
        if (filter.$and) {
          filter.$and.push(leadFilter);
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, leadFilter];
          delete filter.$or;
        } else {
          filter.leadStatus = leadStatusValues;
        }

        if (statusCountsFilter.$and) {
          statusCountsFilter.$and.push(leadFilter);
        } else if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, leadFilter];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.leadStatus = leadStatusValues;
        }
      }

      //Sort Options
      let sortOptions: any = { createdAt: -1 };
      if (payload?.sortBy) {
        const [field, direction] = payload.sortBy.split(' ');
        if (field && direction) {
          sortOptions = { [field]: direction.toLowerCase() === 'asc' ? 1 : -1, _id: 1 };
        }
      }

      // Parallel Data Fetch
      const [ongoingCount, endedCount, failedCount, pendingCount, data, totalCount] =
        await Promise.all([
          Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.ONGOING }),
          Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.ENDED }),
          Call.countDocuments({
            ...statusCountsFilter,
            status: { $in: [CALL_STATUS.FAILED, CALL_STATUS.ERROR] }
          }),
          Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.PENDING }),
          (async () => {
            let query: any = Call.find(filter).select({
              _id: 1,
              callId: 1,
              clientName: 1,
              status: 1,
              direction: 1,
              fromNumber: 1,
              toNumber: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              gender: 1,
              agentId: 1,
              createdAt: 1,
              updatedAt: 1,
              disconnectionReason: 1,
              duration: 1,
              leadStatus: 1,
              callInterestStatus: 1,
              bmbyId: 1,
              syncInBmby: 1,
              availableInBmby: 1,
              callCreatedFrom: 1,
              companyId: 1,
              createdBy: 1
            });

            // Conditionally populate if companyId exists in schema
            if (Call.schema.path('companyId')) {
              query = query.populate('companyId', 'name domain');
            }

            return query
              .sort(sortOptions)
              .skip(Number(payload?.skip) || 0)
              .limit(Number(payload?.limit || 10))
              .lean();
          })(),
          Call.countDocuments(filter)
        ]);

      const statusCounts = {
        ONGOING: ongoingCount,
        ENDED: endedCount + failedCount + pendingCount,
        FAILED: failedCount,
        PENDING: pendingCount,
        ALL: ongoingCount + endedCount + failedCount + pendingCount
      };


      return {
        message: 'Call List is:',
        data,
        statusCounts,
        totalCount,
        isSuperAdmin
      };
    } catch (error: any) {
      console.error('Error in getCallListing:', error);
      return {
        message: 'Failed to retrieve call list: ' + error.message,
        data: [],
        statusCounts: { ONGOING: 0, ENDED: 0, FAILED: 0, PENDING: 0, ALL: 0 },
        totalCount: 0,
        isSuperAdmin: false
      };
    }
  }

  public async getGroupedCallListing(
    user: any,
    payload: IFilterPayload
  ): Promise<IGroupedCallResponse> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const filter: any = {};
      const statusCountsFilter: any = {};

      // Company Filter Logic
      const shouldApplyCompanyFilter = !isSuperAdmin || payload?.companyId;
      if (shouldApplyCompanyFilter) {
        const targetCompanyId = isSuperAdmin ? payload.companyId : user?.companyId;
        if (targetCompanyId) {
          const companyObjId =
            targetCompanyId instanceof Types.ObjectId
              ? targetCompanyId
              : new Types.ObjectId(targetCompanyId);

          const companyFilterCondition = [
            { companyId: companyObjId },
            { companyId: { $exists: false } },
            { companyId: null }
          ];

          filter.$or = companyFilterCondition;
          statusCountsFilter.$or = companyFilterCondition;
        }
      }

      // User & Agent Filter Logic
      let targetUserId = null;
      let targetAgentId = payload?.agentId ? payload.agentId : null;

      if (isSuperAdmin) {
        if (payload?.userId) {
          targetUserId = new Types.ObjectId(payload.userId);
        } else if (!payload?.companyId) {
          targetUserId =
            user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
        }
      } else if (user?.isAdmin && payload?.userId) {
        targetUserId = new Types.ObjectId(payload.userId);
      } else if (!user?.isAdmin && user?.userId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      } else if (!payload?.companyId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      }

      if (targetUserId) {
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { createdBy: targetUserId }];
          delete filter.$or;
        } else {
          filter.createdBy = targetUserId;
        }

        if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, { createdBy: targetUserId }];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.createdBy = targetUserId;
        }
      }

      if (targetAgentId) {
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { agentId: targetAgentId }];
          delete filter.$or;
        } else {
          filter.agentId = targetAgentId;
        }

        if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, { agentId: targetAgentId }];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.agentId = targetAgentId;
        }
      }

      // Date Filter
      if (payload.startDate && payload.endDate) {
        const dateFilter = {
          $gte: new Date(payload.startDate),
          $lte: new Date(payload.endDate)
        };
        filter.createdAt = dateFilter;
        statusCountsFilter.createdAt = dateFilter;
      }

      // Search Filter
      if (payload?.search) {
        const escapedSearch = await this.escapeRegex(payload.search.trim());
        const searchRegex = new RegExp(escapedSearch, 'i');
        const isNumber = !isNaN(Number(payload.search.trim()));

        const searchFilter = {
          $or: [
            { clientName: { $regex: searchRegex } },
            { toNumber: { $regex: searchRegex } },
            { fromNumber: { $regex: searchRegex } },
            ...(isNumber ? [{ bmbyId: Number(payload.search.trim()) }] : [])
          ]
        };

        if (filter.$and) {
          filter.$and.push(searchFilter);
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, searchFilter];
          delete filter.$or;
        } else {
          Object.assign(filter, searchFilter);
        }

        if (statusCountsFilter.$and) {
          statusCountsFilter.$and.push(searchFilter);
        } else if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, searchFilter];
          delete statusCountsFilter.$or;
        } else {
          Object.assign(statusCountsFilter, searchFilter);
        }
      }

      let leadStatusFilter = null;
      if (payload?.leadStatus) {
        const leadStatusValues = this.getLeadStatusFilterValues(payload.leadStatus);
        leadStatusFilter = leadStatusValues;

        // ✅ Apply leadStatus filter ONLY to statusCountsFilter (for accurate counts)
        const leadFilter = { leadStatus: leadStatusValues };

        if (statusCountsFilter.$and) {
          statusCountsFilter.$and.push(leadFilter);
        } else if (statusCountsFilter.$or) {
          statusCountsFilter.$and = [{ $or: statusCountsFilter.$or }, leadFilter];
          delete statusCountsFilter.$or;
        } else {
          statusCountsFilter.leadStatus = leadStatusValues;
        }
      }

      const [ongoingCount, endedCount, failedCount, pendingCount, allCalls] = await Promise.all([
        Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.ONGOING }),
        Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.ENDED }),
        Call.countDocuments({
          ...statusCountsFilter,
          status: { $in: [CALL_STATUS.FAILED, CALL_STATUS.ERROR] }
        }),
        Call.countDocuments({ ...statusCountsFilter, status: CALL_STATUS.PENDING }),
        Call.find(filter)
          .select({
            _id: 1,
            callId: 1,
            clientName: 1,
            status: 1,
            direction: 1,
            fromNumber: 1,
            toNumber: 1,
            firstName: 1,
            lastName: 1,
            createdAt: 1,
            updatedAt: 1,
            disconnectionReason: 1,
            duration: 1,
            leadStatus: 1,
            transcript: 1,
            bmbyId: 1,
            syncInBmby: 1,
            agentId: 1
          })
          .lean()
      ]);

      // Collect unique agent IDs from calls
      const agentIds = [...new Set(allCalls.map((call) => call.agentId).filter(Boolean))];

      // Fetch all agents in one query using agentId field
      const agents = await Agent.find({ agentId: { $in: agentIds } })
        .select('agentId agentName')
        .lean();

      const agentMap = new Map(agents.map((agent) => [agent.agentId, agent.agentName]));

      // Group calls by toNumber (from date-filtered results)
      const groupedByPhone = new Map<string, any[]>();

      for (const call of allCalls) {
        const phoneNumber = call.toNumber || 'unknown';
        if (!groupedByPhone.has(phoneNumber)) {
          groupedByPhone.set(phoneNumber, []);
        }
        groupedByPhone.get(phoneNumber)!.push(call);
      }

      // Get phone numbers for unread comments check
      const phoneNumbers = Array.from(groupedByPhone.keys());

      // ✅ Fetch all comments and calculate unread count with proper user ID
      const activeCompanyId = user?.companyId;

      // Get the actual logged-in user's ID from the token (not targetUserId which might be filtered user)
      const loggedInUserId =
        user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);

      console.log('🔍 Logged-in User ID:', loggedInUserId.toString());
      console.log('🔍 Target User ID (filter):', targetUserId?.toString());
      console.log('🔍 Active Company ID:', activeCompanyId?.toString());
      console.log('🔍 Phone numbers to check:', phoneNumbers);

      let unreadCommentMap = new Map<string, number>();

      try {
        // Fetch all comments for phone numbers in the current company
        const commentsForPhones = await Comment.find({
          phone: { $in: phoneNumbers },
          companyId: activeCompanyId
        })
          .select('phone readBy')
          .lean()
          .exec();

        console.log(
          `✅ Found ${commentsForPhones.length} total comments for ${phoneNumbers.length} phone numbers`
        );

        // Calculate unread count per phone number
        for (const comment of commentsForPhones) {
          const phone = comment.phone;

          // ✅ Check if the LOGGED-IN user's ID is in readBy array
          const isRead = comment.readBy.some(
            (id: any) => id.toString() === loggedInUserId.toString()
          );

          console.log(
            `📝 Comment for ${phone}: readBy=${JSON.stringify(comment.readBy)}, isRead=${isRead}, loggedInUserId=${loggedInUserId.toString()}`
          );

          if (!isRead) {
            unreadCommentMap.set(phone, (unreadCommentMap.get(phone) || 0) + 1);
          }
        }

        console.log('✅ Unread comment counts:', Object.fromEntries(unreadCommentMap));
      } catch (commentError: any) {
        console.error('⚠️ Error fetching unread comments:', commentError.message);
        unreadCommentMap = new Map<string, number>();
      }

      // Process groups
      let groups: ICallGroup[] = [];

      for (const [phoneNumber, calls] of groupedByPhone.entries()) {
        // Sort calls within group by createdAt (newest first)
        calls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const latestCall = calls[0];
        if (leadStatusFilter) {
          const latestLeadStatus = latestCall.leadStatus;
          const matchesFilter =
            typeof leadStatusFilter === 'object' && leadStatusFilter.$in
              ? leadStatusFilter.$in.includes(latestLeadStatus)
              : latestLeadStatus === leadStatusFilter;

          if (!matchesFilter) {
            continue;
          }
        }

        // If status filter is "ended", only include groups where ALL calls are ended
        if (payload?.status === CALL_STATUS.ENDED) {
          const allEnded = calls.every((call) => call.status === CALL_STATUS.ENDED);
          if (!allEnded) continue;
        }

        const customerName = latestCall.clientName || latestCall.firstName || 'Unknown';

        // Get agent name from the map using agentId
        const agentName = latestCall.agentId
          ? agentMap.get(latestCall.agentId) || 'Unknown Agent'
          : 'Unknown Agent';

        groups.push({
          phoneNumber,
          totalCalls: calls.length,
          latestCallDate: latestCall.createdAt,
          customerName,
          agentName,
          bmbyId: latestCall.bmbyId?.toString(),
          syncInBmby: latestCall.syncInBmby || false,
          status: mapNumberStatusToString(latestCall.status) || 'unknown',
          leadStatus: latestCall.leadStatus || 'Unclassified',
          disconnectionReason: latestCall.disconnectionReason,
          duration: formatDuration(latestCall.duration || 0),
          durationInMs: latestCall.duration || 0,
          unreadComments: unreadCommentMap.get(phoneNumber) || 0
        });
      }

      // ✅ Parse sorting parameters - handle "createdAt desc" format
      let sortBy = payload?.sortBy || 'customerName';
      let sortOrder = payload?.sortOrder || 'asc';

      // ✅ FIX: Parse sortBy if it contains space (like "createdAt desc")
      if (sortBy && sortBy.includes(' ')) {
        const parts = sortBy.split(' ');
        sortBy = parts[0];
        if (parts[1] && ['asc', 'desc'].includes(parts[1].toLowerCase())) {
          sortOrder = parts[1].toLowerCase();
        }
      }

      console.log(`🔄 Sorting by: ${sortBy}, order: ${sortOrder}`);

      // ✅ Apply sorting based on parsed parameters
      switch (sortBy) {
        case 'createdAt':
        case 'latestCallDate':
          groups.sort((a, b) => {
            const dateA = new Date(a.latestCallDate).getTime();
            const dateB = new Date(b.latestCallDate).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          });
          break;

        case 'duration':
          groups.sort((a, b) => {
            const durationA = a.durationInMs || 0;
            const durationB = b.durationInMs || 0;
            return sortOrder === 'asc' ? durationA - durationB : durationB - durationA;
          });
          break;

        case 'totalCalls':
          groups.sort((a, b) => {
            return sortOrder === 'asc' ? a.totalCalls - b.totalCalls : b.totalCalls - a.totalCalls;
          });
          break;

        case 'customerName':
        case 'leadStatus':
          groups.sort((a, b) => {
            const leadStatusA = (a.leadStatus || '').toLowerCase();
            const leadStatusB = (b.leadStatus || '').toLowerCase();
            return sortOrder === 'asc' ? leadStatusA.localeCompare(leadStatusB) : leadStatusB.localeCompare(leadStatusA);
          });
          break;
        default:
          groups.sort((a, b) => {
            const nameA = (a.customerName || '').toLowerCase();
            const nameB = (b.customerName || '').toLowerCase();
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
          });
          break;
      }

      // Apply pagination to groups
      const skip = Number(payload?.skip) || 0;
      const limit = Number(payload?.limit) || 10;
      const totalGroups = groups.length;
      const paginatedGroups = groups.slice(skip, skip + limit);

      // Calculate total number of calls across all groups
      const totalCallCount = allCalls.length;

      return {
        data: paginatedGroups,
        totalCount: totalGroups
      };
    } catch (error: any) {
      console.error('Error in getGroupedCallListing:', error);
      throw error;
    }
  }

  // ✅ COMPLETE: getPhoneDetail with CallLogs transcript + Followup details
  public async getPhoneDetail(
    user: any,
    payload: IPhoneDetailPayload,
    startDate?: string,
    endDate?: string
  ): Promise<IPhoneDetailResponse> {
    try {
      let { phoneNumber, companyId, targetUserId, skip, limit } = payload;

      console.log('📥 Service received dates:', { startDate, endDate }); // ✅ Debug log

      if (!phoneNumber) {
        return {
          success: false,
          data: {
            phoneNumber: '',
            customerName: '',
            totalAttempts: 0,
            calls: [],
            comments: [],
            leadStatusHistory: []
          },
          message: 'Phone number is required'
        };
      }

      phoneNumber = phoneNumber.trim();
      const pageSkip = skip || 0;
      const pageLimit = limit ? Math.min(limit, 100) : 50;

      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const filter: any = { toNumber: phoneNumber };

      const shouldApplyCompanyFilter = !isSuperAdmin || companyId;
      if (shouldApplyCompanyFilter) {
        const targetCompanyId = isSuperAdmin ? companyId : user?.companyId;
        if (targetCompanyId) {
          const companyObjId =
            targetCompanyId instanceof Types.ObjectId
              ? targetCompanyId
              : new Types.ObjectId(targetCompanyId);

          const companyFilterCondition = [
            { companyId: companyObjId },
            { companyId: { $exists: false } },
            { companyId: null }
          ];

          filter.$and = [{ toNumber: phoneNumber }, { $or: companyFilterCondition }];
          delete filter.toNumber;
        }
      }

      let finalUserId = null;

      if (isSuperAdmin) {
        if (targetUserId) {
          finalUserId = new Types.ObjectId(targetUserId);
        } else if (!companyId) {
          finalUserId =
            user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
        }
      } else if (user?.isAdmin && targetUserId) {
        finalUserId = new Types.ObjectId(targetUserId);
      } else if (!user?.isAdmin && user?.userId) {
        finalUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      } else if (!companyId) {
        finalUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      }

      if (finalUserId) {
        if (filter.$and) {
          filter.$and.push({ createdBy: finalUserId });
        } else {
          filter.createdBy = finalUserId;
        }
      }

      // ✅ Add date range filter if provided
      if (startDate && endDate) {
        const dateFilter = {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };

        if (filter.$and) {
          filter.$and.push(dateFilter);
        } else {
          Object.assign(filter, dateFilter);
        }

        console.log('✅ Date range applied:', { startDate, endDate });
      } else {
        console.log('⚠️ No date range provided');
      }

      console.log('Phone Detail Filter:', JSON.stringify(filter, null, 2));

      const activeCompanyId = user.companyId;
      console.log('✅ Using companyId for comments/history:', activeCompanyId);

      const [calls, totalCount, comments, leadStatusHistory] = await Promise.all([
        Call.find(filter)
          .select({
            _id: 1,
            callId: 1,
            clientName: 1,
            status: 1,
            direction: 1,
            fromNumber: 1,
            toNumber: 1,
            agentId: 1,
            createdAt: 1,
            startTimestamp: 1,
            endTimestamp: 1,
            disconnectionReason: 1,
            leadStatus: 1,
            recordingUrl: 1,
            bmbyId: 1,
            syncInBmby: 1,
            duration: 1
          })
          .sort({ createdAt: -1 })
          .skip(pageSkip)
          .limit(pageLimit)
          .lean()
          .exec(),
        Call.countDocuments(filter),
        Comment.find({ phone: phoneNumber, companyId: activeCompanyId })
          .populate('createdBy', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
        LeadStatusHistory.find({ phoneNumber: phoneNumber, companyId: activeCompanyId })
          .populate('createdBy', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .lean()
          .exec()
      ]);

      const formattedComments: IPhoneDetailComment[] = (comments || []).map((comment: any) => ({
        _id: comment._id?.toString(),
        comment: comment.comment,
        createdBy: {
          _id: comment.createdBy?._id?.toString(),
          name: comment.createdBy
            ? `${comment.createdBy.firstName || ''} ${comment.createdBy.lastName || ''}`.trim()
            : 'Unknown',
          email: comment.createdBy?.email
        },
        isEdited: comment.isEdited || false,
        readBy: comment.readBy || [],
        callId: comment.callId?.toString(),
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      }));

      const formattedHistory: IPhoneDetailLeadStatusHistory[] = (leadStatusHistory || []).map(
        (history: any) => ({
          _id: history._id?.toString(),
          leadStatus: history.leadStatus,
          callId: history.callId,
          createdBy: {
            _id: history.createdBy?._id?.toString(),
            name: history.createdBy
              ? `${history.createdBy.firstName || ''} ${history.createdBy.lastName || ''}`.trim()
              : 'System',
            email: history.createdBy?.email
          },
          createdByType: history.createdByType,
          changeReason: history.changeReason,
          createdAt: history.createdAt
        })
      );

      // ✅ Get Followup Details (Earliest Scheduled)
      let followupDetail: IPhoneDetailFollowup | undefined = undefined;

      try {
        const recipients = await Recipient.find({
          number: phoneNumber,
          companyId: activeCompanyId,
          status: 2
        })
          .select('batchCallId')
          .lean()
          .exec();

        console.log(`Found ${recipients?.length || 0} completed recipients for ${phoneNumber}`);

        if (recipients && recipients.length > 0) {
          const batchCallIds = [...new Set(recipients.map((r) => r.batchCallId).filter(Boolean))];
          console.log(`Checking followups for batchCallIds:`, batchCallIds);

          if (batchCallIds.length > 0) {
            const followup: any = await BatchCallFollowUps.findOne({
              batchCallId: { $in: batchCallIds },
              status: 3
            })
              .select({
                _id: 1,
                batchCallId: 1,
                followupNumber: 1,
                date: 1,
                time: 1,
                timezone: 1,
                utcDateTime: 1,
                status: 1,
                totalRecipient: 1,
                processedRecipient: 1,
                createdAt: 1
              })
              .sort({ utcDateTime: 1 })
              .lean()
              .exec();

            if (followup) {
              followupDetail = {
                _id: followup._id?.toString(),
                batchCallId: followup.batchCallId?.toString(),
                followupNumber: followup.followupNumber,
                date: followup.date,
                time: followup.time,
                timezone: followup.timezone,
                utcDateTime: followup.utcDateTime,
                status: followup.status,
                totalRecipient: followup.totalRecipient,
                processedRecipient: followup.processedRecipient,
                createdAt: followup.createdAt
              };
              console.log(`✅ Found scheduled followup:`, {
                date: followup.date,
                time: followup.time,
                utcDateTime: followup.utcDateTime
              });
            } else {
              console.log('⚠️ No scheduled followup found (status: 3)');
            }
          }
        }
      } catch (followupError: any) {
        console.error('⚠️ Error fetching followup details:', followupError.message);
      }

      if (!calls || calls.length === 0) {
        return {
          success: true,
          data: {
            phoneNumber,
            customerName: 'Unknown',
            totalAttempts: 0,
            calls: [],
            comments: formattedComments,
            leadStatusHistory: formattedHistory,
            followup: followupDetail
          },
          message: 'No calls found for this phone number'
        };
      }

      const agentIds = [...new Set(calls.map((call) => call.agentId).filter(Boolean))];
      const agents = await Agent.find({ agentId: { $in: agentIds } })
        .select({ agentId: 1, agentName: 1 })
        .lean()
        .exec();

      const agentMap = new Map(agents.map((agent) => [agent.agentId, agent.agentName]));

      const latestCall: any = calls[0];
      const customerName = latestCall.clientName || 'Unknown';
      const bmbyId = latestCall.bmbyId?.toString() || undefined;

      let syncStatus = 'Not synced';
      if (latestCall.syncInBmby === true) {
        syncStatus = 'Synced successfully';
      } else if (latestCall.syncInBmby === false) {
        syncStatus = 'Failed to sync';
      }

      const callIds = calls.map((call) => call.callId).filter(Boolean);

      const callLogs = await CallLog.find({
        'raw_data.call.call_id': { $in: callIds },
        'raw_data.event': { $in: ['call_analyzed', 'call_ended'] }
      })
        .select({
          'raw_data.call.call_id': 1,
          'raw_data.call.transcript_object': 1,
          'raw_data.call.call_analysis.call_summary': 1
        })
        .lean()
        .exec();

      const transcriptMap = new Map<string, ITranscriptMessage[]>();
      const summaryMap = new Map<string, string>();
      for (const log of callLogs) {
        const callId = log.raw_data?.call?.call_id;
        const transcriptObject = log.raw_data?.call?.transcript_object;
        const callSummary = log.raw_data?.call?.call_analysis?.call_summary;
        if (callId && Array.isArray(transcriptObject)) {
          transcriptMap.set(callId, transcriptObject);
        }

        if (callId && callSummary) {
          summaryMap.set(callId, callSummary);
        }
      }



      const safeToTitleCase = (input: any): string => {
        if (!input) return '';
        const str =
          typeof input === 'string'
            ? input
            : typeof input === 'object' && input.value
              ? String(input.value)
              : String(input);
        return str
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim()
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      const formattedCalls: IPhoneDetailCall[] = calls.map((call: any) => {
        const durationInSeconds =
          call.duration ||
          (call.endTimestamp && call.startTimestamp
            ? Math.floor((call.endTimestamp - call.startTimestamp) / 1000)
            : 0);

        const disconnectionReasonStr: string | undefined = call.disconnectionReason
          ? safeToTitleCase(call.disconnectionReason)
          : undefined;

        let directionStr: string | undefined = undefined;
        if (call.direction !== undefined && call.direction !== null) {
          if (typeof call.direction === 'string') {
            directionStr = call.direction;
          } else if (typeof call.direction === 'number') {
            directionStr = call.direction === 1 ? 'outbound' : 'inbound';
          }
        }

        const transcript = transcriptMap.get(call.callId) || [];
        const summary = summaryMap.get(call.callId) || undefined;

        return {
          callId: call.callId || '',
          _id: call._id?.toString() || '',
          date: moment(call.createdAt).format('MMMM DD, YYYY [at] h:mm A'),
          duration: formatDuration(durationInSeconds),
          status: mapNumberStatusToString(call.status) || 'unknown',
          leadStatus: call.leadStatus || 'Unclassified',
          disconnectionReason: disconnectionReasonStr,
          direction: directionStr,
          agentName: call.agentId ? agentMap.get(call.agentId) : undefined,
          agentId: call.agentId || undefined,
          recordingUrl: call.recordingUrl || undefined,
          transcript: transcript,
          summery: summary,
          createdAt: call.createdAt,
          startTimestamp: call.startTimestamp || undefined,
          endTimestamp: call.endTimestamp || undefined
        };
      });

      return {
        success: true,
        data: {
          phoneNumber,
          customerName,
          totalAttempts: totalCount,
          bmbyId,
          syncStatus,
          calls: formattedCalls,
          comments: formattedComments,
          leadStatusHistory: formattedHistory,
          followup: followupDetail
        }
      };
    } catch (error: any) {
      console.error('Error in getPhoneDetail:', error);
      return {
        success: false,
        data: {
          phoneNumber: payload.phoneNumber || '',
          customerName: '',
          totalAttempts: 0,
          calls: [],
          comments: [],
          leadStatusHistory: []
        },
        message: 'Failed to fetch phone details: ' + error.message
      };
    }
  }

  public async detail(user: any, id: string) {
    const result = await Call.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(id)
        }
      },
      {
        $lookup: {
          from: 'CallLogs',
          let: { callId: '$callId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$callId', '$raw_data.call.call_id'] },
                    { $in: ['$raw_data.event', ['call_analyzed', 'call_ended']] }
                  ]
                }
              }
            },
            {
              $project: {
                callSummary: '$raw_data.call.call_analysis.call_summary',
                transcriptObject: '$raw_data.call.transcript_object',
                callCost: {
                  totalDurationUnitPrice: '$raw_data.call.call_cost.total_duration_unit_price',
                  productCosts: '$raw_data.call.call_cost.product_costs',
                  combinedCost: '$raw_data.call.call_cost.combined_cost',
                  totalDurationSeconds: '$raw_data.call.call_cost.total_duration_seconds'
                }
              }
            }
          ],
          as: 'callAnalysisData'
        }
      },
      {
        $project: {
          callId: 1,
          status: 1,
          clientName: 1,
          direction: 1,
          fromNumber: 1,
          toNumber: 1,
          email: 1,
          firstName: 1,
          lastName: 1,
          gender: 1,
          bmbyId: 1,
          syncInBmby: 1,
          availableInBmby: 1,
          agentId: 1,
          disconnectionReason: 1,
          duration: 1,
          recordingUrl: 1,
          createdAt: 1,
          updatedAt: 1,
          leadStatus: 1,
          callSummary: { $arrayElemAt: ['$callAnalysisData.callSummary', 0] },
          transcriptObject: {
            $ifNull: [{ $arrayElemAt: ['$callAnalysisData.transcriptObject', 0] }, []]
          },
          callCost: { $arrayElemAt: ['$callAnalysisData.callCost', 0] }
        }
      }
    ]);

    return {
      message: 'Call Detail is:',
      data: result[0] || null
    };
  }

  public async getCallListingFromRetell(user: any, payload: IFilterPayload): Promise<any> {
    const { startDate, endDate, skip = 0, limit = 10, sortBy, status } = payload;
    try {
      const apiPayload = {
        startDate,
        endDate,
        skip: Number(skip),
        limit: Number(limit),
        sortBy,
        status: Number(status)
      };
      if (status) {
        const stringStatus = mapNumberStatusToString(status);
        if (stringStatus === null) {
          return {
            message: 'Invalid status',
            data: [],
            totalCount: 0,
            totalFilteredCount: 0,
            statusCounts: { ONGOING: 0, ENDED: 0, FAILED: 0, PENDING: 0, ALL: 0 }
          };
        }
        apiPayload.status = stringStatus as any;
      }

      const allCallsResponse = await RetellService.callList({
        startDate,
        endDate,
        sortBy,
        status: Number(status)
      });
      let allCalls = allCallsResponse?.calls || allCallsResponse?.data || allCallsResponse || [];

      allCalls = allCalls.map((call: any) => ({
        callId: call.call_id,
        agentId: call.agent_id,
        agentName: 'cold call agent',
        callStatus: call.call_status,
        status: call.call_status ? mapStringStatusToNumber(call.call_status) : null,
        startTimestamp: call.start_timestamp,
        endTimestamp: call.end_timestamp,
        durationMs: call.duration_ms,
        combinedCost: call.call_cost?.combined_cost || 0,
        createdAt: call.start_timestamp
      }));

      if (startDate && endDate) {
        allCalls = filterCallsByDate(allCalls, startDate, endDate);
      }

      const totalFilteredCount = allCalls.length;

      const statusCounts: Record<string, number> = {
        ONGOING: 0,
        ENDED: 0,
        FAILED: 0,
        PENDING: 0
      };

      allCalls.forEach((call: any) => {
        const statusName = mapNumberStatusToString(call.status);
        if (statusName) {
          const statusKey = statusName.toUpperCase();
          if (statusCounts.hasOwnProperty(statusKey)) {
            statusCounts[statusKey]++;
          }
        }
      });

      statusCounts.ALL = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      if (status !== undefined && status !== null) {
        allCalls = allCalls.filter((call: any) => call.status === status);
      }

      const totalCount = allCalls.length;

      if (sortBy) {
        const sort = sortBy.split(' ');
        if (sort.length > 1 && sort[0] === 'startTimestamp' && sort[1].toLowerCase() === 'desc') {
          allCalls.sort((a: any, b: any) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
        } else {
          allCalls.sort((a: any, b: any) => (a.startTimestamp || 0) - (b.startTimestamp || 0));
        }
      } else {
        allCalls.sort((a: any, b: any) => (a.startTimestamp || 0) - (b.startTimestamp || 0));
      }

      const data = allCalls.slice(skip, skip + limit);

      return {
        message: 'Call List is:',
        data,
        totalCount,
        totalFilteredCount,
        statusCounts
      };
    } catch (error: any) {
      return {
        message: 'Failed to retrieve call list :' + error.message,
        data: [],
        totalCount: 0,
        totalFilteredCount: 0,
        statusCounts: { ONGOING: 0, ENDED: 0, FAILED: 0, PENDING: 0, ALL: 0 }
      };
    }
  }

  public async exportCallListing(user: any, payload: IFilterPayload): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const filter: any = {};

      // Company Filter Logic
      const shouldApplyCompanyFilter = !isSuperAdmin || payload?.companyId;
      if (shouldApplyCompanyFilter) {
        const targetCompanyId = isSuperAdmin ? payload.companyId : user?.companyId;
        if (targetCompanyId) {
          const companyObjId =
            targetCompanyId instanceof Types.ObjectId
              ? targetCompanyId
              : new Types.ObjectId(targetCompanyId);

          const companyFilterCondition = [
            { companyId: companyObjId },
            { companyId: { $exists: false } },
            { companyId: null }
          ];

          filter.$or = companyFilterCondition;
        }
      }

      let targetUserId = null;
      if (isSuperAdmin) {
        if (payload?.userId) {
          targetUserId = new Types.ObjectId(payload.userId);
        } else if (!payload?.companyId) {
          targetUserId =
            user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
        }
      } else if (user?.isAdmin && payload?.userId) {
        targetUserId = new Types.ObjectId(payload.userId);
      } else if (!user?.isAdmin && user?.userId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      } else if (!payload?.companyId) {
        targetUserId =
          user.userId instanceof Types.ObjectId ? user.userId : new Types.ObjectId(user.userId);
      }

      if (targetUserId) {
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { createdBy: targetUserId }];
          delete filter.$or;
        } else {
          filter.createdBy = targetUserId;
        }
      }

      if (payload?.agentId) {
        if (filter.$and) {
          filter.$and.push({ agentId: payload.agentId });
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { agentId: payload.agentId }];
          delete filter.$or;
        } else {
          filter.agentId = payload.agentId;
        }
      }

      // Date Filter
      if (payload.startDate && payload.endDate) {
        filter.createdAt = {
          $gte: new Date(payload.startDate),
          $lte: new Date(payload.endDate)
        };
      }

      // Search Filter
      if (payload?.search) {
        const escapedSearch = await this.escapeRegex(payload.search.trim());
        const searchRegex = new RegExp(escapedSearch, 'i');
        const isNumber = !isNaN(Number(payload.search.trim()));

        const searchFilter = {
          $or: [
            { clientName: { $regex: searchRegex } },
            { toNumber: { $regex: searchRegex } },
            { fromNumber: { $regex: searchRegex } },
            ...(isNumber ? [{ bmbyId: Number(payload.search.trim()) }] : [])
          ]
        };

        if (filter.$and) {
          filter.$and.push(searchFilter);
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, searchFilter];
          delete filter.$or;
        } else {
          Object.assign(filter, searchFilter);
        }
      }

      // 1. Fetch all calls matching base filters
      const allCalls = await Call.find(filter)
        .select({
          _id: 1,
          callId: 1,
          clientName: 1,
          status: 1,
          direction: 1,
          fromNumber: 1,
          toNumber: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          gender: 1,
          createdAt: 1,
          updatedAt: 1,
          disconnectionReason: 1,
          duration: 1,
          leadStatus: 1,
          transcript: 1,
          bmbyId: 1,
          syncInBmby: 1,
          agentId: 1
        })
        .sort({ createdAt: -1 })
        .lean();

      // 2. Group by phone
      const groupedByPhone = new Map<string, any[]>();
      for (const call of allCalls) {
        const phoneNumber = call.toNumber || 'unknown';
        if (!groupedByPhone.has(phoneNumber)) {
          groupedByPhone.set(phoneNumber, []);
        }
        groupedByPhone.get(phoneNumber)!.push(call);
      }

      // 3. Resolve lead status filter
      let leadStatusFilter = null;
      if (payload?.leadStatus) {
        leadStatusFilter = this.getLeadStatusFilterValues(payload.leadStatus);
      }

      // 4. Process groups and filter by latest lead status
      let groups: any[] = [];
      const callIdsToLookup: string[] = [];

      for (const [phoneNumber, calls] of groupedByPhone.entries()) {
        const latestCall = calls[0];
        
        if (leadStatusFilter && leadStatusFilter.$in) {
          if (!leadStatusFilter.$in.includes(latestCall.leadStatus)) {
            continue;
          }
        }

        // Include grouping info
        const groupData = {
          ...latestCall,
          totalAttempts: calls.length
        };
        groups.push(groupData);
        if (latestCall.callId) {
          callIdsToLookup.push(latestCall.callId);
        }
      }

      // 5. Lookup summaries and transcripts from CallLogs for the latest calls in each group
      const callLogs = await CallLog.find({
        'raw_data.call.call_id': { $in: callIdsToLookup },
        'raw_data.event': { $in: ['call_analyzed', 'call_ended'] }
      })
      .select('raw_data.call.call_id raw_data.call.call_analysis.call_summary raw_data.call.transcript')
      .lean();

      const callLogMap = new Map();
      for (const log of callLogs) {
        const callId = log.raw_data?.call?.call_id;
        if (callId && !callLogMap.has(callId)) {
          callLogMap.set(callId, {
            summary: log.raw_data?.call?.call_analysis?.call_summary || '',
            transcript: log.raw_data?.call?.transcript || ''
          });
        }
      }

      // Merge logs with groups
      const result = groups.map(group => {
        const logs = callLogMap.get(group.callId) || { summary: '', transcript: '' };
        return {
          ...group,
          callSummary: logs.summary,
          transcript: logs.transcript || group.transcript || ''
        };
      });

      // 6. Sort results
      let sortField = 'createdAt';
      let sortOrder = -1;
      if (payload?.sortBy) {
        const sort = payload.sortBy.split(' ');
        if (sort.length > 1) {
          sortField = sort[0];
          sortOrder = sort[1].toLowerCase() === 'asc' ? 1 : -1;
        }
      }

      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        
        if (sortField === 'createdAt') {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }

        if (valA < valB) return -1 * sortOrder;
        if (valA > valB) return 1 * sortOrder;
        return 0;
      });

      const transformed = result.map((row) => {
        const data = {
          Date: payload?.timezone
            ? moment.utc(row.createdAt).tz(payload.timezone).format('DD-MM-YYYY HH:mm:ss')
            : moment.utc(row.createdAt).format('DD-MM-YYYY HH:mm:ss'),
          Client: row.clientName || '',
          'Call Type': row.direction === 1 ? 'outbound' : 'inbound',
          'First Name': row?.firstName,
          'Last Name': row?.lastName || '',
          'BMBY ID': row.bmbyId || '',
          'Phone Number': row.toNumber,
          Email: row.email || '',
          Gender: row.gender || '',
          'Call Status': mapNumberStatusToString(row.status),
          'Lead Status': row.leadStatus,
          'Call Duration': formatDuration(row.duration),
          'Disconnection Reason': row.disconnectionReason || '',
          Attempts: row.totalAttempts || 1,
          Summary: row.callSummary || '',
          Transcript: row.transcript || ''
        };
        return toTitleCaseWithSpaces(data);
      });

      const worksheet = XLSX.utils.json_to_sheet(transformed);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Calls');

      // Generate buffer
      const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return xlsxBuffer;
    } catch (error: any) {
      return { message: 'Failed to export call list: ' + error.message, data: [] };
    }
  }

  public async updateCallLeadStatus(user: any, payload: any): Promise<any> {
    try {
      const { callId, leadStatus } = payload;

      const existingCall: any = await Call.findOne({ callId: callId });
      const callUser: any = await User.findOne({ _id: existingCall?.createdBy });

      // Check if call exists
      if (!existingCall) {
        return {
          message: 'Call not found with the provided callId',
          data: null,
          success: false
        };
      }

      if (!existingCall.callInterestStatus) {
        return {
          message: 'Cannot update call lead status as current status is pending',
          data: null,
          success: false
        };
      }

      if (existingCall.leadStatus === leadStatus) {
        return {
          message: 'Lead status is already set to ' + leadStatus,
          data: {
            _id: existingCall._id,
            callId: existingCall.callId,
            leadStatus: existingCall.leadStatus
          },
          success: true
        };
      }

      const leadStatusId = this.getLeadStatusId(leadStatus);

      let syncResult = false;

      if (leadStatusId && existingCall?.bmbyId && LEAD_STATUS_FOR_SYNC.includes(leadStatus)) {
        if (!SYNC_NOT_ALLOWED_AGENTS.includes(existingCall.agentId)) {
          this.updateLead(existingCall?.bmbyId, leadStatusId, callUser);
          syncResult = true;
        }
        function getAgentSMS(agentId: string) {
          const config = SMS.agents.find((a: any) =>
            a.agentIds.includes(agentId)
          );

          return config ? config.message : null;
        }

        const smsMessage = getAgentSMS(existingCall.agentId);

        console.log(`SMS message for agent ${existingCall.agentId}:`, smsMessage);
        console.log('Lead status:', existingCall);

        //Send SMS to the client if lead status is Interested - Task or Interested - Meeting
        if (smsMessage) {
          if (!existingCall?.companyId) {
            // WE GET COMPANY ID FORM USER RECORD BY existingCall.createdBy
            let callUser = await User.findOne({ _id: existingCall.createdBy });
            if (callUser?.companyId) {
              existingCall.companyId = callUser.companyId;
            }
          }
          let messageDoc: any;
          try {
            let messageObj = {
              companyId: existingCall?.companyId,
              conversationId: existingCall.callId,
              status: 'sent',
              fromNumber: existingCall.fromNumber,
              toNumber: existingCall.toNumber,
              senderId: existingCall.createdBy,
              createdBy: existingCall.createdBy,
              updatedBy: existingCall.createdBy,
              senderType: 'user',
              clientId: existingCall?.bmbyId,
              receiverType: 'contact',
              message: smsMessage
            };


            messageDoc = await Messages.create(messageObj);


            const messageId = messageDoc._id.toString();

            console.log('Message document created with ID:', messageId);

            await rebuildSMSQueue.add(
              {
                id: messageId,
                message: smsMessage,
                toNumber: existingCall.toNumber,
                fromNumber: existingCall.fromNumber
              },
              { jobId: messageId + '_sms_process', removeOnComplete: true }
            );

          } catch (err: any) {
            console.error('❌ Error creating message:', err);
            throw err;
          }


        }
      }

      if (leadStatus === 'Do Not Contact') {
        await this.addToBlackList(existingCall, callUser);
        if (existingCall?.batchCallId && existingCall?.toNumber) {
          await Recipient.updateOne(
            {
              batchCallId: new Types.ObjectId(existingCall.batchCallId),
              number: existingCall.toNumber
            },
            {
              $set: { status: 4 }
            }
          );
        }
      }

      // Find and update the call by callId
      const updatedCall = await Call.findOneAndUpdate(
        { callId: callId },
        {
          leadStatus: leadStatus,
          updatedAt: new Date(),
          syncInBmby: syncResult
        },
        {
          new: true
        }
      ).select({
        _id: 1,
        callId: 1,
        leadStatus: 1,
        toNumber: 1
      });

      if (!updatedCall) {
        return {
          message: 'Failed to update call',
          data: null,
          success: false
        };
      }

      try {
        await LeadStatusHistory.create({
          phoneNumber: updatedCall.toNumber || existingCall.toNumber,
          companyId: user.companyId,
          leadStatus: leadStatus,
          callId: callId,
          createdBy: user.userId,
          createdByType: 'manual',
          changeReason: `Status changed from "${existingCall.leadStatus || 'Unclassified'}" to "${leadStatus}"`
        });

        console.log(`✅ Lead status history created for call ${callId}`);
      } catch (historyError: any) {
        console.error('⚠️ Failed to create lead status history:', historyError.message);
      }



      return {
        message: 'Call lead status updated successfully',
        data: {
          _id: updatedCall._id,
          callId: updatedCall.callId,
          leadStatus: updatedCall.leadStatus
        },
        success: true
      };
    } catch (error: any) {
      return {
        message: 'Failed to update call lead status: ' + error.message,
        data: null,
        success: false
      };
    }
  }

  // ✅ NEW HELPER METHOD TO ADD TO BLACKLIST
  private async addToBlackList(call: any, callUser: any): Promise<void> {
    try {
      // Get companyId from user
      const companyId = callUser?.companyId;

      if (!companyId) {
        console.warn(`Cannot add to blacklist - no companyId found for user ${call.createdBy}`);
        return;
      }

      if (!call.toNumber) {
        console.warn(`Cannot add to blacklist - no toNumber in call ${call.callId}`);
        return;
      }

      // Check if already blacklisted
      const existing = await BlackList.findOne({
        toNumber: call.toNumber,
        companyId: companyId,
        isArchived: false
      });

      if (existing) {
        console.log(`Number ${call.toNumber} already in blacklist for company ${companyId}`);
        return;
      }
      // Create blacklist entry
      const blackListEntry = {
        toNumber: call.toNumber,
        companyId: companyId,
        createdBy: call.createdBy,
        clientName: call.clientName || 'Unknown',
        bmbyId: call.bmbyId?.toString() || null,
        email: call.email || null,
        reason: 'Do Not Contact',
        callId: call.callId,
        isArchived: false
      };

      await BlackList.create(blackListEntry);

      console.log(
        `✅ Added ${call.toNumber} to blacklist for company ${companyId} (Call: ${call.callId})`
      );
    } catch (error: any) {
      // Handle duplicate key error gracefully
      if (error.code === 11000) {
        console.log(`Number ${call.toNumber} already in blacklist (duplicate key)`);
      } else {
        console.error('Error adding to blacklist:', error);
        // Don't throw error - we don't want to fail the lead status update
      }
    }
  }

  public async updateLead(clientId: number, leadStatusId: any, userRecord: any) {

    const BMBY_SOAP_URL = 'https://www.bmby.com/WebServices/srv/v3/';
    const SOAP_HEADERS = {
      'Content-Type': 'text/xml; charset=utf-8'
    } as const;

    const soapEnvelope = this.createUpdateLeadSoapEnvelope(leadStatusId, clientId, userRecord);
    try {
      const response = await fetch(BMBY_SOAP_URL, {
        method: 'POST',
        headers: {
          ...SOAP_HEADERS,
          SOAPAction: 'http://www.bmby.com/WebServices/srv/v3/Insert'
        },
        body: soapEnvelope
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.text();
      console.log('SOAP Insert Lead Response:', result);
      return result;
    } catch (error: any) {
      console.error('SOAP Insert Lead Error:', error.message);
      throw error;
    }
  }

  createUpdateLeadSoapEnvelope(leadStatusId: any, clientId: any, userRecord: any): string {
    let formattedData: any = {
      project_id: { value: Environment.bmbyCredentials.projectId },
      user_id: { value: userRecord?.bmbyUserId || Environment.bmbyCredentials.userId },
      client_id: { value: clientId },
      lead: { value: 1 },
      update: { value: 1 }
    };

    formattedData.dynvars = {
      value: [
        {
          title_id: 24559,
          type: 'Combo',
          title: 'Lead Status',
          module_id: 3,
          value: leadStatusId
        }
      ]
    };
    const userName = Environment.bmbyCredentials.username;
    const userPassword = Environment.bmbyCredentials.password;
    const projectId = userRecord?.bmbyProjectId || Environment.bmbyCredentials.projectId;
    return `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                    xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                    xmlns:v3="http://www.bmby.com/WebServices/srv/v3/">
      <soapenv:Header/>
      <soapenv:Body>
          <v3:Insert soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
              <Parameters xsi:type="v3:GetAllInput">
                  <Login xsi:type="xsd:string">${userName}</Login>
                  <Password xsi:type="xsd:string">${userPassword}</Password>
                  <ProjectID xsi:type="xsd:int">${projectId}</ProjectID>
                  <UniqID xsi:type="xsd:int"></UniqID>
                  <TaskID xsi:type="xsd:int"></TaskID>
                  <ClientID xsi:type="xsd:int"></ClientID>
                  <OwnerID xsi:type="xsd:int"></OwnerID>
                  <ContractID xsi:type="xsd:int"></ContractID>
                  <Dynamic xsi:type="xsd:int"></Dynamic>
                  <Limit xsi:type="xsd:int"></Limit>
                  <Offset xsi:type="xsd:int"></Offset>
                  <OrderDesc xsi:type="xsd:int"></OrderDesc>
                  <FromDate xsi:type="xsd:string"></FromDate>
                  <ToDate xsi:type="xsd:string"></ToDate>
                  <Type xsi:type="soapenc:Array" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"></Type>
                  <TypeString xsi:type="xsd:string"></TypeString>
                  <SetPrivate xsi:type="xsd:int"></SetPrivate>
              </Parameters>
              <jsonClient xsi:type="xsd:string">${JSON.stringify(formattedData)}</jsonClient>
          </v3:Insert>
      </soapenv:Body>
  </soapenv:Envelope>`;
  }

  getLeadStatusId(text: string): string {
    if (!text || text.trim() === '') return '';

    const leadStatus = [
      { id: '74988', value: 'Already Bought' },

      { id: '74989', value: 'Interested - Meeting' },
      { id: '74989', value: 'Interested - Meeting Booked' },
      { id: '74989', value: 'Interested Meeting' },

      { id: '74990', value: 'Interested Task' },
      { id: '74990', value: 'Interested - Task' },

      { id: '75078', value: 'Human Review Needed' },
      { id: '75078', value: 'Human Action Needed - Task' },

      { id: '74991', value: 'Ask Human Call' },
      { id: '75019', value: 'Not Interested' },
      { id: '75020', value: 'Unclassified' },

      { id: '74991', value: 'Human Call Needed' }
    ];

    const match = leadStatus.find(
      (status) => status.value.toLowerCase() === text.trim().toLowerCase()
    );

    return match ? match.id : '';
  }

}
