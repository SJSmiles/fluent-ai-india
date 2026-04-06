import axios, { AxiosInstance } from 'axios';
import { Environment } from '../../../config/environment';
import { IVoiceService } from './voice-service.interface';

export class RetellService implements IVoiceService {
  private retellApiClient: AxiosInstance;

  constructor() {
    this.retellApiClient = axios.create({
      baseURL: Environment.retell.baseUrl,
      headers: {
        Authorization: `Bearer ${Environment.retell.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  // ==================== CALL MANAGEMENT ====================

  public async callList(filters?: any): Promise<any> {
    try {
      const response = await this.retellApiClient.post('/list-calls', filters);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch call history: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async createRetellCall(user: any, callPayload: any): Promise<any> {
    try {
      const dynamicVariables = callPayload?.retell_llm_dynamic_variables;
      const processedVariables: any = {};

      // Process dynamic variables
      for (const key in dynamicVariables) {
        if (dynamicVariables[key] !== undefined && dynamicVariables[key] !== null) {
          processedVariables[key] = dynamicVariables[key];
        }
      }

      const requestData: any = {
        from_number: callPayload.fromNumber,
        to_number: callPayload.toNumber,
        agent_id: callPayload.agentId,
        retell_llm_dynamic_variables: processedVariables
      };

      const response = await this.retellApiClient.post('/create-phone-call', requestData, {
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        message: 'Phone call initiated successfully',
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to initiate call: ${error?.response?.data?.message || error.message}`,
        data: null
      };
    }
  }

  // ==================== LLM MANAGEMENT ====================

  public async createLanguageModel(agentPrompt: string): Promise<string> {
    try {
      const llmConfiguration = {
        model: 'gpt-4o',
        version: 0,
        is_published: false,
        model_temperature: 0.1,
        general_prompt: agentPrompt,
        starting_state: 'information_collection',
        begin_message: "Hey! I'm calling from Retell Hospital to help you book your appointment.",
        states: [
          {
            name: 'information_collection',
            state_prompt: 'Collect user information about symptoms and timing for check-up.',
            edges: [
              {
                destination_state_name: 'appointment_booking',
                description: 'User wants to book an appointment.'
              }
            ],
            tools: [
              {
                type: 'transfer_call',
                name: 'transfer_to_support',
                description: 'Transfer the call to hospital support team.',
                transfer_destination: {
                  type: 'predefined',
                  number: '16175551212'
                },
                transfer_option: {
                  type: 'cold_transfer',
                  show_transferee_as_caller: false
                }
              }
            ]
          },
          {
            name: 'appointment_booking',
            state_prompt:
              "Book an appointment for health check-up. Collect preferred dates and times, then inform the user that the appointment will be scheduled and they'll receive a confirmation."
          }
        ]
      };

      const response = await this.retellApiClient.post('/create-retell-llm', llmConfiguration);
      return response.data.llm_id;
    } catch (error: any) {
      throw new Error(
        `Failed to create language model: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async updateLanguageModelPrompt(llmId: string, agentPrompt: string): Promise<void> {
    try {
      const updatePayload = {
        general_prompt: agentPrompt,
        model_temperature: 0.1
      };

      await this.retellApiClient.patch(`/update-retell-llm/${llmId}`, updatePayload);
    } catch (error: any) {
      throw new Error(
        `Failed to update language model: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  // ==================== AGENT MANAGEMENT ====================

  public async createRetellAgent(agentConfiguration: any): Promise<any> {
    try {
      const response = await this.retellApiClient.post('/create-agent', agentConfiguration);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to create Retell agent: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async updateRetellAgent(retellAgentId: string, updateData: any): Promise<any> {
    try {
      const response = await this.retellApiClient.patch(
        `/update-agent/${retellAgentId}`,
        updateData
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to update Retell agent: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async deleteRetellAgent(retellAgentId: string): Promise<any> {
    try {
      const response = await this.retellApiClient.delete(`/delete-agent/${retellAgentId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to delete Retell agent: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async getAllRetellAgents(): Promise<any> {
    try {
      const response = await this.retellApiClient.get('/list-agents');
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch agents list: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async getRetellAgentById(retellAgent: any): Promise<any> {
    try {
      const response = await this.retellApiClient.get(
        `/get-agent/${retellAgent.agent_id}?version=${retellAgent.version}`
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch agent details: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async getRetellAgentPromptById(retellAgent: any): Promise<any> {
    try {
      const response = await this.retellApiClient.get(`/get-retell-llm/${retellAgent.llm_id}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch agent details: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  // ==================== PHONE NUMBER MANAGEMENT ====================

  public async getAllPhoneNumbers(): Promise<any> {
    try {
      const response = await this.retellApiClient.get('/list-phone-numbers');
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch phone numbers: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async getPhoneNumberDetails(phoneNumber: string): Promise<any> {
    try {
      const response = await this.retellApiClient.get(`/get-phone-number/${phoneNumber}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch phone number details: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async updatePhoneNumberConfiguration(
    phoneNumber: string,
    configuration: any
  ): Promise<any> {
    try {
      const response = await this.retellApiClient.patch(
        `/update-phone-number/${phoneNumber}`,
        configuration
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to update phone number configuration: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  // ==================== PHONE NUMBER VALIDATION & BINDING ====================

  public async validatePhoneNumberAvailability(
    phoneNumber: string,
    excludeAgentId?: string
  ): Promise<{ exists: boolean; available: boolean; boundToAgent?: string; agentName?: string }> {
    try {
      const phoneDetails = await this.getPhoneNumberDetails(phoneNumber);
      const boundAgentId = phoneDetails.inbound_agent_id || phoneDetails.outbound_agent_id;

      const validationResult = {
        exists: true,
        available: !boundAgentId,
        boundToAgent: boundAgentId || undefined,
        agentName: undefined as string | undefined
      };

      // Fetch agent details if phone is bound to an agent
      if (boundAgentId) {
        try {
          const agentDetails = await this.getRetellAgentById(boundAgentId);
          validationResult.agentName = agentDetails.agent_name;
        } catch (agentError) { }
      }

      // Check if phone is bound to the same agent being updated
      if (excludeAgentId && boundAgentId === excludeAgentId) {
        validationResult.available = true;
      }

      return validationResult;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { exists: false, available: false };
      }
      throw new Error(
        `Phone validation failed: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async bindPhoneNumberToAgent(
    phoneNumber: string,
    retellAgentId: string,
    callDirection: string = 'inbound'
  ): Promise<void> {
    try {
      const bindingConfiguration: any = {};

      if (callDirection === 'inbound') {
        bindingConfiguration.inbound_agent_id = retellAgentId;
      } else if (callDirection === 'outbound') {
        bindingConfiguration.outbound_agent_id = retellAgentId;
      } else {
        bindingConfiguration.inbound_agent_id = retellAgentId; // Default to inbound
      }

      await this.updatePhoneNumberConfiguration(phoneNumber, bindingConfiguration);
    } catch (error: any) {
      throw new Error(
        `Failed to bind phone number to agent: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async unbindPhoneNumberFromAgent(
    phoneNumber: string,
    callDirection: string = 'inbound'
  ): Promise<void> {
    try {
      const unbindConfiguration: any = {};

      if (callDirection === 'inbound') {
        unbindConfiguration.inbound_agent_id = null;
      } else if (callDirection === 'outbound') {
        unbindConfiguration.outbound_agent_id = null;
      } else {
        unbindConfiguration.inbound_agent_id = null; // Default to inbound
      }

      await this.updatePhoneNumberConfiguration(phoneNumber, unbindConfiguration);
    } catch (error: any) {
      throw new Error(
        `Failed to unbind phone number: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  public async changeAgentPhoneNumber(
    retellAgentId: string,
    newPhoneNumber: string,
    currentPhoneNumber: string | null,
    callDirection: string = 'inbound'
  ): Promise<void> {
    try {
      // Validate new phone number availability (excluding current agent)
      const phoneValidation = await this.validatePhoneNumberAvailability(
        newPhoneNumber,
        retellAgentId
      );

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${newPhoneNumber} does not exist in Retell`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.agentName
          ? `Phone number ${newPhoneNumber} is already bound to agent: ${phoneValidation.agentName}`
          : `Phone number ${newPhoneNumber} is already bound to another agent`;
        throw new Error(errorMessage);
      }

      // Bind the new phone number
      await this.bindPhoneNumberToAgent(newPhoneNumber, retellAgentId, callDirection);

      // Unbind old phone number if it exists and is different
      if (
        currentPhoneNumber &&
        currentPhoneNumber !== newPhoneNumber &&
        !currentPhoneNumber.startsWith('TEMP_')
      ) {
        try {
          await this.unbindPhoneNumberFromAgent(currentPhoneNumber, callDirection);
        } catch (unbindError: any) { }
      }
    } catch (error: any) {
      throw new Error(`Phone number change failed: ${error.message}`);
    }
  }

  // ==================== COMPLEX AGENT OPERATIONS ====================

  public async createAgentWithConfiguration(
    agentPayload: any
  ): Promise<{ agentId: string; llmId: string }> {
    try {
      this.validateRetellConfiguration();

      // Create language model first
      const llmId = await this.createLanguageModel(agentPayload.agentPrompt);

      // Create agent with comprehensive configuration
      const agentConfiguration = {
        agent_name: agentPayload.agentName,
        response_engine: {
          type: 'retell-llm' as const,
          llm_id: llmId
        },
        voice_id: '11labs-Adrian',
        language: 'en-US',
        voice_model: 'eleven_turbo_v2',
        voice_temperature: 1,
        voice_speed: 1,
        volume: 1,
        responsiveness: 1,
        interruption_sensitivity: 1,
        enable_backchannel: true,
        backchannel_frequency: 0.9,
        backchannel_words: ['yeah', 'uh-huh'],
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
        ambient_sound: 'coffee-shop',
        ambient_sound_volume: 1,
        end_call_after_silence_ms: 600000,
        max_call_duration_ms: 3600000,
        begin_message_delay_ms: 1000,
        ring_duration_ms: 30000,
        stt_mode: 'fast',
        vocab_specialization: 'general',
        allow_user_dtmf: true,
        user_dtmf_options: {
          digit_limit: 25,
          termination_key: '#',
          timeout_ms: 8000
        },
        denoising_mode: 'noise-cancellation',
        boosted_keywords: ['retell', 'kroger'],
        enable_voicemail_detection: true,
        voicemail_detection_timeout_ms: 30000,
        opt_out_sensitive_data_storage: true,
        opt_in_signed_url: true,
        pronunciation_dictionary: [
          {
            word: 'actually',
            alphabet: 'ipa',
            phoneme: 'ˈæktʃuəli'
          }
        ],
        normalize_for_speech: true,
        voicemail_option: {
          action: {
            type: 'static_text',
            text: 'Please give us a callback tomorrow at 10am.'
          }
        },
        post_call_analysis_data: [
          {
            type: 'string',
            name: 'customer_name',
            description: 'The name of the customer.',
            examples: ['John Doe', 'Jane Smith']
          }
        ],
        post_call_analysis_model: 'gpt-4o-mini'
        // NO webhook_url - as per requirement
      };

      const agentResponse = await this.createRetellAgent(agentConfiguration);

      return {
        agentId: agentResponse.agent_id,
        llmId: llmId
      };
    } catch (error: any) {
      throw new Error(`Agent creation failed: ${error?.response?.data?.message || error.message}`);
    }
  }

  public async createAgentWithPhoneNumber(
    agentPayload: any
  ): Promise<{ agentId: string; llmId: string }> {
    try {
      const callDirection = agentPayload.callType || 'inbound';

      // Validate phone number availability before creating agent
      const phoneValidation = await this.validatePhoneNumberAvailability(agentPayload.phone);

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${agentPayload.phone} does not exist in Retell system`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.agentName
          ? `Phone number ${agentPayload.phone} is already assigned to agent: ${phoneValidation.agentName}`
          : `Phone number ${agentPayload.phone} is already assigned to another agent`;
        throw new Error(errorMessage);
      }

      // Create agent without phone binding first
      const agentCreationResult = await this.createAgentWithConfiguration(agentPayload);

      // Bind phone number to the newly created agent
      await this.bindPhoneNumberToAgent(
        agentPayload.phone,
        agentCreationResult.agentId,
        callDirection
      );

      return agentCreationResult;
    } catch (error: any) {
      throw new Error(`Agent creation with phone failed: ${error.message}`);
    }
  }

  // ==================== AGENT UTILITY METHODS ====================

  public async findAgentIdByName(agentName: string): Promise<string | null> {
    try {
      const allAgents = await this.getAllRetellAgents();
      const matchingAgent = allAgents.find(
        (agent: any) => agent.agent_name.toLowerCase() === agentName.toLowerCase()
      );
      return matchingAgent ? matchingAgent.agent_id : null;
    } catch (error: any) {
      throw new Error(`Failed to find agent by name: ${error.message}`);
    }
  }

  public async updateAgentName(retellAgentId: string, newAgentName: string): Promise<void> {
    try {
      const nameUpdatePayload = {
        agent_name: newAgentName
      };
      await this.updateRetellAgent(retellAgentId, nameUpdatePayload);
    } catch (error: any) {
      throw new Error(
        `Failed to update agent name: ${error?.response?.data?.message || error.message}`
      );
    }
  }

  // ==================== COMPREHENSIVE UPDATE OPERATIONS ====================

  public async updateAgentComprehensively(
    retellAgentId: string,
    updateConfiguration: {
      agentName?: string;
      phoneNumber: string;
      currentPhoneNumber?: string | null;
      callDirection?: string;
      agentPrompt?: string;
      llmId?: string;
    }
  ): Promise<void> {
    try {
      // Update agent name if provided
      if (updateConfiguration.agentName && retellAgentId) {
        try {
          await this.updateAgentName(retellAgentId, updateConfiguration.agentName);
        } catch (error: any) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }
      }

      // Update phone number binding
      const callDirection = updateConfiguration.callDirection || 'inbound';
      await this.changeAgentPhoneNumber(
        retellAgentId,
        updateConfiguration.phoneNumber,
        updateConfiguration.currentPhoneNumber || null,
        callDirection
      );

      // Update language model prompt if provided
      if (updateConfiguration.agentPrompt && updateConfiguration.llmId) {
        try {
          await this.updateLanguageModelPrompt(
            updateConfiguration.llmId,
            updateConfiguration.agentPrompt
          );
        } catch (error: any) {
          if (error.response?.status !== 404) {
            throw error;
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Comprehensive agent update failed: ${error.message}`);
    }
  }

  public async deleteAgentCompletely(
    retellAgentId: string | null,
    phoneNumber: string,
    callDirection: string = 'inbound',
    llmId?: string
  ): Promise<void> {
    const deletionErrors: string[] = [];

    // Unbind phone number from agent
    try {
      if (phoneNumber && !phoneNumber.startsWith('TEMP_')) {
        await this.unbindPhoneNumberFromAgent(phoneNumber, callDirection);
      }
    } catch (phoneError: any) {
      deletionErrors.push(`Phone unbinding failed: ${phoneError.message}`);
    }

    // Delete agent from Retell
    if (retellAgentId) {
      try {
        await this.deleteRetellAgent(retellAgentId);
      } catch (agentError: any) {
        deletionErrors.push(`Agent deletion failed: ${agentError.message}`);
      }
    }

    if (deletionErrors.length > 0) {
    }
  }

  // ==================== HIGH-LEVEL BUSINESS OPERATIONS ====================

  public async processAgentCreationRequest(
    user: any,
    creationPayload: any
  ): Promise<{ agentId: string; llmId: string }> {
    try {
      this.validateRetellConfiguration();

      // Validate phone number availability
      const phoneValidation = await this.validatePhoneNumberAvailability(creationPayload.phone);

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${creationPayload.phone} is not available in Retell system`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.agentName
          ? `Phone number ${creationPayload.phone} is currently assigned to agent: ${phoneValidation.agentName}`
          : `Phone number ${creationPayload.phone} is currently assigned to another agent`;
        throw new Error(errorMessage);
      }

      // Create agent with phone number binding
      const creationResult = await this.createAgentWithPhoneNumber(creationPayload);

      return {
        agentId: creationResult.agentId,
        llmId: creationResult.llmId
      };
    } catch (error: any) {
      throw new Error(`Agent creation process failed: ${error.message}`);
    }
  }

  public async processPhoneNumberUpdateRequest(
    retellAgentId: string,
    newPhoneNumber: string,
    currentPhoneNumber: string,
    callDirection: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      this.validateRetellConfiguration();

      // Validate new phone number availability
      const phoneValidation = await this.validatePhoneNumberAvailability(
        newPhoneNumber,
        retellAgentId
      );

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${newPhoneNumber} is not available in Retell system`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.agentName
          ? `Phone number ${newPhoneNumber} is currently assigned to agent: ${phoneValidation.agentName}`
          : `Phone number ${newPhoneNumber} is currently assigned to another agent`;
        throw new Error(errorMessage);
      }

      // Process phone number change
      await this.changeAgentPhoneNumber(
        retellAgentId,
        newPhoneNumber,
        currentPhoneNumber,
        callDirection
      );
    } catch (error: any) {
      throw new Error(`Phone number update process failed: ${error.message}`);
    }
  }

  public async processAgentUpdateRequest(
    user: any,
    existingAgent: any,
    updatePayload: any
  ): Promise<void> {
    try {
      this.validateRetellConfiguration();

      // Validate phone number if it's being changed
      if (updatePayload.phone && updatePayload.phone !== existingAgent.phone) {
        const phoneValidation = await this.validatePhoneNumberAvailability(
          updatePayload.phone,
          existingAgent.retellAgentId
        );

        if (!phoneValidation.exists) {
          throw new Error(`Phone number ${updatePayload.phone} is not available in Retell system`);
        }

        if (!phoneValidation.available) {
          const errorMessage = phoneValidation.agentName
            ? `Phone number ${updatePayload.phone} is currently assigned to agent: ${phoneValidation.agentName}`
            : `Phone number ${updatePayload.phone} is currently assigned to another agent`;
          throw new Error(errorMessage);
        }
      }

      // Process comprehensive agent update
      await this.updateAgentComprehensively(existingAgent.retellAgentId, {
        agentName: updatePayload.agentName,
        phoneNumber: updatePayload.phone || existingAgent.phone,
        currentPhoneNumber: existingAgent.phone,
        callDirection: updatePayload.callType || existingAgent.callType || 'inbound',
        agentPrompt: updatePayload.agentPrompt,
        llmId: existingAgent.retellLlmId
      });
    } catch (error: any) {
      throw new Error(`Agent update process failed: ${error.message}`);
    }
  }

  public async processAgentDeletionRequest(agentData: any): Promise<void> {
    try {
      const retellAgentId = agentData.retellAgentId;
      const phoneNumber = agentData.phone;
      const callDirection = agentData.callType || 'inbound';
      const llmId = agentData.retellLlmId;

      // Process complete agent deletion
      await this.deleteAgentCompletely(retellAgentId, phoneNumber, callDirection, llmId);
    } catch (retellError: any) { }
  }

  public async processAgentDuplicationRequest(
    user: any,
    sourceAgent: any
  ): Promise<{ agentId: string; llmId: string; duplicateName: string }> {
    try {
      this.validateRetellConfiguration();

      const duplicatedAgentName = `${sourceAgent.agentName} (Copy)`;

      // Prepare duplication payload
      const duplicationPayload = {
        agentName: duplicatedAgentName,
        agentPrompt: sourceAgent.agentPrompt,
        callType: sourceAgent.callType
      };

      // Create duplicate agent (without phone number)
      const duplicationResult = await this.createAgentWithConfiguration(duplicationPayload);

      return {
        agentId: duplicationResult.agentId,
        llmId: duplicationResult.llmId,
        duplicateName: duplicatedAgentName
      };
    } catch (error: any) {
      throw new Error(`Agent duplication process failed: ${error.message}`);
    }
  }

  // ==================== VALIDATION & CONFIGURATION ====================

  public validateRetellConfiguration(): void {
    if (!Environment.retell.apiKey || !Environment.retell.baseUrl) {
      throw new Error('Retell API configuration is incomplete - missing API key or base URL');
    }
  }

  // Keep some aliases for existing code that might reference old method names
  public async handleAgentCreation(
    user: any,
    payload: any
  ): Promise<{ agentId: string; llmId: string }> {
    return this.processAgentCreationRequest(user, payload);
  }

  public async handlePhoneNumberUpdate(
    retellAgentId: string,
    newPhone: string,
    oldPhone: string,
    callType: 'inbound' | 'outbound'
  ): Promise<void> {
    return this.processPhoneNumberUpdateRequest(retellAgentId, newPhone, oldPhone, callType);
  }

  public async handleAgentUpdate(user: any, existingAgent: any, payload: any): Promise<void> {
    return this.processAgentUpdateRequest(user, existingAgent, payload);
  }

  public async handleAgentDeletion(agent: any): Promise<void> {
    return this.processAgentDeletionRequest(agent);
  }

  public async handleAgentDuplication(
    user: any,
    originalAgent: any
  ): Promise<{ agentId: string; llmId: string; duplicateName: string }> {
    return this.processAgentDuplicationRequest(user, originalAgent);
  }
}

const retellServiceInstance = new RetellService();
export default retellServiceInstance;
