import Queue from 'bull';

export const rebuildQueue = new Queue('rebuild-calls', {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    },
});