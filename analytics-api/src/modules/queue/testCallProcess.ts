import Queue from 'bull';

export const testCallProcessQueue = new Queue('test-call-process', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
});