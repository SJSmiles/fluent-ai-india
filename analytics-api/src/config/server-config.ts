export const DASHBOARD_ANALYTICS_TYPE = {
  TOTAL_CALL: 1,
  TOTAL_DURATION: 2,
  TOTAL_COST: 3,
  FAILED_CALLS: 4,
  ENDED_CALLS: 5,
  LEAD_STATUS: 6,
  CALL_PICKUP_STATUS: 7,
  TOTAL_ATTEMPTS: 8,
  ANSWERED_CALLS: 9,
  NO_ANSWER_CALLS: 10,
  AVG_DURATION: 11,
  SUCCESS_RATE: 12,
  LEAD_STATUS_DISTRIBUTION: 13
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
  INBOUND: 2,
};


export const CORS_CONFIG = {
  strictPreflight: false,
  origin: ['http://localhost:4200', 'https://dev.thefluent.io'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};


export const LEAD_STATUS = [
  'Already Bought',
  'Interested - Meeting',
  'Interested - Meeting Booked',
  'Human Action Needed - Task',
  'Interested - Task',
  'Ask Human Call',
  'Human Review Needed',
  'Human Call Needed',
  'Not Interested',
  'Not Interested - For Now',
  'Changed Interest',
  'Do Not Contact',
  'Invalid Lead',
  'No Human Detected',
  'Unclassified',
  'Pending'
];

export const ANSWERED_LEAD_STATUSES = [
  'Already Bought',
  'Interested - Meeting',
  'Interested - Meeting Booked',
  'Human Action Needed - Task',
  'Interested - Task',
  'Ask Human Call',
  'Human Review Needed',
  'Human Call Needed',
  'Not Interested',
  'Not Interested - For Now',
  'Changed Interest',
  'Do Not Contact',
  'Invalid Lead'
];


export const ANSWER_CALLS = [
  // Agent / User actions
  'agent_ended_call',
  'agent_hangup',
  'user_ended_call',
  'user_hangup',

  // Time-based (only possible after connect)
  'silence_timeout',
  'max_duration_reached',
  'max_duration_exceeded',

  // System-ended but connected
  'call_completed',
  'call_completed_normally'
];


export const NO_ANSWER_CALLS = [
  // Dial failures
  'dial_busy',
  'dial_failed',
  'dial_no_answer',

  // Destination / routing
  'invalid_destination',
  'customer-did-not-answer',
  'twilio-reported-customer-misdialed',

  // Provider issues
  'telephony_provider_permission_denied',
  'telephony_provider_unavailable',
  'twilio_error',
  'vonage_error',
  'connection_error',
  'not_connected',

  // AI / pipeline failures before connect
  'pipeline-error-eleven-labs-voice-failed',
  'pipeline-error-eleven-labs-voice-not-found',
  'call.in-progress.error-vapifault-worker-died',

  // Detection / inactivity (pre-connect)
  'inactivity',
  'error_asr',

  // Voicemail (industry standard = no answer)
  'voicemail_detected',
  'voicemail_reached'
];


export const NO_ANSWER_LEAD_STATUSES = [
  'No Human Detected',
  'Unclassified',
  'Pending'
];

export const LEAD_STATUS_GROUPS: { [key: string]: string[] } = {
  'Meeting Booked': ['Interested - Meeting Booked'],
  'Interested': ['Interested - Meeting', 'Interested - Task'],
  'Not Interested': ['Not Interested', 'Not Interested - For Now', 'Changed Interest', 'Do Not Contact'],
  'Human Needed': [
    'Human Action Needed - Task',
    'Ask Human Call',
    'Human Review Needed',
    'Human Call Needed'
  ],
  'No Human': ['No Human Detected', 'Unclassified', 'Pending'],
  'Already Bought': ['Already Bought'],
  'Invalid Lead': ['Invalid Lead']
};

export const SUCCESS_STATUSES = ['Interested - Meeting Booked', 'Interested - Meeting'];


export const LEAD_STATUSES_FOR_PM_QUALI = [
  "Do Not Contact",
  "No Human Detected",
  "Invalid Lead",
  "Already Successful / No Coaching Needed",
  "Changed Interest",
  "Not Interested",
  "Not Interested - For Now",
  "Interested - Meeting Booked",
  "Interested - Task",
  "Human Action Needed - Task",
  "Unclassified",
];

export const LEAD_STATUSES_COMMONS = [
  'Interested - Meeting Booked',
  'Interested - Task',
  'Not Interested',
  'Human Action Needed - Task',
  'No Human Detected',
  'Already Bought',
  'Unclassified',
  'Do Not Contact',
  'Invalid Lead'
];