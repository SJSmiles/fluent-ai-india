import { RequestSchemas } from '../../../common/common-interfaces';
const PHONE_REGEX = '^\\+?[\\d\\s\\-\\(\\)]+$';
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
      postCallAnalysisData: {
        type: 'array',
      },
      postCallStatus: {
        type: 'array',
      },
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
      postCallAnalysisData: {
        type: 'array',
      },
      postCallStatus: {
        type: 'array',
      },
      companyId: { type: 'string' },
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
          enum: ['createdAt', 'agentName', 'updatedAt'],
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
  description: `<h3> This API retrieves all outbound agents with primary phone for batch calling </h3>`,
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
  description: `<h3> This API delete an existing agent </h3>`
};

export const duplicateAgentRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Duplicate Agent',
  description: `<h3> This API duplicate an existing agent </h3>`
};

export const getAgentDetailsRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Agent Details',
  description: `<h3> This API get details of  an existing agent </h3>`
};

;

export const mapUserAgentsRequest: RequestSchemas = {
  tags: ['UserAgent'],
  summary: 'Create User Agent Mappings',
  description: `<h3>This API creates mappings between users and agents</h3>
  <p>Identifier type (agentId / assistantId) will be decided automatically based on company.voiceProvider</p>`,
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
                description: 'Array of agent identifiers'
              }
            }
          }
        },
        skipUrlUpdate: {
          type: 'boolean',
          default: false,
          description: 'Skip updating Retell/Vapi URLs (default: false)'
        }
      }
    }
  }
};

export const getAllAgentsForSuperAdminRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Get All Agents for Super Admin',
  description: `<h3>This API retrieves all agents with assigned user IDs for Super Admin only</h3>
    <p>Returns agents filtered by companyId from UserAgent collection.</p>
    <p>Includes phoneNumberId (for VAPI providers) and outboundNumber (primaryPhone from Agent).</p>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        search: {
          type: 'string',
          description: 'Search by agent name or agent ID'
        },
        companyId: {
          type: 'string',
          description: 'Filter agents by company ID'
        }
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              agentName: { type: 'string' },
              agentId: { type: 'string' },
              companyId: { type: ['string', 'null'] },
              userId: {
                type: 'array',
                items: { type: 'string' }
              },
              phoneNumberId: {
                type: ['string', 'null'],
                description: 'VAPI phone number ID (only populated when voiceProvider is vapi)'
              },
              outboundNumber: {
                type: ['string', 'null'],
                description: 'Primary phone number for outbound calls'
              },
              voiceProvider: {
                type: ['string', 'null'],
                description: 'Voice provider for the agent (vapi or retell)'
              },
              webhookUrl: { type: ['string', 'null'] },
            }
          }
        },
        totalCount: { type: 'integer' },
        stats: {
          type: 'object',
          properties: {
            totalAgents: { type: 'integer' },
            agentsWithUsers: { type: 'integer' },
            agentsWithoutUsers: { type: 'integer' }
          }
        }
      }
    }
  }
};


export const currentMappingsRequest: RequestSchemas = {
  tags: ['Currently Mapped Agent'],
  summary: 'Get All Mapped Agent for company',
  description: `<h3> This API retrieves all mapped agents for a company with active user mappings </h3>`,
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
      userId: { type: 'string', description: 'User ID to set as primary for' }
    }
  }
};



export const makeCallRequest: RequestSchemas = {
  tags: ['Ag'],
  summary: 'Make Call',
  description: `<h3>This API makes a call to the specified user</h3>`,
  body: {
    title: 'Make Call',
    type: 'object',
    required: ['agentId', 'phoneNumber', 'toPhoneNumber'],
    additionalProperties: false,
    properties: {
      agentId: { type: 'string', description: 'Agent ID to set as primary' },
      phoneNumber: { type: 'string', description: 'Phone number to call' },
      toPhoneNumber: { type: 'string', description: 'Phone number to call' },
      userId: { type: 'string', description: 'User ID to set as primary for' }
    }
  }
};