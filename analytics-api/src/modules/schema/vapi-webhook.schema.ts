import { RequestSchemas } from '../../common/common.interface';

export const vapiWebhookRequest: RequestSchemas = {
  tags: ['VAPI Webhook'],
  summary: 'Create VAPI Webhook',
  description: `<h3>This API handles VAPI webhook events</h3>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {},
    },
  },
  body: {
    title: 'VAPI Webhook Payload',
    type: 'object',
    additionalProperties: false,
    required: ['message'],
    properties: {
      message: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'timestamp', 'call'],
        properties: {
          // Message Type
          type: {
            type: 'string',
            enum: [
              'end-of-call-report',
              'status-update',
              'function-call',
              'hang',
              'speech-update',
              'transcript',
              'conversation-update',
            ],
            description: 'Type of webhook message',
          },
          timestamp: {
            type: 'number',
            description: 'Unix timestamp in milliseconds',
          },

          // End of Call Report specific fields
          endedReason: {
            type: 'string',
            enum: [
              'assistant-ended-call',
              'assistant-error',
              'assistant-not-found',
              'call-duration-limit-exceeded',
              'customer-busy',
              'customer-did-not-answer',
              'customer-did-not-give-microphone-permission',
              'customer-ended-call',
              'db-error',
              'dial-busy',
              'dial-failed',
              'dial-no-answer',
              'exceeded-max-duration',
              'forwarding-phone-number-busy',
              'forwarding-phone-number-did-not-answer',
              'forwarding-phone-number-failed',
              'inactivity',
              'no-server-available',
              'pipeline-error-backpressure',
              'pipeline-error-model-error',
              'pipeline-error-openai-llm-failed',
              'pipeline-error-setup-failed',
              'pipeline-error-twilio-failed',
              'silence-timed-out',
              'twilio-failed-to-connect-call',
              'unknown-error',
              'vonage-disconnected',
              'vonage-failed-to-connect-call',
              'voicemail',
            ],
            description: 'Reason why call ended',
          },
          cost: {
            type: 'number',
            description: 'Total cost of the call',
          },
          costs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                description: { type: 'string' },
                cost: { type: 'number' },
                duration: { type: 'number' },
                characters: { type: 'number' },
                minutes: { type: 'number' },
              },
            },
          },

          // Analysis results (populated after call)
          analysis: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              structuredData: {
                type: 'object',
                additionalProperties: true,
                description: 'Your custom analysis schema results',
              },
              successEvaluation: { type: 'string' },
            },
          },
          artifact: {
            type: 'object',
            additionalProperties: true,
          },

          // Main Call Object
          call: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'orgId', 'type', 'status', 'createdAt', 'updatedAt'],
            properties: {
              // Identifiers
              id: {
                type: 'string',
                description: 'Unique call identifier',
              },
              orgId: {
                type: 'string',
                description: 'Organization identifier',
              },
              assistantId: {
                type: 'string',
                description: 'Assistant identifier',
              },
              squadId: {
                type: 'string',
                nullable: true,
              },
              phoneNumberId: {
                type: 'string',
                description: 'Phone number identifier',
              },
              customerId: {
                type: 'string',
                nullable: true,
              },

              // Call Type & Status
              type: {
                type: 'string',
                enum: ['inboundPhoneCall', 'outboundPhoneCall', 'webCall'],
                description: 'Type of call',
              },
              status: {
                type: 'string',
                enum: ['queued', 'ringing', 'in-progress', 'forwarding', 'ended'],
                description: 'Current call status',
              },
              endedReason: {
                type: 'string',
                description: 'Reason for call ending',
              },

              // Timestamps
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Call creation timestamp',
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update timestamp',
              },
              startedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Call start timestamp (null if not connected)',
              },
              endedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Call end timestamp (null if not completed)',
              },

              // Content
              transcript: {
                type: 'string',
                nullable: true,
                description: 'Full call transcript (null if no conversation)',
              },
              recordingUrl: {
                type: 'string',
                format: 'uri',
                nullable: true,
                description: 'Mono recording URL',
              },
              stereoRecordingUrl: {
                type: 'string',
                format: 'uri',
                nullable: true,
                description: 'Stereo recording URL',
              },
              summary: {
                type: 'string',
                nullable: true,
                description: 'AI-generated call summary',
              },

              // Cost Information
              cost: {
                type: 'number',
                description: 'Total call cost',
              },
              costs: {
                type: 'array',
                nullable: true,
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    description: { type: 'string' },
                    cost: { type: 'number' },
                  },
                },
              },
              costBreakdown: {
                type: 'object',
                nullable: true,
                properties: {
                  llm: { type: 'number' },
                  voice: { type: 'number' },
                  transcriber: { type: 'number' },
                  transport: { type: 'number' },
                  total: { type: 'number' },
                },
              },

              // Customer Information
              customer: {
                type: 'object',
                properties: {
                  number: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  sipUri: { type: 'string' },
                  extension: { type: 'string' },
                },
              },

              // Phone Provider (Twilio/Vonage)
              phoneCallProvider: {
                type: 'string',
                enum: ['twilio', 'vonage', 'vapi'],
                description: 'Telephony provider',
              },
              phoneCallProviderId: {
                type: 'string',
                description: 'Provider-specific call ID',
              },
              phoneCallTransport: {
                type: 'string',
                enum: ['sip', 'pstn'],
              },
              phoneCallProviderBypassEnabled: {
                type: 'boolean',
                nullable: true,
              },
              phoneCallProviderDetails: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Twilio Specific
              twilioCallSid: {
                type: 'string',
                nullable: true,
              },
              twilioCallStatus: {
                type: 'string',
                nullable: true,
              },

              // Vonage Specific
              vonageConversationUuid: {
                type: 'string',
                nullable: true,
              },

              // Web Call Specific
              webCallUrl: {
                type: 'string',
                format: 'uri',
                nullable: true,
              },
              webCallSipUri: {
                type: 'string',
                nullable: true,
              },

              // Analysis & Artifacts
              analysis: {
                type: 'object',
                nullable: true,
                properties: {
                  summary: { type: 'string' },
                  structuredData: {
                    type: 'object',
                    additionalProperties: true,
                  },
                  successEvaluation: { type: 'string' },
                },
              },
              artifact: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Monitor URLs
              monitor: {
                type: 'object',
                properties: {
                  listenUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'WebSocket URL for live monitoring',
                  },
                  controlUrl: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL for call control',
                  },
                },
              },

              // Transport Details
              transport: {
                type: 'object',
                properties: {
                  provider: { type: 'string' },
                  callSid: { type: 'string' },
                  conversationUuid: { type: 'string' },
                  accountSid: { type: 'string' },
                  apiKey: { type: 'string' },
                },
              },

              // Forwarding
              forwardedPhoneNumber: {
                type: 'string',
                nullable: true,
              },

              // Overrides
              assistantOverrides: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },
              assistantOverride: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Related objects (usually null in webhook)
              assistant: {
                type: 'object',
                nullable: true,
              },
              phoneNumber: {
                type: 'object',
                nullable: true,
              },
              assistants: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              squad: {
                type: 'object',
                nullable: true,
              },

              // Other fields
              name: {
                type: 'string',
                nullable: true,
              },
              destination: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },
              messages: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              maxDurationSeconds: {
                type: 'number',
                nullable: true,
              },
              metadata: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Workflow
              workflowId: {
                type: 'string',
                nullable: true,
              },
              workflow: {
                type: 'object',
                nullable: true,
              },
              workflowOverrides: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Campaign
              campaignId: {
                type: 'string',
                nullable: true,
              },

              // Compliance
              compliance: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },

              // Schedule
              schedulePlan: {
                type: 'object',
                nullable: true,
                additionalProperties: true,
              },
            },
          },

          // Phone Number Object
          phoneNumber: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orgId: { type: 'string' },
              assistantId: { type: 'string' },
              squadId: { type: 'string', nullable: true },
              number: {
                type: 'string',
                description: 'Phone number in E.164 format',
              },
              provider: {
                type: 'string',
                enum: ['twilio', 'vonage', 'vapi'],
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive'],
              },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              twilioAccountSid: { type: 'string', nullable: true },
              twilioOutgoingCallerId: { type: 'string', nullable: true },
              vonageApiKey: { type: 'string', nullable: true },
              vonageApiSecret: { type: 'string', nullable: true },
              vonageApplicationId: { type: 'string', nullable: true },
              credentialId: { type: 'string', nullable: true },
              serverUrl: { type: 'string', format: 'uri', nullable: true },
              serverUrlSecret: { type: 'string', nullable: true },
              sipUri: { type: 'string', nullable: true },
              fallbackDestination: { type: 'object', nullable: true },
              stripeSubscriptionId: { type: 'string', nullable: true },
              stripeSubscriptionStatus: { type: 'string', nullable: true },
              stripeSubscriptionCurrentPeriodStart: { type: 'string', nullable: true },
              smsEnabled: { type: 'boolean' },
              numberE164CheckEnabled: { type: 'boolean', nullable: true },
              workflowId: { type: 'string', nullable: true },
              cnam: { type: 'string', nullable: true },
              credentialIds: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              authentication: { type: 'object', nullable: true },
              server: { type: 'object', nullable: true },
              useClusterSip: { type: 'boolean', nullable: true },
              providerResourceId: { type: 'string', nullable: true },
              hooks: { type: 'object', nullable: true },
            },
          },

          // Assistant Object (extensive configuration)
          assistant: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orgId: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },

              // Voice Configuration
              voice: {
                type: 'object',
                properties: {
                  provider: {
                    type: 'string',
                    enum: ['11labs', 'azure', 'cartesia', 'deepgram', 'lmnt', 'neets', 'openai', 'playht', 'rime-ai'],
                  },
                  voiceId: { type: 'string' },
                  model: { type: 'string' },
                  speed: { type: 'number' },
                  stability: { type: 'number' },
                  similarityBoost: { type: 'number' },
                  style: { type: 'number' },
                  useSpeakerBoost: { type: 'boolean' },
                  optimizeStreamingLatency: { type: 'number' },
                  autoMode: { type: 'boolean' },
                  temperature: { type: 'number' },
                },
              },

              // Model Configuration
              model: {
                type: 'object',
                properties: {
                  provider: {
                    type: 'string',
                    enum: ['openai', 'anthropic', 'groq', 'together-ai', 'anyscale', 'perplexity-ai', 'deepinfra', 'custom-llm'],
                  },
                  model: { type: 'string' },
                  temperature: { type: 'number' },
                  maxTokens: { type: 'number' },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string' },
                        content: { type: 'string' },
                      },
                    },
                  },
                  functions: {
                    type: 'array',
                    nullable: true,
                    items: { type: 'object' },
                  },
                  knowledgeBase: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      provider: { type: 'string' },
                      fileIds: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                  },
                },
              },

              // Transcriber Configuration
              transcriber: {
                type: 'object',
                properties: {
                  provider: {
                    type: 'string',
                    enum: ['deepgram', 'gladia', 'talkscriber'],
                  },
                  model: { type: 'string' },
                  language: { type: 'string' },
                  numerals: { type: 'boolean' },
                },
              },

              // Messages
              firstMessage: { type: 'string' },
              firstMessageMode: {
                type: 'string',
                enum: ['assistant-speaks-first', 'assistant-waits-for-user', 'assistant-speaks-first-with-model-generated-message'],
              },
              endCallMessage: { type: 'string' },
              voicemailMessage: { type: 'string' },

              // Behavior Settings
              context: { type: 'string', nullable: true },
              interruptionsEnabled: { type: 'boolean', nullable: true },
              recordingEnabled: { type: 'boolean', nullable: true },
              endCallFunctionEnabled: { type: 'boolean' },
              dialKeypadFunctionEnabled: { type: 'boolean', nullable: true },
              fillersEnabled: { type: 'boolean', nullable: true },
              backchannelingEnabled: { type: 'boolean', nullable: true },
              backgroundDenoisingEnabled: { type: 'boolean', nullable: true },
              modelOutputInMessagesEnabled: { type: 'boolean', nullable: true },

              // Analysis Plan (YOUR CUSTOM SCHEMA)
              analysisPlan: {
                type: 'object',
                properties: {
                  structuredDataPlan: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      schema: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          required: {
                            type: 'array',
                            items: { type: 'string' },
                          },
                          properties: {
                            type: 'object',
                            additionalProperties: true,
                          },
                        },
                      },
                      messages: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            role: { type: 'string' },
                            content: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  minMessagesThreshold: { type: 'number' },
                },
              },

              // Timing Settings
              responseDelaySeconds: { type: 'number', nullable: true },
              llmRequestDelaySeconds: { type: 'number', nullable: true },
              llmRequestNonPunctuatedDelaySeconds: { type: 'number', nullable: true },
              maxDurationSeconds: { type: 'number', nullable: true },
              silenceTimeoutSeconds: { type: 'number', nullable: true },
              numWordsToInterruptAssistant: { type: 'number', nullable: true },
              customerJoinTimeoutSeconds: { type: 'number', nullable: true },

              // Advanced Settings
              backgroundSound: {
                type: 'string',
                enum: ['off', 'office'],
              },
              keywords: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              endCallPhrases: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              voicemailDetectionEnabled: { type: 'boolean', nullable: true },
              voicemailDetectionTypes: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              hipaaEnabled: { type: 'boolean', nullable: true },

              // Server Configuration
              server: {
                type: 'object',
                nullable: true,
                properties: {
                  url: { type: 'string', format: 'uri' },
                  timeoutSeconds: { type: 'number' },
                },
              },
              serverUrl: { type: 'string', format: 'uri', nullable: true },
              serverUrlSecret: { type: 'string', nullable: true },

              // Messaging
              clientMessages: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              serverMessages: {
                type: 'array',
                items: { type: 'string' },
              },

              // Other Settings
              language: { type: 'string', nullable: true },
              functions: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              forwardingPhoneNumber: { type: 'string', nullable: true },
              forwardingPhoneNumbers: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              parentId: { type: 'string', nullable: true },
              squadId: { type: 'string', nullable: true },
              blockId: { type: 'string', nullable: true },
              block: { type: 'object', nullable: true },
              credentialIds: {
                type: 'array',
                nullable: true,
                items: { type: 'string' },
              },
              metadata: { type: 'object', nullable: true },
              summaryPrompt: { type: 'string', nullable: true },
              artifactPlan: { type: 'object', nullable: true },
              messagePlan: { type: 'object', nullable: true },
              voicemailDetection: { type: 'object', nullable: true },
              transportConfigurations: {
                type: 'array',
                nullable: true,
                items: { type: 'object' },
              },
              pipelineConfiguration: { type: 'object', nullable: true },
              startSpeakingPlan: {
                type: 'object',
                nullable: true,
                properties: {
                  smartEndpointingPlan: {
                    type: 'object',
                    properties: {
                      provider: { type: 'string' },
                    },
                  },
                },
              },
              stopSpeakingPlan: { type: 'object', nullable: true },
              monitorPlan: { type: 'object', nullable: true },
              credentials: { type: 'object', nullable: true },
              pciEnabled: { type: 'boolean', nullable: true },
              hooks: { type: 'object', nullable: true },
              compliancePlan: { type: 'object', nullable: true },
              keypadInputPlan: { type: 'object', nullable: true },
              observabilityPlan: { type: 'object', nullable: true },
              firstMessageInterruptionsEnabled: { type: 'boolean', nullable: true },
              backgroundSpeechDenoisingPlan: { type: 'object', nullable: true },
              liveTranscriptsEnabled: { type: 'boolean', nullable: true },
              callbackUrl: { type: 'string', format: 'uri', nullable: true },
              customLlmUrl: { type: 'string', format: 'uri', nullable: true },
            },
          },

          // Other message type fields
          role: { type: 'string' },
          content: { type: 'string' },
          functionCall: { type: 'object' },
          toolCalls: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
  },
};