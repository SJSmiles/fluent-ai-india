import { RequestSchemas } from '../../../common/common-interfaces';

export const createMessageTemplateRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Create Message Template',
  description: `<h3>This API creates a new message template</h3>
  <p><strong>Access:</strong> Template is created under authenticated user's company</p>`,
  body: {
    title: 'Message Template Create',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'message'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 100
      },
      message: {
        type: 'string',
        minLength: 1
      },
      isActive: {
        type: 'boolean'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    }
  }
};


export const getMessageTemplateListRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Get Message Template List',
  description: `<h3>This API returns list of message templates</h3>
  <p><strong>Access:</strong> Users see only their company templates</p>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        search: { type: 'string' },
        isActive: { type: 'boolean' },
        sortBy: { type: 'string', default: 'createdAt' }
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            templates: { type: 'array' },
            total: { type: 'number' },
            skip: { type: 'number' },
            limit: { type: 'number' }
          }
        }
      }
    }
  }
};


export const updateMessageTemplateRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Update Message Template',
  description: `<h3>This API updates a message template</h3>`,
  body: {
    title: 'Message Template Update',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: {
        type: 'string'
      },
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 100
      },
      message: {
        type: 'string'
      },
      isActive: {
        type: 'boolean'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    }
  }
};



export const deleteMessageTemplateRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Delete Message Template (Soft Delete)',
  description: `<h3>This API soft deletes a template by setting isArchived to true</h3>`,
  body: {
    title: 'Message Template Delete',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: {
        type: 'string',
        description: 'Message Template ID'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  }
};


export const getSingleMessageTemplateRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Get Single Message Template',
  description: `<h3>This API returns single template details</h3>`,
  schema: {
    querystring: {
      type: 'object',
      required: ['_id'],
      properties: {
        _id: { type: 'string' }
      }
    }
  }
};


export const updateStatusTemplateRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Update Message Template Status',
  description: `<h3>This API updates a message template status</h3>`,
  body: {
    title: 'Message Template Update Status  ',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: {
        type: 'string'
      },
      isActive: {
        type: 'boolean'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    }
  }
};


export const filterMessageTemplateListRequest: RequestSchemas = {
  tags: ['Message Template'],
  summary: 'Get Filtered Active Message Template List',
  description: `<h3>This API returns list of active message templates</h3>
  <p><strong>Access:</strong> Users see only their company active templates</p>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {}
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    }
  }
};


export const getMessageListRequest: RequestSchemas = {
  tags: ['Messages'],
  summary: 'Get Messages List',
  description: `<h3>This API returns message list filtered by senderId and toNumber</h3>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        senderId: { type: 'string' },
        toNumber: { type: 'string' },
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 100 }
      },
      required: ['toNumber']
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            messages: { type: 'array' },
            total: { type: 'number' },
            skip: { type: 'number' },
            limit: { type: 'number' }
          }
        }
      }
    }
  }
};
