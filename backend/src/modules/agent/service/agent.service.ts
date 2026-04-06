import { Agent } from '../model/agent.model';
import { AgentListingPayload, AgentUpdatePayload, IAgent } from '../interface/agent.interface';
import { validateAgent, validateCustomAgent } from '../helper/agent.helper';
import retellService, { RetellService } from '../../call/service/retall.service';
import vapiService, { VapiService } from '../../call/service/vapi.service';
import { generateWebhookUrl } from '../../webhook/helper/webhook.helper';
import { UserAgent } from '../model/user-agent.model';
import mongoose from 'mongoose';
import { getRedisClient } from '../../../database/mongo-connect';
import { userAgentValidationService } from './agent-redis.service';
import { Company } from '../../company/models/company.model';
import { IVoiceService } from '../../call/service/voice-service.interface';
import { Types } from 'mongoose';
import { User } from '../../users/models/user.model'
import { VapiClient } from './vapi.service';
import { RetellClient } from './retell.service';
import axios from 'axios';
import { throwError } from '../../../common/app-helper';
import { v4 as uuidv4 } from 'uuid';
import { Server } from '../../../server';

export interface UpdateAgentPhoneRequest {
  agentId: string;
  phoneNumberId?: string | null;
  outboundNumber?: string | null;
  twilioAccountSid?: string | null;
}

export interface PhoneMapping {
  inbound: PhoneMappingDetails | null;
  outbound: PhoneMappingDetails | null;
}

export interface PhoneMappingDetails {
  number: string;
  formatted: string;
  callType: 'inbound' | 'outbound';
}

export interface PhoneBinding {
  id: string;
  number: string;
  direction: 'inbound' | 'outbound';
  formatted: string;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
}

export class AgentService {

  private getVoiceProviderConfig(
    company: any,
    providerName: 'vapi' | 'retell'
  ): { name: string; api_key_id: string } | null {
    if (company?.voiceProviders && Array.isArray(company.voiceProviders)) {
      const providerConfig = company.voiceProviders.find(
        (vp: any) => vp.name?.toLowerCase() === providerName.toLowerCase()
      );

      if (providerConfig) {
        return providerConfig;
      }
    }

    if (company?.voiceProvider && typeof company.voiceProvider === 'string') {
      const oldProviderName = company.voiceProvider.toLowerCase();

      if (oldProviderName === providerName.toLowerCase()) {
        return {
          name: company.voiceProvider,
          api_key_id: company.api_key_id || null
        };
      }
    }

    return null;
  }

  private getPrimaryVoiceProvider(company: any): 'vapi' | 'retell' {
    if (!company?.voiceProviders || company.voiceProviders.length === 0) {
      throw throwError(
        'No voice providers configured for this company',
        { status: 400 },
        'BAD_REQUEST'
      );
    }

    const primaryProvider = company.voiceProviders[0]?.name?.toLowerCase();

    if (!primaryProvider || (primaryProvider !== 'vapi' && primaryProvider !== 'retell')) {
      throw throwError(
        `Invalid voice provider configured: ${primaryProvider}. Must be 'vapi' or 'retell'`,
        { status: 400 },
        'BAD_REQUEST'
      );
    }

    return primaryProvider as 'vapi' | 'retell';
  }

  private getApiKeyForProvider(
    company: any,
    providerName: 'vapi' | 'retell'
  ): string {
    const config = this.getVoiceProviderConfig(company, providerName);

    if (!config) {
      throw throwError(
        `Voice provider '${providerName}' is not configured for this company`,
        { status: 400 },
        'BAD_REQUEST'
      );
    }

    if (!config.api_key_id) {
      throw throwError(
        `API key missing for voice provider: ${providerName}. Please configure the API key in company settings`,
        { status: 400 },
        'BAD_REQUEST'
      );
    }

    return config.api_key_id;
  }

  private async getVoiceProvider(user: any): Promise<'vapi' | 'retell'> {
    try {
      const company = await Company.findById(user.companyId).lean();

      if (!company) {
        throw throwError(
          'Company not found',
          { status: 404 },
          'NOT_FOUND'
        );
      }

      return this.getPrimaryVoiceProvider(company);
    } catch (error: any) {
      // Re-throw our custom errors
      if (error.status) {
        throw error;
      }

      // Wrap unexpected errors
      throw throwError(
        `Error fetching voice provider: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  private async getVoiceService(user: any): Promise<IVoiceService> {
    const provider = await this.getVoiceProvider(user);
    return provider === 'vapi' ? vapiService : retellService;
  }

  // ==================== AGENT CRUD OPERATIONS ====================

  public async agentCreate(user: any, payload: IAgent): Promise<any> {
    try {
      await validateAgent(payload);
      const webhookUrl = generateWebhookUrl(user.companyId);
      const voiceService = await this.getVoiceService(user);
      const provider = await this.getVoiceProvider(user);

      // Process agent/assistant creation based on provider
      const result = await voiceService.processAgentCreationRequest(user, payload);

      // Create database entry with provider-specific fields
      const agentData: any = {
        agentName: payload.agentName,
        phone: payload.phone,
        agentPromptType: 'Multi Prompt',
        agentPrompt: payload.agentPrompt,
        callType: payload.callType || 'inbound',
        webhookUrl: webhookUrl,
        createdBy: user.userId,
        updatedBy: user.userId
      };

      // Add provider-specific IDs
      if (provider === 'vapi') {
        agentData.vapiAssistantId = result.assistantId;
      } else {
        agentData.retellLlmId = result.llmId;
        agentData.retellAgentId = result.agentId;
      }

      const agent = await Agent.create(agentData);

      return {
        status: true,
        message: 'Agent Created and Published Successfully',
        data: {
          ...agent.toJSON(),
          ...(provider === 'vapi'
            ? { vapiAssistantId: result.assistantId }
            : { retellAgentId: result.agentId, retellLlmId: result.llmId }
          ),
          webhookUrl: webhookUrl,
          promptType: 'Multi Prompt'
        }
      };
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

  public async updateAgentPhoneNumber(
    agentId: string,
    user: any,
    payload: { phone: string; callType: 'inbound' | 'outbound' }
  ): Promise<any> {
    try {
      // Get existing agent
      const existingAgent = await Agent.findById(agentId);
      if (!existingAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      if (!(existingAgent as any).phone) {
        throw throwError(
          'Agent must have a phone number before updating',
          { status: 400 },
          'BAD_REQUEST'
        );
      }

      const voiceService = await this.getVoiceService(user);
      const provider = await this.getVoiceProvider(user);

      // Get provider-specific agent ID
      const agentIdentifier = provider === 'vapi'
        ? (existingAgent as any).vapiAssistantId
        : (existingAgent as any).retellAgentId;

      if (!agentIdentifier) {
        throw throwError(
          `${provider === 'vapi' ? 'Vapi Assistant' : 'Retell Agent'} ID not found`,
          { status: 400 },
          'BAD_REQUEST'
        );
      }

      // Call appropriate service
      await voiceService.processPhoneNumberUpdateRequest(
        agentIdentifier,
        payload.phone,
        (existingAgent as any).phone,
        payload.callType
      );

      // Update database
      const updatedAgent = await Agent.findByIdAndUpdate(
        agentId,
        {
          phone: payload.phone,
          callType: payload.callType,
          updatedBy: user.userId,
          updatedAt: new Date()
        },
        { new: true }
      );

      return {
        status: true,
        message: 'Agent Phone Number Updated Successfully',
        data: {
          ...updatedAgent!.toJSON(),
          promptType: 'Multi Prompt'
        }
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to update agent phone number: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async updateAgent(agentId: string, user: any, payload: AgentUpdatePayload): Promise<any> {
    try {
      await validateCustomAgent(agentId);

      // Get existing agent
      const existingAgent = await Agent.findById(agentId);
      if (!existingAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      const voiceService = await this.getVoiceService(user);

      // Call appropriate service for update
      await voiceService.processAgentUpdateRequest(user, existingAgent, payload);

      // Update database
      const updateData: any = {
        agentName: payload.agentName,
        agentPrompt: payload.agentPrompt,
        updatedBy: user.userId,
        updatedAt: new Date()
      };

      // Update phone and callType if provided
      if (payload.phone) {
        updateData.phone = payload.phone;
      }
      if (payload.callType) {
        updateData.callType = payload.callType;
      }

      const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, { new: true });

      if (!updatedAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      return {
        status: true,
        message: 'Agent Updated Successfully',
        data: {
          ...updatedAgent.toJSON(),
          promptType: 'Multi Prompt'
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

  // public async getAgentListingFromRetell(user: any, payload: AgentListingPayload): Promise<any> {
  //   const { skip = 0, limit = 10, sortBy, search, sortOrder = 'asc' } = payload;

  //   // Ensure skip and limit are numbers
  //   const skipNum = Number(skip) || 0;
  //   const limitNum = Number(limit) || 10;

  //   try {
  //     // Get all agents from Retell
  //     let allAgents = (await RetellService.getAllRetellAgents()) || [];

  //     // Group agents by agent_id to find latest version for each
  //     const agentGroups = new Map();

  //     allAgents.forEach((agent: any) => {
  //       const agentId = agent.agent_id;
  //       if (!agentGroups.has(agentId)) {
  //         agentGroups.set(agentId, []);
  //       }
  //       agentGroups.get(agentId).push(agent);
  //     });

  //     // Get only the latest version of each agent
  //     allAgents = [];
  //     agentGroups.forEach((agents) => {
  //       const latestAgent = agents.sort((a: any, b: any) => (b.version || 0) - (a.version || 0))[0];
  //       allAgents.push(latestAgent);
  //     });

  //     // Get all phone numbers to map with agents
  //     const allPhoneNumbers = (await RetellService.getAllPhoneNumbers()) || [];
  //     const agentToPhoneMap = new Map();

  //     allPhoneNumbers.forEach((phone: any) => {
  //       if (phone.inbound_agent_id) {
  //         if (!agentToPhoneMap.has(phone.inbound_agent_id)) {
  //           agentToPhoneMap.set(phone.inbound_agent_id, []);
  //         }
  //         agentToPhoneMap.get(phone.inbound_agent_id).push({
  //           number: phone.phone_number,
  //           direction: 'inbound',
  //           formatted: phone.phone_number_pretty || phone.phone_number
  //         });
  //       }

  //       // Check for outbound agent binding
  //       if (phone.outbound_agent_id) {
  //         if (!agentToPhoneMap.has(phone.outbound_agent_id)) {
  //           agentToPhoneMap.set(phone.outbound_agent_id, []);
  //         }
  //         agentToPhoneMap.get(phone.outbound_agent_id).push({
  //           number: phone.phone_number,
  //           direction: 'outbound',
  //           formatted: phone.phone_number_pretty || phone.phone_number
  //         });
  //       }
  //     });

  //     // Enhance agents with phone number information
  //     allAgents = allAgents.map((agent: any) => {
  //       const boundPhones = agentToPhoneMap.get(agent.agent_id) || [];

  //       return {
  //         ...agent,
  //         phoneNumbers: boundPhones,
  //         primaryPhoneNumber: boundPhones.length > 0 ? boundPhones[0].number : null,
  //         // Create searchable phone string (all phone numbers concatenated)
  //         phoneSearchString: boundPhones
  //           .map((p: any) => p.number + ' ' + (p.formatted || ''))
  //           .join(' ')
  //           .toLowerCase()
  //       };
  //     });

  //     // Apply search filter if provided
  //     if (search && search.trim()) {
  //       const searchTerm = search.toLowerCase().trim();
  //       allAgents = allAgents.filter((agent: any) => {
  //         // Search in agent name
  //         const nameMatch = agent.agent_name && agent.agent_name.toLowerCase().includes(searchTerm);

  //         // Search in phone numbers
  //         const phoneMatch =
  //           agent.phoneSearchString && agent.phoneSearchString.includes(searchTerm);

  //         // Search in agent ID
  //         const idMatch = agent.agent_id && agent.agent_id.toLowerCase().includes(searchTerm);

  //         return nameMatch || phoneMatch || idMatch;
  //       });
  //     }

  //     // Apply sorting
  //     if (sortBy) {
  //       const sortField = sortBy;
  //       const order = sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  //       allAgents.sort((a: any, b: any) => {
  //         let aValue, bValue;

  //         // Handle only phone number and agent name sorting
  //         switch (sortField) {
  //           case 'phoneNumber':
  //           case 'primaryPhoneNumber':
  //             aValue = a.primaryPhoneNumber || '';
  //             bValue = b.primaryPhoneNumber || '';
  //             break;
  //           case 'agentName':
  //           case 'agent_name':
  //             aValue = a.agent_name || '';
  //             bValue = b.agent_name || '';
  //             break;
  //           default:
  //             // Default to agent name for any other field
  //             aValue = a.agent_name || '';
  //             bValue = b.agent_name || '';
  //         }

  //         // Handle string values
  //         if (typeof aValue === 'string' && typeof bValue === 'string') {
  //           aValue = aValue.toLowerCase();
  //           bValue = bValue.toLowerCase();
  //         }

  //         // Handle null/undefined values
  //         if (aValue === undefined || aValue === null) aValue = '';
  //         if (bValue === undefined || bValue === null) bValue = '';

  //         // Apply sorting order
  //         if (order === 'desc') {
  //           return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
  //         } else {
  //           return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
  //         }
  //       });
  //     } else {
  //       // Default sorting by agent name
  //       allAgents.sort((a: any, b: any) => {
  //         const aName = a.agent_name || '';
  //         const bName = b.agent_name || '';
  //         return aName.toLowerCase() > bName.toLowerCase()
  //           ? 1
  //           : aName.toLowerCase() < bName.toLowerCase()
  //             ? -1
  //             : 0;
  //       });
  //     }

  //     // Calculate counts after filtering and sorting
  //     const totalFilteredCount = allAgents.length;
  //     const totalCount = allAgents.length;

  //     // Apply pagination with explicit number conversion
  //     const data = allAgents.slice(skipNum, skipNum + limitNum);

  //     // Debug log
  //     console.log(
  //       `Pagination Debug: skip=${skipNum}, limit=${limitNum}, totalCount=${totalCount}, resultLength=${data.length}`
  //     );

  //     return {
  //       message: 'Agent List retrieved successfully',
  //       data,
  //       totalCount,
  //       totalFilteredCount
  //     };
  //   } catch (error: any) {
  //     console.error('Error in getAgentListingFromRetell:', error);
  //     return {
  //       message: 'Failed to retrieve agent list: ' + error.message,
  //       data: [],
  //       totalCount: 0,
  //       totalFilteredCount: 0,
  //       error: error.message
  //     };
  //   }
  // }


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

      const voiceService = await this.getVoiceService(user);

      // Call appropriate service for deletion
      await voiceService.processAgentDeletionRequest(agent);

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

  public async duplicateAgent(agentId: string, user: any): Promise<any> {
    try {
      const originalAgent = await Agent.findById(agentId);

      if (!originalAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      if ((originalAgent as any).isArchived) {
        throw throwError('Cannot duplicate archived agent', { status: 400 }, 'BAD_REQUEST');
      }

      // Generate webhook URL only for database storage
      const webhookUrl = generateWebhookUrl(user.companyId);
      const voiceService = await this.getVoiceService(user);
      const provider = await this.getVoiceProvider(user);

      // Call appropriate service for duplication
      const result = await voiceService.processAgentDuplicationRequest(user, originalAgent);

      // Create duplicate agent in database with webhook URL
      const duplicateAgentData: any = {
        agentName: result.duplicateName,
        agentPromptType: (originalAgent as any).agentPromptType,
        agentPrompt: (originalAgent as any).agentPrompt,
        callType: (originalAgent as any).callType,
        webhookUrl: webhookUrl,
        createdBy: user.userId,
        updatedBy: user.userId
      };

      // Add provider-specific IDs
      if (provider === 'vapi') {
        duplicateAgentData.vapiAssistantId = result.assistantId;
      } else {
        duplicateAgentData.retellLlmId = result.llmId;
        duplicateAgentData.retellAgentId = result.agentId;
      }

      const duplicateAgent = await Agent.create(duplicateAgentData);

      return {
        status: true,
        message: 'Agent Duplicated Successfully (Update phone number to activate)',
        data: {
          ...duplicateAgent.toJSON(),
          ...(provider === 'vapi'
            ? { vapiAssistantId: result.assistantId }
            : { retellAgentId: result.agentId, retellLlmId: result.llmId }
          ),
          webhookUrl: webhookUrl,
          promptType: 'Multi Prompt'
        }
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to duplicate agent: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentDetails(user: string, payload: any): Promise<any> {
    try {
      const voiceService = await this.getVoiceService(user as any);
      const provider = await this.getVoiceProvider(user as any);

      // Cast to specific service type and call appropriate method
      let agentDetails;
      if (provider === 'vapi') {
        agentDetails = await (voiceService as VapiService).getVapiAssistantById(payload);
      } else {
        agentDetails = await (voiceService as RetellService).getRetellAgentById(payload);
      }

      return {
        status: true,
        message: 'Agent details retrieved successfully',
        data: agentDetails
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to retrieve agent details: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getAgentPromptDetails(user: string, payload: any): Promise<any> {
    try {
      const voiceService = await this.getVoiceService(user as any);
      const provider = await this.getVoiceProvider(user as any);

      // Cast to specific service type and call appropriate method
      let agentDetails;
      if (provider === 'vapi') {
        // For Vapi, the assistant details contain the prompt
        agentDetails = await (voiceService as VapiService).getVapiAssistantById(payload);
      } else {
        // For Retell, there's a separate prompt endpoint
        agentDetails = await (voiceService as RetellService).getRetellAgentPromptById(payload);
      }

      return {
        status: true,
        message: 'Agent prompt retrieved successfully',
        data: agentDetails
      };
    } catch (error: any) {
      if (error.status) {
        throw error;
      }

      throw throwError(
        `Failed to retrieve agent prompt: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  private generateAnalysisPrompt(postCallAnalysisData: any): string {
    if (!postCallAnalysisData || postCallAnalysisData.length === 0) {
      return '';
    }

    let prompt = `You are an AI assistant that analyzes call conversations and extracts the following data:

**CUSTOM DATA EXTRACTION** - Extract these specific fields from the conversation:

`;

    // Add only custom fields from postCallAnalysisData
    postCallAnalysisData.forEach((field: any) => {
      prompt += `- **${field.name}**: ${field.description}`;
      if (field.type) {
        prompt += ` (${field.type})`;
      }
      prompt += '\n';
    });

    prompt += `
**Instructions:**
- Extract the exact value mentioned by the customer
- Use empty string '' if not mentioned
- For multiple values, use the most relevant one

Respond ONLY in valid JSON format:
{
  "customAnalysisData": {`;

    // Add custom fields to JSON structure
    postCallAnalysisData.forEach((field: any, index: any) => {
      prompt += `\n    "${field.name}": "string"`;
      if (index < postCallAnalysisData.length - 1) {
        prompt += ',';
      }
    });

    prompt += `
  }
}`;

    return prompt;
  }

  public async updateCustomAgent(
    agentId: string,
    user: any,
    payload: any
  ): Promise<any> {
    try {
      console.log('Updating agent with ID:', agentId);
      console.log('Payload received:', payload);

      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        throw throwError('Invalid agent ID format', { status: 400 }, 'BAD_REQUEST');
      }

      await validateCustomAgent(agentId);

      // Get existing agent
      const existingAgent = await Agent.findById(agentId);
      if (!existingAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      if (!payload || Object.keys(payload).length === 0) {
        throw throwError('Request body cannot be empty', { status: 400 }, 'BAD_REQUEST');
      }

      const updateData: any = {};

      if (payload.agentPrompt !== undefined) {
        updateData.agentPrompt = payload.agentPrompt;
      }

      if (payload.postCallAnalysisData !== undefined) {
        updateData.postCallAnalysisData = payload.postCallAnalysisData;

        // Generate analysis prompt only if postCallAnalysisData has items
        if (payload.postCallAnalysisData && payload.postCallAnalysisData.length > 0) {
          updateData.analysisPrompt = this.generateAnalysisPrompt(payload.postCallAnalysisData);
        } else {
          // If postCallAnalysisData is empty, set analysisPrompt to empty string
          updateData.analysisPrompt = '';
        }
      }

      // Add metadata
      updateData.updatedBy = user.userId || user._id || user.id;
      updateData.updatedAt = new Date();

      console.log('Update data prepared:', updateData);

      // Update agent in database
      const updatedAgent = await Agent.findByIdAndUpdate(
        agentId,
        { $set: updateData },
        {
          new: true,
          runValidators: true
        }
      );

      console.log('Agent updated successfully:', updatedAgent ? 'Yes' : 'No');

      if (!updatedAgent) {
        throw throwError('Failed to update agent', { status: 500 }, 'UPDATE_FAILED');
      }

      // Clear Redis caches
      try {
        const redis = getRedisClient();

        // 1. Delete agent cache
        const agentRedisKey = `agent:${agentId}`;
        await redis.del(agentRedisKey);
        console.log(`Redis cache deleted for key: ${agentRedisKey}`);

        // 2. Clear validation cache using agentObjectId
        await userAgentValidationService.clearValidationCacheByAgentObjectId(agentId, user.companyId);
        console.log(`Validation cache cleared for agentId: ${agentId}`);

      } catch (redisError: any) {
        console.error('Error clearing Redis caches:', redisError);
        // Don't throw error, just log it - cache deletion failure shouldn't stop the update
      }

      // Return success response
      return {
        status: true,
        message: 'Custom Agent Updated Successfully',
        data: {
          _id: updatedAgent._id,
          agentPrompt: updatedAgent.agentPrompt,
          postCallAnalysisData: updatedAgent.postCallAnalysisData,
          analysisPrompt: updatedAgent.analysisPrompt,
          updatedAt: updatedAgent.updatedAt,
          updatedBy: updatedAgent.updatedBy
        }
      };

    } catch (error: any) {
      console.error('Error in updateCustomAgent:', error);
      throw throwError(
        `Failed to update agent: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async pullAgents(companyId: string, requestedProvider?: 'vapi' | 'retell') {
    try {
      console.log(requestedProvider);
      try {
        await Agent.collection.dropIndex('agentId_1');
        console.log('dropped old agentId_1 index');
      } catch (err: any) {
        console.log('Old index already dropped or does not exist');
      }

      await Agent.syncIndexes();

      const company = await Company.findById(companyId).lean();
      if (!company) throw throwError('Invalid company ID', { status: 404 });

      let voiceProvider: 'vapi' | 'retell';
      let apiKey: string | null = null;

      if (requestedProvider) {
        console.log(`Checking for requested provider: ${requestedProvider}`);

        const providerConfig = this.getVoiceProviderConfig(company, requestedProvider);

        if (!providerConfig) {
          throw throwError(
            `Voice provider '${requestedProvider}' is not configured for this company`,
            { status: 400 }
          );
        }

        if (!providerConfig.api_key_id) {
          throw throwError(
            `API key missing for voice provider: ${requestedProvider}`,
            { status: 400 }
          );
        }

        voiceProvider = requestedProvider;
        apiKey = providerConfig.api_key_id;

        console.log(`Using requested provider: ${voiceProvider}`);
      } else {
        //No provider specified - use primary (first in array)
        voiceProvider = this.getPrimaryVoiceProvider(company);
        apiKey = this.getApiKeyForProvider(company, voiceProvider);

        console.log(`Using primary provider: ${voiceProvider}`);
      }

      if (!apiKey) {
        throw throwError(
          `API key missing for voice provider: ${voiceProvider}`,
          { status: 400 }
        );
      }

      console.log(`API Key found for ${voiceProvider}: ${apiKey}`);

      let pulledAgents: any[] = [];
      let stats: any = {};

      if (voiceProvider === 'vapi') {
        console.log('pulling agents from VAPI...');
        const vapiClient = new VapiClient(apiKey);
        pulledAgents = await vapiClient.getAllAssistantsWithDetails();
        stats = await this.syncVapiAgents(pulledAgents, companyId);
      } else if (voiceProvider === 'retell') {
        console.log('Pulling agents from Retell...');
        const retellClient = new RetellClient(apiKey);
        pulledAgents = await retellClient.getAllAgentsWithDetails();
        stats = await this.syncRetellAgents(pulledAgents, companyId);
      }

      return {
        status: true,
        message: `Successfully pulled agents from ${voiceProvider.toUpperCase()}`,
        provider: voiceProvider,
        summary: stats
      };
    } catch (error: any) {
      throw throwError(
        `Failed to pull agents: ${error?.response?.data?.message || error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  private async syncVapiAgents(assistants: any[], companyId: string) {
    const stats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as any[] };
    const companyObjId = new Types.ObjectId(companyId);

    console.log(`\n=== Starting VAPI Sync for ${assistants.length} agents ===`);

    for (const assistant of assistants) {
      try {
        const agentId = assistant.id?.trim();

        if (!agentId) {
          stats.skipped++;
          console.warn(`⚠️ Skipping assistant with missing ID:`, { name: assistant.name, orgId: assistant.orgId });
          stats.errors.push({ agentName: assistant.name || 'Unknown', error: 'Missing assistant ID' });
          continue;
        }

        let existing = await Agent.findOne({
          agentId,
          companyId: companyObjId
        });

        if (!existing) {
          console.log(`📝 Agent "${assistant.name}" (${agentId}) not found for company ${companyId}, will create new`);
        } else {
          console.log(`📝 Found existing agent "${existing.agentName}" for company ${companyId}, will update`);
        }

        const systemPrompt = assistant.model?.messages?.find((m: any) => m.role === 'system')?.content || null;
        const phoneBindings = Array.isArray(assistant.phoneBindings) && assistant.phoneBindings.length > 0
          ? assistant.phoneBindings.map((phone: any) => ({
            id: phone.id,
            number: phone.number || null,
            direction: phone.direction || (phone === assistant.outboundPhone ? 'outbound' : 'inbound'),
            formatted: phone.formatted || phone.number || null,
            twilioAccountSid: phone.twilioAccountSid || null,
            twilioAuthToken: phone.twilioAuthToken || null
          }))
          : (existing?.phoneBindings || []);

        const phoneMapping = {
          inbound: assistant.inboundPhone ? {
            number: assistant.inboundPhone.number,
            formatted: assistant.inboundPhone.formatted || assistant.inboundPhone.number,
            callType: 'inbound'
          } : (existing?.phoneMapping?.inbound || null),
          outbound: assistant.outboundPhone ? {
            number: assistant.outboundPhone.number,
            formatted: assistant.outboundPhone.formatted || assistant.outboundPhone.number,
            callType: 'outbound'
          } : (existing?.phoneMapping?.outbound || null)
        };

        const primaryPhone = assistant.primaryPhone
          || assistant.outboundPhone?.number
          || assistant.inboundPhone?.number
          || phoneBindings[0]?.number
          || (existing?.primaryPhone && existing.primaryPhone !== 'N/A' ? existing.primaryPhone : null)
          || 'N/A';

        const vapiPhoneNumberId = phoneBindings[0]?.id
          || (existing?.vapiPhoneNumberId || null);

        const webhookUrl = assistant.webhookUrl || assistant.server?.url || assistant.serverUrl || null;

        if (existing) {
          // Log preservation or update
          if (!phoneBindings[0]?.id && existing.vapiPhoneNumberId) {
            console.log(`📞 Preserving vapiPhoneNumberId for ${existing.agentName}`);
          }
          if ((!assistant.primaryPhone && !assistant.outboundPhone?.number) && existing.primaryPhone && existing.primaryPhone !== 'N/A') {
            console.log(`📞 Preserving primaryPhone for ${existing.agentName}`);
          }
          if (!Array.isArray(assistant.phoneBindings) && Array.isArray(existing.phoneBindings) && existing.phoneBindings.length > 0) {
            console.log(`📞 Preserving phoneBindings for ${existing.agentName}`);
          }
          if (!assistant.inboundPhone && !assistant.outboundPhone && existing.phoneMapping) {
            console.log(`📞 Preserving phoneMapping for ${existing.agentName}`);
          }
          // ✅ Log webhook changes
          if (webhookUrl && webhookUrl !== existing.webhookUrl) {
            console.log(`🔗 Updating webhookUrl for ${existing.agentName}: ${existing.webhookUrl} → ${webhookUrl}`);
          } else if (!webhookUrl && existing.webhookUrl) {
            console.log(`🔗 Preserving webhookUrl for ${existing.agentName}`);
          }
        }

        const responseEngine = {
          type: assistant.model?.provider || assistant.responseEngine?.type || 'llm',
          llm_id: assistant.model?.model || assistant.responseEngine?.llm_id || assistant.llmId || null,
          version: assistant.responseEngine?.version || assistant.version || null
        };

        // Post call analysis data mapping (keeping existing code)
        let postCallAnalysisData: any[] = [];

        if (assistant.analysisPlan?.structuredDataPlan?.schema?.properties) {
          const properties = assistant.analysisPlan.structuredDataPlan.schema.properties;
          const requiredFields = assistant.analysisPlan.structuredDataPlan.schema.required || [];

          postCallAnalysisData = Object.entries(properties).map(([key, value]: [string, any]) => {
            let examples: string[] = [];
            let cleanDescription = value.description || '';

            if (value.examples && Array.isArray(value.examples)) {
              examples = value.examples;
            } else if (value.enum && Array.isArray(value.enum)) {
              examples = value.enum;
            } else if (value.description) {
              const exampleMatch = value.description.match(/examples?:\s*\[(.*?)\]/is);
              if (exampleMatch) {
                const examplesString = exampleMatch[1].trim();

                try {
                  const jsonArray = JSON.parse(`[${examplesString}]`);
                  if (Array.isArray(jsonArray)) {
                    examples = jsonArray.map((ex: any) => String(ex).trim());
                  }
                } catch {
                  const quotedMatches = examplesString.match(/["']([^"']*?)["']/g);
                  if (quotedMatches && quotedMatches.length > 0) {
                    examples = quotedMatches.map((ex: string) => ex.replace(/["']/g, '').trim());
                  } else {
                    examples = examplesString
                      .split(',')
                      .map((ex: string) => ex.trim())
                      .filter((ex: string) => ex.length > 0);
                  }
                }

                cleanDescription = value.description.replace(/examples?:\s*\[.*?\]/is, '').trim();
              }
            }

            return {
              name: key,
              type: value.type || 'string',
              description: cleanDescription,
              examples: examples,
              enum: value.enum || null,
              required: requiredFields.includes(key) || false
            };
          });
        } else if (assistant.analysisPlan?.structuredDataSchema?.items) {
          postCallAnalysisData = assistant.analysisPlan.structuredDataSchema.items.map((item: any) => ({
            name: item.name,
            type: item.type || 'string',
            description: item.description || '',
            examples: Array.isArray(item.examples) ? item.examples : [],
            enum: item.enum || null,
            required: item.required || false
          }));
        } else if (assistant.postCallAnalysisData) {
          const data = Array.isArray(assistant.postCallAnalysisData)
            ? assistant.postCallAnalysisData
            : [];

          postCallAnalysisData = data.map((item: any) => ({
            name: item.name,
            type: item.type || 'string',
            description: item.description || '',
            examples: Array.isArray(item.examples) ? item.examples : [],
            enum: item.enum || null,
            required: item.required || false
          }));
        } else if (existing?.postCallAnalysisData) {
          postCallAnalysisData = existing.postCallAnalysisData;
          console.log(`📊 Preserving postCallAnalysisData for ${existing.agentName}`);
        }

        const agentPrompt = systemPrompt || assistant.agentPrompt || assistant.firstMessage || assistant.prompt || 'Default agent prompt not provided.';

        const doc = {
          agentName: assistant.name || 'Unnamed Agent',
          agentId: agentId,
          assistantId: agentId,
          voiceProvider: 'vapi',
          companyId: companyObjId,
          callType: (assistant.callType || 'outbound') as 'inbound' | 'outbound',
          agentPromptType: (assistant.promptType || 'Multi Prompt') as any,
          agentPrompt: agentPrompt,
          llmId: assistant.model?.model || assistant.llmId || null,
          llmDetails: assistant.model || {},
          responseEngine: responseEngine,
          phone: primaryPhone,
          vapiPhoneNumberId: vapiPhoneNumberId,
          phoneBindings: phoneBindings,
          phoneMapping: phoneMapping,
          primaryPhone: primaryPhone,
          voiceId: assistant.voice?.voiceId || assistant.voiceId || null,
          voiceModel: assistant.voice?.model || 'eleven_flash_v2_5',
          voiceSpeed: assistant.voice?.speed ?? 1.02,
          voiceTemperature: assistant.voice?.temperature ?? 0.6,
          postCallAnalysisData: postCallAnalysisData,
          postCallAnalysisModel: assistant.analysisPlan?.model || assistant.postCallAnalysisModel || 'gpt-4o-mini',
          isArchived: assistant.isArchived || false,
          isPublished: assistant.isPublished || false,
          language: assistant.language || 'en-US',
          channel: assistant.channel || 'voice',
          beginMessageDelayMs: assistant.beginMessageDelayMs ?? 2000,
          endCallAfterSilenceMs: assistant.endCallAfterSilenceMs ?? 26000,
          maxCallDurationMs: assistant.maxCallDurationMs ?? 3600000,
          ringDurationMs: assistant.ringDurationMs ?? 30000,
          enableBackchannel: assistant.enableBackchannel ?? true,
          backchannelFrequency: assistant.backchannelFrequency ?? 0.5,
          interruptionSensitivity: assistant.interruptionSensitivity ?? 0.9,
          responsiveness: assistant.responsiveness ?? 1,
          volume: assistant.volume ?? 1,
          ambientSoundVolume: assistant.ambientSoundVolume ?? 0.4,
          dataStorageSetting: assistant.dataStorageSetting || 'everything',
          optOutSensitiveDataStorage: assistant.optOutSensitiveDataStorage ?? false,
          version: assistant.version ?? 107,
          versionTitle: assistant.versionTitle || '',
          // ✅ Webhook URL - update if new value provided, else preserve existing
          webhookUrl: webhookUrl || (existing?.webhookUrl || null),
          updatedAt: new Date()
        };

        if (existing) {
          await Agent.updateOne({ _id: existing._id }, { $set: doc });
          stats.updated++;
          console.log(`✅ Updated agent: ${doc.agentName} (${agentId}) for company ${companyId}`);
        } else {
          await Agent.create({
            ...doc,
            createdAt: new Date(),
            createdBy: null
          });
          stats.created++;
          console.log(`✨ Created agent: ${doc.agentName} (${agentId}) for company ${companyId}`);
        }
      } catch (err: any) {
        stats.failed++;
        if (err.code === 11000) {
          console.error('❌ Duplicate agent - unique constraint violation:', { name: assistant.name, id: assistant.id });
          stats.errors.push({ agentName: assistant.name, agentId: assistant.id, error: 'Duplicate key - agent already exists for this company' });
        } else {
          console.error('❌ VAPI Agent Sync Error:', { name: assistant.name, id: assistant.id, error: err.message });
          stats.errors.push({ agentName: assistant.name, agentId: assistant.id, error: err.message });
        }
      }
    }

    console.log('\n=== VAPI Sync Summary ===');
    console.log(`Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
    if (stats.errors.length > 0) {
      console.log('Errors:', JSON.stringify(stats.errors.slice(0, 5), null, 2));
    }
    return stats;
  }

  private async syncRetellAgents(agents: any[], companyId: string) {
    const stats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as any[] };
    const companyObjId = new Types.ObjectId(companyId);

    console.log(`\n=== Starting Retell Sync for ${agents.length} agents ===`);

    for (const agent of agents) {
      try {
        const agentId = agent.agent_id;

        if (!agentId) {
          stats.skipped++;
          console.warn(`⚠️ Skipping Retell agent with missing ID:`, agent.agent_name);
          stats.errors.push({ agentName: agent.agent_name || 'Unknown', error: 'Missing agent ID' });
          continue;
        }

        // ✅ Find agent for THIS specific company
        let existing = await Agent.findOne({
          agentId,
          companyId: companyObjId
        });

        // ✅ Check if agent exists for a different company
        if (!existing) {
          const agentInOtherCompany = await Agent.findOne({ agentId });

          if (agentInOtherCompany) {
            console.log(`📝 Agent "${agent.agent_name}" (${agentId}) exists for different company. Creating new entry for company ${companyId}`);
          } else {
            console.log(`📝 Agent "${agent.agent_name}" (${agentId}) not found for company ${companyId}, will create new`);
          }
        } else {
          console.log(`📝 Found existing agent "${existing.agentName}" for company ${companyId}, will update`);
        }

        const phoneBindings = Array.isArray(agent.phoneBindings) && agent.phoneBindings.length > 0
          ? agent.phoneBindings.map((phone: any) => ({
            id: phone.id,
            number: phone.number || null,
            direction: phone.direction || (phone === agent.outboundPhone ? 'outbound' : 'inbound'),
            formatted: phone.formatted || phone.number || null,
            twilioAccountSid: phone.twilioAccountSid || null,
            twilioAuthToken: phone.twilioAuthToken || null
          }))
          : (existing?.phoneBindings || []);

        const phoneMapping = {
          inbound: agent.inboundPhone ? {
            number: agent.inboundPhone.number,
            formatted: agent.inboundPhone.formatted || agent.inboundPhone.number,
            callType: 'inbound'
          } : (existing?.phoneMapping?.inbound || null),
          outbound: agent.outboundPhone ? {
            number: agent.outboundPhone.number,
            formatted: agent.outboundPhone.formatted || agent.outboundPhone.number,
            callType: 'outbound'
          } : (existing?.phoneMapping?.outbound || null)
        };

        const primaryPhone = agent.primaryPhone
          || agent.outboundPhone?.number
          || agent.inboundPhone?.number
          || phoneBindings[0]?.number
          || (existing?.primaryPhone && existing.primaryPhone !== 'N/A' ? existing.primaryPhone : null)
          || 'N/A';

        let callType: 'inbound' | 'outbound' = 'outbound';

        if (agent.outboundPhone || phoneMapping.outbound) {
          callType = 'outbound';
        } else if (agent.inboundPhone || phoneMapping.inbound) {
          callType = 'inbound';
        } else if (phoneBindings.length > 0) {
          const hasOutbound = phoneBindings.some((p: any) =>
            p.direction === 'outbound' || p.direction === 'both'
          );
          const hasInbound = phoneBindings.some((p: any) =>
            p.direction === 'inbound' || p.direction === 'both'
          );

          if (hasOutbound) {
            callType = 'outbound';
          } else if (hasInbound) {
            callType = 'inbound';
          }
        } else if (existing?.callType) {
          callType = existing.callType;
        }

        // Get agentPrompt from general_prompt
        const agentPrompt = agent.general_prompt
          || agent.agentPrompt
          || agent.begin_message
          || agent.prompt
          || existing?.agentPrompt
          || `AI Assistant for ${agent.agent_name || 'Voice Calls'}`;

        // Map post_call_analysis_data to postCallAnalysisData format
        let postCallAnalysisData: any[] = [];
        if (Array.isArray(agent.post_call_analysis_data)) {
          postCallAnalysisData = agent.post_call_analysis_data.map((field: any) => ({
            name: field.name,
            type: field.type || 'string',
            description: field.description || '',
            examples: field.examples || [],
            enum: field.enum || null,
            required: field.required || false
          }));
        } else if (existing?.postCallAnalysisData) {
          postCallAnalysisData = existing.postCallAnalysisData;
        }

        // ✅ Get webhook URL from agent data
        const webhookUrl = agent.webhook_url || agent.webhookUrl || null;

        // ✅ Log preservation or updates for existing agents
        if (existing) {
          if (!Array.isArray(agent.phoneBindings) && Array.isArray(existing.phoneBindings) && existing.phoneBindings.length > 0) {
            console.log(`📞 Preserving phoneBindings for ${existing.agentName}`);
          }
          if (!agent.primaryPhone && existing.primaryPhone && existing.primaryPhone !== 'N/A') {
            console.log(`📞 Preserving primaryPhone for ${existing.agentName}`);
          }
          if (!agent.general_prompt && existing.agentPrompt) {
            console.log(`📝 Preserving agentPrompt for ${existing.agentName}`);
          }
          if (!Array.isArray(agent.post_call_analysis_data) && Array.isArray(existing.postCallAnalysisData) && existing.postCallAnalysisData?.length > 0) {
            console.log(`📊 Preserving postCallAnalysisData for ${existing.agentName}`);
          }
          // ✅ Log webhook changes
          if (webhookUrl && webhookUrl !== existing.webhookUrl) {
            console.log(`🔗 Updating webhookUrl for ${existing.agentName}: ${existing.webhookUrl} → ${webhookUrl}`);
          } else if (!webhookUrl && existing.webhookUrl) {
            console.log(`🔗 Preserving webhookUrl for ${existing.agentName}`);
          }
        }

        const doc = {
          agentName: agent.agent_name || 'Unnamed Retell Agent',
          agentId: agentId,
          voiceProvider: 'retell',
          companyId: companyObjId,
          callType: callType,
          agentPromptType: 'Multi Prompt' as any,
          agentPrompt: agentPrompt,
          llmId: agent.llm_id || agent.response_engine?.llm_id || null,
          llmDetails: agent.response_engine || agent.llmDetails || {},
          responseEngine: {
            type: agent.response_engine?.type || 'llm',
            llm_id: agent.llm_id || agent.response_engine?.llm_id || null,
            version: agent.version || null
          },
          retellVersion: agent.version || 1,
          retellLastModified: agent.last_modification_timestamp || null,
          // Phone information
          phone: primaryPhone,
          primaryPhone: primaryPhone,
          phoneBindings: phoneBindings,
          phoneMapping: phoneMapping,
          primaryCallType: callType,
          // Post call analysis data
          postCallAnalysisData: postCallAnalysisData,
          postCallAnalysisModel: agent.post_call_analysis_model || 'gpt-4o-mini',
          // Voice settings
          voiceId: agent.voice_id || agent.voiceId || null,
          voiceModel: agent.voice_model || agent.voiceModel || 'eleven_turbo_v2',
          voiceSpeed: agent.voice_speed ?? agent.voiceSpeed ?? 1.0,
          voiceTemperature: agent.voice_temperature ?? agent.voiceTemperature ?? 0.7,
          // Call settings
          language: agent.language || 'en-US',
          channel: agent.channel || 'voice',
          enableBackchannel: agent.enable_backchannel ?? agent.enableBackchannel ?? true,
          backchannelFrequency: agent.backchannel_frequency ?? agent.backchannelFrequency ?? 0.8,
          backchannelWords: agent.backchannel_words || agent.backchannelWords || null,
          interruptionSensitivity: agent.interruption_sensitivity ?? agent.interruptionSensitivity ?? 1.0,
          responsiveness: agent.responsiveness ?? 1.0,
          normalizeForSpeech: agent.normalize_for_speech ?? agent.normalizeForSpeech ?? true,
          ambientSound: agent.ambient_sound || agent.ambientSound || null,
          ambientSoundVolume: agent.ambient_sound_volume ?? agent.ambientSoundVolume ?? 0.4,
          volume: agent.volume ?? 1,
          denoisingMode: agent.denoising_mode || agent.denoisingMode || null,
          sttMode: agent.stt_mode || agent.sttMode || null,
          // Call duration settings
          beginMessageDelayMs: agent.begin_message_delay_ms ?? 2000,
          endCallAfterSilenceMs: agent.end_call_after_silence_ms ?? 26000,
          maxCallDurationMs: agent.max_call_duration_ms ?? 3600000,
          ringDurationMs: agent.ring_duration_ms ?? 30000,
          reminderTriggerMs: agent.reminder_trigger_ms ?? null,
          reminderMaxCount: agent.reminder_max_count ?? null,
          // DTMF settings
          allowUserDtmf: agent.allow_user_dtmf ?? true,
          userDtmfOptions: agent.user_dtmf_options || {},
          // Voicemail
          voicemailOption: agent.voicemail_option || { action: { type: 'hangup' } },
          // Data and webhook
          dataStorageSetting: agent.data_storage_setting || 'everything',
          optOutSensitiveDataStorage: agent.opt_out_sensitive_data_storage ?? false,
          optInSignedUrl: agent.opt_in_signed_url ?? false,
          piiConfig: agent.pii_config || { mode: 'post_call', categories: [] },
          isArchived: agent.isArchived || false,
          isPublished: agent.is_published || false,
          versionTitle: agent.version_title || '',
          // ✅ Webhook URL - update if new value provided, else preserve existing
          webhookUrl: webhookUrl || (existing?.webhookUrl || null),
          lastModificationTimestamp: agent.last_modification_timestamp || null,
          updatedAt: new Date()
        };

        if (existing) {
          await Agent.updateOne({ _id: existing._id }, { $set: doc });
          stats.updated++;
          console.log(`✅ Updated Retell agent: ${doc.agentName} (${agentId}) for company ${companyId}`);
        } else {
          // ✅ Create new agent (either first time or for different company)
          await Agent.create({
            ...doc,
            createdAt: new Date(),
            createdBy: null
          });
          stats.created++;
          console.log(`✨ Created Retell agent: ${doc.agentName} (${agentId}) for company ${companyId}`);
        }
      } catch (err: any) {
        stats.failed++;
        const caughtAgentId = agent?.agent_id || (agent as any)?._id || null;
        if (err.code === 11000) {
          console.error('❌ Duplicate agent - unique constraint violation:', { name: agent?.agent_name, id: caughtAgentId });
          stats.errors.push({
            agentName: agent?.agent_name || 'Unknown',
            agentId: caughtAgentId,
            error: 'Duplicate key - agent already exists for this company'
          });
        } else {
          console.error('❌ Retell Agent Sync Error:', {
            name: agent?.agent_name,
            agentId: caughtAgentId,
            error: err.message,
            validationErrors: err.errors ? Object.keys(err.errors) : []
          });
          stats.errors.push({
            agentName: agent?.agent_name || 'Unknown',
            agentId: caughtAgentId,
            error: err.message
          });
        }
      }
    }

    console.log('\n=== Retell Sync Summary ===');
    console.log(`Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`);
    if (stats.errors.length > 0) {
      console.log('Errors:', JSON.stringify(stats.errors.slice(0, 5), null, 2));
    }
    return stats;
  }

  async mapUserAgents(
    authUser: any,
    {
      mappings,
      skipUrlUpdate = false,
      companyId,
    }: {
      mappings: Array<{ userId: string; agentIds: string[] }>;
      skipUrlUpdate?: boolean;
      companyId: string; // ✅ Add companyId parameter
    }
  ) {
    const results: any[] = [];

    // ✅ NEW: Handle users completely removed from mapping
    if (companyId) {
      try {
        // Get all user IDs from the payload
        const payloadUserIds = mappings.map(m => m.userId);

        // Find all users who currently have active mappings for this company
        const allCompanyUserIds = await UserAgent.find({
          companyId,
          isArchived: false
        })
          .distinct('userId')
          .lean();

        // Find users who had mappings but are NOT in the payload (removed users)
        const usersToArchive = allCompanyUserIds.filter(
          existingUserId => !payloadUserIds.includes(existingUserId.toString())
        );

        if (usersToArchive.length > 0) {
          console.log(`Found ${usersToArchive.length} users to completely archive for company ${companyId}`);

          // Archive all mappings for these removed users
          for (const userIdToArchive of usersToArchive) {
            try {
              // Get all active agent mappings for this user
              const userMappings = await UserAgent.find({
                userId: userIdToArchive,
                companyId,
                isArchived: false
              }).lean();

              console.log(`Archiving ${userMappings.length} mappings for removed user ${userIdToArchive}`);

              for (const mapping of userMappings) {
                // ✅ Archive the UserAgent mapping
                await UserAgent.updateOne(
                  { _id: mapping._id },
                  {
                    $set: {
                      isArchived: true,
                      updatedAt: new Date(),
                      archivedAt: new Date(),
                      archivedBy: authUser._id,
                      archivedReason: 'User removed from all agent mappings'
                    }
                  }
                );

                // Clear Redis cache
                const redisKey = `user_agent:validation:${companyId}:${mapping.agentId}`;
                await getRedisClient().del(redisKey);

                results.push({
                  userId: userIdToArchive.toString(),
                  agentId: mapping.agentId?.toString(),
                  status: 'archived',
                  reason: 'User completely removed from mapping'
                });
              }

              console.log(`📦 Archived all mappings for removed user ${userIdToArchive}`);
            } catch (error: any) {
              console.error(`Error archiving mappings for user ${userIdToArchive}:`, error);
              results.push({
                userId: userIdToArchive.toString(),
                status: 'failed',
                reason: `Failed to archive: ${error.message}`
              });
            }
          }
        }
      } catch (error: any) {
        console.error('Error handling removed users:', error);
      }
    }

    // ✅ Continue with existing logic for users in the payload
    for (const mapping of mappings) {
      const { userId, agentIds } = mapping;

      // Step 1: Validate user
      const user = await User.findById(userId).lean();
      if (!user) {
        results.push({ userId, status: 'failed', reason: 'User not found' });
        continue;
      }

      // Step 2: Validate company
      const company = await Company.findById(user.companyId).lean();
      if (!company) {
        results.push({ userId, status: 'failed', reason: 'Company not found' });
        continue;
      }

      const webhookToken = company.webhookToken || '';

      const existingMappings = await UserAgent.find({
        userId,
        companyId: user.companyId
      }).lean();

      const existingAgentIds = existingMappings
        .filter(m => !m.isArchived && m.agentId != null)
        .map(m => m.agentId!.toString());

      const newAgentIds = agentIds; // Agent _ids from payload
      const agentIdsToArchive = existingAgentIds.filter(
        existingId => !newAgentIds.includes(existingId)
      );

      if (agentIdsToArchive.length > 0) {
        console.log(`Archiving ${agentIdsToArchive.length} agent mappings for user ${userId}`);

        for (const agentIdToArchive of agentIdsToArchive) {
          try {
            const agentToArchive = await Agent.findById(agentIdToArchive).lean();

            await UserAgent.updateMany(
              {
                userId,
                agentId: agentIdToArchive,
                companyId: user.companyId
              },
              {
                $set: {
                  isArchived: true,
                  updatedAt: new Date(),
                  archivedAt: new Date(),
                  archivedBy: authUser._id
                }
              }
            );

            results.push({
              userId,
              agentId: agentIdToArchive,
              agentName: agentToArchive?.agentName || 'Unknown',
              status: 'archived',
              reason: 'Agent removed from mapping'
            });

            // Clear Redis cache for archived mapping
            const redisKey = `user_agent:validation:${user.companyId}:${agentIdToArchive}`;
            await getRedisClient().del(redisKey);

            console.log(`📦 Archived mapping: User ${userId} - Agent ${agentIdToArchive}`);
          } catch (error: any) {
            console.error(`Error archiving mapping for agent ${agentIdToArchive}:`, error);
            results.push({
              userId,
              agentId: agentIdToArchive,
              status: 'failed',
              reason: `Failed to archive: ${error.message}`
            });
          }
        }
      }

      for (const agentIdentifier of agentIds) {
        try {
          // Find agent by MongoDB _id first
          let agent: any = await Agent.findById(agentIdentifier).lean();

          // If not found by _id, try finding by agentId (Retell) or assistantId (VAPI)
          if (!agent) {
            agent = await Agent.findOne({
              $or: [
                { agentId: agentIdentifier },
                { assistantId: agentIdentifier }
              ],
              companyId: user.companyId
            }).lean();
          }

          if (!agent) {
            console.log(`Agent not found for identifier:`, agentIdentifier);
            results.push({
              userId,
              agentIdentifier,
              status: 'failed',
              reason: 'Agent not found',
            });
            continue;
          }

          // Get voice provider from agent
          const voiceProvider = agent.voiceProvider || 'vapi';

          console.log(`Processing agent for mapping:`, {
            _id: agent._id,
            agentName: agent.agentName,
            voiceProvider: voiceProvider
          });

          // Get API key for the specific provider
          const apiKey = this.getApiKeyForProvider(company, voiceProvider);

          if (!apiKey) {
            results.push({
              userId,
              agentId: agent._id,
              agentName: agent.agentName,
              status: 'failed',
              reason: `API key not found for ${voiceProvider}`,
              voiceProvider
            });
            continue;
          }


          const existing = await UserAgent.findOne({
            userId,
            agentId: agent._id,
            companyId: user.companyId,
          }).lean();

          if (existing) {
            if (existing.isArchived) {
              // Check if user has other active agents
              const activeAgentCount = await UserAgent.countDocuments({
                userId,
                isArchived: false
              });
              const isPrimary = activeAgentCount === 0;

              await UserAgent.updateOne(
                { _id: existing._id },
                {
                  $set: {
                    isArchived: false,
                    updatedAt: new Date(),
                    voiceProvider,
                    isPrimary: isPrimary, // Auto-set primary if only agent
                    unarchivedAt: new Date(),
                    unarchivedBy: authUser._id
                  },
                  $unset: {
                    archivedAt: 1,
                    archivedBy: 1,
                    archivedReason: 1
                  }
                }
              );

              results.push({
                userId,
                agentId: agent._id,
                agentName: agent.agentName,
                status: 'unarchived',
                reason: 'Previously archived mapping restored',
                voiceProvider
              });

              console.log(`📤 Unarchived mapping: User ${userId} - Agent ${agent._id}`);
            } else {
              // Mapping already exists and is active - just keep it
              results.push({
                userId,
                agentId: agent._id,
                agentName: agent.agentName,
                status: 'kept',
                reason: 'Mapping already exists and is active',
                voiceProvider
              });
              console.log(`✅ Kept existing mapping: User ${userId} - Agent ${agent._id}`);
            }
            continue;
          }

          // Create new mapping
          // Check if user has other active agents
          const activeAgentCount = await UserAgent.countDocuments({
            userId,
            isArchived: false
          });
          const isPrimary = activeAgentCount === 0;

          await UserAgent.create({
            userId,
            agentId: agent._id,
            companyId: user.companyId,
            createdBy: authUser._id,
            voiceProvider,
            isArchived: false,
            isPrimary: isPrimary, // Auto-set primary if only agent
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          results.push({
            userId,
            agentId: agent._id,
            agentName: agent.agentName,
            status: 'created',
            voiceProvider,
          });

          console.log(`✨ Created new mapping: User ${userId} - Agent ${agent._id}`);

          // Clear Redis cache
          const redisKey = `user_agent:validation:${user.companyId}:${agent._id}`;
          await getRedisClient().del(redisKey);

          // Update URLs based on agent's voice provider
          if (!skipUrlUpdate) {
            try {
              if (voiceProvider === 'retell') {
                console.log('Updating Retell URLs for agent:', agent.agentId);
                await this.updateRetellAgentUrls(agent, webhookToken, apiKey);
              } else if (voiceProvider === 'vapi') {
                console.log('Updating VAPI URLs for agent:', agent.assistantId);
                await this.updateVapiAssistantUrls(agent, webhookToken, apiKey);
              }
            } catch (err: any) {
              console.error(
                `⚠️ ${voiceProvider.toUpperCase()} URL update failed for ${agent._id}:`,
                err.message
              );
            }
          }
        } catch (error: any) {
          console.error(`Error processing agent ${agentIdentifier}:`, error);
          results.push({
            userId,
            agentIdentifier,
            status: 'failed',
            reason: error.message || 'Unknown error occurred',
          });
        }
      }
    }


    return {
      message: 'User–Agent mapping completed successfully',
      results,
      summary: {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        kept: results.filter(r => r.status === 'kept').length,
        unarchived: results.filter(r => r.status === 'unarchived').length,
        archived: results.filter(r => r.status === 'archived').length,
        failed: results.filter(r => r.status === 'failed').length,
        byProvider: {
          vapi: results.filter(r =>
            (r.status === 'created' || r.status === 'kept' || r.status === 'unarchived') &&
            r.voiceProvider === 'vapi'
          ).length,
          retell: results.filter(r =>
            (r.status === 'created' || r.status === 'kept' || r.status === 'unarchived') &&
            r.voiceProvider === 'retell'
          ).length
        }
      }
    };
  }

  private validateAgentConfiguration(
    agent: any,
    voiceProvider: string
  ): {
    isValid: boolean;
    errors: string[];
    missingFields: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const missingFields: string[] = [];
    const suggestions: string[] = [];

    // ✅ Always validate primary phone
    const isPrimaryPhoneInvalid =
      !agent.primaryPhone ||
      agent.primaryPhone.trim() === '' ||
      agent.primaryPhone.trim().toLowerCase() === 'n/a';

    if (isPrimaryPhoneInvalid) {
      errors.push('Primary Phone Number is required');
      missingFields.push('primaryPhone');
      suggestions.push('Set a valid Primary Phone Number for this agent');
    }

    // ✅ Provider-specific validation
    if (voiceProvider === 'vapi') {
      const isVapiPhoneNumberIdInvalid =
        !agent.vapiPhoneNumberId ||
        agent.vapiPhoneNumberId.trim() === '';

      const isAssistantIdInvalid =
        !agent.assistantId ||
        agent.assistantId.trim() === '';

      if (isVapiPhoneNumberIdInvalid) {
        errors.push('VAPI Phone Number ID is required for VAPI provider');
        missingFields.push('vapiPhoneNumberId');
        suggestions.push('Set the VAPI Phone Number ID for this agent');
      }

      if (isAssistantIdInvalid) {
        errors.push('Assistant ID is required for VAPI provider');
        missingFields.push('assistantId');
        suggestions.push('Set the Assistant ID for this agent');
      }
    }

    if (voiceProvider === 'retell') {
      const isAgentIdInvalid =
        !agent.agentId ||
        agent.agentId.trim() === '';

      if (isAgentIdInvalid) {
        errors.push('Agent ID is required for Retell provider');
        missingFields.push('agentId');
        suggestions.push('Set the Agent ID for this agent');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      missingFields,
      suggestions
    };
  }

  private async updateRetellAgentUrls(agent: any, webhookToken: string, apiKey?: string | null) {
    if (!agent?.agentId) return;

    const webhookUrl = `${process.env.RETELL_WEBHOOK_BASE_URL}?signature=${webhookToken}`;
    const websocketUrl = `${process.env.RETELL_WS_BASE_URL}?signature=${webhookToken}`;

    const retellKey = apiKey || process.env.RETELL_API_KEY; // 👈 choose company key or default

    await axios.put(
      `${process.env.RETELL_BASE_URL}/get-agent/${agent.agentId}`,
      { webhookUrl, websocketUrl },
      {
        headers: {
          Authorization: `Bearer ${retellKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`🔁 Retell URLs updated for agent: ${agent.agentId}`);
  }

  /**
   * 🔧 Update VAPI Assistant Webhook URL
   */
  private async updateVapiAssistantUrls(agent: any, webhookToken: string, apiKey?: string | null) {
    console.log('Updating VAPI assistant webhook URL for agent:', agent);
    console.log('Using webhook token:', webhookToken);
    console.log('Using API key:', apiKey || 'default from env');
    if (!agent?.assistantId) return;

    const webhookUrl = `${process.env.VAPI_WEBHOOK_BASE_URL}?signature=${webhookToken}`;
    const vapiKey = apiKey || process.env.VAPI_API_KEY; // 👈 choose company key or default

    await axios.patch(
      `${process.env.VAPI_BASE_URL}/assistants/${agent.assistantId}`,
      {
        tools: [
          {
            type: 'webhook',
            url: webhookUrl,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${vapiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`🔁 VAPI assistant webhook updated: ${agent.assistantId}`);
  }

  public async getAllAgentsForSuperAdmin(user: any, search?: string, companyId?: string): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      if (!isSuperAdmin) {
        throw throwError(
          'Access denied. Super Admin privileges required.',
          { status: 403 },
          'FORBIDDEN'
        );
      }

      console.log('Getting all agents for Super Admin with user assignments', { companyId });

      // Build query for Agent collection - filter by companyId FIRST
      const agentQuery: any = {
        isArchived: false
      };

      // Add companyId filter to Agent query
      if (companyId) {
        agentQuery.companyId = companyId;
      }

      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), 'i');
        agentQuery.$or = [
          { agentName: searchRegex },
          { agentId: searchRegex }
        ];
      }

      const agents = await Agent.find(agentQuery)
        .select('_id agentName agentId vapiPhoneNumberId primaryPhone companyId voiceProvider webhookUrl isActive')
        .sort({ agentName: 1 })
        .lean();

      if (agents.length > 0) {
        console.log('📋 First agent data:', {
          agentName: agents[0].agentName,
          webhookUrl: agents[0].webhookUrl,
          hasWebhookUrl: !!agents[0].webhookUrl,
          _id: agents[0]._id
        });
      }

      if (agents.length === 0) {
        return {
          status: true,
          message: 'No agents found for the specified company',
          data: [],
          totalCount: 0,
          stats: {
            totalAgents: 0,
            agentsWithUsers: 0,
            agentsWithoutUsers: 0
          }
        };
      }

      const agentIds = agents.map(agent => agent._id);

      // Get user assignments for these agents, also filtered by companyId
      const userAgentQuery: any = {
        agentId: { $in: agentIds }
      };

      if (companyId) {
        userAgentQuery.companyId = companyId;
      }

      const userAssignments = await UserAgent.find(userAgentQuery)
        .select('agentId userId voiceProvider companyId')
        .lean();

      // Create a map for agent user assignments with voice provider info
      const agentUserMap = new Map<string, Array<{ userId: string; voiceProvider: string }>>();

      userAssignments.forEach(assignment => {
        if (!assignment || !assignment.agentId) {
          return;
        }

        const agentIdStr = assignment.agentId.toString();
        if (!agentUserMap.has(agentIdStr)) {
          agentUserMap.set(agentIdStr, []);
        }

        if (assignment.userId) {
          agentUserMap.get(agentIdStr)!.push({
            userId: assignment.userId.toString(),
            voiceProvider: assignment.voiceProvider || 'vapi'
          });
        }
      });

      // Map agents with users and additional fields
      const agentsWithUsers = agents.map(agent => {
        const agentIdStr = agent._id.toString();
        const userAssignments = agentUserMap.get(agentIdStr) || [];

        // Priority 1: Get voiceProvider from Agent collection
        let voiceProvider = agent.voiceProvider;

        // Priority 2: If not in Agent, check UserAgent assignments
        if (!voiceProvider && userAssignments.length > 0) {
          const userAgentProvider = userAssignments.find(
            assignment => assignment.voiceProvider
          )?.voiceProvider;
          voiceProvider = userAgentProvider;
        }

        // Priority 3: Default to 'vapi' if still not found
        if (!voiceProvider) {
          voiceProvider = 'vapi';
        }

        // Check if the resolved voiceProvider is VAPI
        const isVapiProvider = voiceProvider === 'vapi';

        const isPrimaryPhoneValid =
          agent.primaryPhone && agent.primaryPhone.trim().toUpperCase() !== 'N/A';

        const result = {
          _id: agentIdStr,
          agentName: agent.agentName,
          agentId: agent.agentId,
          companyId: agent.companyId?.toString() || null,
          userId: userAssignments.map(assignment => assignment.userId),
          phoneNumberId: isVapiProvider && agent.vapiPhoneNumberId
            ? agent.vapiPhoneNumberId
            : null,
          outboundNumber: isPrimaryPhoneValid ? agent.primaryPhone : null,
          voiceProvider: voiceProvider,
          webhookUrl: agent.webhookUrl || null,
        };

        if (agent.webhookUrl) {
          console.log(`Agent "${agent.agentName}" has webhookUrl:`, agent.webhookUrl);
        }

        return result;
      });

      console.log(`Found ${agentsWithUsers.length} agents for company ${companyId}`);

      const agentsWithUsersCount = agentsWithUsers.filter(a => a.userId.length > 0).length;
      console.log(`Agents with user assignments: ${agentsWithUsersCount}`);

      const agentsWithWebhook = agentsWithUsers.filter(a => a.webhookUrl).length;
      console.log(`Agents with webhookUrl: ${agentsWithWebhook}`);

      return {
        status: true,
        message: 'Agents retrieved successfully',
        data: agentsWithUsers,
        totalCount: agentsWithUsers.length,
        stats: {
          totalAgents: agentsWithUsers.length,
          agentsWithUsers: agentsWithUsersCount,
          agentsWithoutUsers: agentsWithUsers.length - agentsWithUsersCount
        }
      };
    } catch (error: any) {
      console.error('Error in getAllAgentsForSuperAdmin:', error);
      throw throwError(
        `Failed to retrieve agents: ${error.message}`,
        { status: error.status || 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async updateAgentPhone(
    agentId: string,
    phoneNumberId?: string | null,
    outboundNumber?: string | null,
    twilioAccountSid?: string | null,
    user?: any
  ): Promise<any> {
    try {
      if (!agentId) {
        throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
      }

      Server.log.info({ agentId, phoneNumberId, outboundNumber }, 'Updating agent phone');

      // Find agent
      const agent = await Agent.findById(agentId);
      if (!agent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      console.log(agent)

      const updatedFields: string[] = [];

      // 1. Update VAPI phone number ID (only for VAPI providers)


      if (agent?.voiceProvider === 'vapi') {
        (agent as any).vapiPhoneNumberId = phoneNumberId || null;
        updatedFields.push('vapiPhoneNumberId');
        Server.log.info({ phoneNumberId }, 'Updated vapiPhoneNumberId');
      } else {
        Server.log.info('Skipped vapiPhoneNumberId - not VAPI provider');
      }

      // 2. Update outbound number configuration
      if (outboundNumber !== undefined && outboundNumber) {
        const formattedNumber = outboundNumber.trim().startsWith('+')
          ? outboundNumber.trim()
          : `+${outboundNumber.trim()}`;

        // Update primary phone settings
        agent.primaryPhone = formattedNumber;

        agent.phone = formattedNumber;

        (agent as any).primaryCallType = 'outbound';

        // Initialize phoneMapping if needed
        if (!(agent as any).phoneMapping) {
          (agent as any).phoneMapping = { inbound: null, outbound: null };
        }

        // Update outbound mapping
        (agent as any).phoneMapping.outbound = {
          number: formattedNumber,
          formatted: formattedNumber,
          callType: 'outbound'
        };

        // Initialize phoneBindings if needed
        if (!agent.phoneBindings || !Array.isArray(agent.phoneBindings)) {
          agent.phoneBindings = [];
        }

        // Find existing outbound binding
        const outboundIndex = (agent.phoneBindings as any[]).findIndex(
          b => b.direction === 'outbound'
        );

        if (outboundIndex !== -1) {
          // Update existing outbound binding
          (agent.phoneBindings as any[])[outboundIndex] = {
            ...(agent.phoneBindings as any[])[outboundIndex],
            number: formattedNumber,
            formatted: formattedNumber,
            twilioAccountSid: twilioAccountSid || (agent.phoneBindings as any[])[outboundIndex].twilioAccountSid || null
          };
          Server.log.info('Updated existing outbound binding');
        } else {
          // Add new outbound binding
          (agent.phoneBindings as any[]).push({
            id: uuidv4(),
            number: formattedNumber,
            direction: 'outbound',
            formatted: formattedNumber,
            twilioAccountSid: twilioAccountSid || null,
            twilioAuthToken: null
          });
          Server.log.info('Added new outbound binding');
        }

        updatedFields.push('primaryPhone', 'primaryCallType', 'phoneMapping', 'phoneBindings', 'phone');
        Server.log.info({ formattedNumber }, 'Updated outbound configuration');
      }
      // Clear outbound configuration if null/empty
      else if (outboundNumber !== undefined && !outboundNumber) {
        agent.primaryPhone = 'N/A';
        agent.phone = 'N/A';
        (agent as any).primaryCallType = 'inbound';

        if ((agent as any).phoneMapping) {
          (agent as any).phoneMapping.outbound = null;
        }

        if (agent.phoneBindings && Array.isArray(agent.phoneBindings)) {
          agent.phoneBindings = (agent.phoneBindings as any[]).filter(
            b => b.direction !== 'outbound'
          );
        }

        updatedFields.push('primaryPhone', 'primaryCallType', 'phoneMapping', 'phoneBindings', 'phone');
        Server.log.info('Cleared outbound configuration');
      }

      // Mark modified for Mongoose
      if ((agent as any).phoneMapping) {
        agent.markModified('phoneMapping');
      }
      if (agent.phoneBindings) {
        agent.markModified('phoneBindings');
      }

      // Update metadata
      agent.updatedAt = new Date();
      if (user?._id) {
        agent.updatedBy = user._id;
      }

      await agent.save();

      Server.log.info({ agentId, updatedFields }, 'Agent phone updated successfully');

      return {
        status: true,
        message: 'Agent phone details updated successfully',
        data: agent,
        updatedFields
      };

    } catch (error: any) {
      Server.log.error(error, 'Error in updateAgentPhone');
      throw throwError(
        `Failed to update agent phone: ${error.message}`,
        { status: error.status || 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async getCurrentMappedAgents(user: any, payload: any): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      console.log('User info for current mappings:', {
        userId: user.userId,
        isAdmin: user.isAdmin,
        isSuperAdmin: isSuperAdmin,
        companyId: user.companyId,
        payloadCompanyId: payload?.companyId
      });

      // ✅ Determine which companyId to use
      let targetCompanyId: string;

      if (isSuperAdmin) {
        if (!payload?.companyId) {
          console.log('Super admin must provide companyId filter');
          return {
            status: true,
            message: 'Please select a company to view agents',
            data: [],
            totalCount: 0,
            isSuperAdmin: true,
            requiresCompanyFilter: true
          };
        }
        targetCompanyId = payload.companyId;
        console.log('Super Admin filtering by company:', targetCompanyId);
      } else if (user.isAdmin) {
        // Company admin can optionally filter by companyId, or use their own
        targetCompanyId = payload?.companyId || user.companyId;
        console.log('Company Admin filtering by company:', targetCompanyId);
      } else {
        // Regular user - use their company
        targetCompanyId = user.companyId;
        console.log('Regular user filtering by company:', targetCompanyId);
      }

      // ✅ Step 1: Find all non-archived user mappings for this company
      const activeUserAgents = await UserAgent.find({
        companyId: new Types.ObjectId(targetCompanyId),
        isArchived: false
      })
        .select('agentId userId')
        .lean();

      if (activeUserAgents.length === 0) {
        console.log('No active user mappings found for company:', targetCompanyId);
        return {
          status: true,
          message: 'No mapped agents found for this company',
          data: [],
          totalCount: 0,
          isSuperAdmin: isSuperAdmin
        };
      }

      // ✅ Step 2: Get unique agent IDs from active mappings (with null check)
      const agentIds = [...new Set(
        activeUserAgents
          .filter(ua => ua.agentId != null) // Filter out null/undefined agentIds
          .map(ua => ua.agentId!.toString())
      )];

      console.log(`Found ${agentIds.length} unique agents with active mappings`);

      if (agentIds.length === 0) {
        console.log('No valid agent IDs found in user mappings');
        return {
          status: true,
          message: 'No valid mapped agents found for this company',
          data: [],
          totalCount: 0,
          isSuperAdmin: isSuperAdmin
        };
      }

      // ✅ Step 3: Query Agent collection
      const agents = await Agent.find({
        _id: { $in: agentIds.map(id => new Types.ObjectId(id)) },
        companyId: new Types.ObjectId(targetCompanyId),
        isArchived: { $ne: true }
      })
        .select('agentName agentId webhookUrl voiceProvider companyId vapiPhoneNumberId primaryPhone')
        .lean();

      console.log(`Retrieved ${agents.length} agents from Agent collection`);

      const agentToUsersMap: Record<string, string[]> = {};

      activeUserAgents.forEach(mapping => {
        if (!mapping.agentId || !mapping.userId) return;
        const agentIdStr = mapping.agentId.toString();
        const userIdStr = mapping.userId.toString();

        if (!agentToUsersMap[agentIdStr]) {
          agentToUsersMap[agentIdStr] = [];
        }

        if (!agentToUsersMap[agentIdStr].includes(userIdStr)) {
          agentToUsersMap[agentIdStr].push(userIdStr);
        }
      });

      // ✅ Step 4: Format the response
      const formattedData = agents.map((agent: any) => {
        const voiceProvider = agent.voiceProvider || 'vapi';
        const isVapiProvider = voiceProvider === 'vapi';

        return {
          _id: agent._id.toString(),
          agentName: agent.agentName,
          agentId: agent.agentId,
          webhookUrl: agent.webhookUrl || null,
          voiceProvider: voiceProvider,
          companyId: agent.companyId?.toString() || null,
          vapiPhoneNumberId: isVapiProvider && agent.vapiPhoneNumberId
            ? agent.vapiPhoneNumberId
            : null,
          outboundNumber: agent.primaryPhone && agent.primaryPhone.trim().toUpperCase() !== 'N/A'
            ? agent.primaryPhone
            : null,
          userId: agentToUsersMap[agent._id.toString()] || []
        };
      });

      console.log(`Returning ${formattedData.length} formatted agents`);

      return {
        status: true,
        message: 'Mapped agents retrieved successfully',
        data: formattedData,
        totalCount: formattedData.length,
        isSuperAdmin: isSuperAdmin,
        companyId: targetCompanyId
      };
    } catch (error: any) {
      console.error('Error in getCurrentMappedAgents:', error);
      throw throwError(
        `Failed to retrieve mapped agents: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }


  async updateAgentPrompt(agentId: string, user: any, payload: any) {
    try {
      const { agentName, systemPrompt, firstMessage, postCallAnalysisData } = payload;

      /* 1️⃣ CHECK AGENT */
      const existingAgent = await Agent.findById(agentId);
      if (!existingAgent) {
        throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
      }

      /* 2️⃣ GET COMPANY + VAPI KEY */
      const company = await Company.findById(existingAgent.companyId);
      if (!company) {
        throw throwError('Company not found', { status: 404 }, 'NOT_FOUND');
      }

      const vapiProvider = company.voiceProviders?.find(
        (provider: any) => provider.name === 'vapi'
      );

      if (!vapiProvider?.api_key_id) {
        throw throwError(
          'VAPI API key not configured properly',
          { status: 500 },
          'CONFIG_ERROR'
        );
      }

      const vapiApiKey = vapiProvider.api_key_id;

      /* 3️⃣ CONVERT ARRAY → JSON SCHEMA */
      const structuredSchema =
        this.convertPostCallToVapiSchema(postCallAnalysisData || []);

      /* 4️⃣ BUILD PATCH PAYLOAD */
      const patchPayload: any = {};

      if (agentName && agentName !== existingAgent.agentName) {
        patchPayload.name = agentName;
      }

      /* ✅ Preserve provider + model from DB */
      if (systemPrompt) {
        patchPayload.model = {
          provider: existingAgent.responseEngine?.type || 'openai',
          model: existingAgent.responseEngine?.llm_id || 'gpt-5-chat-latest',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ]
        };
      }

      if (firstMessage) {
        patchPayload.firstMessage = firstMessage;
      }

      if (postCallAnalysisData?.length) {
        patchPayload.analysisPlan = {
          structuredDataPlan: {
            enabled: true,
            schema: structuredSchema
          }
        };
      }

      /* 5️⃣ PATCH VAPI */
      await axios.patch(
        `https://api.vapi.ai/assistant/${existingAgent.agentId}`,
        patchPayload,
        {
          headers: {
            Authorization: `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      /* 6️⃣ UPDATE DATABASE AFTER SUCCESS */
      const dbUpdate = await Agent.findByIdAndUpdate(
        agentId,
        {
          ...(agentName && { agentName }),
          ...(systemPrompt && { agentPrompt: systemPrompt }),
          ...(firstMessage && { firstMessage }),
          ...(postCallAnalysisData && { postCallAnalysisData }),
          updatedAt: new Date()
        },
        { new: true }
      );

      return {
        success: true,
        message: 'Agent updated successfully',
        data: dbUpdate
      };

    } catch (error: any) {
      Server.log.error(error, 'Error updating agent');
      throw error;
    }
  }


  /* ============================= */
  /* 🔥 SCHEMA CONVERTER FUNCTION */
  /* ============================= */

  convertPostCallToVapiSchema(data: any[] = []) {
    const properties: any = {};
    const required: string[] = [];

    data.forEach(field => {
      if (!field?.name || !field?.type) return;

      properties[field.name] = {
        type: field.type,
        description: field.description || ''
      };

      if (field.enum && Array.isArray(field.enum) && field.enum.length) {
        properties[field.name].enum = field.enum;
      }

      if (field.required) {
        required.push(field.name);
      }
    });

    return {
      type: 'object',
      properties,
      required
    };
  }
}

