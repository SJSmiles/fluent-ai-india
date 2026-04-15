import { RequestSchemas } from '../../../common/common-interfaces';


export const createCompanyRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Create Company',
  description: `<h3> This API creates Company with Configuration and Admin User </h3>`,
  body: {
    title: 'Company create',
    type: 'object',
    additionalProperties: false,
    required: [
      'name',
      'description',
      'domain',
      'plivoAuthId',
      'plivoAuthToken',
      'elevenLabsApiKey',
      'deepgramApiKey',
      'email',
      'password'
    ],
    properties: {
      name: { type: 'string', maxLength: 50 },
      description: { type: 'string' },
      domain: { type: 'string', maxLength: 30 },
      plivoAuthId: { type: 'string' },
      plivoAuthToken: { type: 'string' },
      elevenLabsApiKey: { type: 'string' },
      deepgramApiKey: { type: 'string' },
      leadStatusPrompt: { type: 'string' },
      callSummaryPrompt: { type: 'string' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string', format: 'email', maxLength: 50 },
      password: { type: 'string', minLength: 8 },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          houseNo: { type: 'string' },
          zipCode: { type: 'string' },
          state: { type: 'string' }
        }
      },
      // ── Call status labels (company-level custom list) ────────────────────
      leadStatus: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        default: []
      },
      // ── CSV column configuration ──────────────────────────────────────────
      csvColumnConfig: {
        type: 'array',
        default: [],
        items: {
          type: 'object',
          required: ['name', 'type'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              description: 'CSV header key exactly as it appears in uploaded files, e.g. phone_number'
            },
            label: {
              type: 'string',
              description: 'Human-readable label shown in validation reports, e.g. Phone Number'
            },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean', 'email', 'phone']
            },
            required: {
              type: 'boolean',
              default: false
            },
            enum: {
              type: 'array',
              items: { type: 'string' },
              default: [],
              description: 'Allowed values; empty means no restriction'
            }
          }
        }
      }
    }
  }
};


export const updateCompanyRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Update Company',
  description: `<h3> This API updates Company information (Super Admin only) </h3>`,
  body: {
    title: 'Company create',
    type: 'object',
    additionalProperties: false,
    required: [
      '_id',
      'name',
      'description',
      'domain',
      'plivoAuthId',
      'plivoAuthToken',
      'elevenLabsApiKey',
      'deepgramApiKey',
    ],
    properties: {
      name: { type: 'string', maxLength: 50 },
      description: { type: 'string' },
      domain: { type: 'string', maxLength: 30 },
      plivoAuthId: { type: 'string' },
      plivoAuthToken: { type: 'string' },
      elevenLabsApiKey: { type: 'string' },
      deepgramApiKey: { type: 'string' },
      leadStatusPrompt: { type: 'string' },
      callSummaryPrompt: { type: 'string' },
      address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          houseNo: { type: 'string' },
          zipCode: { type: 'string' },
          state: { type: 'string' },
        }
      },
      // ── Call status labels (company-level custom list) ────────────────────
      leadStatus: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        default: []
      },
      // ── CSV column configuration ──────────────────────────────────────────
      csvColumnConfig: {
        type: 'array',
        default: [],
        items: {
          type: 'object',
          required: ['name', 'type'],
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              description: 'CSV header key exactly as it appears in uploaded files, e.g. phone_number'
            },
            label: {
              type: 'string',
              description: 'Human-readable label shown in validation reports, e.g. Phone Number'
            },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean', 'email', 'phone']
            },
            required: {
              type: 'boolean',
              default: false
            },
            enum: {
              type: 'array',
              items: { type: 'string' },
              default: [],
              description: 'Allowed values; empty means no restriction'
            }
          }
        }
      }
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


export const getCompanyFilterListRequest: RequestSchemas = {
  tags: ['Company'],
  summary: 'Get Company Filter List',
  description: `<h3> This API returns list of all companies with id and name only (Super Admin only) </h3>`
};
