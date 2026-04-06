import Queue, { Job } from 'bull';
import dotenv from 'dotenv';
import { vapiHandleCallUpdate } from '../services/vapi-logs-service';
import { retellHandleCallUpdate } from '../services/retell.service';

dotenv.config();

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const rebuildQueue = new Queue('rebuild-calls', {
    redis: {
        host: REDIS_HOST, port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
    },
});


rebuildQueue.process(async (job: Job<{ call_id: string, type: string }>) => {
    try {
        const { call_id, type } = job.data;
        console.log(`Worker received job for call_id: ${call_id}, type: ${type}`);
        if (type === 'vapi') {
            await vapiHandleCallUpdate(call_id);
        } else {
            await retellHandleCallUpdate(call_id);
        }
    } catch (err) {
        console.error('Worker job failed', err);
        throw err;
    }
});



console.log('Worker listening for jobs...');


