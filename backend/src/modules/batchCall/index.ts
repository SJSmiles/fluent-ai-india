import { AppModule } from '../../common/common-interfaces';
import { batchCallsDetailsHandler, batchCallsFollowUpsHandler, batchCallStartHandler, batchListBatchCallsHandler, createBatchCallFromCallsHandler, createBatchCallHandler, deleteHandler, getBatchCallDetailHandler, listBatchCallsHandler, processPendingBatchCallRequestHandler, retryBatchCallRequestHandler, retryFollowupsBatchCallRequestHandler } from './handlers/batchCall.handlers';
import { createBatchCallHandlerNew } from './handlers/batchCallNewOne.handlers';
import { batchCallsDetailsRequest, batchCallsFollowUpsRequest, batchCallStartRequest, batchListBatchCallsRequest, createBatchCallFromCallsRequest, createBatchCallRequest, deleteRequest, getBatchCallDetailRequest, listBatchCallsRequest, processPendingBatchCallRequest, retryBatchCallRequest, retryFollowupsBatchCallRequest } from './schema/batchCall.schema';

export const module: AppModule = {
  name: 'Batch Call module',
  mountPoint: '/batch-call',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/upload',
      auth: true,
      schema: createBatchCallRequest,
      handler: createBatchCallHandlerNew
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: listBatchCallsRequest,
      handler: listBatchCallsHandler
    },
    {
      method: 'GET',
      url: '/detail/:id',
      auth: true,
      schema: getBatchCallDetailRequest,
      handler: getBatchCallDetailHandler
    },
    {
      method: 'PUT',
      url: '/start-call/:id',
      auth: true,
      schema: batchCallStartRequest,
      handler: batchCallStartHandler
    },
    {
      method: 'GET',
      url: '/batch-listing',
      auth: true,
      schema: batchListBatchCallsRequest,
      handler: batchListBatchCallsHandler
    },
    {
      method: 'POST',
      url: '/details',
      auth: true,
      schema: batchCallsDetailsRequest,
      handler: batchCallsDetailsHandler,
    },
    {
      method: 'POST',
      url: '/follow-ups',
      auth: true,
      schema: batchCallsFollowUpsRequest,
      handler: batchCallsFollowUpsHandler,
    },
    {
      method: 'DELETE',
      url: '/delete/:id/:type',
      auth: true,
      schema: deleteRequest,
      handler: deleteHandler,
    },
    {
      method: 'POST',
      url: '/calls-from-dashboard',
      auth: true,
      schema: createBatchCallFromCallsRequest,
      handler: createBatchCallFromCallsHandler
    },
    {
      method: 'POST',
      url: '/retry-batch-call',
      auth: true,
      schema: retryBatchCallRequest,
      handler: retryBatchCallRequestHandler,
    },
    {
      method: 'POST',
      url: '/retry-followups-batch-call',
      auth: true,
      schema: retryFollowupsBatchCallRequest,
      handler: retryFollowupsBatchCallRequestHandler,
    },
    {
      method: 'POST',
      url: '/process-pending-batch-call',
      auth: true,
      schema: processPendingBatchCallRequest,
      handler: processPendingBatchCallRequestHandler,
    }
  ],
};
