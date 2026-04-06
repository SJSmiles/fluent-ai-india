import { RequestSchemas } from '../../../common/common-interfaces';

export const createCompanyRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Create Company',
  description: `<h3> This API creates Company with Configuration and Admin User </h3>`,
  body: {
    title: 'Company create',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'description', 'domain', 'email', 'password', 'voiceProviders', 'interestedMeetingBooked', 'interestedTask', 'notInterested'],
    properties: {
      name: { type: 'string', maxLength: 50 },
      interestedMeetingBooked: { type: 'string' },
      interestedTask: { type: 'string' },
      notInterested: { type: 'string' },
      description: { type: 'string' },
      domain: { type: 'string', maxLength: 30 },
      voiceProviders: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['name', 'api_key_id'],
          properties: {
            name: {
              type: 'string',
              enum: ['vapi', 'retell'] // Add your voice provider options
            },
            api_key_id: { type: 'string' }
          },
          additionalProperties: false
        }
      },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          houseNo: { type: 'string' },
          zipCode: { type: 'string' },
          state: { type: 'string' },
          countryId: { type: 'string' }
        }
      },
      email: { type: 'string', format: 'email', maxLength: 50 },
      password: { type: 'string', minLength: 8 },
      bmbyProfileActive: { type: 'boolean', default: false }
    }
  }
};

export const getCompanyListRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Get Company List',
  description: `<h3> This API returns list of companies (Super Admin only) </h3>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        search: { type: 'string' },
        sortBy: { type: 'string', default: 'createdAt' }
      }
    }
  }
};

export const updateCompanyRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Update Company',
  description: `<h3> This API updates Company information (Super Admin only) </h3>`,
  body: {
    title: 'Company update',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: { type: 'string' },
      name: { type: 'string', maxLength: 50 },
      interestedMeetingBooked: { type: 'string' },
      interestedTask: { type: 'string' },
      notInterested: { type: 'string' },
      description: { type: 'string' },
      isActive: { type: 'boolean' },
      voiceProviders: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'api_key_id'],
          properties: {
            name: {
              type: 'string',
              enum: ['vapi', 'retell'] // Add your voice provider options
            },
            api_key_id: { type: 'string' }
          },
          additionalProperties: false
        }
      },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          houseNo: { type: 'string' },
          zipCode: { type: 'string' },
          state: { type: 'string' },
          countryId: { type: 'string' }
        }
      },
      bmbyProfileActive: { type: 'boolean', default: false }
    }
  }
};

export const toggleCompanyStatusRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Toggle Company Status (Activate/Deactivate)',
  description: `<h3>This API activates or deactivates a company (Super Admin only)</h3>
  <p>When a company is deactivated, all associated users will also be deactivated automatically.</p>`,
  body: {
    title: 'Toggle Company Status',
    type: 'object',
    additionalProperties: false,
    required: ['_id', 'isActive'],
    properties: {
      _id: {
        type: 'string',
        description: 'Company ID'
      },
      isActive: {
        type: 'boolean',
        description: 'Set to true to activate, false to deactivate'
      }
    }
  }
};

export const getCountryMasterListRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Get Country Master List',
  description: `<h3> This API returns list of all countries </h3>`
};

export const getCompanyFilterListRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Get Company Filter List',
  description: `<h3> This API returns list of all companies with id and name only (Super Admin only) </h3>`
};

export const generateCompanyTokenRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Generate/Update Company Webhook Token',
  description: `<h3>This API generates or updates the webhook token for a company</h3>
    <p>Super Admin: Can generate token for any company</p>
    <p>Regular Admin: Can only generate token for their own company</p>`,
  body: {
    title: 'Generate Company Token',
    type: 'object',
    additionalProperties: false,
    required: ['companyId'],
    properties: {
      companyId: {
        type: 'string',
        description: 'MongoDB ObjectId of the company'
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
            companyId: { type: 'string' },
            companyName: { type: 'string' },
            webhookToken: { type: 'string' }
          }
        }
      }
    }
  }
};