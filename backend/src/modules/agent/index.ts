import { AppModule } from '../../common/common-interfaces';
import {
  agentDetailsHandler,
  agentListingForBatchCallHandler,
  agentListingHandler,
  agentPromptHandler,
  agentPullHandler,
  createAgentHandler,
  currentMappingsHandler,
  // createUserAgentsHandler,
  deleteAgentHandler,
  duplicateAgentHandler,
  getAllAgentsForSuperAdminHandler,
  mapUserAgentsHandler,
  updateAgentHandler,
  updateAgentPhoneHandler,
  updateCustomAgentHandler,
  setPrimaryAgentHandler,
  updateAgentPromptHandler
} from './handler/agent.handler';
import {
  agentPullRequest,
  createAgentRequest,
  currentMappingsRequest,
  deleteAgentRequest,
  duplicateAgentRequest,
  getAgentDetailsRequest,
  getAgentPromptRequest,
  getAllAgentsForBatchCallRequest,
  getAllAgentsForSuperAdminRequest,
  getAllAgentsRequest,
  mapUserAgentsRequest,
  updateAgentPhoneRequest,
  updateAgentRequest,
  updateCustomAgentRequest,
  setPrimaryAgentRequest,
  updateAgentPromptRequest
} from './schema/agent.schema';

export const module: AppModule = {
  name: 'Agent module',
  mountPoint: '/agents',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createAgentRequest,
      handler: createAgentHandler
    },

    {
      method: 'POST',
      url: '/pull',
      auth: true,
      schema: agentPullRequest,
      handler: agentPullHandler
    },

    {
      method: 'POST',
      url: '/user-agents-map',
      auth: true,
      schema: mapUserAgentsRequest,
      handler: mapUserAgentsHandler
    },

    {
      method: 'PUT',
      url: '/update/:id',
      auth: true,
      schema: updateAgentRequest,
      handler: updateAgentHandler
    },

    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: getAllAgentsRequest,
      handler: agentListingHandler
    },
    {
      method: 'GET',
      url: '/filter-list',
      auth: true,
      schema: getAllAgentsForBatchCallRequest,
      handler: agentListingForBatchCallHandler
    },
    // {
    //   method: 'GET',
    //   url: '/agent-listing',
    //   auth: true,
    //   schema: getAllRetellAgentsRequest,
    //   handler: retellAgentListingHandler
    // },

    {
      method: 'PUT',
      url: '/delete/:id',
      auth: true,
      schema: deleteAgentRequest,
      handler: deleteAgentHandler
    },

    {
      method: 'POST',
      url: '/duplicate/:id',
      auth: true,
      schema: duplicateAgentRequest,
      handler: duplicateAgentHandler
    },
    {
      method: 'POST',
      url: '/agent-details',
      auth: true,
      schema: getAgentDetailsRequest,
      handler: agentDetailsHandler
    },
    {
      method: 'POST',
      url: '/agent-prompt',
      auth: true,
      schema: getAgentPromptRequest,
      handler: agentPromptHandler
    },

    {
      method: 'PUT',
      url: '/custom-update/:id',
      auth: true,
      schema: updateCustomAgentRequest,
      handler: updateCustomAgentHandler
    },
    {
      method: 'GET',
      url: '/all-agents',
      auth: true,
      schema: getAllAgentsForSuperAdminRequest,
      handler: getAllAgentsForSuperAdminHandler
    },

    {
      method: 'PUT',
      url: '/update-agent-phone',
      auth: true,
      schema: updateAgentPhoneRequest,
      handler: updateAgentPhoneHandler
    },
    {
      method: 'GET',
      url: '/current-mappings',
      auth: true,
      schema: currentMappingsRequest,
      handler: currentMappingsHandler
    },
    {
      method: 'POST',
      url: '/set-primary',
      auth: true,
      schema: setPrimaryAgentRequest,
      handler: setPrimaryAgentHandler
    },
    {
      method: 'PUT',
      url: '/update-prompt/:id',
      auth: false,
      schema: updateAgentPromptRequest,
      handler: updateAgentPromptHandler
    },
  ]
};
