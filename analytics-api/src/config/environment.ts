// Import environment variables
import dotenv from 'dotenv';

dotenv.config();

export const Environment = {
  env: process.env.NODE_ENV,
  host: process.env.HOST,
  port: parseInt(process.env.PORT ? process.env.PORT : '9000', 10),
  database: {
    connector: process.env.DATABASE_CONNECTOR,
    mongoUri: process.env.DATABASE_URI,
  },
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

console.log('----------------------------------------------------------------');
