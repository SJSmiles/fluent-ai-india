import { Agent } from '../model/agent.model';
import { IAgent } from '../interface/agent.interface';
import { UserAgent } from '../model/user-agent.model';
import { Company } from '../../company/models/company.model';
import { Types } from 'mongoose';
import { User } from '../../users/models/user.model';
import { throwError } from '../../../common/app-helper';
const plivo = require('plivo');

export class AgentService {

  // ==================== AGENT CRUD OPERATIONS ====================

  public async agentCreate(user: any, payload: IAgent): Promise<any> {
    try {
      payload.companyId = payload.companyId ? payload.companyId : user.companyId;

      const agentData: any = {
        name: payload.name,
        prompt: payload.prompt,
        voiceId: payload.voiceId,
        companyId: payload.companyId,
        firstMessage: payload.firstMessage || '',
        endCallMessage: payload.endCallMessage || '',
        endCallInvoke: payload.endCallInvoke ?? false,
        createdBy: user.userId,
        updatedBy: user.userId,
      };

      const agent = await Agent.create(agentData);

      return {
        status: true,
        message: 'Agent Created Successfully',
        data: agent
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to create agent: ${error.message}`,
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

      const updateData: any = {
        name: payload.name,
        prompt: payload.prompt,
        voiceId: payload.voiceId,
        updatedBy: user.userId,
        updatedAt: new Date(),
      };

      if (payload.firstMessage !== undefined) updateData.firstMessage = payload.firstMessage;
      if (payload.endCallMessage !== undefined) updateData.endCallMessage = payload.endCallMessage;
      if (payload.endCallInvoke !== undefined) updateData.endCallInvoke = payload.endCallInvoke;

      const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, { new: true });

      if (!updatedAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      return {
        status: true,
        message: 'Agent Updated Successfully',
        data: updatedAgent.toJSON()
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to update agent: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentListing(user: any, payload: any): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      let targetUserIds: any[] = [];
      targetUserIds = [user.userId];

      // ── Super Admin ───────────────────────────────────────────────────────
      if (isSuperAdmin) {
        if (payload?.companyId && user?.isAdmin) {
          const companyUsers = await User.find({
            companyId: payload?.companyId ? new Types.ObjectId(payload.companyId) : new Types.ObjectId(user.companyId),
            isArchived: false
          }).select('_id').lean();

          targetUserIds = companyUsers.map(u => u._id);
          if (payload?.userId) {
            targetUserIds = targetUserIds.filter(id => id.toString() === payload.userId);
          }
        }
      }
      // ── Company Admin ─────────────────────────────────────────────────────
      else if (user.isAdmin) {
        if (payload.userId) {
          targetUserIds = [new Types.ObjectId(payload.userId)];
        } else {
          const companyUsers = await User.find({
            companyId: payload?.companyId ? new Types.ObjectId(payload.companyId) : new Types.ObjectId(user.companyId),
            isArchived: false
          }).select('_id').lean();

          targetUserIds = companyUsers.map(u => u._id);
        }
      }
      if (targetUserIds.length === 0) {
        return { status: true, message: 'No users found for this filter', data: [], totalCount: 0 };
      }
      // Get mapped agent IDs for target users
      const userAgents = await UserAgent.find({
        userId: { $in: targetUserIds },
        isArchived: false
      }).select('agentId userId isPrimary').lean();

      const agentIds = userAgents.map(ua => ua.agentId);
      if (agentIds.length === 0) {
        return { status: true, message: 'No agents found for the selected users', data: [], totalCount: 0 };
      }

      const searchQuery: any = {
        isArchived: { $ne: true },
        _id: { $in: agentIds }
      };

      if (payload?.search) {
        const searchRegex = new RegExp(payload.search, 'i');
        searchQuery.$or = [
          { name: searchRegex },
        ];
      }

      // Sorting — use 'name' (matches model), not 'agentName'
      const sortBy = payload?.sortBy === 'agentName' ? 'name' : (payload?.sortBy || 'createdAt');
      const sortOrder = payload?.sortOrder === 'asc' ? 1 : -1;
      const sortOptions: Record<string, 1 | -1> = { [sortBy]: sortOrder };

      const skip = Number(payload?.skip) || 0;
      const limit = Number(payload?.limit) || 10;

      const [data, totalCount] = await Promise.all([
        Agent.find(searchQuery)
          .select('_id name voiceId prompt firstMessage endCallMessage endCallInvoke companyId isArchived createdAt updatedAt createdBy updatedBy')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Agent.countDocuments(searchQuery)
      ]);

      // Map isPrimary onto each agent
      let enrichedData: any[] = data.map((agent: any) => {
        const userAgent = userAgents.find(ua =>
          ua.agentId && ua.agentId.toString() === agent._id.toString()
        );
        return { ...agent, isPrimary: userAgent?.isPrimary || false };
      });
      return {
        status: true,
        message: 'Agent list retrieved successfully',
        data: enrichedData,
        totalCount,
        isSuperAdmin
      };
    } catch (error: any) {
      throw throwError(
        `Failed to retrieve agent list: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentListingForBatchCall(user: any, payload: any): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      let agentQuery: any = { isArchived: { $ne: true } };

      if (isSuperAdmin) {
        agentQuery.companyId = payload?.companyId
          ? new Types.ObjectId(payload.companyId)
          : user?.companyId;
      }

      let primaryMap = new Map<string, boolean>();

      if (user.isAdmin) {
        const userAgents = await UserAgent.find({
          userId: payload?.userId ? new Types.ObjectId(payload.userId) : user?.userId,
          isArchived: { $ne: true }
        }).select('agentId isPrimary').lean();

        const agentIds = userAgents.map(ua => ua.agentId);
        agentQuery._id = { $in: agentIds };
        userAgents.forEach(ua => {
          if (ua.agentId) primaryMap.set(ua.agentId.toString(), ua.isPrimary || false);
        });
      } else {
        const userAgents = await UserAgent.find({
          userId: user.userId,
          isArchived: { $ne: true }
        }).select('agentId isPrimary').lean();

        const agentIds = userAgents.map(ua => ua.agentId);
        agentQuery._id = { $in: agentIds };
        userAgents.forEach(ua => {
          if (ua.agentId) primaryMap.set(ua.agentId.toString(), ua.isPrimary || false);
        });
      }

      const data = await Agent.find(agentQuery)
        .select('_id name voiceId prompt companyId firstMessage isArchived createdAt updatedAt')
        .lean();

      let enrichedData: any[] = data.map((agent: any) => ({
        ...agent,
        isPrimary: primaryMap.get(agent._id.toString()) || false
      }));

      // Enrich with user/company info for Super Admin
      if (isSuperAdmin && data.length > 0) {
        const agentIds = data.map((agent: any) => agent._id);
        const userAgents = await UserAgent.find({ agentId: { $in: agentIds } })
          .select('agentId userId').lean();

        const agentUserMap = new Map<string, any[]>();
        userAgents.forEach(ua => {
          if (ua.agentId) {
            const key = ua.agentId.toString();
            if (!agentUserMap.has(key)) agentUserMap.set(key, []);
            agentUserMap.get(key)!.push(ua.userId);
          }
        });

        const userIds = Array.from(new Set(userAgents.map(ua => ua.userId)));

        if (userIds.length > 0) {
          const users = await User.find({ _id: { $in: userIds } })
            .select('_id firstName lastName email companyId')
            .populate('companyId', 'name domain')
            .lean();

          const userMap = new Map(users.map(u => [u._id.toString(), u]));

          enrichedData = enrichedData.map((agent: any) => {
            const mappedUserIds = agentUserMap.get(agent._id.toString()) || [];
            const mappedUsers: any[] = mappedUserIds
              .map(uid => userMap.get(uid.toString()))
              .filter(Boolean);

            const companyInfo = mappedUsers[0]?.companyId
              ? { _id: mappedUsers[0].companyId._id, name: mappedUsers[0].companyId.name, domain: mappedUsers[0].companyId.domain }
              : null;

            return {
              ...agent,
              mappedUsers: mappedUsers.map((u: any) => ({
                _id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email
              })),
              company: companyInfo
            };
          });
        }
      }

      return {
        status: true,
        message: 'Agent list retrieved successfully',
        data: enrichedData,
        totalCount: enrichedData.length,
        isSuperAdmin
      };
    } catch (error: any) {
      throw throwError(
        `Failed to retrieve agent list: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async setPrimaryAgent(userId: string, agentId: string): Promise<any> {
    try {
      if (!agentId) throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
      if (!userId) throw throwError('User ID is required', { status: 400 }, 'BAD_REQUEST');

      const targetAgent = await UserAgent.findOne({ userId, agentId, isArchived: false });
      if (!targetAgent) {
        throw throwError('Agent not found or not assigned to user', { status: 404 }, 'NOT_FOUND');
      }

      // Unset primary for all user's agents
      await UserAgent.updateMany({ userId, isArchived: false }, { $set: { isPrimary: false } });

      // Set the selected agent as primary
      const updatedAgent = await UserAgent.findOneAndUpdate(
        { userId, agentId },
        { $set: { isPrimary: true } },
        { new: true }
      );

      return {
        status: true,
        message: 'Primary agent set successfully',
        data: { agentId, isPrimary: updatedAgent?.isPrimary }
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(`Failed to set primary agent: ${error.message}`, { status: 500 }, 'INTERNAL_SERVER_ERROR');
    }
  }

  public async deleteAgent(agentId: string, user: any): Promise<any> {
    try {
      if (!agentId) throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');

      const agent = await Agent.findById(agentId);
      if (!agent) throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      if ((agent as any).isArchived) throw throwError('Agent is already deleted', { status: 400 }, 'BAD_REQUEST');

      const deletedAgent = await Agent.findByIdAndUpdate(
        agentId,
        { isArchived: true, updatedBy: user.userId, updatedAt: new Date() },
        { new: true }
      );

      return {
        status: true,
        message: 'Agent Deleted Successfully',
        data: deletedAgent
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(`Failed to delete agent: ${error.message}`, { status: 500 }, 'INTERNAL_SERVER_ERROR');
    }
  }

  public async makeCall(user: any, body: any): Promise<any> {
    try {
      const { agentId, phoneNumber, toPhoneNumber, userId, metadata } = body;

      if (!user?.userId) user.userId = userId;

      const userAgent = await UserAgent.findOne({ userId: user.userId, agentId, isArchived: false });
      if (!userAgent) {
        throw throwError('Agent not found or not assigned to user', { status: 404 }, 'NOT_FOUND');
      }

      const company: any = await Company.findById(user.companyId);
      if (!company) throw throwError('Company not found', { status: 404 }, 'NOT_FOUND');

      if (!toPhoneNumber) throw new Error('To number is required');
      if (!phoneNumber) throw new Error('From number is required');
      if (!agentId) throw new Error('Agent ID is required');

      const plivoClient = new plivo.Client(company.plivoAuthId, company.plivoAuthToken);

      const baseUrl = process.env.NGROK_URL;
      let answerUrl = `${baseUrl}/webhook/incoming-call/${agentId}?direction=outbound`;

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

      return {
        success: true,
        callId: response.requestUuid
      };
    } catch (error: any) {
      throw new Error(error.message || 'Call failed');
    }
  }

  // Add this method inside AgentService class in agent.service.ts

  public async mapUserAgents(user: any, payload: { userId: string; agentIds: string[] }): Promise<any> {
    try {
      const { userId, agentIds } = payload;

      // Validate user exists
      const targetUser = await User.findOne({ _id: new Types.ObjectId(userId), isArchived: false });
      if (!targetUser) {
        throw throwError('User not found', { status: 404 }, 'NOT_FOUND');
      }

      // Validate all agents exist and are not archived
      const agents = await Agent.find({
        _id: { $in: agentIds.map(id => new Types.ObjectId(id)) },
        isArchived: { $ne: true }
      }).select('_id companyId').lean();

      if (agents.length !== agentIds.length) {
        throw throwError(
          'One or more agents not found or are archived',
          { status: 404 },
          'NOT_FOUND'
        );
      }
      const companyId = targetUser.companyId;
      // Find already mapped agent IDs for this user
      const existingMappings: any = await UserAgent.find({
        userId: new Types.ObjectId(userId),
        isArchived: false
      }).select('agentId').lean();

      const existingAgentIds = new Set(existingMappings.map((m: { agentId: { toString: () => any; }; }) => m.agentId.toString()));

      // Separate into new mappings and already existing ones
      const newAgentIds = agentIds.filter(id => !existingAgentIds.has(id));
      const alreadyMappedIds = agentIds.filter(id => existingAgentIds.has(id));

      // Check if user has any existing primary agent
      const hasPrimary = await UserAgent.exists({
        userId: new Types.ObjectId(userId),
        isPrimary: true,
        isArchived: false
      });

      // Build new mapping documents
      const mappingDocs = newAgentIds.map((agentId, index) => ({
        userId: new Types.ObjectId(userId),
        companyId: new Types.ObjectId(companyId),
        agentId: new Types.ObjectId(agentId),
        // Set first agent as primary only if user has no primary agent yet
        isPrimary: !hasPrimary && index === 0,
        createdBy: new Types.ObjectId(user.userId),
        updatedBy: new Types.ObjectId(user.userId),
        isArchived: false
      }));

      let insertedMappings: any[] = [];

      if (mappingDocs.length > 0) {
        insertedMappings = await UserAgent.insertMany(mappingDocs);
      }

      return {
        status: true,
        message: 'User agents mapped successfully',
        data: {
          userId,
          totalRequested: agentIds.length,
          newlyMapped: insertedMappings.length,
          alreadyMapped: alreadyMappedIds.length,
          mappedAgentIds: newAgentIds,
          skippedAgentIds: alreadyMappedIds
        }
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to map user agents: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }


  // Add this method inside AgentService class in agent.service.ts

  public async getUserAgentMapping(user: any, query: { userId?: string }): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Determine which userId to fetch mappings for
      let targetUserId: Types.ObjectId;

      if (isSuperAdmin || user.isAdmin) {
        // Admin/SuperAdmin can pass any userId
        if (!query?.userId) {
          throw throwError('userId is required', { status: 400 }, 'BAD_REQUEST');
        }
        targetUserId = new Types.ObjectId(query.userId);
      } else {
        // Regular user can only see their own mappings
        targetUserId = new Types.ObjectId(user.userId);
      }

      // Validate user exists
      const targetUser = await User.findOne({
        _id: targetUserId,
        isArchived: false
      }).select('_id firstName lastName email companyId').lean();

      if (!targetUser) {
        throw throwError('User not found', { status: 404 }, 'NOT_FOUND');
      }

      // Fetch all active mappings for this user
      const mappings = await UserAgent.find({
        userId: targetUserId,
        isArchived: false
      })
        .populate({
          path: 'agentId',
          select: '_id name voiceId prompt firstMessage endCallMessage endCallInvoke companyId isArchived createdAt updatedAt',
          match: { isArchived: { $ne: true } }
        })
        .select('_id agentId isPrimary createdAt')
        .lean();

      // Filter out any mappings where agent was archived (populate returns null)
      const validMappings = mappings.filter((m: any) => m.agentId !== null);

      const formattedMappings = validMappings.map((m: any) => ({
        mappingId: m._id,
        isPrimary: m.isPrimary,
        mappedAt: m.createdAt,
        agent: {
          _id: m.agentId._id,
          name: m.agentId.name,
          voiceId: m.agentId.voiceId,
          prompt: m.agentId.prompt,
          firstMessage: m.agentId.firstMessage || '',
          endCallMessage: m.agentId.endCallMessage || '',
          endCallInvoke: m.agentId.endCallInvoke ?? false,
          companyId: m.agentId.companyId,
          createdAt: m.agentId.createdAt,
          updatedAt: m.agentId.updatedAt,
        }
      }));

      return {
        status: true,
        message: 'User agent mappings retrieved successfully',
        data: {
          user: {
            _id: targetUser._id,
            firstName: (targetUser as any).firstName,
            lastName: (targetUser as any).lastName,
            email: (targetUser as any).email,
          },
          totalMappings: formattedMappings.length,
          primaryAgent: formattedMappings.find(m => m.isPrimary) || null,
          agents: formattedMappings
        }
      };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to retrieve user agent mappings: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }


  public async downloadSampleExcel(user: any, query: { companyId?: string }): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      let targetCompanyId: Types.ObjectId;
      if (isSuperAdmin && query?.companyId) {
        targetCompanyId = new Types.ObjectId(query.companyId);
      } else {
        targetCompanyId = new Types.ObjectId(user.companyId);
      }

      const company = await Company.findOne({
        _id: targetCompanyId,
        isArchived: false
      }).select('name csvColumnConfig').lean();

      if (!company) {
        throw throwError('Company not found', { status: 404 }, 'NOT_FOUND');
      }

      const csvColumnConfig: any[] = (company as any).csvColumnConfig || [];

      // Fallback default columns if company has no config
      const columns = csvColumnConfig.length > 0
        ? csvColumnConfig
        : [
          { name: 'phone_number', label: 'Phone Number', type: 'phone' },
          { name: 'first_name', label: 'First Name', type: 'string' },
          { name: 'last_name', label: 'Last Name', type: 'string' },
          { name: 'email', label: 'Email', type: 'email' },
        ];

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sample');

      // Header row
      sheet.columns = columns.map((col: any) => ({
        header: col.name,   // ✅ always use name
        key: col.name,
        width: 20,
      }));

      // One sample data row
      const sampleRow: any = {};
      columns.forEach((col: any) => {
        const samples: Record<string, string> = {
          phone: '+918003907875',
          email: 'example@email.com',
          number: '123',
          boolean: 'true',
          string: col.enum?.length > 0 ? col.enum[0] : 'Sample Text',
        };
        sampleRow[col.name] = samples[col.type] || 'Sample Text';
      });
      sheet.addRow(sampleRow);

      const buffer = await workbook.xlsx.writeBuffer();
      const companyName = (company as any).name?.replace(/\s+/g, '_') || 'Company';
      const filename = `${companyName}_sample_upload.xlsx`;

      return { buffer: Buffer.from(buffer), filename };
    } catch (error: any) {
      if (error.status) throw error;
      throw throwError(
        `Failed to generate sample Excel: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }
}