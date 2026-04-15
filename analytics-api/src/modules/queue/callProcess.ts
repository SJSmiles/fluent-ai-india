import Queue from 'bull';

export const callProcessQueue = new Queue('call-process', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
});