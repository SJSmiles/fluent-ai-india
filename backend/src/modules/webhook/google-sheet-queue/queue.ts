// queue.ts
import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || undefined,
};

export const rebuildSheetProcessQueue = new Queue(
  'rebuild-google-sheet-process',
  { redis: REDIS_CONFIG }
);
