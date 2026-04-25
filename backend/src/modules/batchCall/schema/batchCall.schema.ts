import { RequestSchemas } from '../../../common/common-interfaces';

export const createBatchCallRequest: RequestSchemas = {
  tags: ['Batch Call'],
  summary: 'Create Batch Call with Recipients Upload',
  description: 'Create a new batch call by uploading a CSV or XLSX file',
  consumes: ['multipart/form-data']
};

export const listBatchCallsRequest: RequestSchemas = {
  tags: ['Batch Call'],
  summary: 'List all Batch Calls',
  description: 'Fetch all batch calls created by the user',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        searchStr: { type: 'string', default: '' },
        sortBy: { type: 'string', default: '' },
        status: { type: 'string', default: '' },
        userId: { type: 'string' },
        agentId: { type: 'string' },
        companyId: { type: 'string' }
      },
      required: ['agentId']
    }
  }
};


export const batchCallsDetailsRequest: RequestSchemas = {
  tags: ['Batch Call Details'],
  summary: 'Batch Calls With Details',
  description: 'Batch Calls With Details',
  body: {
    title: 'Batch Call Details',
    type: 'object',
    additionalProperties: false,
    required: ['batchIds'],
    properties: {
      batchIds: { type: 'string' },
      userId: { type: 'string' },
      skip: { type: 'number', default: 0 },
      limit: { type: 'number', default: 10 },
      searchStr: { type: 'string', default: '' },
      sortBy: { type: 'string', default: '' },
      callLeadStatus: { type: 'string', default: '' },
      statusFilter: { type: 'string', default: '' }
    }
  }
};
