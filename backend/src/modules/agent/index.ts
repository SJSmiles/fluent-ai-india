import { AppModule } from '../../common/common-interfaces';
import {
  agentListingForBatchCallHandler,
  agentListingHandler,
  createAgentHandler,
  deleteAgentHandler,
  updateAgentHandler,
  setPrimaryAgentHandler,
  makeCallHandler,
  mapUserAgentsHandler,
  getUserAgentMappingHandler,
  downloadSampleExcelHandler,
} from './handler/agent.handler';
import {
  createAgentRequest,
  currentMappingsRequest,
  deleteAgentRequest,
  getAllAgentsForBatchCallRequest,
  getAllAgentsRequest,
  mapUserAgentsRequest,
  updateAgentRequest,
  setPrimaryAgentRequest,
  makeCallRequest,
  getUserAgentMappingRequest,
  downloadSampleExcelRequest
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
    },
    {
      method: 'POST',
      url: '/map-user-agents',
      auth: true,
      schema: mapUserAgentsRequest,
      handler: mapUserAgentsHandler
    },
    {
      method: 'GET',
      url: '/user-agent-mapping',
      auth: true,
      schema: getUserAgentMappingRequest,
      handler: getUserAgentMappingHandler
    },
    {
      method: 'GET',
      url: '/download-sample',
      auth: true,
      schema: downloadSampleExcelRequest,
      handler: downloadSampleExcelHandler,
      isFileDownload: true
    }
  ]
};