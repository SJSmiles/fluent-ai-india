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
