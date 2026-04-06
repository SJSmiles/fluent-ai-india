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
    required: ['agentName', 'agentPrompt', 'phone'],
    properties: {
      agentName: { type: 'string', minLength: 3, maxLength: 100, pattern: '^(?!\\s*$).+' },
      phone: { type: 'string', pattern: PHONE_REGEX },
      agentPromptType: {
        type: 'string',
        enum: ['Single Prompt', 'Multi Prompt', 'Conversation Flow', 'Custom LLM'],
        default: 'Multi Prompt'
      },
      agentPrompt: { type: 'string', pattern: '^(?!\\s*$).+', maxLength: 5000 },
      callType: {
        type: 'string',
        enum: ['inbound', 'outbound'],
        description: 'Type of calls this agent will handle'
      }
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
    required: ['agentName', 'agentPrompt', 'phone'],
    properties: {
      agentName: { type: 'string', minLength: 3, maxLength: 100, pattern: '^(?!\\s*$).+' },
      phone: { type: 'string', pattern: PHONE_REGEX },
      agentPrompt: { type: 'string', maxLength: 5000 },
      callType: { type: 'string', enum: ['inbound', 'outbound'] }
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
        callType: { type: 'string', enum: ['inbound', 'outbound'] },
        userId: { type: 'string', description: 'User ID filter (Admin only)' },
        companyId: { type: 'string', description: 'Company ID filter (Super Admin only)' }
      }
    }
  }
};

export const getAllRetellAgentsRequest: RequestSchemas = {
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
        callType: { type: 'string', enum: ['inbound', 'outbound'] }
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

export const getAgentPromptRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Agent Prompt',
  description: `<h3> This API get prompt of  an existing agent </h3>`
};

export const updateCustomAgentRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Update Agent',
  description: `<h3> This API updates an existing custom agent </h3>`,
  body: {
    title: 'Agent update',
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      agentPrompt: { type: 'string', maxLength: 10000 },
      postCallAnalysisData: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            examples: { type: 'array' }
          }
        }
      }
    }
  }
};

export const agentPullRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Pull Agents from Voice Provider (Vapi or Retell)',
  description: `<h3> This API pulls all agents from Vapi or Retell for a company </h3>`,
  body: {
    title: 'Agent Pull',
    type: 'object',
    additionalProperties: false,
    required: ['companyId', 'voiceProvider'],
    properties: {
      companyId: { type: 'string', description: 'Company ID to pull agents for' },
      voiceProvider: {
        type: 'string',
        enum: ['vapi', 'retell'],
        description: 'Optional: Specific voice provider to pull from. If not provided, uses primary provider.'
      }
    }
  }
};

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

export const updateAgentPhoneRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Update Agent Phone Details',
  description: `<h3>This API updates the agent's phone number ID and outbound number</h3>
    <p>Updates multiple fields in the Agent document:</p>
    <ul>
      <li><strong>phoneNumberId:</strong> Updates vapiPhoneNumberId <strong>only if the agent's voiceProvider is 'vapi'</strong> in UserAgent collection</li>
      <li><strong>outboundNumber:</strong> Updates outboundNumber, primaryPhone, primaryCallType, phoneMapping.outbound, and phoneBindings array</li>
    </ul>
    <p>When outboundNumber is provided, it automatically:</p>
    <ul>
      <li>Sets primaryCallType to "outbound"</li>
      <li>Updates or creates phoneMapping.outbound object</li>
      <li>Updates or creates outbound entry in phoneBindings array</li>
      <li>Formats the phone number (adds + if missing)</li>
    </ul>
    <p><strong>Important:</strong></p>
    <ul>
      <li>vapiPhoneNumberId will only be updated if the agent uses VAPI as voiceProvider</li>
      <li>Setting outboundNumber to null will remove outbound configuration from all places</li>
      <li>phoneNumberId update is skipped for non-VAPI agents</li>
    </ul>`,
  schema: {
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['agentId'],
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID (MongoDB ObjectId)'
        },
        phoneNumberId: {
          type: ['string', 'null'],
          description: 'Phone number ID to update (optional). Set to null to clear.'
        },
        outboundNumber: {
          type: ['string', 'null'],
          description: 'Outbound phone number (optional). Set to null to clear. Will be auto-formatted with + prefix.'
        },
        twilioAccountSid: {
          type: ['string', 'null'],
          description: 'Twilio Account SID for the phone number (optional)'
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
          type: 'object',
          properties: {
            _id: { type: 'string' },
            agentName: { type: 'string' },
            agentId: { type: 'string' },
            phoneNumberId: { type: ['string', 'null'] },
            vapiPhoneNumberId: { type: ['string', 'null'] },
            outboundNumber: { type: ['string', 'null'] },
            primaryPhone: { type: 'string' },
            primaryCallType: { type: 'string' },
            phoneMapping: {
              type: 'object',
              properties: {
                inbound: {
                  type: ['object', 'null'],
                  properties: {
                    number: { type: 'string' },
                    formatted: { type: 'string' },
                    callType: { type: 'string' }
                  }
                },
                outbound: {
                  type: ['object', 'null'],
                  properties: {
                    number: { type: 'string' },
                    formatted: { type: 'string' },
                    callType: { type: 'string' }
                  }
                }
              }
            },
            phoneBindings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  number: { type: 'string' },
                  direction: { type: 'string' },
                  formatted: { type: 'string' },
                  twilioAccountSid: { type: ['string', 'null'] },
                  twilioAuthToken: { type: ['string', 'null'] }
                }
              }
            }
          }
        }
      }
    },
    400: {
      type: 'object',
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' },
        error: { type: 'string' }
      }
    },
    404: {
      type: 'object',
      properties: {
        status: { type: 'boolean' },
        message: { type: 'string' }
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


export const updateAgentPromptRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Update Agent Prompt + First Message + Structured Output',
  description: `<h3>This API updates system prompt, first message and structured output schema</h3>`,
  body: {
    title: 'Agent update',
    type: 'object',
    additionalProperties: false,
    required: ['agentName', 'systemPrompt', 'firstMessage', 'postCallAnalysisData'],
    properties: {
      agentName: { type: 'string' },
      systemPrompt: { type: 'string' },
      firstMessage: { type: 'string' },
      postCallAnalysisData: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'type', 'required'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' },
            examples: { type: 'array', items: { type: 'string' } },
            enum: { type: ['array', 'null'], items: { type: 'string' } },
            required: { type: 'boolean' }
          }
        }
      }
    }
  }
};