import { RequestSchemas } from '../../common/common.interface';
export const incomingCallSchema: RequestSchemas = {
  tags: ['Webhook'],
  summary: 'Incoming Call Webhook',
  description: `<h3>Handles incoming call and returns Plivo XML</h3>`,
  schema: {
    params: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string' },
      },
    },

    querystring: {
      type: 'object',
      properties: {
        direction: { type: 'string' }, // inbound / outbound
      },
    },
    body: {
      type: 'object',
      additionalProperties: true,
    },

    response: {
      200: {
        type: 'string', // ✅ XML response
      },
    },
  },
};

export const callStatusSchema: RequestSchemas = {
  tags: ['Webhook'],
  summary: 'Call Status Webhook',
  description: `<h3>Handles call status updates from Plivo</h3>`,

  schema: {
    params: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string' },
      },
    },

    querystring: {
      type: 'object',
      properties: {
        signature: { type: 'string' },
      },
    },

    body: {
      type: 'object',
      properties: {
        CallUUID: { type: 'string' },
        Direction: { type: 'string' },
        From: { type: 'string' },
        To: { type: 'string' },
        CallStatus: { type: 'string' },
        Event: { type: 'string' },
        CallDuration: { type: 'string' },
        HangupCause: { type: 'string' },
      },
      additionalProperties: true, // ⚠️ important
    },

    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
        },
      },
    },
  },
};



