import { Environment } from './environment';

export const LOGGER_CONFIG = {
  transport: {
    target: 'pino-pretty'
  },
  level: Environment.logger.level
};

export const CORS_CONFIG = {
  strictPreflight: false,
  origin: ['http://localhost:4200'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

export const JWT_CONFIG = {
  secret: Environment.jwt.secret
};

export const USER_STATUS = {
  PENDING: 0,
  ACTIVE: 1
};



export const CALL_STATUS = {
  ONGOING: 1,
  ENDED: 2,
  FAILED: 3,
  PENDING: 4,
  ERROR: 6
};

export const CALL_DIRECTION = {
  OUTBOUND: 1,
  INBOUND: 2
};

export const BATCH_CALL_STATUS = {
  START_CALLING: 2,
  NOT_STARTED: 3,
  IN_PROCESS: 4,
  COMPLETED: 5,
  FAILED: 6,
  CREATED: 9
};

export const BATCH_CHUNK_STATUS = {
  NOT_STARTED: 1,
  IN_PROCESS: 2,
  COMPLETED: 2,
};


export const BATCH_CALL_FOLLOWUPS_DIFF = {
  DIFF_IN: 'minutes',// FOR minutes use 'minutes' // FOR hours use 'hours'
  DIFF_VALUE: 15,
};

export const BATCH_CALL_START_AFTER: any = {
  DIFF_IN: 'minutes',// FOR minutes use 'minutes' // FOR hours use 'hours'
  DIFF_VALUE: 2,
};

export const CALL_DELETE_BEFORE: any = {
  DIFF_VALUE: 30, // in  'minutes
};

export const CONFIG_TYPES: any = {
  SHEET: 'sheet-configuration',
  BMBY: 'bmby-configuration'
}


export const LEAD_STATUS_FOR_SYNC = [
  'Interested - Meeting Booked',
  'Interested - Task'
]


export const TIME_DIFF = {
  RETRY_BATCH_CALL: 20
};


export const NOT_CONTACT_REASON_STATUS = {
  DO_NOT_CONTACT: 1,
  NOT_INTERESTED: 2,
  INTERESTED_TASK: 3,
  INTERESTED_MEETING_BOOKED: 4
};


export const BATCH_CALL_PROCESS_STATUS = {
  UN_SUCCESS: [
    'dial_busy',
    'dial_failed',
    'dial_no_answer',
    'error_no_audio_received',
    'inactivity',
    'invalid_destination',
    'telephony_provider_permission_denied',
    'telephony_provider_unavailable',
    'voicemail_reached',
    'voicemail_detected',
    'Voicemail Detected',
    'customer-did-not-answer',
    'silence_timeout',
    'twilio_error',
    'vonage_error',
    'connection_error',
    'not_connected',
    'call.in-progress.error-vapifault-worker-died',
    'twilio-reported-customer-misdialed',
    'error_asr'
  ],
  SUCCESS: ['agent_hangup', 'silence_timeout', 'user_hangup', 'max_duration_reached', 'user_ended_call', 'max_duration_exceeded', 'agent_ended_call'],
  UN_SUCCESS_VALUE: 2,
  SUCCESS_VALUE: 3,
  DEAD: 4,
  SKIP: 5,
  IN_PROCESS: 6,
  PENDING: 1,
  FAILED: 7,
  MIN_TIME_FOR_SUCCESS: 2000
};





