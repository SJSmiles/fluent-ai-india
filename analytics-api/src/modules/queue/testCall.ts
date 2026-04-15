import Queue from 'bull';

export const testCallQueue = new Queue('test-call-end', {
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});