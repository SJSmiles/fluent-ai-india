import { Server } from '../../../server';
import { AgentService } from '../service/agent.service';
import { throwError } from '../../../common/app-helper';

const AgentServiceInstance = new AgentService();

export async function createAgentHandler(request: any) {
  try {
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
    return await AgentServiceInstance.getAgentListing(request.user, request.query);
  } catch (error: any) {
    Server.log.error(error, 'Error in agentListingHandler');
    throw error;
  }
}
// export async function retellAgentListingHandler(request: any) {
//   try {
//     return await AgentServiceInstance.getAgentListingFromRetell(request.user, request.query);
//   } catch (error: any) {
//     Server.log.error(error, 'Error in agentListingHandler');
//     throw error;
//   }
// }

export async function agentListingForBatchCallHandler(request: any) {
  try {
    // Pass request.query to support userId and companyId filters
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

export async function duplicateAgentHandler(request: any) {
  try {
    Server.log.info(request.params, 'DuplicateAgent request payload');
    if (!request.params.id) {
      throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
    }

    const result = await AgentServiceInstance.duplicateAgent(request.params.id, request.user);
    Server.log.info(result, 'Duplicate Agent response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in duplicateAgentHandler');
    throw error;
  }
}

export async function agentDetailsHandler(request: any) {
  try {
    return await AgentServiceInstance.getAgentDetails(request.user, request.body);
  } catch (error: any) {
    Server.log.error(error, 'Error in agentDetailsHandler');
    throw error;
  }
}

export async function agentPromptHandler(request: any) {
  try {
    return await AgentServiceInstance.getAgentPromptDetails(request.user, request.body);
  } catch (error: any) {
    Server.log.error(error, 'Error in agentPromptHandler');
    throw error;
  }
}

export async function updateCustomAgentHandler(request: any) {
  try {
    // Check for ID in params (not query since you're using :id in URL)
    if (!request.params.id) {
      throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
    }

    const result = await AgentServiceInstance.updateCustomAgent(
      request.params.id,
      request.user,
      request.body
    );

    // Server.log.info(result, 'Update Custom Agent response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateAgentHandler');
    throw error;
  }
}

export async function agentPullHandler(request: any) {
  try {
    const { companyId, voiceProvider } = request.body;
    Server.log.info(`Agent Pull request for companyId: ${companyId}, voiceProvider: ${voiceProvider || 'primary'}`);

    console.log(request.body)
    console.log(voiceProvider)

    const result = await AgentServiceInstance.pullAgents(companyId, voiceProvider);

    Server.log.info(result, 'Agent Pull response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in agentPullHandler');
    throw error;
  }
}

export async function mapUserAgentsHandler(request: any) {
  try {
    const { mappings, skipUrlUpdate, companyId } = request.body;

    return await AgentServiceInstance.mapUserAgents(request.user, {
      mappings,
      skipUrlUpdate: skipUrlUpdate || false,
      companyId
    });
  } catch (error: any) {
    Server.log.error(error, 'Error in mapUserAgentsHandler');
    throw error;
  }
}

export async function getAllAgentsForSuperAdminHandler(request: any) {
  try {
    const { search, companyId } = request.query;
    Server.log.info({ search, companyId }, 'Get All Agents for Super Admin request');
    const result = await AgentServiceInstance.getAllAgentsForSuperAdmin(
      request.user,
      search,
      companyId
    );

    Server.log.info({
      agentCount: result.data?.length,
      agentsWithUsers: result.data?.filter((a: any) => a.userId?.length > 0).length,
      companyId
    }, 'Get All Agents for Super Admin response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getAllAgentsForSuperAdminHandler');
    throw error;
  }
}

export async function updateAgentPhoneHandler(request: any) {
  try {
    const { agentId, phoneNumberId, outboundNumber, twilioAccountSid } = request.body;

    Server.log.info({
      agentId,
      phoneNumberId,
      outboundNumber,
      userId: request.user?._id
    }, 'Update Agent Phone request');

    const result = await AgentServiceInstance.updateAgentPhone(
      agentId,
      phoneNumberId,
      outboundNumber,
      twilioAccountSid,
      request.user
    );

    Server.log.info({
      agentId,
      updated: true,
      phoneNumberId: result.data?.phoneNumberId,
      outboundNumber: result.data?.outboundNumber
    }, 'Update Agent Phone response');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateAgentPhoneHandler');
    throw error;
  }
}

export async function currentMappingsHandler(request: any) {
  try {
    // Pass request.query to support companyId filter
    return await AgentServiceInstance.getCurrentMappedAgents(request.user, request.query);
  } catch (error: any) {
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


export async function updateAgentPromptHandler(request: any) {
  try {
    Server.log.info(request.body, 'Update Agent request payload');

    if (!request.params.id) {
      throw throwError('Agent ID is required', { status: 400 }, 'BAD_REQUEST');
    }

    const result = await AgentServiceInstance.updateAgentPrompt(
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
