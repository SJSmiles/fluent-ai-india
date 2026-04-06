import { CallLog } from '../models/callLog.model';
import { rebuildQueue } from '../event-queue/queue';
export class WebhookService {
    public async processWebhookEvent(eventData: any, headers: any, logType: string): Promise<void> {
        try {
            const callLog = await CallLog.create({
                raw_data: eventData,
                headers: headers,
                received_at: new Date()
            });

            console.log(`CallLog saved with ID: ${callLog._id}`);
            await rebuildQueue.add(
                { call_id: eventData.call.call_id },
                { jobId: eventData.call.call_id + '_' + logType, removeOnComplete: true }
            );
            console.log('Enqueued rebuild job for', eventData.call.call_id + '_' + logType);

        } catch (error) {
            console.error('Error processing webhook event:', error);
            throw error;
        }
    }
}