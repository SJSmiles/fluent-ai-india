import { RequestSchemas } from "../../../common/common-interfaces";


export const listBlackListRequest: RequestSchemas = {
  tags: ['BlackList'],
  summary: 'List BlackList Numbers',
  description: `<h3>Fetch paginated list of blacklisted phone numbers</h3>
    <p>Regular admins can only view blacklisted numbers for their company.</p>
    <p>Super admins can view blacklisted numbers for all companies or filter by specific companyId.</p>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        companyId: {
          type: 'string',
          description: 'Filter by company ID (optional for Super Admin, ignored for regular admin)'
        },
        skip: {
          type: 'integer',
          minimum: 0,
          default: 0,
          description: 'Number of records to skip (for pagination)'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
          description: 'Number of records to return'
        },
        searchStr: {
          type: 'string',
          description: 'Search by phone number, client name, or email (optional)'
        },
        sortBy: {
          type: 'string',
          default: 'createdAt desc',
          description: 'Sort field and order, e.g. "createdAt desc" or "toNumber asc"'
        }
      },
      required: []
    }
  }
};

export const removeBlackListRequest: RequestSchemas = {
  tags: ['BlackList'],
  summary: 'Remove Number from BlackList',
  description: `<h3>Archive a blacklisted phone number</h3>
    <p>Sets isArchived to true for the specified blacklist record.</p>
    <p>Regular admins can only remove numbers from their own company.</p>
    <p>Super admins can remove numbers from any company.</p>`,
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