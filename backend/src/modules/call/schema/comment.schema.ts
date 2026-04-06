import { RequestSchemas } from '../../../common/common-interfaces';

export const createCommentRequest: RequestSchemas = {
  tags: ['Comment'],
  summary: 'Create Comment',
  description: `<h3>This API creates a comment for a phone number</h3>`,
  body: {
    title: 'Create Comment',
    type: 'object',
    additionalProperties: false,
    required: ['phone', 'comment'],
    properties: {
      phone: {
        type: 'string',
        description: 'Phone number for which comment is being added'
      },
      comment: {
        type: 'string',
        description: 'Comment text',
        minLength: 1,
        maxLength: 2000
      },
      callId: {
        type: 'string',
        description: 'Optional call ID reference'
      }
    }
  }
};

export const listCommentsRequest: RequestSchemas = {
  tags: ['Comment'],
  summary: 'List Comments by Phone Number',
  description: `<h3>This API retrieves all comments for a specific phone number</h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      required: ['phone'],
      properties: {
        phone: {
          type: 'string',
          description: 'Phone number to fetch comments for'
        },
        skip: {
          type: 'number',
          default: 0,
          description: 'Number of records to skip for pagination'
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Number of records to return'
        },
        sortBy: {
          type: 'string',
          default: '-createdAt',
          description: 'Field to sort by (use - prefix for descending)'
        }
      }
    }
  }
};

export const markAsReadRequest: RequestSchemas = {
  tags: ['Comment'],
  summary: 'Mark Comments as Read for Phone Number',
  description: `<h3>This API marks all unread comments for a phone number as read by current user</h3>`,
  body: {
    title: 'Mark Comments as Read',
    type: 'object',
    additionalProperties: false,
    required: ['phone'],
    properties: {
      phone: {  // ✅ Changed from commentId to phone
        type: 'string',
        description: 'Phone number to mark comments as read (e.g., +918769365375)'
      }
    }
  }
};