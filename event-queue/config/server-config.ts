export const CALL_STATUS = {
  ONGOING: 1,
  ENDED: 2,
  FAILED: 3,
  PENDING: 4,
};

export const CALL_DIRECTION = {
  OUTBOUND: 1,
  INBOUND: 2,
};

export const BATCH_CALL_STATUS = {
  PENDING: 9,
  DRAFT: 1,
  START_CALLING: 2,
  NOT_STARTED: 3,
  IN_PROCESS: 4,
  COMPLETED: 5,
  FAILED: 6
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
  MIN_TIME_FOR_SUCCESS: 2000,
  SKIP: 5,
  FAILED: 7,
};


export const LEAD_STATUS_FOR_SYNC = [
  'Interested - Meeting Booked',
  'Interested - Task'
]

export const LEAD_STATUS_FOR_TASK_CREATION = [
  'Interested - Meeting Booked', // Appointment
  'will join session', // Appointment
  'callback requested', // Appointment
  'Interested - Task' // Task
]


export const RECIPIENTS_CALL_ATTEMPT_STATUS = {
  PENDING: 0,
  IN_PROCESS: 1,
  SUCCESS: 2
};

export const RETRY_DATA: any = {
  MAX_ATTEMPTS: 1,
  RETRY_INTERVAL: {
    1: 2 * 60 * 1000,     // 2 min
    2: 5 * 60 * 1000     // 5 min
  }
};

export const SHEET_RETRY_DIFF: any = {
  DIFF_VALUE: 60, // in  minutes
  DIFF_IN: 'minutes'
}

export const meetingStatusesArray = [
  'Interested - Meeting',
  'Interested - Meeting Booked',
  'Interested – Meeting Booked',
  'Interested Meeting',
  'will join session',
  'callback requested',
  'Interested - Task',
  'Interested Task'
];


export const SMS: any = {
  agents: [
    {
      agentIds: ["9bd90c1a-26d2-4c28-95f4-0a04050cc99d", "6fb7cef2-9181-4e94-9782-ab0805683853"],
      message: `Hi! Thanks for taking the time to chat with us 🙏 Here's your registration link for the open house:

📍 Helmholtzstr. 24, Berlin
📅 March 19 | 5:30 PM – 7:00 PM
https://luma.com/vhncye3k?upixel=testpixel&utm_campaign=Open%20House%20-%20Helmholtzstr.%2024&utm_medium=email&utm_source=InforuMail

We'd love to welcome you! Bring your family or anyone who'd like to see the place.
— Your Sweet Home Team 🏡`
    },

    {
      agentIds: ["99c69158-55bc-4645-8b03-53949d067f52"],
      message: `Hi! Thanks for taking the time to chat with us 🙏 Here's your registration link for the open house:

📍 Eugen-Schönhaar-Str. 19, Berlin
📅 March 21 | 12:00 PM – 2:00 PM
https://luma.com/1e32qenz?upixel=testpixel&utm_campaign=Open%20House%20-%20Eugen-Sch%C3%B6nhaar-Str.%2019%20&utm_medium=email&utm_source=InforuMail

We'd love to welcome you!
— Your Sweet Home Team 🏡`
    },

    {
      agentIds: ["aa693d85-12b2-46bd-9bbf-353f2dbc6b6a"],
      message: `Hi! Thanks for taking the time to chat with us 🙏 Here's your registration link:

📍 Huttenstraße 71, Berlin
📅 March 26 | 5:30 PM – 7:00 PM
https://luma.com/tcyzml7n?upixel=testpixel&utm_campaign=Open%20House%20-%20Huttenstra%C3%9Fe%2071%2C%20WE%206&utm_medium=email&utm_source=InforuMail

We'd love to welcome you!
— Your Sweet Home Team 🏡`
    },

    {
      agentIds: ["29cffefb-ea1d-4b13-b3cc-de5e21646651", "5e2141ac-55e7-459a-9c13-ee08e95340e6"],
      message: `Hi! Thanks for taking the time to chat with us 🙏 Here's your registration link:

📍 Beusselstraße 37, Berlin
📅 March 28 | 12:00 PM – 2:00 PM
https://luma.com/2uaih7ry?upixel=testpixel&utm_campaign=Open%20House%20-%20Beusselstra%C3%9Fe%2037%2C%20WE%206&utm_medium=email&utm_source=InforuMail

We'd love to welcome you!
— Your Sweet Home Team 🏡`
    }
  ]
};

export const SYNC_NOT_ALLOWED_AGENTS = [
  "9bd90c1a-26d2-4c28-95f4-0a04050cc99d", "6fb7cef2-9181-4e94-9782-ab0805683853",
  "fc2d2356-ddf9-4aca-8ea8-e393412bc95d", "c2854d15-4f4c-4d48-8be7-7500e50e3bc1",
  "5c1395ae-cf11-474a-a401-643c02bb01ee", "4c16d279-41e2-4d2b-96db-9df3676bebc0",
  "29cffefb-ea1d-4b13-b3cc-de5e21646651", "5e2141ac-55e7-459a-9c13-ee08e95340e6", "99c69158-55bc-4645-8b03-53949d067f52", "aa693d85-12b2-46bd-9bbf-353f2dbc6b6a"
]

export const PM_QUALI_COMPANY_ID = "69ccab1681b8d79c89f3b239";