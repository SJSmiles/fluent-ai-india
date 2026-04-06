
import { CALL_DIRECTION, CALL_STATUS } from '../../config/server-config';
import { Call } from '../models/call.model';
import { CallLog } from '../models/callLog.model';
import { webhookAdapter } from './webhook-adapter.service';
export class WebhookService {

    public async saveCallLog(rawData: any, headers?: any): Promise<any> {
        try {
            return await CallLog.create({
                raw_data: rawData,
                headers: headers || {},
                received_at: new Date(),
            });
        } catch (err) {
            console.error('Error saving call log', err);
        }
    }

    public async handleWebhook(data: any, callLogId: any, source: 'retell' | 'vapi' = 'retell'): Promise<any> {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

        // Adapt data to Retell format if coming from VAPI
        const adaptedData = webhookAdapter.adaptVapiToRetell(parsedData);

        await this.saveCallFromWebhook(adaptedData, callLogId);
        return { success: true };
    }

    private async saveCallFromWebhook(webhookData: any, callLogId: any): Promise<void> {
        const call = webhookData.call || {};
        const callId = call.call_id || webhookData.call_id || webhookData.id;
        if (!callId) {
            console.warn('No call_id found in webhook data');
            return;
        }

        const eventType = webhookData.event || webhookData.event_type;
        let status = 0;

        if (eventType === 'call_started') status = CALL_STATUS.ONGOING;
        else if (['call_ended', 'call_analyzed'].includes(eventType)) status = CALL_STATUS.ENDED;
        else if (
            eventType?.toLowerCase().includes('fail') ||
            eventType?.toLowerCase().includes('error')
        )
            status = CALL_STATUS.FAILED;

        const dynamicVars = call.retell_llm_dynamic_variables || {};
        const clientName =
            dynamicVars?.clientName ||
            `${dynamicVars.firstName || ''} ${dynamicVars.lastName || ''} ${dynamicVars.userName || ''}`.trim();
        const callData: any = {
            callId: callId,
            clientName: clientName,
            status,
            recordingUrl: call.recording_url,
            duration: call.duration_ms,
            disconnectionReason: call.disconnection_reason,
            direction: call.direction === 'outbound' ? CALL_DIRECTION.OUTBOUND : CALL_DIRECTION.INBOUND,
            fromNumber: call.from_number,
            toNumber: call.to_number,
            agentId: call.agent_id,
        };

        let existingCall: any = await Call.findOne({ callId: callId });
    }
}

const webhookService = new WebhookService();
export { webhookService };