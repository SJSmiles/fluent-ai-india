import { AppModule } from '../../common/common-interfaces';
import {
  agentListingForBatchCallHandler,
  agentListingHandler,
  createAgentHandler,
  deleteAgentHandler,
  updateAgentHandler,
  setPrimaryAgentHandler,
  makeCallHandler,
} from './handler/agent.handler';
import {
  createAgentRequest,
  currentMappingsRequest,
  deleteAgentRequest,
  duplicateAgentRequest,
  getAgentDetailsRequest,
  getAllAgentsForBatchCallRequest,
  getAllAgentsForSuperAdminRequest,
  getAllAgentsRequest,
  mapUserAgentsRequest,
  updateAgentRequest,
  setPrimaryAgentRequest,
  makeCallRequest
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
    {
      method: 'PUT',
      url: '/delete/:id',
      auth: true,
      schema: deleteAgentRequest,
      handler: deleteAgentHandler
    },
    {
      method: 'POST',
      url: '/set-primary',
      auth: true,
      schema: setPrimaryAgentRequest,
      handler: setPrimaryAgentHandler
    },
    {
      method: 'POST',
      url: '/make-call',
      auth: true,
      schema: makeCallRequest,
      handler: makeCallHandler
    }
  ]
};
