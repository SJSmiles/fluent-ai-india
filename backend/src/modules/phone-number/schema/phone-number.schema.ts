import { RequestSchemas } from '../../../common/common-interfaces';

export const createPhoneNumberRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Create Phone Number',
  description: `<h3>This API creates a new phone number</h3>
  <p><strong>Access:</strong> Phone Number is created under authenticated user's company</p>`,
  body: {
    title: 'Phone Number Create',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'phoneNumber'],
    properties: {
      name: {
        type: 'string',
        minLength: 2,
        maxLength: 100
      },
      phoneNumber: {
        type: 'string',
        minLength: 1
      },
      companyId: {
        type: 'string'
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


export const getPhoneNumberListRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Get Phone Number List',
  description: `<h3>This API returns list of phone numbers</h3>
  <p><strong>Access:</strong> Users see only their company phone numbers</p>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        companyId: { type: 'string' },
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        search: { type: 'string' },
        isArchived: { type: 'boolean' },
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
            phoneNumbers: { type: 'array' },
            total: { type: 'number' },
            skip: { type: 'number' },
            limit: { type: 'number' }
          }
        }
      }
    }
  }
};


export const updatePhoneNumberRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Update Phone Number',
  description: `<h3>This API updates a phone number</h3>`,
  body: {
    title: 'Phone Number Update',
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
      phoneNumber: {
        type: 'string',
        minLength: 1
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



export const deletePhoneNumberRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Delete Phone Number (Soft Delete)',
  description: `<h3>This API soft deletes a phone number by setting isArchived to true</h3>`,
  body: {
    title: 'Phone Number Delete',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: {
        type: 'string',
        description: 'Phone Number ID'
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


export const getSinglePhoneNumberRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Get Single Phone Number',
  description: `<h3>This API returns single phone number details</h3>`,
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


export const filterPhoneNumberListRequest: RequestSchemas = {
  tags: ['Phone Number'],
  summary: 'Get Filtered Phone Number List',
  description: `<h3>This API returns list of phone numbers</h3>
  <p><strong>Access:</strong> Users see only their company phone numbers</p>`,
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
              phoneNumber: { type: 'string' }
            }
          }
        }
      }
    }
  }
};
