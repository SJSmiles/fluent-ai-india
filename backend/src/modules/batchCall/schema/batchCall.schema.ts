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

export const getBatchCallDetailRequest: RequestSchemas = {
  tags: ['Batch Call'],
  summary: 'Get Batch Call Details',
  description: 'Fetch details of a specific batch call by ID',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  }
};

export const batchCallStartRequest: RequestSchemas = {
  tags: ['Batch Call Start'],
  summary: 'Start Batch Call',
  description: 'Start processing a batch call by ID',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    }
  },
  body: {
    title: 'Start Batch Call',
    type: 'object',
    additionalProperties: false,
    required: ['date', 'time'],
    properties: {
      date: { type: 'string' },
      time: { type: 'string' }
    }
  }
};

export const batchListBatchCallsRequest: RequestSchemas = {
  tags: ['Batch Call List For Dropdown'],
  summary: 'List all Batch Calls for Dropdown',
  description: 'Fetch all batch calls created by the user for dropdown selection'
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

export const batchCallsFollowUpsRequest: RequestSchemas = {
  tags: ['Batch Call Details'],
  summary: 'Batch Calls With Details',
  description: 'Batch Calls With Details',
  body: {
    title: 'Batch Call Details',
    type: 'object',
    additionalProperties: false,
    required: [
      'batchCallId', 'timezone', 'followUpsDetails'
    ],
    properties: {
      batchCallId: { type: 'string' },
      timezone: { type: 'string' },
      followUpsDetails: {
        type: 'array',
        items: {
          type: 'object',
          required: ['date', 'time'],
          properties: {
            date: { type: 'string' },
            time: { type: 'string' },
          },
        },
      }
    },
  }
};

export const deleteRequest: RequestSchemas = {
  tags: ['Batch Call & Follow ups delete'],
  summary: 'Batch Call & Follow ups delete',
  description: 'Batch Call & Follow ups delete',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'batch',
            'followups'
          ]
        }
      },
      required: ['id', 'type']
    }
  }
};

export const createBatchCallFromCallsRequest: RequestSchemas = {
  tags: ['Batch Call'],
  summary: 'Create Batch Call from Existing Calls',
  description: 'Create a new batch call using existing call records from Call collection',
  body: {
    title: 'Batch Call From Dashboard',
    type: 'object',
    required: ['name', 'agentId', 'callIds'],
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
        description: 'Name of the batch call'
      },
      agentId: {
        type: 'string',
        description: 'Agent ID to use for the batch call'
      },
      callIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of Call collection _id values'
      },
      leadGroupId: {
        type: 'string',
        description: 'Lead group ID (optional)'
      },
      outboundNumber: {
        type: 'string',
        description: 'Outbound number to use'
      },
      status: {
        type: 'integer',
        enum: [1, 2, 3, 4, 5, 6], // 1 = draft, 2 = start_calling, 3 = paused
        description: 'Batch call status (1: draft, 2: start calling, 3: paused)',
        default: 1
      },
      schedule: {
        type: 'boolean',
        description: 'Whether to schedule the batch call'
      },
      timezone: {
        type: 'string',
        description: 'Timezone for scheduling'
      },
      date: {
        type: 'string',
        description: 'Date for scheduling (YYYY-MM-DD)'
      },
      time: {
        type: 'string',
        description: 'Time for scheduling (HH:mm)'
      },
      followUpsDetails: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            time: { type: 'string' }
          }
        },
        description: 'Follow-up schedule details'
      }
    }
  }
};


export const retryBatchCallRequest: RequestSchemas = {
  tags: ['Retry Batch Call Request'],
  summary: 'Retry Batch Call Request',
  description: 'Retry Batch Call Request',
  body: {
    title: 'Retry Batch Call Request',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'date', 'time'],
    properties: {
      id: { type: 'string' },
      date: { type: 'string' },
      time: { type: 'string' },
      followupDetails: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'date', 'time'],
          properties: {
            id: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
          },
        }
      },
    }
  }
};


export const retryFollowupsBatchCallRequest: RequestSchemas = {
  tags: ['Retry Followups Batch Call Request'],
  summary: 'Retry Followups Batch Call Request',
  description: 'Retry Followups Batch Call Request',
  body: {
    title: 'Retry Followups Batch Call Request',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'followupDetails'],
    properties: {
      id: { type: 'string' },
      followupDetails: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'date', 'time'],
          properties: {
            id: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
          },
        }
      },
    }
  }
};

export const processPendingBatchCallRequest: RequestSchemas = {
  tags: ['Process Pending Batch Call Request'],
  summary: 'Process Pending Batch Call Request',
  description: 'Process Pending Batch Call Request',
  body: {
    title: 'Process Pending Batch Call Request',
    type: 'object',
    additionalProperties: false,
    required: ['id', 'date', 'time', 'recipientsIds'],
    properties: {
      id: { type: 'string' },
      date: { type: 'string' },
      time: { type: 'string' },
      recipientsIds: { type: 'array' }
    }
  }
};

