import { RequestSchemas } from '../../../common/common-interfaces';

export const callListingRequest: RequestSchemas = {
  tags: ['Call'],
  summary: 'Call Listing with Date Filtering, Pagination, and Sorting',
  description: `<h3> This API gives Call list with company filter for Super Admin </h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date for filtering calls'
        },
        endDate: {
          type: 'string',
          description: 'End date for filtering calls'
        },
        sortBy: {
          type: 'string',
          description: 'Field to sort by'
        },
        skip: {
          type: 'number',
          default: 0,
          description: 'Number of records to skip for pagination'
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Number of records to return'
        },
        status: {
          type: 'number',
          description: 'Call status filter'
        },
        leadStatus: {
          type: 'string',
          description: 'Lead status filter'
        },
        timezone: {
          type: 'string',
          description: 'Timezone'
        },
        userId: {
          type: 'string',
          description: 'User ID filter (Admin only)'
        },
        companyId: {
          type: 'string',
          description: 'Company ID filter (Super Admin only)'
        },
        agentId: {
          type: 'string',
          description: 'Agent ID filter'
        },
        search: {
          type: 'string',
          description: 'Search by client name, phone number, or BMBY ID'
        }
      }
    }
  }
};

export const callDetailRequest: RequestSchemas = {
  tags: ['Call'],
  summary: 'Generate Call Detail',
  description: `<h3> This API Data Call Detail </h3>`,
  schema: {
    querystring: {
      id: { type: 'string' }
    }
  }
};

export const phoneDetailPostRequest: RequestSchemas = {
  tags: ['Call'],
  summary: 'Get All Calls for a Phone Number (POST)',
  description: `<h3>This API returns all calls associated with a specific phone number, sorted by latest first. Use POST method for better parameter handling.</h3>`,
  body: {
    title: 'Phone Detail Request',
    type: 'object',
    additionalProperties: false,
    required: ['phoneNumber'],
    properties: {
      phoneNumber: {
        type: 'string',
        description: 'Phone number to fetch all calls for (required)'
      },
      companyId: {
        type: 'string',
        description: 'Company ID filter (Super Admin only)'
      },
      userId: {
        type: 'string',
        description: 'User ID filter (Admin/Super Admin only)'
      },
      skip: {
        type: 'number',
        default: 0,
        description: 'Number of records to skip for pagination'
      },
      limit: {
        type: 'number',
        default: 50,
        description: 'Number of records to return (max 100)'
      },
      // ✅ Add startDate
      startDate: {
        type: 'string',
        format: 'date-time',
        description: 'Start date for filtering calls (ISO 8601 format)'
      },
      // ✅ Add endDate
      endDate: {
        type: 'string',
        format: 'date-time',
        description: 'End date for filtering calls (ISO 8601 format)'
      }
    }
  }
};

export const retellCallCreateRequest: RequestSchemas = {
  tags: ['Call'],
  summary: 'Create Retell Call',
  description: `<h3> This API creates a Retell Call </h3>`,
  body: {
    title: 'Create Retell Call',
    type: 'object',
    additionalProperties: false,
    properties: {
      fromNumber: { type: 'string', description: 'From number' },
      toNumber: { type: 'string', description: 'To number' },
      agentId: { type: 'string', description: 'Agent ID' },
      retell_llm_dynamic_variables: {
        type: 'object',
        additionalProperties: true,
        description: 'Dynamic variables for Retell LLM'
      }
    },
    required: ['fromNumber', 'toNumber', 'agentId']
  }
};

export const updateCallLeadStatusRequest: RequestSchemas = {
  tags: ['Call'],
  summary: 'Update Call Lead Status',
  description: `<h3>This API updates the lead status of a call</h3>`,
  body: {
    title: 'Update Call Lead Status',
    type: 'object',
    additionalProperties: false,
    required: ['callId', 'leadStatus'],
    properties: {
      callId: { type: 'string' },
      leadStatus: {
        type: 'string',
        enum: [
          'Already Bought',
          'Interested - Meeting',
          'Interested - Meeting Booked',
          'Ask Human Call',
          'Interested - Task',
          'Human Review Needed',
          'Human Call Needed',
          'Human Action Needed - Task',
          'Do Not Contact',
          'Invalid Lead',
          'No Human Detected',
          'Unclassified',
          'Not Interested',
          'Not Interested - For Now',
          'Changed Interest',
        ]
      }
    }
  }
};