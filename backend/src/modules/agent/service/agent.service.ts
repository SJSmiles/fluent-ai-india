import { Agent } from '../model/agent.model';
import { IAgent } from '../interface/agent.interface';
import { validateAgent } from '../helper/agent.helper';
import { UserAgent } from '../model/user-agent.model';
import { Company } from '../../company/models/company.model';
import { Types } from 'mongoose';
import { User } from '../../users/models/user.model'
import { throwError } from '../../../common/app-helper';
const plivo = require('plivo');

export class AgentService {
  // ==================== AGENT CRUD OPERATIONS ====================

  public async agentCreate(user: any, payload: IAgent): Promise<any> {
    try {
      payload.companyId = payload.companyId ? payload.companyId : user.companyId;
      await validateAgent(payload);

      // Create database entry with provider-specific fields
      const agentData: any = {
        voiceId: payload.voiceId,
        name: payload.name,
        prompt: payload.prompt,
        createdBy: user.userId,
        updatedBy: user.userId,
        companyId: payload.companyId
      };
      const agent = await Agent.create(agentData);

      return {
        status: true,
        message: 'Agent Created and Published Successfully',
        data: agent
      }
    } catch (error: any) {
      if (error.status) {
        throw error;
      }
      throw throwError(
        `Failed to create agent: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async updateAgent(agentId: string, user: any, payload: any): Promise<any> {
    try {

      const existingAgent = await Agent.findById(agentId);
      if (!existingAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }
      // Update database
      const updateData: any = {
        name: payload.name,
        prompt: payload.prompt,
        updatedBy: user.userId,
        voiceId: payload.voiceId,
        updatedAt: new Date()
      };
      // TODO if any thing changes agent data then create new version of agent

      const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, { new: true });

      if (!updatedAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      return {
        status: true,
        message: 'Agent Updated Successfully',
        data: {
          ...updatedAgent.toJSON(),
        }
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to update agent: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentListing(user: any, payload: any): Promise<any> {
    console.log('getAgentListing called with payload:', payload);
    console.log('User info:', user);
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      console.log('User info:', {
        userId: user.userId,
        isAdmin: user.isAdmin,
        isSuperAdmin: isSuperAdmin,
        companyId: user.companyId,
        payloadUserId: payload?.userId,
        payloadCompanyId: payload?.companyId
      });

      let targetUserIds: any[] = [];
      let targetCompanyId: any = null;

      // Super Admin Logic
      if (isSuperAdmin) {
        console.log('Super Admin detected');
        if (payload?.companyId) {
          // Super admin filtering by specific company
          targetCompanyId = new Types.ObjectId(payload.companyId);

          // Get all users from that company
          const companyUsers = await User.find({
            companyId: targetCompanyId,
            isArchived: false
          }).select('_id').lean();

          targetUserIds = companyUsers.map(u => u._id);

          // If userId is also provided, filter to that specific user
          if (payload?.userId) {
            targetUserIds = targetUserIds.filter(id =>
              id.toString() === payload.userId
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
      else if (user.isAdmin && payload?.userId) {
        // Admin provided specific userId filter (within their company)
        targetUserIds = [new Types.ObjectId(payload.userId)];
      }
      // Regular User or Admin without userId filter
      else {
        targetUserIds = [user.userId];
      }

      console.log('Target User IDs:', targetUserIds);
      console.log('Target Company ID:', targetCompanyId);

      if (targetUserIds.length === 0) {
        console.log('No users found for the filter criteria');
        return {
          status: true,
          message: 'No users found for this filter',
          data: [],
          totalCount: 0,
          isSuperAdmin: isSuperAdmin
        };
      }

      // Get user agents for the target users
      const userAgents = await UserAgent.find({
        userId: { $in: targetUserIds },
        isArchived: false
      }).select('agentId userId isPrimary').lean();

      console.log('UserAgents found:', userAgents.length);

      const agentIds = userAgents.map(ua => ua.agentId);
      console.log('Agent IDs count:', agentIds.length);

      if (agentIds.length === 0) {
        console.log('No agents found for users, returning empty result');
        return {
          status: true,
          message: 'No agents found for the selected users',
          data: [],
          totalCount: 0,
          isSuperAdmin: isSuperAdmin
        };
      }

      const searchQuery: any = {
        isArchived: { $ne: true },
        _id: { $in: agentIds }
      };

      // Call type filter
      if (payload?.callType) {
        searchQuery.callType = payload.callType;
      }

      console.log('Search Query:', JSON.stringify(searchQuery, null, 2));

      // Search functionality
      if (payload?.search) {
        const searchRegex = new RegExp(payload.search, 'i');
        searchQuery.$or = [
          { agentName: searchRegex },
          { phone: searchRegex }
        ];
      }

      // Sorting
      const sortBy = payload?.sortBy || 'createdAt';
      const sortOrder = payload?.sortOrder === 'asc' ? 1 : -1;
      const sortOptions: Record<string, 1 | -1> = { [sortBy]: sortOrder };

      // Pagination
      const skip = Number(payload?.skip) || 0;
      const limit = Number(payload?.limit) || 10;

      // Execute queries with selected fields and populate user/company info
      const [data, totalCount] = await Promise.all([
        Agent.find(searchQuery)
          .select('_id agentName firstMessage agentId llmId phoneBindings agentPromptType agentPrompt callType channel language isArchived createdAt updatedAt analysisPrompt responseEngine postCallAnalysisData')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Agent.countDocuments(searchQuery)
      ]);

      // Enrich data with user and company information for super admin
      let enrichedData = data;
      if (isSuperAdmin && data.length > 0) {
        // Create a map of agentId to userId from userAgents
        const agentUserMap = new Map();
        userAgents.forEach(ua => {
          // Ensure agentId exists before calling toString() to avoid runtime/compile errors
          if (ua.agentId) {
            agentUserMap.set(ua.agentId.toString(), ua.userId);
          }
        });

        // Get user details with company info
        const userIds = Array.from(new Set(userAgents.map(ua => ua.userId)));
        const users = await User.find({
          _id: { $in: userIds }
        })
          .select('_id firstName lastName email companyId')
          .populate('companyId', 'name domain')
          .lean();

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Enrich agent data
        enrichedData = data.map((agent: any) => {
          const userId = agentUserMap.get(agent._id.toString());
          const userInfo = userId ? userMap.get(userId.toString()) : null;

          const userAgent = userAgents.find(ua => ua.agentId && ua.agentId.toString() === agent._id.toString() && ua.userId && ua.userId.toString() === userId?.toString());

          return {
            ...agent,
            isPrimary: userAgent?.isPrimary || false,
            user: userInfo ? {
              _id: userInfo._id,
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              email: userInfo.email
            } : null,
            company: userInfo?.companyId ? {
              _id: (userInfo.companyId as any)._id,
              name: (userInfo.companyId as any).name,
              domain: (userInfo.companyId as any).domain
            } : null
          };
        });
      }

      // Map isPrimary for non-super admin users as well
      if (!isSuperAdmin && data.length > 0) {
        enrichedData = data.map((agent: any) => {
          // Find the matching user agent record
          const userAgent = userAgents.find(ua =>
            ua.agentId &&
            ua.agentId.toString() === agent._id.toString()
          );

          return {
            ...agent,
            isPrimary: userAgent?.isPrimary || false
          };
        });
      }

      console.log('Final data count:', enrichedData.length);
      console.log('Total count:', totalCount);

      return {
        status: true,
        message: 'Agent List retrieved successfully',
        data: enrichedData,
        totalCount,
        isSuperAdmin: isSuperAdmin
      };
    } catch (error: any) {
      console.error('Error in getAgentListing:', error);
      throw throwError(
        `Failed to retrieve Agent list: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentListingForBatchCall(user: any, payload: any): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      let agentQuery: any = {
        isArchived: { $ne: true },
        $or: [
          { primaryCallType: "outbound", primaryPhone: { $ne: null } },
          { callType: "outbound", primaryPhone: { $ne: null } }
        ]
      };

      let enrichWithUserInfo = false;

      if (isSuperAdmin) {
        agentQuery.companyId = payload.companyId ? new Types.ObjectId(payload.companyId) : user?.companyId;
        enrichWithUserInfo = true;
        console.log('Filtering agents by company:', payload.companyId);
      }

      let primaryMap = new Map<string, boolean>();

      // If userId is also provided, further filter by user mapping
      if (user.isAdmin) {
        console.log('Company Admin filtering by specific user');
        const userAgents = await UserAgent.find({
          userId: payload?.userId ? new Types.ObjectId(payload.userId) : user?.userId,
          isArchived: { $ne: true },
        }).select('agentId isPrimary').lean();

        const agentIds = userAgents.map(ua => ua.agentId);
        agentQuery._id = { $in: agentIds };

        userAgents.forEach(ua => {
          if (ua.agentId) primaryMap.set(ua.agentId.toString(), ua.isPrimary || false);
        });

        console.log('Filtering by userId, found agents:', agentIds.length);
      } else {
        console.log('Regular user - filtering by their mapped agents');
        const userAgents = await UserAgent.find({
          userId: user.userId,
          isArchived: { $ne: true },
        }).select('agentId isPrimary').lean();

        const agentIds = userAgents.map(ua => ua.agentId);
        agentQuery._id = { $in: agentIds };

        userAgents.forEach(ua => {
          if (ua.agentId) primaryMap.set(ua.agentId.toString(), ua.isPrimary || false);
        });

        console.log('User mapped agents:', agentIds.length);
      }
      console.log('Final agent query:', JSON.stringify(agentQuery, null, 2));

      // Execute query with selected fields
      const data = await Agent.find(agentQuery)
        .select('agentId primaryPhone agentName callType primaryCallType companyId')
        .lean();

      console.log('Final data for batch call:', data.length);

      let enrichedData = data.map((agent: any) => ({
        ...agent,
        isPrimary: primaryMap.get(agent._id.toString()) || false
      }));

      if (enrichWithUserInfo && data.length > 0) {
        console.log('Enriching data with user and company info');

        const agentIds = data.map((agent: any) => agent._id);
        const userAgents = await UserAgent.find({
          agentId: { $in: agentIds }
        }).select('agentId userId').lean();

        const agentUserMap = new Map<string, any[]>();
        userAgents.forEach(ua => {
          if (ua.agentId) {
            const agentIdStr = ua.agentId.toString();
            if (!agentUserMap.has(agentIdStr)) {
              agentUserMap.set(agentIdStr, []);
            }
            agentUserMap.get(agentIdStr)!.push(ua.userId);
          }
        });

        const userIds = Array.from(new Set(userAgents.map(ua => ua.userId)));

        if (userIds.length > 0) {
          const users = await User.find({
            _id: { $in: userIds }
          })
            .select('_id firstName lastName email companyId')
            .populate('companyId', 'name domain')
            .lean();

          const userMap = new Map(users.map(u => [u._id.toString(), u]));

          enrichedData = enrichedData.map((agent: any) => {
            const mappedUserIds = agentUserMap.get(agent._id.toString()) || [];
            const mappedUsers = mappedUserIds
              .map(userId => userMap.get(userId.toString()))
              .filter(u => u !== undefined);

            let companyInfo = null;
            if (mappedUsers.length > 0 && mappedUsers[0]?.companyId) {
              companyInfo = {
                _id: (mappedUsers[0].companyId as any)._id,
                name: (mappedUsers[0].companyId as any).name,
                domain: (mappedUsers[0].companyId as any).domain
              };
            }

            return {
              ...agent,
              mappedUsers: mappedUsers.map((userInfo: any) => ({
                _id: userInfo._id,
                firstName: userInfo.firstName,
                lastName: userInfo.lastName,
                email: userInfo.email
              })),
              company: companyInfo
            };
          });
        }
      }

      return {
        status: true,
        message: 'Agent List retrieved successfully',
        data: enrichedData,
        totalCount: enrichedData.length,
        isSuperAdmin: isSuperAdmin,
        requiresCompanyFilter: false
      };
    } catch (error: any) {
      console.error('Error in getAgentListingForBatchCall:', error);
      throw throwError(
        `Failed to retrieve Agent list: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async setPrimaryAgent(userId: string, agentId: string): Promise<any> {
    try {
      if (!agentId) {
        throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
      }

      if (!userId) {
        throw throwError('User ID is required', { status: 400 }, 'BAD_REQUEST');
      }

      // 1. Verify the user has access to this agent in UserAgents
      const targetAgent = await UserAgent.findOne({
        userId: userId,
        agentId: agentId,
        isArchived: false
      });

      if (!targetAgent) {
        throw throwError('Agent not found or not assigned to user', { status: 404 }, 'NOT_FOUND');
      }

      // 2. Unset primary for all other agents of this user
      await UserAgent.updateMany(
        {
          userId: userId,
          isArchived: false
        },
        { $set: { isPrimary: false } }
      );

      // 3. Set the specific agent as primary
      const updatedAgent = await UserAgent.findOneAndUpdate(
        {
          userId: userId,
          agentId: agentId
        },
        { $set: { isPrimary: true } },
        { new: true }
      );

      return {
        status: true,
        message: 'Primary agent set successfully',
        data: {
          agentId,
          isPrimary: updatedAgent?.isPrimary
        }
      };

    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to set primary agent: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async deleteAgent(agentId: string, user: any): Promise<any> {
    try {
      // Validate ObjectId format
      if (!agentId) {
        throw throwError('Invalid Agent ID format', { status: 400 }, 'BAD_REQUEST');
      }

      const agent = await Agent.findById(agentId);

      if (!agent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      if ((agent as any).isArchived) {
        throw throwError('Agent is already deleted', { status: 400 }, 'BAD_REQUEST');
      }

      // Mark as archived in database
      const deletedAgent = await Agent.findByIdAndUpdate(
        agentId,
        {
          isArchived: true,
          updatedBy: user.userId,
          updatedAt: new Date()
        },
        { new: true }
      );

      return {
        status: true,
        message: 'Agent Deleted Successfully',
        data: deletedAgent
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to delete agent: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async makeCall(user: any, body: any): Promise<any> {
    try {
      const { agentId, phoneNumber, toPhoneNumber, userId, metadata } = body;

      if (!user?.userId) {
        user.userId = userId;
      }

      const userAgent = await UserAgent.findOne({
        userId: user.userId,
        agentId: agentId,
        isArchived: false
      });

      if (!userAgent) {
        throw throwError('Agent not found or not assigned to user', { status: 404 }, 'NOT_FOUND');
      }

      const company: any = await Company.findById(user.companyId);

      const plivoClient = new plivo.Client(
        company.plivoAuthId,
        company.plivoAuthToken
      );


      if (!toPhoneNumber) throw new Error('To number is required');
      if (!phoneNumber) throw new Error('From number is required');
      if (!agentId) throw new Error('Agent is required');

      const baseUrl = process.env.NGROK_URL;

      let answerUrl = `${baseUrl}/webhook/incoming-call/${agentId}?direction=outbound`;
      
      // Append metadata to answerUrl as query params
      if (metadata && typeof metadata === 'object') {
        Object.keys(metadata).forEach(key => {
          answerUrl += `&${key}=${encodeURIComponent(metadata[key])}`;
        });
      }

      const statusUrl = `${baseUrl}/webhook/call-status/${agentId}`;

      const response = await plivoClient.calls.create(
        phoneNumber,
        toPhoneNumber,
        answerUrl,
        {
          answerMethod: 'POST',
          record: 'mp3',
          recordCallbackUrl: statusUrl,
          recordCallbackMethod: 'POST',
          statusCallback: statusUrl,
          statusCallbackMethod: 'POST'
        }
      );

      console.log('[Outbound Call] Initiated:', response.requestUuid);

      return {
        success: true,
        callId: response.requestUuid
      };

    } catch (error: any) {
      console.error('[Outbound Call] Error:', error);
      throw new Error(error.message || 'Call failed');
    }
  }
}
