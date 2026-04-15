import dotenv from 'dotenv';
import Queue, { Job } from 'bull';
import { handleCallUpdate } from '../services/callProcess.service';
import { handleTestCallUpdate } from '../services/testCallProcess.service';

dotenv.config();

// ==============================
// ✅ REDIS CONFIG (SHARED)
// ==============================
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || undefined,
};

// ==============================
// ✅ QUEUE INIT (MUST MATCH API)
// ==============================
const callProcessQueue = new Queue('call-process', {
    redis: REDIS_CONFIG,
});

const testCallProcessQueue = new Queue('test-call-process', {
    redis: REDIS_CONFIG,
});

console.log('🚀 Worker started...');
console.log('🔌 Redis:', REDIS_CONFIG.host + ':' + REDIS_CONFIG.port);

// ==============================
// ✅ CALL PROCESSOR
// ==============================
callProcessQueue.process(
    async (job: Job<{ call_id: string; type: string }>) => {
        try {
            const { call_id, type } = job.data;

            console.log(`📥 [CALL] Processing job: ${job.id}`);
            console.log(`➡️ call_id: ${call_id}, type: ${type}`);

            await handleCallUpdate(call_id);

            console.log(`✅ [CALL] Done: ${call_id}`);
        } catch (err) {
            console.error('❌ [CALL] Job failed:', err);
            throw err;
        }
    }
);

// ==============================
// ✅ TEST CALL PROCESSOR
// ==============================
testCallProcessQueue.process(
    async (job: Job<{ call_id: string; type: string }>) => {
        try {
            const { call_id, type } = job.data;

            console.log(`📥 [TEST CALL] Processing job: ${job.id}`);
            console.log(`➡️ call_id: ${call_id}, type: ${type}`);

            await handleTestCallUpdate(call_id);

            console.log(`✅ [TEST CALL] Done: ${call_id}`);
        } catch (err) {
            console.error('❌ [TEST CALL] Job failed:', err);
            throw err;
        }
    }
);

// ==============================
// ✅ GLOBAL EVENTS (DEBUG)
// ==============================
callProcessQueue.on('waiting', (jobId) => {
    console.log(`⏳ [CALL] Waiting: ${jobId}`);
});

callProcessQueue.on('active', (job) => {
    console.log(`⚡ [CALL] Active: ${job.id}`);
});

callProcessQueue.on('completed', (job) => {
    console.log(`🎉 [CALL] Completed: ${job.id}`);
});

callProcessQueue.on('failed', (job, err) => {
    console.error(`🔥 [CALL] Failed: ${job?.id}`, err);
});

// ==============================
// ✅ TEST QUEUE EVENTS
// ==============================
testCallProcessQueue.on('completed', (job) => {
    console.log(`🎉 [TEST CALL] Completed: ${job.id}`);
});

testCallProcessQueue.on('failed', (job, err) => {
    console.error(`🔥 [TEST CALL] Failed: ${job?.id}`, err);
});

console.log('👂 Worker listening for jobs...');