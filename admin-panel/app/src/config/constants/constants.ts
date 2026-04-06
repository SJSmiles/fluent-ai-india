export const DATE_RANGE_OPTIONS = [
  { key: 'today', display: 'Today' },
  { key: 'last7Days', display: 'Last 7 Days' },
  { key: 'last30Days', display: 'Last 30 Days' },
  { key: 'custom', display: 'Custom Range' }
];

// You can also add other constants here
export const DEFAULT_DATE_RANGE = 'last7Days';
export const CUSTOM_DATE_RANGE = 'custom';

export const CALL_STATUS = {
  ALL: 0,
  ONGOING: 1,
  ENDED: 2,
  FAILED: 3,
  PENDING: 4,
  ERROR: 6
};

export const Lead_Status = [
  'Interested - Meeting Booked',
  'Interested - Task',
  'Not Interested',
  'Human Action Needed - Task',
  'No Human Detected',
  'Already Bought',
  'Unclassified',
  'Do Not Contact',
  'Invalid Lead'
  // 'Pending'
  // 'Interested - Meeting',

  // 'Ask Human Call',
  // 'Human Review Needed',
  // 'Human Call Needed',

  // 'Not Interested - For Now',
  // 'Changed Interest',

  // 'Invalid Lead',
];

export const Lead_Status_Filter = [
  'Interested - Meeting Booked',
  'Interested - Task',
  'Not Interested',
  'Human Action Needed - Task',
  'No Human Detected',
  'Already Bought',
  'Unclassified',
  'Do Not Contact',
  'Invalid Lead'

  // 'Interested - Meeting',
  // 'Ask Human Call',
  // 'Human Review Needed',
  // 'Human Call Needed',

  // 'Not Interested - For Now',
  // 'Changed Interest',
];

export const TESTIMONIAL_DATA = [
  {
    id: 1,
    name: 'David M.',
    position: 'CEO - APPLE INC',
    avatar: 'DM',
    imageUrl: 'src/assets/images/fluent/david-m.png',
    rating: 5,
    text: 'As a freelancer, staying organized is non-negotiable. Fluent has been a game-changer for me. The notifications keep me in the loop, and the chat support feature has saved me more than once.',
    gradient: 'linear-gradient(135deg, #ff6b6b, #feca57)'
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    position: 'CTO - Tech Solutions',
    avatar: 'SJ',
    imageUrl: 'src/assets/images/fluent/sara-j.png',
    rating: 5,
    text: 'Fluent has revolutionized our customer service. The AI handles routine inquiries flawlessly, allowing our team to focus on complex issues. Response times improved by 300%!',
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)'
  },
  {
    id: 3,
    name: 'Michael Rodriguez',
    position: 'Sales Director - Global Corp',
    avatar: 'MR',
    imageUrl: 'src/assets/images/fluent/michael-r.png',
    rating: 5,
    text: 'The integration was seamless and results immediate. Our sales team can now handle 5x more calls with the same headcount. Fluent is a must-have for growing business.',
    gradient: 'linear-gradient(135deg, #f093fb, #f5576c)'
  },
  {
    id: 4,
    name: 'Emily Watson',
    position: 'Operations Manager - StartupXYZ',
    avatar: 'EW',
    imageUrl: 'src/assets/images/fluent/david-m.png',
    rating: 5,
    text: "Amazing product! The natural language processing is incredibly advanced. Customers often don't realize they're talking to an AI. Like having a 24/7 superhero.",
    gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)'
  },
  {
    id: 5,
    name: 'James Liu',
    position: 'VP Strategy - Fortune 500',
    avatar: 'JL',
    imageUrl: 'src/assets/images/fluent/michael-r.png',
    rating: 5,
    text: 'ROI was evident within the first month. Fluent reduced operational costs and increased customer satisfaction scores. The analytics dashboard provides incredible insights.',
    gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)'
  }
];

export const DELETION_CONFIG = {
  MIN_TIME_DIFFERENCE_MINUTES: 30,

  get MIN_TIME_DIFFERENCE_MS() {
    return this.MIN_TIME_DIFFERENCE_MINUTES * 60 * 1000;
  }
};

export const BATCH_DETAILS = {
  data: [
    {
      _id: '6932a8d08944afaa129835c9',
      recipientId: '6932a8d08944afaa129835c9',
      errorMessage: '',
      rCallStatus: 3,
      recipientNumber: '+1 (555) 234-5678',
      recipientFirstName: 'Sarah',
      recipientLastName: 'Johnson',
      recipientGender: 'female',
      recipientEmail: 'sarah.johnson@example.com',
      recipientStatus: 3,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-06T15:35:24.000Z',
      callAttempt: 2,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-5241-755b-b3f6-a35b1cb90130',
      callStatus: 3,
      callRecordingUrl: '',
      callDuration: 24,
      callDisconnectionReason: '',
      callFromNumber: '+12532151864',
      callToNumber: '+15552345678',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: true,
      callLeadStatus: '',
      callCreatedAt: '2025-12-05T15:35:00.000Z',
      callUpdatedAt: '2025-12-05T15:35:24.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T14:15:00.000Z',
          status: 'Not Answered',
          result: 'followup',
          duration: 0,
          disconnectionReason: 'no_answer'
        },
        {
          attemptNumber: 2,
          datetime: '2025-12-05T15:35:00.000Z',
          status: 'In Progress...',
          result: 'processing',
          duration: 24,
          disconnectionReason: ''
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c8',
      recipientId: '6932a8d08944afaa129835c8',
      errorMessage: '',
      rCallStatus: 3,
      recipientNumber: '+1 (555) 876-5432',
      recipientFirstName: 'John',
      recipientLastName: 'Smith',
      recipientGender: 'male',
      recipientEmail: 'john.smith@example.com',
      recipientStatus: 3,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:35:18.000Z',
      callAttempt: 1,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba286',
      callStatus: 3,
      callRecordingUrl: '',
      callDuration: 18,
      callDisconnectionReason: '',
      callFromNumber: '+12532151864',
      callToNumber: '+15558765432',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: true,
      callLeadStatus: '',
      callCreatedAt: '2025-12-05T15:35:00.000Z',
      callUpdatedAt: '2025-12-05T15:35:18.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T15:35:00.000Z',
          status: 'In Progress...',
          result: 'processing',
          duration: 18,
          disconnectionReason: ''
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c7',
      recipientId: '6932a8d08944afaa129835c7',
      errorMessage: '',
      rCallStatus: 3,
      recipientNumber: '+1 (555) 987-6543',
      recipientFirstName: 'Emily',
      recipientLastName: 'Davis',
      recipientGender: 'female',
      recipientEmail: 'emily.davis@example.com',
      recipientStatus: 3,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:35:32.000Z',
      callAttempt: 1,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba287',
      callStatus: 3,
      callRecordingUrl: '',
      callDuration: 32,
      callDisconnectionReason: '',
      callFromNumber: '+12532151864',
      callToNumber: '+15559876543',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: true,
      callLeadStatus: '',
      callCreatedAt: '2025-12-05T15:35:00.000Z',
      callUpdatedAt: '2025-12-05T15:35:32.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T15:35:00.000Z',
          status: 'In Progress...',
          result: 'processing',
          duration: 32,
          disconnectionReason: ''
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c6',
      recipientId: '6932a8d08944afaa129835c6',
      errorMessage: '',
      rCallStatus: 2,
      recipientNumber: '+1 (555) 111-2222',
      recipientFirstName: 'Michael',
      recipientLastName: 'Brown',
      recipientGender: 'male',
      recipientEmail: 'michael.brown@example.com',
      recipientStatus: 3,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:20:23.000Z',
      callAttempt: 3,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba288',
      callStatus: 2,
      callRecordingUrl: 'https://example.com/recording2.mp3',
      callDuration: 323,
      callDisconnectionReason: 'agent_hangup',
      callFromNumber: '+12532151864',
      callToNumber: '+15551112222',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: true,
      callLeadStatus: 'Meeting Booked',
      callCreatedAt: '2025-12-05T15:15:00.000Z',
      callUpdatedAt: '2025-12-05T15:20:23.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T14:00:00.000Z',
          status: 'Not Answered',
          result: 'followup',
          duration: 0,
          disconnectionReason: 'no_answer'
        },
        {
          attemptNumber: 2,
          datetime: '2025-12-05T14:45:00.000Z',
          status: 'Disconnected',
          result: 'followup',
          duration: 12,
          disconnectionReason: 'customer_hangup'
        },
        {
          attemptNumber: 3,
          datetime: '2025-12-05T14:45:00.000Z',
          status: 'Disconnected',
          result: 'followup',
          duration: 12,
          disconnectionReason: 'customer_hangup'
        },
        {
          attemptNumber: 4,
          datetime: '2025-12-05T15:15:00.000Z',
          status: 'Meeting Booked',
          result: 'success',
          duration: 323,
          disconnectionReason: 'agent_hangup'
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c5',
      recipientId: '6932a8d08944afaa129835c5',
      errorMessage: '',
      rCallStatus: 2,
      recipientNumber: '+1 (555) 222-3333',
      recipientFirstName: 'Lisa',
      recipientLastName: 'Wilson',
      recipientGender: 'female',
      recipientEmail: 'lisa.wilson@example.com',
      recipientStatus: 3,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:14:12.000Z',
      callAttempt: 1,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba289',
      callStatus: 2,
      callRecordingUrl: 'https://example.com/recording3.mp3',
      callDuration: 252,
      callDisconnectionReason: 'agent_hangup',
      callFromNumber: '+12532151864',
      callToNumber: '+15552223333',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: true,
      callLeadStatus: 'Interested',
      callCreatedAt: '2025-12-05T15:10:00.000Z',
      callUpdatedAt: '2025-12-05T15:14:12.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T15:10:00.000Z',
          status: 'Interested',
          result: 'success',
          duration: 252,
          disconnectionReason: 'agent_hangup'
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c4',
      recipientId: '6932a8d08944afaa129835c4',
      errorMessage: '',
      rCallStatus: 2,
      recipientNumber: '+1 (555) 333-4444',
      recipientFirstName: 'David',
      recipientLastName: 'Martinez',
      recipientGender: 'male',
      recipientEmail: 'david.martinez@example.com',
      recipientStatus: 4,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:06:45.000Z',
      callAttempt: 1,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba290',
      callStatus: 2,
      callRecordingUrl: 'https://example.com/recording4.mp3',
      callDuration: 105,
      callDisconnectionReason: 'customer_hangup',
      callFromNumber: '+12532151864',
      callToNumber: '+15553334444',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: false,
      callLeadStatus: "Don't Call Back",
      callCreatedAt: '2025-12-05T15:05:00.000Z',
      callUpdatedAt: '2025-12-05T15:06:45.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T15:05:00.000Z',
          status: "Don't Call Back",
          result: 'success',
          duration: 105,
          disconnectionReason: 'customer_hangup'
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c3',
      recipientId: '6932a8d08944afaa129835c3',
      errorMessage: '',
      rCallStatus: 2,
      recipientNumber: '+1 (555) 444-5555',
      recipientFirstName: 'Jennifer',
      recipientLastName: 'Taylor',
      recipientGender: 'female',
      recipientEmail: 'jennifer.taylor@example.com',
      recipientStatus: 2,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T15:00:00.000Z',
      callAttempt: 2,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '019af313-4f64-755b-b3f6-9e2c32eba291',
      callStatus: 2,
      callRecordingUrl: '',
      callDuration: 0,
      callDisconnectionReason: 'no_answer',
      callFromNumber: '+12532151864',
      callToNumber: '+15554445555',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: false,
      callLeadStatus: 'Follow-up Scheduled',
      callCreatedAt: '2025-12-05T15:00:00.000Z',
      callUpdatedAt: '2025-12-05T15:00:00.000Z',
      callHistory: [
        {
          attemptNumber: 1,
          datetime: '2025-12-05T14:30:00.000Z',
          status: 'Not Answered',
          result: 'followup',
          duration: 0,
          disconnectionReason: 'no_answer'
        },
        {
          attemptNumber: 2,
          datetime: '2025-12-05T15:00:00.000Z',
          status: 'Follow-up Scheduled',
          result: 'success',
          duration: 0,
          disconnectionReason: 'no_answer'
        }
      ]
    },
    {
      _id: '6932a8d08944afaa129835c2',
      recipientId: '6932a8d08944afaa129835c2',
      errorMessage: '',
      rCallStatus: 1,
      recipientNumber: '+1 (555) 555-6666',
      recipientFirstName: 'Robert',
      recipientLastName: 'Anderson',
      recipientGender: 'male',
      recipientEmail: 'robert.anderson@example.com',
      recipientStatus: 1,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T09:41:36.907Z',
      callAttempt: 0,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '',
      callStatus: 1,
      callRecordingUrl: '',
      callDuration: 0,
      callDisconnectionReason: '',
      callFromNumber: '+12532151864',
      callToNumber: '+15555556666',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: false,
      callLeadStatus: '',
      callCreatedAt: null,
      callUpdatedAt: null,
      callHistory: []
    },
    {
      _id: '6932a8d08944afaa129835c1',
      recipientId: '6932a8d08944afaa129835c1',
      errorMessage: '',
      rCallStatus: 1,
      recipientNumber: '+1 (555) 666-7777',
      recipientFirstName: 'Amanda',
      recipientLastName: 'Thomas',
      recipientGender: 'female',
      recipientEmail: 'amanda.thomas@example.com',
      recipientStatus: 1,
      recipientCreatedAt: '2025-12-05T09:41:36.907Z',
      recipientUpdatedAt: '2025-12-05T09:41:36.907Z',
      callAttempt: 0,
      batchId: '6932a8d08944afaa129835c6',
      batchName: 'Enterprise Leads Q4',
      batchStatus: 4,
      batchDate: '2025-12-05',
      batchTime: '14:00',
      batchTimezone: 'America/New_York',
      batchOutboundNumber: '+1 (253) 215 1864',
      callId: '',
      callStatus: 1,
      callRecordingUrl: '',
      callDuration: 0,
      callDisconnectionReason: '',
      callFromNumber: '+12532151864',
      callToNumber: '+15556667777',
      callAgentId: 'Sarah Johnson',
      callInterestStatus: false,
      callLeadStatus: '',
      callCreatedAt: null,
      callUpdatedAt: null,
      callHistory: []
    }
  ],
  logs: {
    action: 'BATCH_ATTEMPT',
    message: 'User attempted to process this recipient',
    attemptedAt: '2025-12-05T15:30:00.000Z',
    expression: '0 0 14 5 12 *',
    recipientIdsToUpdate: 10
  },
  totalCount: 187,
  pagination: {
    skip: 0,
    limit: 15,
    total: 187,
    hasMore: true
  }
};

export const BATCH_CALL_STATUS = {
  IN_PROCESS: 4,
  COMPLETED: 5,
  FAILED: 6,
  QUEUED: 9,
  SCHEDULED: 10
};
