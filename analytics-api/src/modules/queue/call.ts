import Queue from 'bull';

export const callQueue = new Queue('call-end', {
  redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
});