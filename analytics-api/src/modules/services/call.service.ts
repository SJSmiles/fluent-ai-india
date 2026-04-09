import { callQueue } from '../queue/queue';

export async function pushCallToQueue(data: any) {
    await callQueue.add('end-call', data);
}