import { RequestSchemas } from '../../../common/common-interfaces';

export const createAgentRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Create Agent',
  description: `<h3> This API creates Agent </h3>`,
  body: {
    title: 'Agent create',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'prompt', 'voiceId'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 100, pattern: '^(?!\\s*$).+' },
      prompt: { type: 'string', pattern: '^(?!\\s*$).+' },
      voiceId: { type: 'string' },
      firstMessage: { type: 'string' },
      endCallMessage: { type: 'string' },
      endCallInvoke: { type: 'boolean' },
      companyId: { type: 'string' },
    }
  }
};

export const updateAgentRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Update Agent',
  description: `<h3> This API updates an existing agent </h3>`,
  body: {
    title: 'Agent update',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'prompt', 'voiceId'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 100, pattern: '^(?!\\s*$).+' },
      prompt: { type: 'string', pattern: '^(?!\\s*$).+' },
      voiceId: { type: 'string' },
      firstMessage: { type: 'string' },
      endCallMessage: { type: 'string' },
      endCallInvoke: { type: 'boolean' },
    }
  }
};

export const getAllAgentsRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Get All Agents',
  description: `<h3> This API retrieves all agents with search and filtering capabilities </h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        sortBy: {
          type: 'string',
          enum: ['createdAt', 'name', 'updatedAt'],
          default: 'createdAt'
        },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        search: { type: 'string' },
        userId: { type: 'string', description: 'User ID filter (Admin only)' },
        companyId: { type: 'string', description: 'Company ID filter (Super Admin only)' }
      }
    }
  }
};

export const getAllAgentsForBatchCallRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Get All Agents for Batch Call',
  description: `<h3> This API retrieves all agents for batch calling </h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        userId: { type: 'string', description: 'Filter by specific user (admin/super admin only)' },
        companyId: { type: 'string', description: 'Filter by specific company (super admin only)' }
      }
    }
  }
};

export const deleteAgentRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Delete Agent',
  description: `<h3> This API soft deletes an existing agent (sets isArchived: true) </h3>`
};

export const getAgentDetailsRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Agent Details',
  description: `<h3> This API gets details of an existing agent </h3>`
};

export const mapUserAgentsRequest: RequestSchemas = {
  tags: ['UserAgent'],
  summary: 'Create User Agent Mappings',
  description: `<h3>This API creates mappings between users and agents</h3>`,
  schema: {
    body: {
      type: 'object',
      required: ['mappings'],
      additionalProperties: false,
      properties: {
        mappings: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          description: 'Array of user-agent mappings',
          items: {
            type: 'object',
            required: ['userId', 'agentIds'],
            properties: {
              userId: { type: 'string' },
              agentIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of agent IDs'
              }
            }
          }
        },
        skipUrlUpdate: {
          type: 'boolean',
          default: false
        }
      }
    }
  }
};

export const currentMappingsRequest: RequestSchemas = {
  tags: ['Currently Mapped Agent'],
  summary: 'Get All Mapped Agents for company',
  description: `<h3> This API retrieves all mapped agents for a company </h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        companyId: { type: 'string', description: 'Filter by specific company (super admin only)' }
      }
    }
  }
};

export const setPrimaryAgentRequest: RequestSchemas = {
  tags: ['UserAgent'],
  summary: 'Set Primary Agent',
  description: `<h3>This API sets a specific agent as primary for the user</h3>`,
  body: {
    title: 'Set Primary Agent',
    type: 'object',
    required: ['agentId', 'userId'],
    additionalProperties: false,
    properties: {
      agentId: { type: 'string', description: 'Agent ID to set as primary' },
      userId: { type: 'string', description: 'User ID' }
    }
  }
};


export const makeCallRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Make Call',
  description: `<h3>This API makes an outbound call</h3>`,
  body: {
    title: 'Make Call',
    type: 'object',
    required: ['agentId', 'phoneNumber', 'toPhoneNumber'],
    additionalProperties: false,
    properties: {
      agentId: { type: 'string', description: 'Agent ID' },
      phoneNumber: { type: 'string', description: 'From phone number' },
      toPhoneNumber: { type: 'string', description: 'To phone number' },
      userId: { type: 'string', description: 'User ID' },
      metadata: {
        type: 'object',
        description: 'Additional metadata to pass to the webhook',
        additionalProperties: true
      }
    }
  }
};

export const getUserAgentMappingRequest: RequestSchemas = {
  tags: ['UserAgent'],
  summary: 'Get User Agent Mapping',
  description: `<h3>This API returns all agents mapped to a specific user</h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to fetch agent mappings for'
        }
      }
    }
  }
};

export const downloadSampleExcelRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Download Sample Excel',
  description: `<h3>This API generates and downloads a sample Excel file based on the company CSV column configuration</h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        companyId: {
          type: 'string',
          description: 'Company ID (Super Admin only)'
        }
      }
    }
  }
};