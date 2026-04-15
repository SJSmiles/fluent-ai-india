import Queue from 'bull';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || undefined,
};

// ✅ SAME NAME everywhere (IMPORTANT)
export const callProcessQueue = new Queue('call-process', {
  redis: REDIS_CONFIG,
});

export const testCallProcessQueue = new Queue('test-call-process', {
  redis: REDIS_CONFIG,
});