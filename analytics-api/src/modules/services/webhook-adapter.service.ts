// modules/services/webhook-adapter.service.ts
export class WebhookAdapter {

  /**
   * Converts VAPI webhook data to Retell format
   */
  public adaptVapiToRetell(vapiData: any): any {
    const message = vapiData.message || {};

    const call = message?.call;
    const assistant = message?.assistant || {};
    const phoneNumber = message?.phoneNumber || {};
    const customer = message?.customer || call?.customer || message?.call?.customer || {};


    const analysis = message.analysis || {};
    const messages = message.messages || [];
    const messagesOpenAIFormatted = message.messagesOpenAIFormatted || [];

    // IMPORTANT: For batch calls, VAPI sends variableValues in artifact

    const artifact = message.artifact || {};
    console.log('artifact?.variableValues:', artifact?.variableValues);
    console.log('customer?.assistantOverrides?.variableValues:', customer?.assistantOverrides?.variableValues);
    console.log('artifact?.variables:', artifact?.variables);
    const variableValues = artifact?.variableValues?.customer?.assistantOverrides?.variableValues || artifact?.variables?.customer?.assistantOverrides?.variableValues || customer?.assistantOverrides?.variableValues || {};
    console.log('VAPI variableValues:', variableValues);

    // Map VAPI disconnection reasons to Retell format
    const mapDisconnectionReason = (reason: string): string => {
      const reasonMap: Record<string, string> = {
        'customer-did-not-answer': 'dial_no_answer',
        'customer-busy': 'dial_busy',
        'customer-ended-call': 'user_ended_call',
        'assistant-ended-call': 'agent_ended_call',
        'user-ended-call': 'user_ended_call',
        'voicemail': 'voicemail_detected',
        'dial-failed': 'dial_failed',
        'dial-no-answer': 'dial_no_answer',
        'exceeded-max-duration': 'max_duration_exceeded',
        'silence-timed-out': 'silence_timeout',
        'twilio-failed-to-connect-call': 'twilio_error',
        'vonage-failed-to-connect-call': 'vonage_error',
        'phone-call-error': 'connection_error',
        'max-duration-reached': 'max_duration_exceeded',
        'not_connected': 'not_connected'
        // Add more mappings as needed
      };
      return reasonMap[reason] || reason || 'unknown';
    };

    // Map VAPI call status to Retell format
    const mapCallStatus = (vapiStatus: string, endedReason?: string): string => {
      if (vapiStatus === 'ended') {
        if (endedReason === 'customer-did-not-answer') return 'not_connected';
        if (endedReason === 'voicemail') return 'voicemail';
        if (endedReason === 'phone-call-error') return 'error';
        return 'ended';
      }

      const statusMap: Record<string, string> = {
        'queued': 'queued',
        'ringing': 'ringing',
        'in-progress': 'ongoing',
        'forwarding': 'forwarding',
        'failed': 'not_connected'
      };

      return statusMap[vapiStatus] || vapiStatus || 'unknown';
    };

    // Extract dynamic variables from VAPI data - UPDATED FOR BATCH CALLS
    const extractDynamicVariables = () => {
      // PRIORITY 1: Batch calls → artifact.variableValues
      if (Object.keys(variableValues || {}).length > 0) {
        return {
          client_id: variableValues.client_id || variableValues.clientId || '',
          salutation: variableValues.salutation || '',
          firstName: variableValues.firstName || variableValues.name?.split(' ')[0] || '',
          lastName: variableValues.lastName || variableValues.name?.split(' ').slice(1).join(' ') || '',
          userName: variableValues.userName || variableValues.clientName || '',
          clientName: variableValues.clientName || '',
          email: variableValues.email || '',
          number: variableValues.number || phoneNumber.number || '',
          country: variableValues.country || '',
          gender: variableValues.gender || '',
          batch_name: variableValues.batch_name || '',
          batchCallId: variableValues.batchCallId || '',
          followupBatchCallId: variableValues.followupBatchCallId || '',
          createdBy: variableValues.createdBy || '',
          sheet_id: variableValues.sheet_id || '',
          attemptLength: variableValues.attemptLength || '',
          maxAttempts: variableValues.maxAttempts || '',
          pendingCallsProcess: variableValues.pendingCallsProcess || '',
          recipientId: variableValues.recipientId || '',
        };
      }

      // PRIORITY 2: Check message.retell_llm_dynamic_variables
      if (message.retell_llm_dynamic_variables) {
        return message.retell_llm_dynamic_variables;
      }

      // PRIORITY 3: Extract from call.metadata, assistant.metadata, phoneNumber, or fallback
      const metadata = call.metadata || {};
      const assistantMetadata = assistant.metadata || {};
      const combined = { ...metadata, ...assistantMetadata };

      return {
        client_id: combined.client_id || combined.clientId || '',
        salutation: combined.salutation || '',
        firstName: combined.firstName || combined.name?.split(' ')[0] || '',
        lastName: combined.lastName || combined.name?.split(' ').slice(1).join(' ') || '',
        userName: combined.userName || combined.clientName || '',
        clientName: combined.clientName || assistant.name || '',
        email: combined.email || '',
        number: combined.number || phoneNumber.number || call.number || '',
        country: combined.country || '',
        gender: combined.gender || '',
        batch_name: combined.batch_name || combined.batchName || '',
        batchCallId: combined.batchCallId || '',
        followupBatchCallId: combined.followupBatchCallId || '',
        createdBy: combined.createdBy || '',
        sheet_id: combined.sheet_id || combined.sheetId || '',
        attemptLength: combined.attemptLength || '',
        maxAttempts: combined.maxAttempts || '',
        pendingCallsProcess: combined.pendingCallsProcess || '',
        recipientId: combined.recipientId || '',
      };
    };


    // Extract custom analysis data
    const extractCustomAnalysisData = () => {
      const structuredData = analysis.structuredData || {};

      // Handle both 'next_attempt ' (with space) and 'next_attempt'
      const nextAttempt = structuredData.next_attempt ||
        structuredData['next_attempt '] ||
        null;

      return {
        lead_status: structuredData.lead_status || 'Unclassified',
        next_attempt: nextAttempt,
        requested_meeting: structuredData.requested_meeting || null,
        data_information: structuredData.data_information || '',
        purpose: structuredData.purpose || '',
        size: structuredData.size || '',
        district: structuredData.district || '',
        timeline: structuredData.timeline || '',
        budget: structuredData.budget || '',
        proposal_channel: structuredData.proposal_channel || '',
        alternative_whatsapp_number: structuredData.alternative_whatsapp_number || '',
        call_back_allowed: structuredData.call_back_allowed || '',
        calendar_booking_failed: structuredData.calendar_booking_failed || '',
        // Map any additional fields from your VAPI analysisPlan schema
      };
    };

    // Calculate duration
    const calculateDuration = (): number => {
      // For end-of-call-report, check duration_ms directly
      if (message.duration_ms) {
        return message.duration_ms;
      }

      // Check if duration is provided in seconds
      if (call.duration) {
        return call.duration * 1000; // Convert to milliseconds
      }

      // Calculate from timestamps
      if (call.endedAt && call.startedAt) {
        return new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime();
      }

      // Calculate from start_timestamp and end_timestamp
      if (message.end_timestamp && message.start_timestamp) {
        return message.end_timestamp - message.start_timestamp;
      }

      // Check artifact for duration info
      if (artifact.messages?.length) {
        const lastMessage = artifact.messages[artifact.messages.length - 1];
        if (lastMessage?.secondsFromStart) {
          return lastMessage.secondsFromStart * 1000; // Convert to milliseconds
        }
      }

      return 0;
    };

    // Get transcript
    const getTranscript = (): string => {
      return message.transcript || artifact.transcript || call.transcript || '';
    };


    const formatTranscriptObject = () => {
      // Priority 1: Check artifact.messages (for end-of-call-report from VAPI)
      if (artifact.messages && Array.isArray(artifact.messages)) {
        return artifact.messages
          .filter((msg: any) => {
            // Only keep user and agent/assistant/bot messages
            const role = msg.role?.toLowerCase();
            return role === 'user' || role === 'agent' || role === 'assistant' || role === 'bot';
          })
          .map((msg: any) => {
            // Determine the role
            let role = msg.role;
            if (msg.role === 'bot' || msg.role === 'assistant') {
              role = 'agent';
            } else if (msg.role === 'user') {
              role = 'user';
            }

            // Build the transcript object entry
            const transcriptEntry: any = {
              role: role,
              content: msg.message || msg.content || '',
              words: []
            };

            // Add timestamp if available
            if (msg.time) {
              transcriptEntry.timestamp = msg.time;
            }

            // Add end_timestamp if available (from endTime)
            if (msg.endTime) {
              transcriptEntry.end_timestamp = msg.endTime;
            }

            // Handle word-level data from metadata
            if (msg.metadata?.wordLevelConfidence && Array.isArray(msg.metadata.wordLevelConfidence)) {
              transcriptEntry.words = msg.metadata.wordLevelConfidence.map((wordData: any) => ({
                word: wordData.word || '',
                start: wordData.start || 0,
                end: wordData.end || 0,
                confidence: wordData.confidence || 0
              }));
            }

            return transcriptEntry;
          });
      }

      // Priority 2: Check messages array
      if (messages.length > 0) {
        return messages
          .filter((msg: any) => {
            // Only keep user and agent/assistant/bot messages
            const role = msg.role?.toLowerCase();
            return role === 'user' || role === 'agent' || role === 'assistant' || role === 'bot';
          })
          .map((msg: any) => {
            let role = msg.role;
            if (msg.role === 'bot' || msg.role === 'assistant') {
              role = 'agent';
            } else if (msg.role === 'user') {
              role = 'user';
            }

            const transcriptEntry: any = {
              role: role,
              content: msg.message || msg.content || '',
              words: []
            };

            if (msg.time || msg.timestamp) {
              transcriptEntry.timestamp = msg.time || msg.timestamp;
            }

            if (msg.endTime) {
              transcriptEntry.end_timestamp = msg.endTime;
            }

            if (msg.metadata?.wordLevelConfidence) {
              transcriptEntry.words = msg.metadata.wordLevelConfidence.map((wordData: any) => ({
                word: wordData.word || '',
                start: wordData.start || 0,
                end: wordData.end || 0,
                confidence: wordData.confidence || 0
              }));
            }

            return transcriptEntry;
          });
      }

      // Priority 3: Parse from transcript string if available
      const transcript = getTranscript();
      if (transcript) {
        // Parse the transcript string format "User: ... \nAI: ..."
        const lines = transcript.split('\n').filter(line => line.trim());
        return lines.map((line, index) => {
          const colonIndex = line.indexOf(':');
          if (colonIndex === -1) return null;

          const speaker = line.substring(0, colonIndex).toLowerCase();
          const content = line.substring(colonIndex + 1).trim();

          let role = 'user';
          if (speaker === 'ai' || speaker === 'assistant' || speaker === 'bot') {
            role = 'agent';
          }

          return {
            role: role,
            content: content,
            words: [] // No word-level data available from plain transcript
          };
        }).filter(Boolean);
      }

      return [];
    }
    // Get transcript with tool calls
    const getTranscriptWithToolCalls = () => {
      // For end-of-call-report
      if (message.transcript_with_tool_calls) {
        return message.transcript_with_tool_calls;
      }

      // From messagesOpenAIFormatted
      if (messagesOpenAIFormatted.length > 0) {
        return messagesOpenAIFormatted;
      }

      // From artifact
      if (artifact.messagesOpenAIFormatted) {
        return artifact.messagesOpenAIFormatted;
      }

      return [];
    };

    // Format cost breakdown
    const formatProductCosts = () => {
      // For end-of-call-report format
      if (message.call_cost?.product_costs) {
        return message.call_cost.product_costs;
      }

      // From call.costBreakdown
      if (call.costBreakdown && typeof call.costBreakdown === 'object') {
        return Object.entries(call.costBreakdown).map(([product, details]: [string, any]) => ({
          product: product,
          cost: details.cost || 0,
          unit_price: details.unitPrice || 0
        }));
      }

      // From message.costs array
      if (message.costs && Array.isArray(message.costs)) {
        return message.costs.map((c: any) => ({
          product: c.type || c.product,
          cost: c.cost || 0,
          unit_price: c.unitPrice || (c.cost / (c.minutes || c.characters || 1))
        }));
      }

      return [];
    };

    // Get timestamps
    const getStartTimestamp = (): number | null => {
      if (message.start_timestamp) return message.start_timestamp;
      if (call.startedAt) return new Date(call.startedAt).getTime();
      if (call.createdAt) return new Date(call.createdAt).getTime();
      return null;
    };

    const getEndTimestamp = (): number | null => {
      if (message.end_timestamp) return message.end_timestamp;
      if (call.endedAt) return new Date(call.endedAt).getTime();
      return null;
    };

    // Build Retell-compatible structure
    const retellFormat = {
      event: 'call_analyzed',
      call: {
        // Core identifiers
        call_id: call.id || message.call_id || '',
        call_type: call.type === 'webCall' || call.type === 'web_call' ? 'web_call' :
          call.type === 'outboundPhoneCall' ? 'phone_call' :
            message.call_type || 'phone_call',
        agent_id: assistant.id || call.assistantId || message.agent_id || '',
        agent_version: message.agent_version || 1, // VAPI doesn't have versions
        agent_name: assistant.name || '',

        // Dynamic variables - UPDATED TO USE EXTRACTED VARIABLES
        retell_llm_dynamic_variables: extractDynamicVariables(),

        // Call status
        call_status: mapCallStatus(call.status, message.endedReason || message.disconnection_reason),

        // Timestamps
        start_timestamp: getStartTimestamp(),
        end_timestamp: getEndTimestamp(),

        // Duration
        duration_ms: calculateDuration(),

        // Transcript
        transcript: getTranscript(),
        transcript_object: formatTranscriptObject(),
        transcript_with_tool_calls: getTranscriptWithToolCalls(),

        // URLs - Check artifact for recording URLs
        recording_url: message.recording_url ||
          message.recordingUrl ||
          artifact.recordingUrl ||
          call.recordingUrl || '',
        public_log_url: message.public_log_url ||
          message.publicLogUrl ||
          artifact.publicLogUrl ||
          artifact.logUrl || '',

        // Disconnection
        disconnection_reason: mapDisconnectionReason(
          message.disconnection_reason || message.endedReason || call.endedReason || ''
        ),

        // Call analysis
        call_analysis: message.call_analysis || {
          call_summary: analysis.summary || call.summary || '',
          in_voicemail: message.endedReason === 'voicemail' || analysis.inVoicemail || false,
          user_sentiment: analysis.sentiment || 'Unknown',
          call_successful: analysis.successEvaluation === true || analysis.successEvaluation === 'true',
          custom_analysis_data: extractCustomAnalysisData()
        },

        // Cost
        call_cost: message.call_cost || {
          combined_cost: call.cost || message.cost || 0,
          total_duration_seconds: calculateDuration() / 1000,
          product_costs: formatProductCosts(),
          total_duration_unit_price: 0
        },

        // Phone details
        from_number: phoneNumber.number || message.from_number || '',
        to_number: customer.number || message.to_number || '',
        direction: call.type === 'outboundPhoneCall' ? 'outbound' :
          message.direction || 'inbound',

        // Batch call ID if present
        batch_call_id: message.batch_call_id || call.metadata?.batchCallId || call.batchCallId || null,

        // Telephony
        telephony_identifier: message.telephony_identifier || {
          twilio_call_sid: call.phoneCallProviderId ||
            call.transport?.callSid ||
            call.twilioCallSid || ''
        },

        // Additional flags
        opt_out_sensitive_data_storage: message.opt_out_sensitive_data_storage || false,
        opt_in_signed_url: message.opt_in_signed_url || false
      }
    };

    return retellFormat;
  }
}

export const webhookAdapter = new WebhookAdapter();