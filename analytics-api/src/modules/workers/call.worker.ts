import { callQueue } from '../queue/queue';
import { Call } from '../models/call.model';
import { redis } from '../store/redis';

callQueue.process('end-call', async (job) => {
  const data = job.data;

  const transcript = await redis.get(`transcript:${data.callSid}`);

  await Call.create({
    ...data,
    transcript: transcript ? JSON.parse(transcript) : [],
  });

  await redis.del(`call:${data.callSid}`);
  await redis.del(`transcript:${data.callSid}`);

  console.log('✅ Call saved');
});