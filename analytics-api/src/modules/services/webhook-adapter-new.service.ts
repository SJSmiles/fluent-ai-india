/**
 * webhook-adapter.service.ts
 *
 * Transforms VAPI `end-of-call-report` payloads into the standardised
 * Retell-compatible format expected by webhookService.saveCallLog().
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Known VAPI payload structures                                      │
 * │                                                                     │
 * │  Structure A (e.g. Anuj Yadav):                                     │
 * │    message.variableValues                                           │
 * │      .customer.assistantOverrides.variableValues  ← lead data       │
 * │    message.artifact.variableValues                                  │
 * │      .customer.assistantOverrides.variableValues  ← lead data       │
 * │                                                                     │
 * │  Structure B (e.g. Sanjay Yadav):                                   │
 * │    message.artifact.variables                                       │
 * │      .customer.assistantOverrides.variableValues  ← lead data       │
 * │                                                                     │
 * │  TRAP: Both structures also have a top-level                        │
 * │    artifact.variableValues = { now, currentDateTime, date, … }      │
 * │  We guard against this by checking for lead-data fields rather      │
 * │  than just Object.keys().length > 0.                                │
 * │                                                                     │
 * │  structuredOutputs (VAPI):                                          │
 * │    artifact.structuredOutputs = {                                   │
 * │      "<uuid>": { name: "lead_status", result: "Interested - Task" } │
 * │      ...                                                            │
 * │    }                                                                │
 * │  Indexed by name → mapped to custom_analysis_data fields.           │
 * └─────────────────────────────────────────────────────────────────────┘
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RetellCallPayload {
    event: 'call_analyzed';
    call: RetellCall;
}

export interface RetellCall {
    // Identifiers
    call_id: string | undefined;
    call_type: string;
    agent_id: string | undefined;
    agent_version: number;
    agent_name: string | undefined;

    // Lead / dynamic variables
    retell_llm_dynamic_variables: Record<string, any> | undefined;

    // Status
    call_status: string;

    // Timestamps (epoch ms)
    start_timestamp: number | undefined;
    end_timestamp: number | undefined;
    duration_ms: number | undefined;

    // Transcript
    transcript: string;
    transcript_object: TranscriptEntry[];
    transcript_with_tool_calls: TranscriptWithToolCallEntry[];

    // Recordings / logs
    recording_url: string | undefined;
    public_log_url: string | undefined;

    // Disconnection
    disconnection_reason: string | undefined;

    // Analysis
    call_analysis: CallAnalysis;

    // Cost
    call_cost: CallCost;

    // Phone
    from_number: string | undefined;
    to_number: string | undefined;
    direction: string | undefined;

    // Batch / telephony
    batch_call_id: string | undefined;
    telephony_identifier: string | undefined;

    // Privacy
    opt_out_sensitive_data_storage: boolean;
    opt_in_signed_url: boolean;
}

interface TranscriptEntry {
    role: string;
    content: string;
    words: WordEntry[];
    timestamp?: number;
    end_timestamp?: number;
}

interface WordEntry {
    word: string;
    start: number;
    end: number;
    confidence: number;
}

interface TranscriptWithToolCallEntry {
    role: string;
    content: string;
    tool_calls?: any[];
    tool_call_result?: any;
}

interface CallAnalysis {
    call_successful: boolean | undefined;
    call_summary: string | undefined;
    user_sentiment: string | undefined;
    in_voicemail: boolean | undefined;
    custom_analysis_data: CustomAnalysisData;
}

interface CustomAnalysisData {
    lead_status: string;
    next_attempt: string | null;
    requested_meeting: string | null;
    data_information: string;
    purpose: string;
    size: string;
    district: string;
    timeline: string;
    budget: string;
    proposal_channel: string;
    alternative_whatsapp_number: string;
    call_back_allowed: string;
    calendar_booking_failed: string;
    [key: string]: any; // allow extra fields from structuredOutputs
}

interface CallCost {
    total_cost: number;
    llm_cost: number | undefined;
    stt_cost: number | undefined;
    tts_cost: number | undefined;
    telephony_cost: number | undefined;
    product_cost: number | undefined;
}

// ── Lead-data sentinel fields ──────────────────────────────────────────────────
// Any of these present → the candidate is real lead data, NOT a metadata blob.
const LEAD_DATA_FIELDS = [
    'firstName',
    'lastName',
    'email',
    'recipientId',
    'client_id',
    'number',
    'salutation',
    'gender',
    'batch_name',
    'batchCallId',
    'createdBy',
] as const;

// ── structuredOutputs field mapping ───────────────────────────────────────────
// Maps VAPI structuredOutput names → custom_analysis_data keys.
// Add entries here when new structured outputs are introduced.
const STRUCTURED_OUTPUT_MAP: Record<string, keyof CustomAnalysisData> = {
    lead_status: 'lead_status',
    requested_meeting: 'requested_meeting',
    data_information: 'data_information',
    preferred_communication: 'proposal_channel',   // VAPI name → Retell key
    zone: 'district',            // VAPI name → Retell key
    timeline: 'timeline',
    budget: 'budget',
    size: 'size',
    alternative_whatsapp_number: 'alternative_whatsapp_number',
    call_back_allowed: 'call_back_allowed',
    calendar_booking_failed: 'calendar_booking_failed',
    next_attempt: 'next_attempt',
};

// ── WebhookAdapter ─────────────────────────────────────────────────────────────

export class WebhookAdapter {

    // ── Public API ───────────────────────────────────────────────────────────────

    /**
     * Transforms a raw VAPI webhook body into the Retell-shaped object
     * expected by webhookService.saveCallLog().
     *
     * @param vapiData - Full request.body received from VAPI
     * @returns RetellCallPayload
     */
    adaptVapiToRetell(vapiData: any): RetellCallPayload {
        const message = vapiData?.message ?? {};
        const call = message?.call ?? {};
        const artifact = message?.artifact ?? {};
        const customer = call?.customer ?? message?.customer ?? {};
        const analysis = message?.analysis ?? {};
        const costs = message?.costs ?? [];

        // ── 1. Variable values (lead data) ────────────────────────────────────────
        const variableValues = this.extractVariableValues({ artifact, message, call, customer });
        const retellLlmDynamicVariables = Object.keys(variableValues).length > 0
            ? { ...variableValues }
            : undefined;

        // ── 2. Timestamps & duration ──────────────────────────────────────────────
        // NOTE: In VAPI end-of-call-report, startedAt / endedAt live on
        //       message (not message.call) — fall back to call if absent.
        const startedAt = message?.startedAt ?? call?.startedAt;
        const endedAt = message?.endedAt ?? call?.endedAt;
        const startTs = startedAt ? new Date(startedAt).getTime() : undefined;
        const endTs = endedAt ? new Date(endedAt).getTime() : undefined;
        const durationMs = message?.durationMs
            ?? ((startTs != null && endTs != null) ? endTs - startTs : undefined);

        // ── 3. Cost ───────────────────────────────────────────────────────────────
        const callCost = this.buildCallCost(costs, message);

        // ── 4. Transcript ─────────────────────────────────────────────────────────
        const rawMessages = artifact?.messages ?? [];
        const transcriptObject = this.buildTranscriptObject(rawMessages);
        const transcriptWithToolCalls = this.buildTranscriptWithToolCalls(rawMessages);

        // ── 5. Identifiers ────────────────────────────────────────────────────────
        const agentId = call?.assistantId ?? message?.assistant?.id ?? undefined;
        const agentName = call?.name ?? message?.assistant?.name ?? undefined;

        // Prefer batchCallId from variableValues (set by the batch system);
        // fall back to VAPI's own squadId if present.
        const batchCallId = variableValues?.batchCallId ?? call?.squadId ?? undefined;
        const telephonyIdentifier = call?.phoneCallProviderId ?? undefined;

        // ── 6. Recording URL ──────────────────────────────────────────────────────
        // Priority: mono combined → top-level recordingUrl → stereo
        const recordingUrl =
            artifact?.recording?.mono?.combinedUrl ??
            artifact?.recordingUrl ??
            message?.recordingUrl ??
            artifact?.stereoRecordingUrl ??
            undefined;

        // ── 7. structuredOutputs → custom_analysis_data ───────────────────────────
        const customAnalysisData = this.buildCustomAnalysisData(
            artifact?.structuredOutputs,
        );

        // ── 8. Assemble ───────────────────────────────────────────────────────────
        return {
            event: 'call_analyzed',
            call: {
                call_id: call?.id,
                call_type: call?.type ?? 'webCall',
                agent_id: agentId,
                agent_version: 1,
                agent_name: agentName,

                retell_llm_dynamic_variables: retellLlmDynamicVariables,

                call_status: this.mapCallStatus(call?.status, message?.endedReason),

                start_timestamp: startTs,
                end_timestamp: endTs,
                duration_ms: durationMs,

                transcript: artifact?.transcript ?? '',
                transcript_object: transcriptObject,
                transcript_with_tool_calls: transcriptWithToolCalls,

                recording_url: recordingUrl,
                public_log_url: artifact?.logUrl ?? artifact?.publicLogsUrl ?? undefined,

                disconnection_reason: this.mapDisconnectionReason(message?.endedReason),

                call_analysis: {
                    ...this.buildCallAnalysis(analysis),
                    custom_analysis_data: customAnalysisData,
                },

                call_cost: callCost,

                // from = the platform number that dialled; to = the customer
                from_number: message?.phoneNumber?.number ?? call?.phoneNumber?.number ?? undefined,
                to_number: customer?.number ?? undefined,
                direction: call?.type === 'outboundPhoneCall' ? 'outbound'
                    : call?.type === 'inboundPhoneCall' ? 'inbound'
                        : call?.direction ?? undefined,

                batch_call_id: batchCallId,
                telephony_identifier: telephonyIdentifier,

                opt_out_sensitive_data_storage: false,
                opt_in_signed_url: false,
            },
        };
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    /**
     * Searches all known paths for a variableValues object that contains
     * actual lead data.  Validates by content, not just key count, to avoid
     * false positives from metadata-only objects.
     *
     * Priority (most specific / reliable first):
     *   1. message.variableValues.customer.assistantOverrides.variableValues
     *   2. artifact.variableValues.customer.assistantOverrides.variableValues
     *   3. artifact.variables.customer.assistantOverrides.variableValues
     *   4–7. Additional fallback locations
     */
    private extractVariableValues(ctx: {
        artifact: any;
        message: any;
        call: any;
        customer: any;
    }): Record<string, any> {
        const { artifact, message, call, customer } = ctx;

        const candidates: any[] = [
            // ── Structure A – message.variableValues path (Anuj-type) ────────────
            message?.variableValues?.customer?.assistantOverrides?.variableValues,
            // ── Structure A – artifact.variableValues path ────────────────────────
            artifact?.variableValues?.customer?.assistantOverrides?.variableValues,
            // ── Structure B – artifact.variables path (Sanjay-type) ──────────────
            artifact?.variables?.customer?.assistantOverrides?.variableValues,
            // ── Fallback paths ────────────────────────────────────────────────────
            message?.call?.assistantOverrides?.variableValues,
            call?.assistantOverrides?.variableValues,
            customer?.assistantOverrides?.variableValues,
            message?.assistant?.variableValues,
        ];

        for (const candidate of candidates) {
            if (this.isLeadData(candidate)) {
                return candidate as Record<string, any>;
            }
        }

        return {};
    }

    /**
     * Returns true only when the object contains at least one recognised
     * lead-data field (prevents metadata-only objects from being returned).
     */
    private isLeadData(obj: any): boolean {
        if (!obj || typeof obj !== 'object') return false;
        return LEAD_DATA_FIELDS.some((field) => {
            const val = (obj as any)[field];
            return val != null && val !== '';
        });
    }

    /**
     * Converts VAPI structuredOutputs (UUID-keyed) into a flat name → result map,
     * then builds the CustomAnalysisData object using STRUCTURED_OUTPUT_MAP.
     *
     * Any structuredOutput names not listed in STRUCTURED_OUTPUT_MAP are still
     * included verbatim as extra keys (future-proofing).
     */
    private buildCustomAnalysisData(
        structuredOutputs: Record<string, { name: string; result: any }> | undefined,
    ): CustomAnalysisData {
        // Defaults — every known field starts empty / null
        const data: CustomAnalysisData = {
            lead_status: 'Unclassified',
            next_attempt: null,
            requested_meeting: null,
            data_information: '',
            purpose: '',
            size: '',
            district: '',
            timeline: '',
            budget: '',
            proposal_channel: '',
            alternative_whatsapp_number: '',
            call_back_allowed: '',
            calendar_booking_failed: '',
        };

        if (!structuredOutputs || typeof structuredOutputs !== 'object') {
            return data;
        }

        // Index by name for O(1) lookups
        const byName: Record<string, any> = {};
        for (const entry of Object.values(structuredOutputs)) {
            if (entry?.name != null) {
                byName[entry.name] = entry.result ?? '';
            }
        }

        // Apply mapped fields
        for (const [vapiName, retellKey] of Object.entries(STRUCTURED_OUTPUT_MAP)) {
            if (vapiName in byName) {
                const value = byName[vapiName];
                // For nullable fields keep null when empty, others keep ''
                const isNullable = retellKey === 'next_attempt' || retellKey === 'requested_meeting';
                data[retellKey] = (value === '' || value == null)
                    ? (isNullable ? null : '')
                    : value;
            }
        }

        // Pass-through any unmapped structured outputs as extra keys
        const mappedVapiNames = new Set(Object.keys(STRUCTURED_OUTPUT_MAP));
        for (const [name, value] of Object.entries(byName)) {
            if (!mappedVapiNames.has(name)) {
                data[name] = value;
            }
        }

        return data;
    }

    /**
     * Maps VAPI call status + endedReason → Retell-compatible status string.
     */
    private mapCallStatus(
        status: string | undefined,
        endedReason: string | undefined,
    ): string {
        if (!status || status === 'ended') {
            switch (endedReason) {
                case 'assistant-ended-call':
                case 'customer-ended-call':
                case 'silence-timed-out':
                case 'max-duration-exceeded': return 'ended';
                case 'voicemail': return 'voicemail';
                case 'assistant-error':
                case 'pipeline-error': return 'error';
                default: return 'ended';
            }
        }
        return status;
    }

    /**
     * Maps VAPI endedReason → Retell disconnection_reason string.
     */
    private mapDisconnectionReason(endedReason: string | undefined): string | undefined {
        if (!endedReason) return undefined;
        const map: Record<string, string> = {
            'assistant-ended-call': 'agent_ended_call',
            'customer-ended-call': 'user_ended_call',
            'customer-did-not-answer': 'no_answer',
            'voicemail': 'voicemail',
            'max-duration-exceeded': 'max_duration_exceeded',
            'silence-timed-out': 'silence_timeout',
            'pipeline-error': 'error',
            'assistant-error': 'error',
            'customer-busy': 'dial_busy',
            'user-ended-call': 'user_ended_call',
            'dial-failed': 'dial_failed',
            'dial-no-answer': 'dial_no_answer',
            'exceeded-max-duration': 'max_duration_exceeded',
            'twilio-failed-to-connect-call': 'twilio_error',
            'vonage-failed-to-connect-call': 'vonage_error',
            'phone-call-error': 'connection_error',
            'max-duration-reached': 'max_duration_exceeded',
            'not_connected': 'not_connected'
        };
        return map[endedReason] ?? endedReason;
    }


    /**
     * Converts VAPI messages array → Retell transcript_object format.
     *
     * Word-level confidence lives inside metadata.wordLevelConfidence in VAPI
     * (not directly on m.words).  We normalise to the Retell words shape.
     */
    private buildTranscriptObject(messages: any[]): TranscriptEntry[] {
        return messages
            .filter((m: any) => (m?.role === 'user' || m?.role === 'bot') && (m?.message ?? m?.content))
            .map((m: any) => {
                const rawWords: WordEntry[] = this.extractWords(m);
                return {
                    role: m.role === 'bot' ? 'agent' : 'user',
                    content: m.message ?? m.content ?? '',
                    words: rawWords,
                    timestamp: m.time ?? undefined,
                    end_timestamp: m.endTime ?? undefined,
                };
            });
    }

    /**
     * Extracts word-level data from a message entry.
     *
     * VAPI puts word confidence inside:
     *   m.metadata.wordLevelConfidence[]  → { word, start, end, confidence }
     *
     * Falls back to m.words[] if present (some VAPI variants / Retell native).
     */
    private extractWords(m: any): WordEntry[] {
        // VAPI path
        const wlc = m?.metadata?.wordLevelConfidence;
        if (Array.isArray(wlc) && wlc.length > 0) {
            return wlc.map((w: any) => ({
                word: w.word ?? '',
                start: w.start ?? 0,
                end: w.end ?? 0,
                confidence: w.confidence ?? 0,
            }));
        }
        // Retell native / fallback
        if (Array.isArray(m?.words) && m.words.length > 0) {
            return m.words.map((w: any) => ({
                word: w.word ?? '',
                start: w.start ?? 0,
                end: w.end ?? 0,
                confidence: w.confidence ?? 1,
            }));
        }
        return [];
    }

    /**
     * Converts VAPI messages array → Retell transcript_with_tool_calls format.
     * Includes all entries (tool-call / tool-result types included).
     * Uses the OpenAI-formatted messages when available.
     */
    private buildTranscriptWithToolCalls(messages: any[]): TranscriptWithToolCallEntry[] {
        return messages
            .filter((m: any) => m?.role)
            .map((m: any) => {
                const entry: TranscriptWithToolCallEntry = {
                    role: m.role === 'bot' ? 'agent' : m.role,
                    content: m.message ?? m.content ?? '',
                };
                if (Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
                    entry.tool_calls = m.toolCalls;
                }
                if (m.toolCallResult !== undefined) {
                    entry.tool_call_result = m.toolCallResult;
                }
                return entry;
            });
    }

    /**
     * Builds call_analysis from VAPI's analysis block.
     * Handles both boolean and string representations of successEvaluation.
     * NOTE: custom_analysis_data is injected by the caller (adaptVapiToRetell).
     */
    private buildCallAnalysis(analysis: any): Omit<CallAnalysis, 'custom_analysis_data'> {
        const successRaw = analysis?.successEvaluation;
        let call_successful: boolean | undefined;

        if (successRaw === true || successRaw === 'true') call_successful = true;
        if (successRaw === false || successRaw === 'false') call_successful = false;

        return {
            call_successful,
            call_summary: analysis?.summary ?? undefined,
            user_sentiment: analysis?.sentiment ?? undefined,
            in_voicemail: undefined,
        };
    }

    /**
     * Builds call_cost from VAPI costs array + top-level cost field.
     *
     * VAPI cost types:
     *   llm | transcriber (= stt) | voice (= tts) | transport (= telephony)
     *   | vapi (= platform fee) | voicemail-detection | analysis | knowledge-base
     *
     * Multiple entries of the same type are summed (e.g. multi-turn LLM calls).
     */
    private buildCallCost(costs: any[], message: any): CallCost {
        const totalCost = typeof message?.cost === 'number' ? message.cost : 0;

        const breakdown: Record<string, number> = {};
        for (const c of costs) {
            if (c?.type && typeof c?.cost === 'number') {
                breakdown[c.type] = (breakdown[c.type] ?? 0) + c.cost;
            }
        }

        return {
            total_cost: totalCost,
            llm_cost: breakdown['llm'] ?? undefined,
            stt_cost: breakdown['transcriber'] ?? undefined,   // VAPI uses "transcriber"
            tts_cost: breakdown['voice'] ?? undefined,   // VAPI uses "voice"
            telephony_cost: breakdown['transport'] ?? undefined,
            product_cost: breakdown['vapi'] ?? undefined,
        };
    }
}

// Singleton export – import this everywhere instead of new WebhookAdapter()
export const webhookAdapterNew = new WebhookAdapter();