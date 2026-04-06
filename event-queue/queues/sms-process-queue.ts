import Queue, { Queue as BullQueue } from 'bull';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;


export const rebuildSMSQueue: BullQueue = new Queue('rebuild-sms-process', {
  redis: {
    host: REDIS_HOST, port: REDIS_PORT, username: REDIS_USERNAME,
    password: REDIS_PASSWORD
  }
});

