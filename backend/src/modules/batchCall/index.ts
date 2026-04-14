import { AppModule } from '../../common/common-interfaces';
import { createBatchCall, listBatchCallsHandler } from './handlers/batchCall.handlers';
import { createBatchCallRequest, listBatchCallsRequest } from './schema/batchCall.schema';

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
      handler: createBatchCall
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: listBatchCallsRequest,
      handler: listBatchCallsHandler
    },
  ],
};


