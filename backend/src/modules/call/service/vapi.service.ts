import { VapiClient } from '@vapi-ai/server-sdk';
import { Environment } from '../../../config/environment';
import { IVoiceService } from './voice-service.interface';

export class VapiService implements IVoiceService {
  private vapiClient: any;

  constructor() {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      throw new Error('Vapi API key is not configured');
    }

    this.vapiClient = new VapiClient({
      token: apiKey
    });
  }

  // ==================== CALL MANAGEMENT ====================

  public async callList(filters?: any): Promise<any> {
    try {
      const response = await this.vapiClient.calls.list(filters);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch call history: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async createVapiCall(user: any, callPayload: any): Promise<any> {
    try {
      const requestData: any = {
        assistantId: callPayload.assistantId,
        customer: {
          number: callPayload.toNumber
        }
      };

      if (callPayload.phoneNumberId) {
        requestData.phoneNumberId = callPayload.phoneNumberId;
      }

      if (callPayload.assistantOverrides) {
        requestData.assistantOverrides = callPayload.assistantOverrides;
      }

      const response = await this.vapiClient.calls.create(requestData);

      return {
        success: true,
        message: 'Phone call initiated successfully',
        data: response
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to initiate call: ${error?.message || 'Unknown error'}`,
        data: null
      };
    }
  }

  public async getCallById(callId: string): Promise<any> {
    try {
      const response = await this.vapiClient.calls.get(callId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch call details: ${error?.message || 'Unknown error'}`
      );
    }
  }

  // ==================== ASSISTANT MANAGEMENT ====================

  public async createVapiAssistant(assistantConfiguration: any): Promise<any> {
    try {
      const response = await this.vapiClient.assistants.create(assistantConfiguration);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to create Vapi assistant: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async updateVapiAssistant(assistantId: string, updateData: any): Promise<any> {
    try {
      const response = await this.vapiClient.assistants.update(assistantId, updateData);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to update Vapi assistant: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async deleteVapiAssistant(assistantId: string): Promise<any> {
    try {
      const response = await this.vapiClient.assistants.delete(assistantId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to delete Vapi assistant: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async getAllVapiAssistants(): Promise<any> {
    try {
      const response = await this.vapiClient.assistants.list();
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch assistants list: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async getVapiAssistantById(assistantId: string): Promise<any> {
    try {
      const response = await this.vapiClient.assistants.get(assistantId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch assistant details: ${error?.message || 'Unknown error'}`
      );
    }
  }

  // ==================== PHONE NUMBER MANAGEMENT ====================

  public async getAllPhoneNumbers(): Promise<any> {
    try {
      const response = await this.vapiClient.phoneNumbers.list();
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch phone numbers: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async getPhoneNumberDetails(phoneNumberId: string): Promise<any> {
    try {
      const response = await this.vapiClient.phoneNumbers.get(phoneNumberId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch phone number details: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async updatePhoneNumberConfiguration(
    phoneNumberId: string,
    configuration: any
  ): Promise<any> {
    try {
      const response = await this.vapiClient.phoneNumbers.update(phoneNumberId, configuration);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to update phone number configuration: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async buyPhoneNumber(phoneNumberData: any): Promise<any> {
    try {
      const response = await this.vapiClient.phoneNumbers.create(phoneNumberData);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to buy phone number: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async deletePhoneNumber(phoneNumberId: string): Promise<any> {
    try {
      const response = await this.vapiClient.phoneNumbers.delete(phoneNumberId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to delete phone number: ${error?.message || 'Unknown error'}`
      );
    }
  }

  // ==================== PHONE NUMBER VALIDATION & BINDING ====================

  public async validatePhoneNumberAvailability(
    phoneNumberId: string,
    excludeAssistantId?: string
  ): Promise<{ exists: boolean; available: boolean; boundToAssistant?: string; assistantName?: string }> {
    try {
      const phoneDetails = await this.getPhoneNumberDetails(phoneNumberId);
      const boundAssistantId = phoneDetails.assistantId;

      const validationResult = {
        exists: true,
        available: !boundAssistantId,
        boundToAssistant: boundAssistantId || undefined,
        assistantName: undefined as string | undefined
      };

      if (boundAssistantId) {
        try {
          const assistantDetails = await this.getVapiAssistantById(boundAssistantId);
          validationResult.assistantName = assistantDetails.name;
        } catch (assistantError) {
          // Ignore error if assistant not found
        }
      }

      if (excludeAssistantId && boundAssistantId === excludeAssistantId) {
        validationResult.available = true;
      }

      return validationResult;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) {
        return { exists: false, available: false };
      }
      throw new Error(
        `Phone validation failed: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async bindPhoneNumberToAssistant(
    phoneNumberId: string,
    assistantId: string
  ): Promise<void> {
    try {
      const bindingConfiguration = {
        assistantId: assistantId
      };

      await this.updatePhoneNumberConfiguration(phoneNumberId, bindingConfiguration);
    } catch (error: any) {
      throw new Error(
        `Failed to bind phone number to assistant: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async unbindPhoneNumberFromAssistant(phoneNumberId: string): Promise<void> {
    try {
      const unbindConfiguration = {
        assistantId: null
      };

      await this.updatePhoneNumberConfiguration(phoneNumberId, unbindConfiguration);
    } catch (error: any) {
      throw new Error(
        `Failed to unbind phone number: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async changeAssistantPhoneNumber(
    assistantId: string,
    newPhoneNumberId: string,
    currentPhoneNumberId: string | null
  ): Promise<void> {
    try {
      const phoneValidation = await this.validatePhoneNumberAvailability(
        newPhoneNumberId,
        assistantId
      );

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${newPhoneNumberId} does not exist in Vapi`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.assistantName
          ? `Phone number ${newPhoneNumberId} is already bound to assistant: ${phoneValidation.assistantName}`
          : `Phone number ${newPhoneNumberId} is already bound to another assistant`;
        throw new Error(errorMessage);
      }

      await this.bindPhoneNumberToAssistant(newPhoneNumberId, assistantId);

      if (
        currentPhoneNumberId &&
        currentPhoneNumberId !== newPhoneNumberId &&
        !currentPhoneNumberId.startsWith('TEMP_')
      ) {
        try {
          await this.unbindPhoneNumberFromAssistant(currentPhoneNumberId);
        } catch (unbindError: any) {
          // Log error but don't fail the operation
        }
      }
    } catch (error: any) {
      throw new Error(`Phone number change failed: ${error.message}`);
    }
  }

  // ==================== COMPLEX ASSISTANT OPERATIONS ====================
  // UPDATED: Now accepts IAgent interface properties

  public async createAssistantWithConfiguration(
    payload: any  // Uses agentName, agentPrompt, phone from IAgent interface
  ): Promise<{ assistantId: string }> {
    try {
      this.validateVapiConfiguration();

      const assistantConfiguration: any = {
        name: payload.agentName,  // Changed from assistantName
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: payload.agentPrompt || 'You are a helpful assistant.'  // Changed from assistantPrompt
            }
          ]
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'paula',
          stability: 0.5,
          similarityBoost: 0.75,
          model: 'eleven_turbo_v2'
        },
        firstMessage: payload.firstMessage || "Hi! How can I help you today?",
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'en'
        },
        recordingEnabled: true,
        hipaaEnabled: false,
        silenceTimeoutSeconds: 30,
        maxDurationSeconds: 3600,
        backgroundSound: 'office',
        backchannelingEnabled: true,
        backgroundDenoisingEnabled: true,
        modelOutputInMessagesEnabled: true
      };

      if (payload.serverUrl) {
        assistantConfiguration.serverUrl = payload.serverUrl;
        assistantConfiguration.serverUrlSecret = payload.serverUrlSecret;
      }

      if (payload.analysisEnabled) {
        assistantConfiguration.analysisPlan = {
          summaryPrompt: 'Summarize the key points discussed in this call.',
          structuredDataSchema: {
            type: 'object',
            properties: {
              customer_name: {
                type: 'string',
                description: 'The name of the customer'
              },
              call_outcome: {
                type: 'string',
                description: 'The outcome of the call'
              }
            }
          }
        };
      }

      const response = await this.createVapiAssistant(assistantConfiguration);

      return {
        assistantId: response.id
      };
    } catch (error: any) {
      throw new Error(
        `Assistant creation failed: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async createAssistantWithPhoneNumber(
    payload: any  // Uses phone from IAgent interface
  ): Promise<{ assistantId: string }> {
    try {
      // Note: phone is used directly from payload, not phoneNumberId
      if (payload.phone) {
        const phoneValidation = await this.validatePhoneNumberAvailability(payload.phone);

        if (!phoneValidation.exists) {
          throw new Error(
            `Phone number ${payload.phone} does not exist in Vapi system`
          );
        }

        if (!phoneValidation.available) {
          const errorMessage = phoneValidation.assistantName
            ? `Phone number ${payload.phone} is already assigned to assistant: ${phoneValidation.assistantName}`
            : `Phone number ${payload.phone} is already assigned to another assistant`;
          throw new Error(errorMessage);
        }
      }

      const assistantCreationResult = await this.createAssistantWithConfiguration(payload);

      if (payload.phone) {
        await this.bindPhoneNumberToAssistant(
          payload.phone,
          assistantCreationResult.assistantId
        );
      }

      return assistantCreationResult;
    } catch (error: any) {
      throw new Error(`Assistant creation with phone failed: ${error.message}`);
    }
  }

  // ==================== ASSISTANT UTILITY METHODS ====================

  public async findAssistantIdByName(agentName: string): Promise<string | null> {
    try {
      const allAssistants = await this.getAllVapiAssistants();
      const matchingAssistant = allAssistants.find(
        (assistant: any) => assistant.name.toLowerCase() === agentName.toLowerCase()
      );
      return matchingAssistant ? matchingAssistant.id : null;
    } catch (error: any) {
      throw new Error(`Failed to find assistant by name: ${error.message}`);
    }
  }

  public async updateAssistantName(assistantId: string, newAgentName: string): Promise<void> {
    try {
      const nameUpdatePayload = {
        name: newAgentName
      };
      await this.updateVapiAssistant(assistantId, nameUpdatePayload);
    } catch (error: any) {
      throw new Error(
        `Failed to update assistant name: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async updateAssistantPrompt(assistantId: string, newPrompt: string): Promise<void> {
    try {
      const promptUpdatePayload = {
        model: {
          messages: [
            {
              role: 'system',
              content: newPrompt
            }
          ]
        }
      };
      await this.updateVapiAssistant(assistantId, promptUpdatePayload);
    } catch (error: any) {
      throw new Error(
        `Failed to update assistant prompt: ${error?.message || 'Unknown error'}`
      );
    }
  }

  // ==================== COMPREHENSIVE UPDATE OPERATIONS ====================
  // UPDATED: Now accepts IAgent interface properties

  public async updateAssistantComprehensively(
    assistantId: string,
    updateConfiguration: {
      agentName?: string;       // Changed from assistantName
      phone?: string;           // Changed from phoneNumberId
      currentPhone?: string | null;  // Changed from currentPhoneNumberId
      agentPrompt?: string;     // Changed from assistantPrompt
      firstMessage?: string;
      voice?: any;
    }
  ): Promise<void> {
    try {
      const updatePayload: any = {};

      if (updateConfiguration.agentName) {
        updatePayload.name = updateConfiguration.agentName;
      }

      if (updateConfiguration.agentPrompt) {
        updatePayload.model = {
          messages: [
            {
              role: 'system',
              content: updateConfiguration.agentPrompt
            }
          ]
        };
      }

      if (updateConfiguration.firstMessage) {
        updatePayload.firstMessage = updateConfiguration.firstMessage;
      }

      if (updateConfiguration.voice) {
        updatePayload.voice = updateConfiguration.voice;
      }

      if (Object.keys(updatePayload).length > 0) {
        try {
          await this.updateVapiAssistant(assistantId, updatePayload);
        } catch (error: any) {
          if (error?.statusCode !== 404 && error?.status !== 404) {
            throw error;
          }
        }
      }

      if (updateConfiguration.phone) {
        await this.changeAssistantPhoneNumber(
          assistantId,
          updateConfiguration.phone,
          updateConfiguration.currentPhone || null
        );
      }
    } catch (error: any) {
      throw new Error(`Comprehensive assistant update failed: ${error.message}`);
    }
  }

  public async deleteAssistantCompletely(
    assistantId: string | null,
    phone?: string  // Changed from phoneNumberId
  ): Promise<void> {
    const deletionErrors: string[] = [];

    if (phone && !phone.startsWith('TEMP_')) {
      try {
        await this.unbindPhoneNumberFromAssistant(phone);
      } catch (phoneError: any) {
        deletionErrors.push(`Phone unbinding failed: ${phoneError.message}`);
      }
    }

    if (assistantId) {
      try {
        await this.deleteVapiAssistant(assistantId);
      } catch (assistantError: any) {
        deletionErrors.push(`Assistant deletion failed: ${assistantError.message}`);
      }
    }

    if (deletionErrors.length > 0) {
      // Log errors but don't throw
    }
  }

  // ==================== HIGH-LEVEL BUSINESS OPERATIONS ====================
  // UPDATED: Now accepts IAgent interface properties

  public async processAssistantCreationRequest(
    user: any,
    payload: any  // Uses agentName, phone, agentPrompt from IAgent
  ): Promise<{ assistantId: string }> {
    try {
      this.validateVapiConfiguration();

      if (payload.phone) {
        const phoneValidation = await this.validatePhoneNumberAvailability(payload.phone);

        if (!phoneValidation.exists) {
          throw new Error(
            `Phone number ${payload.phone} is not available in Vapi system`
          );
        }

        if (!phoneValidation.available) {
          const errorMessage = phoneValidation.assistantName
            ? `Phone number ${payload.phone} is currently assigned to assistant: ${phoneValidation.assistantName}`
            : `Phone number ${payload.phone} is currently assigned to another assistant`;
          throw new Error(errorMessage);
        }
      }

      const creationResult = await this.createAssistantWithPhoneNumber(payload);

      return {
        assistantId: creationResult.assistantId
      };
    } catch (error: any) {
      throw new Error(`Assistant creation process failed: ${error.message}`);
    }
  }

  public async processPhoneNumberUpdateRequest(
    assistantId: string,
    newPhone: string,          // Changed from newPhoneNumberId
    currentPhone: string,      // Changed from currentPhoneNumberId
    callType?: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      this.validateVapiConfiguration();

      const phoneValidation = await this.validatePhoneNumberAvailability(
        newPhone,
        assistantId
      );

      if (!phoneValidation.exists) {
        throw new Error(`Phone number ${newPhone} is not available in Vapi system`);
      }

      if (!phoneValidation.available) {
        const errorMessage = phoneValidation.assistantName
          ? `Phone number ${newPhone} is currently assigned to assistant: ${phoneValidation.assistantName}`
          : `Phone number ${newPhone} is currently assigned to another assistant`;
        throw new Error(errorMessage);
      }

      await this.changeAssistantPhoneNumber(assistantId, newPhone, currentPhone);
    } catch (error: any) {
      throw new Error(`Phone number update process failed: ${error.message}`);
    }
  }

  public async processAssistantUpdateRequest(
    user: any,
    existingAssistant: any,
    payload: any  // Uses agentName, phone, agentPrompt from IAgent
  ): Promise<void> {
    try {
      this.validateVapiConfiguration();

      if (payload.phone && payload.phone !== existingAssistant.phone) {
        const phoneValidation = await this.validatePhoneNumberAvailability(
          payload.phone,
          existingAssistant.vapiAssistantId
        );

        if (!phoneValidation.exists) {
          throw new Error(
            `Phone number ${payload.phone} is not available in Vapi system`
          );
        }

        if (!phoneValidation.available) {
          const errorMessage = phoneValidation.assistantName
            ? `Phone number ${payload.phone} is currently assigned to assistant: ${phoneValidation.assistantName}`
            : `Phone number ${payload.phone} is currently assigned to another assistant`;
          throw new Error(errorMessage);
        }
      }

      await this.updateAssistantComprehensively(existingAssistant.vapiAssistantId, {
        agentName: payload.agentName,
        phone: payload.phone || existingAssistant.phone,
        currentPhone: existingAssistant.phone,
        agentPrompt: payload.agentPrompt,
        firstMessage: payload.firstMessage,
        voice: payload.voice
      });
    } catch (error: any) {
      throw new Error(`Assistant update process failed: ${error.message}`);
    }
  }

  public async processAssistantDeletionRequest(assistantData: any): Promise<void> {
    try {
      const assistantId = assistantData.vapiAssistantId;
      const phone = assistantData.phone;

      await this.deleteAssistantCompletely(assistantId, phone);
    } catch (vapiError: any) {
      // Log error but don't throw
    }
  }

  public async processAssistantDuplicationRequest(
    user: any,
    sourceAssistant: any  // Uses agentName, agentPrompt from IAgent
  ): Promise<{ assistantId: string; duplicateName: string }> {
    try {
      this.validateVapiConfiguration();

      const duplicatedAgentName = `${sourceAssistant.agentName} (Copy)`;

      const duplicationPayload = {
        agentName: duplicatedAgentName,
        agentPrompt: sourceAssistant.agentPrompt,
        firstMessage: sourceAssistant.firstMessage
      };

      const duplicationResult = await this.createAssistantWithConfiguration(duplicationPayload);

      return {
        assistantId: duplicationResult.assistantId,
        duplicateName: duplicatedAgentName
      };
    } catch (error: any) {
      throw new Error(`Assistant duplication process failed: ${error.message}`);
    }
  }

  // ==================== INTERFACE IMPLEMENTATION (AGENT ALIASES) ====================

  public async processAgentCreationRequest(
    user: any,
    payload: any
  ): Promise<{ agentId: string; assistantId: string }> {
    const result = await this.processAssistantCreationRequest(user, payload);
    return {
      agentId: result.assistantId,
      assistantId: result.assistantId
    };
  }

  public async processAgentUpdateRequest(
    user: any,
    existingAgent: any,
    payload: any
  ): Promise<void> {
    return this.processAssistantUpdateRequest(user, existingAgent, payload);
  }

  public async processAgentDeletionRequest(agentData: any): Promise<void> {
    return this.processAssistantDeletionRequest(agentData);
  }

  public async processAgentDuplicationRequest(
    user: any,
    sourceAgent: any
  ): Promise<{ agentId: string; assistantId: string; duplicateName: string }> {
    const result = await this.processAssistantDuplicationRequest(user, sourceAgent);
    return {
      agentId: result.assistantId,
      assistantId: result.assistantId,
      duplicateName: result.duplicateName
    };
  }

  // ==================== SQUAD MANAGEMENT ====================

  public async getAllSquads(): Promise<any> {
    try {
      const response = await this.vapiClient.squads.list();
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch squads: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async createSquad(squadData: any): Promise<any> {
    try {
      const response = await this.vapiClient.squads.create(squadData);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to create squad: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async getSquadById(squadId: string): Promise<any> {
    try {
      const response = await this.vapiClient.squads.get(squadId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch squad details: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async updateSquad(squadId: string, updateData: any): Promise<any> {
    try {
      const response = await this.vapiClient.squads.update(squadId, updateData);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to update squad: ${error?.message || 'Unknown error'}`
      );
    }
  }

  public async deleteSquad(squadId: string): Promise<any> {
    try {
      const response = await this.vapiClient.squads.delete(squadId);
      return response;
    } catch (error: any) {
      throw new Error(
        `Failed to delete squad: ${error?.message || 'Unknown error'}`
      );
    }
  }

  // ==================== VALIDATION & CONFIGURATION ====================

  public validateVapiConfiguration(): void {
    if (!Environment.vapi.apiKey) {
      throw new Error('Vapi API configuration is incomplete - missing API key');
    }
  }

  // Deprecated aliases for backward compatibility
  public async handleAssistantCreation(
    user: any,
    payload: any
  ): Promise<{ assistantId: string }> {
    return this.processAssistantCreationRequest(user, payload);
  }

  public async handlePhoneNumberUpdate(
    assistantId: string,
    newPhoneId: string,
    oldPhoneId: string
  ): Promise<void> {
    return this.processPhoneNumberUpdateRequest(assistantId, newPhoneId, oldPhoneId);
  }

  public async handleAssistantUpdate(
    user: any,
    existingAssistant: any,
    payload: any
  ): Promise<void> {
    return this.processAssistantUpdateRequest(user, existingAssistant, payload);
  }

  public async handleAssistantDeletion(assistant: any): Promise<void> {
    return this.processAssistantDeletionRequest(assistant);
  }

  public async handleAssistantDuplication(
    user: any,
    originalAssistant: any
  ): Promise<{ assistantId: string; duplicateName: string }> {
    return this.processAssistantDuplicationRequest(user, originalAssistant);
  }

  // Retell-specific methods (not implemented for Vapi)
  public async getRetellAgentById?(payload: any): Promise<any> {
    throw new Error('getRetellAgentById is not available for Vapi service');
  }

  public async getRetellAgentPromptById?(payload: any): Promise<any> {
    throw new Error('getRetellAgentPromptById is not available for Vapi service');
  }
}

const vapiServiceInstance = new VapiService();
export default vapiServiceInstance;