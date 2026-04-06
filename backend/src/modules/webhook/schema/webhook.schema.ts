import { RequestSchemas } from '../../../common/common-interfaces';

export const webhookRequest: RequestSchemas = {
  tags: ['Webhook'],
  summary: 'Create Webhook',
  description: `<h3>This API creates a Webhook document</h3>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        signature: { type: 'string' }
      }
    }
  },
  body: {
    title: 'Create Webhook',
    type: 'object',
    additionalProperties: false,
    required: ['event', 'call'],
    properties: {
      event: {
        type: 'string',
        description: 'Event type identifier'
      },
      call: {
        type: 'object',
        additionalProperties: false,
        required: ['call_id', 'call_status'],
        properties: {
          call_id: {
            type: 'string',
            description: 'Unique identifier for the call'
          },
          call_type: {
            type: 'string',
            description: 'Type of call (e.g., phone_call)'
          },
          agent_id: {
            type: 'string',
            description: 'Unique identifier for the agent'
          },
          agent_version: {
            type: 'number',
            description: 'Version of the agent'
          },
          retell_llm_dynamic_variables: {
            type: 'object',
            additionalProperties: true,
            properties: {
              last_name: { type: 'string' },
              salutation: { type: 'string' },
              first_name: { type: 'string' },
              client_id: { type: 'string' },
              email: {
                type: 'string'
              }
            }
          },
          call_status: {
            type: 'string',

            description: 'Current status of the call'
          },
          start_timestamp: {
            type: 'number',
            description: 'Unix timestamp when call started'
          },
          end_timestamp: {
            type: 'number',
            description: 'Unix timestamp when call ended'
          },
          duration_ms: {
            type: 'number',
            description: 'Call duration in milliseconds'
          },
          transcript: {
            type: 'string',
            description: 'Full transcript of the call'
          },
          transcript_object: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: {
                  type: 'string'
                },
                content: { type: 'string' },
                words: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      word: { type: 'string' },
                      start: { type: 'number' },
                      end: { type: 'number' }
                    }
                  }
                },
                metadata: {
                  type: 'object',
                  properties: {
                    response_id: { type: 'number' }
                  }
                }
              }
            }
          },
          transcript_with_tool_calls: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: {
                  type: 'string'
                },
                content: { type: 'string' },
                words: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      word: { type: 'string' },
                      start: { type: 'number' },
                      end: { type: 'number' }
                    }
                  }
                },
                metadata: {
                  type: 'object',
                  properties: {
                    response_id: { type: 'number' }
                  }
                }
              }
            }
          },
          knowledge_base_retrieved_contents_url: {
            type: 'string',

            description: 'URL to knowledge base contents'
          },
          recording_url: {
            type: 'string',

            description: 'URL to call recording'
          },
          public_log_url: {
            type: 'string',

            description: 'URL to public log'
          },
          disconnection_reason: {
            type: 'string',
            description: 'Reason for call disconnection'
          },
          latency: {
            type: 'object',
            properties: {
              llm: {
                type: 'object',
                properties: {
                  p50: { type: 'number' },
                  p90: { type: 'number' },
                  p95: { type: 'number' },
                  p99: { type: 'number' },
                  min: { type: 'number' },
                  max: { type: 'number' },
                  num: { type: 'number' },
                  values: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              },
              e2e: {
                type: 'object',
                properties: {
                  p50: { type: 'number' },
                  p90: { type: 'number' },
                  p95: { type: 'number' },
                  p99: { type: 'number' },
                  min: { type: 'number' },
                  max: { type: 'number' },
                  num: { type: 'number' },
                  values: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              },
              tts: {
                type: 'object',
                properties: {
                  p50: { type: 'number' },
                  p90: { type: 'number' },
                  p95: { type: 'number' },
                  p99: { type: 'number' },
                  min: { type: 'number' },
                  max: { type: 'number' },
                  num: { type: 'number' },
                  values: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              },
              knowledge_base: {
                type: 'object',
                properties: {
                  p50: { type: 'number' },
                  p90: { type: 'number' },
                  p95: { type: 'number' },
                  p99: { type: 'number' },
                  min: { type: 'number' },
                  max: { type: 'number' },
                  num: { type: 'number' },
                  values: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              }
            }
          },
          call_cost: {
            type: 'object',
            properties: {
              total_duration_unit_price: { type: 'number' },
              product_costs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product: { type: 'string' },
                    unit_price: { type: 'number' },
                    cost: { type: 'number' }
                  }
                }
              },
              combined_cost: { type: 'number' },
              total_duration_seconds: { type: 'number' }
            }
          },
          call_analysis: {
            type: 'object',
            properties: {
              call_summary: {
                type: 'string',
                description: 'Summary of the call'
              },
              in_voicemail: {
                type: 'boolean',
                description: 'Whether call went to voicemail'
              },
              user_sentiment: {
                type: 'string',

                description: 'User sentiment analysis'
              },
              call_successful: {
                type: 'boolean',
                description: 'Whether the call was successful'
              },
              custom_analysis_data: {
                type: 'object',
                properties: {
                  purpose: {
                    type: 'string',
                    description: 'Purpose of the call'
                  },
                  size: {
                    type: 'string',
                    description: 'Property size discussed'
                  },
                  district: {
                    type: 'string',
                    description: 'District discussed'
                  },
                  timeline: {
                    type: 'string',
                    description: 'Timeline discussed'
                  },
                  proposal_channel: {
                    type: 'string',
                    description: 'Preferred proposal channel'
                  },
                  alternative_whatsapp_number: {
                    type: 'string',
                    description: 'Alternative WhatsApp number'
                  },
                  call_back_allowed: {
                    type: 'string',

                    description: 'Whether callback is allowed'
                  },
                  budget: {
                    type: 'string',
                    description: 'Budget discussed'
                  },
                  calendar_booking_failed: {
                    type: 'string',
                    description: 'Calendar booking failure reason'
                  },
                  next_attempt: {
                    type: 'string',
                    description: 'Next attempt information'
                  }
                }
              }
            }
          },
          opt_out_sensitive_data_storage: {
            type: 'boolean',
            description: 'Whether user opted out of sensitive data storage'
          },
          opt_in_signed_url: {
            type: 'boolean',
            description: 'Whether user opted in for signed URLs'
          },
          llm_token_usage: {
            type: 'object',
            properties: {
              values: {
                type: 'array',
                items: { type: 'number' }
              },
              average: { type: 'number' },
              num_requests: { type: 'number' }
            }
          },
          batch_call_id: {
            type: 'string',
            description: 'Batch call identifier'
          },
          from_number: {
            type: 'string',
            description: 'Caller phone number'
          },
          to_number: {
            type: 'string',
            description: 'Recipient phone number'
          },
          direction: {
            type: 'string',

            description: 'Call direction'
          },
          telephony_identifier: {
            type: 'object',
            properties: {
              twilio_call_sid: {
                type: 'string',
                description: 'Twilio call SID'
              }
            }
          }
        }
      }
    }
  }
};

export const sheetsWebhookRequest: RequestSchemas = {
  tags: ['Webhook', 'Google Sheets'],
  summary: 'Google Sheets Webhook Handler',
  description: `<h3>Handles Google Sheets change notifications</h3>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        sheet_id: { type: 'string' },
        verification_token: { type: 'string' }
      }
    },
    headers: {
      type: 'object',
      properties: {
        'x-goog-channel-id': { type: 'string' },
        'x-goog-resource-id': { type: 'string' },
        'x-goog-resource-state': { type: 'string' },
        'x-goog-message-number': { type: 'string' }
      },
      additionalProperties: true
    },
    body: {
      type: 'object',
      required: ['fullName', 'email', 'phoneNumber'], // Required fields
      properties: {
        fullName: {
          type: 'string',
          minLength: 1,
          description: 'Full name of the person'
        },
        email: {
          type: 'string',
          minLength: 1,
          description: 'Email address of the person'
        },
        phoneNumber: {
          type: 'string',
          minLength: 1,
          description: 'Phone number of the person'
        },
        additionalInformation: {
          type: 'object',
          additionalProperties: true,
          description: 'Additional fields from the spreadsheet'
        },
        uniqueRowId: {
          type: 'string',
          description: 'Unique identifier for this row used for tracking updates'
        },
        rowNumber: {
          type: 'number',
          description: 'Row number in the spreadsheet'
        },
        // Optional fields for debugging/metadata
        eventType: { type: 'string' },
        sheetName: { type: 'string' },
        range: { type: 'string' },
        timestamp: { type: 'string' },
        userInfo: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' }
          },
          additionalProperties: true
        }
      },
      additionalProperties: true
    }
  }
};
