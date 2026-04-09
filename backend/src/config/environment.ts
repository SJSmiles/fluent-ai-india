// Import environment variables
import { Algorithm } from 'fast-jwt';
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const Environment = {
  env: process.env.NODE_ENV,
  isDev: process.env.IS_DEV?.toLowerCase() === 'true',
  host: process.env.HOST,
  port: parseInt(process.env.PORT ? process.env.PORT : '9000', 10),
  logger: {
    level: process.env.LOG_LEVEL
  },
  database: {
    connector: process.env.DATABASE_CONNECTOR,
    mongoUri: process.env.DATABASE_URI
  },
  jwt: {
    secret: process.env.JWT_TOKEN_SECRET
  },
  JWT_EXPIRE_TIME: process.env.JWT_EXPIRE_TIME || '7d',
  JWT_REFRESH_TOKEN_EXPIRE_TIME: process.env.JWT_REFRESH_TOKEN_EXPIRE_TIME || '1h',

  // JWT Configuration from environment
  JWT_CONFIG: {
    TOKEN_SECRET: process.env.JWT_TOKEN_SECRET!,
    ACCESS_TOKEN_EXPIRES_IN: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    REFRESH_TOKEN_EXPIRES_IN: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
    LONG_REFRESH_TOKEN_EXPIRES_IN: process.env.JWT_LONG_REFRESH_TOKEN_EXPIRES_IN || '90d',
    ISSUER: process.env.JWT_ISSUER || 'fluent-app',
    ALGORITHM: 'HS256' as Algorithm
  },


  // Cookie configuration
  COOKIE_CONFIG: {
    httpOnly: true,                           // Prevents XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',                      // CSRF protection
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000       // 30 days in milliseconds
  },

  REMEMBER_COOKIE_CONFIG: {
    httpOnly: true,                           // Prevents XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',                      // CSRF protection
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000       // 30 days in milliseconds
  },
  COOKIE_SECRET: process.env.COOKIE_SECRET,
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    username: process.env.REDIS_USERNAME,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
};


console.log('----------------------------------------------------------------');
console.log('- Environment Configuration');
console.log('----------------------------------------------------------------');

console.log(`> NODE_ENV: ${Environment.env}`);
console.log(`> HOST: ${Environment.host}`);
console.log(`> PORT: ${Environment.port}`);
console.log(`> LOG_LEVEL: ${Environment.logger.level}`);

console.log('----------------------------------------------------------------');
