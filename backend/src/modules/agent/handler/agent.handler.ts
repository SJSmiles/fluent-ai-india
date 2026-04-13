import { Server } from '../../../server';
import { AgentService } from '../service/agent.service';
import { throwError } from '../../../common/app-helper';

const AgentServiceInstance = new AgentService();

export async function createAgentHandler(request: any) {
  try {
    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
    const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
    if (!isSuperAdmin && !user.isAdmin) {
      throw throwError('Permission denied: Admin access required', { status: 403 }, 'FORBIDDEN');
    }
    Server.log.info(request.body, 'Create Agent request payload');
    const result = await AgentServiceInstance.agentCreate(request.user, request.body);
    Server.log.info(result, 'Create Agent response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in createAgentHandler');
    throw error;
  }
}

export async function updateAgentHandler(request: any) {
  try {
    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
    const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
    if (!isSuperAdmin && !user.isAdmin) {
      throw throwError('Permission denied: Admin access required', { status: 403 }, 'FORBIDDEN');
    }
    Server.log.info(request.body, 'Update Agent request payload');
    if (!request.params.id) {
      throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
    }
    const result = await AgentServiceInstance.updateAgent(
      request.params.id,
      request.user,
      request.body
    );
    Server.log.info(result, 'Update Agent response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateAgentHandler');
    throw error;
  }
}

export async function agentListingHandler(request: any) {
  try {
    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
    const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
    if (!isSuperAdmin && !user.isAdmin) {
      throw throwError('Permission denied: Admin access required', { status: 403 }, 'FORBIDDEN');
    }
    return await AgentServiceInstance.getAgentListing(request.user, request.query);
  } catch (error: any) {
    Server.log.error(error, 'Error in agentListingHandler');
    throw error;
  }
}

export async function agentListingForBatchCallHandler(request: any) {
  try {
    return await AgentServiceInstance.getAgentListingForBatchCall(request.user, request.query);
  } catch (error: any) {
    Server.log.error(error, 'Error in agentListingForBatchCallHandler');
    throw error;
  }
}

export async function deleteAgentHandler(request: any) {
  try {
    if (!request.params.id) {
      throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
    }
    const result = await AgentServiceInstance.deleteAgent(request.params.id, request.user);
    Server.log.info(result, 'Delete Agent response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in deleteAgentHandler');
    throw error;
  }
}

export async function setPrimaryAgentHandler(request: any) {
  try {
    const { agentId, userId } = request.body;
    return await AgentServiceInstance.setPrimaryAgent(userId, agentId);
  } catch (error: any) {
    Server.log.error(error, 'Error in setPrimaryAgentHandler');
    throw error;
  }
}

export async function makeCallHandler(request: any) {
  try {
    return await AgentServiceInstance.makeCall(request.user, request.body);
  } catch (error: any) {
    Server.log.error(error, 'Error in makeCallHandler');
    throw error;
  }
}

// Add this in agent.handler.ts

export async function mapUserAgentsHandler(request: any) {
  try {
    Server.log.info(request.body, 'Map User Agents request payload');
    const result = await AgentServiceInstance.mapUserAgents(request.user, request.body);
    Server.log.info(result, 'Map User Agents response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in mapUserAgentsHandler');
    throw error;
  }
}


// ── Handler (add in agent.handler.ts) ────────────────────────────────────────

export async function getUserAgentMappingHandler(request: any) {
  try {
    Server.log.info(request.query, 'Get User Agent Mapping request query');
    const result = await AgentServiceInstance.getUserAgentMapping(request.user, request.query);
    Server.log.info(result, 'Get User Agent Mapping response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getUserAgentMappingHandler');
    throw error;
  }
}

// Add this in agent.handler.ts
export async function downloadSampleExcelHandler(request: any, reply: any) {
  try {
    const { buffer, filename } = await AgentServiceInstance.downloadSampleExcel(
      request.user,
      request.query
    );

    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);

    // Tell Fastify the reply is already handled
    reply.hijack();

  } catch (error: any) {
    Server.log.error(error, 'Error in downloadSampleExcelHandler');
    throw error;
  }
}