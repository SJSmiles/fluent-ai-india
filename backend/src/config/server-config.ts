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





