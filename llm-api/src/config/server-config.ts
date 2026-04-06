export const DASHBOARD_ANALYTICS_TYPE = {
    TOTAL_CALL: 1,
    TOTAL_DURATION: 2,
    TOTAL_COST: 3,
    FAILED_CALLS: 4,
    ENDED_CALLS: 5,

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
    origin: '*',
    allowedHeaders: '*',
    exposedHeaders: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
};