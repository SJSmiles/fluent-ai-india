import { AppModule } from '../../common/common-interfaces';
import { createBatchCall } from './handlers/batchCall.handlers';
import { createBatchCallRequest } from './schema/batchCall.schema';

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
    }
  ],
};


