import { throwError } from '../../../common/app-helper';
import { Environment } from '../../../config/environment';
import { BatchCall } from '../../batchCall/models/batchCall.model';
import { AgentUpdatePayload, IAgent } from '../interface/agent.interface';
import { Agent } from '../model/agent.model';
import mongoose from 'mongoose';

export const validateAgent = async (payload: IAgent): Promise<void> => {
  // Check if agent name already exists
  const existingAgentByName = await Agent.findOne({
    agentName: { $regex: new RegExp(`^${payload.agentName}$`, 'i') },
    isArchived: false
  });

  if (existingAgentByName) {
    throw throwError('Agent Name Already Exists');
  }

  // Check if phone number is already bound to another agent in database
  if (payload.phone) {
    const existingAgentByPhone = await Agent.findOne({
      phone: payload.phone,
      isArchived: false
    });

    if (existingAgentByPhone) {
      throw throwError(
        `Phone number ${payload.phone} is already bound to agent: ${existingAgentByPhone.agentName}`,
        { status: 400 },
        'BAD_REQUEST'
      );
    }
  }
};

export const validateCustomAgent = async (agentId: string): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      throw throwError('Invalid agent ID format', { status: 400 }, 'BAD_REQUEST');
    }

    const agent: any = await Agent.findById(agentId);

    if (!agent) {
      throw throwError('Agent not found', { status: 404 }, 'NOT_FOUND');
    }

    // Check if agent is archived
    if (agent.isArchived === true) {
      throw throwError('Cannot update archived agent', { status: 403 }, 'FORBIDDEN');
    }

    // Get responseEngine using working approach
    const responseEngine = agent.toObject()?.responseEngine;
    console.log('ResponseEngine:', responseEngine);

    if (!responseEngine || !responseEngine.type) {
      throw throwError(
        'Cannot update this agent. Only custom agents can be updated with custom prompts.',
        { status: 403 },
        'FORBIDDEN'
      );
    }

    if (responseEngine.type !== 'custom-llm') {
      throw throwError(
        `Cannot update ${responseEngine.type} agent. Only custom-llm agents can be updated.`,
        { status: 403 },
        'FORBIDDEN'
      );
    }

    console.log('Agent validation passed');

    // BatchCall validation
    const phoneMapping = agent.get('phoneMapping') || agent.toObject()?.phoneMapping;
    const outboundNumber = phoneMapping?.outbound?.number;
    console.log('Outbound number:', outboundNumber);

    if (outboundNumber) {
      const batchCalls = await BatchCall.find({
        outboundNumber: outboundNumber,
        isArchived: { $ne: true }
      });

      console.log('Found batch calls count:', batchCalls.length);

      for (const batchCall of batchCalls) {
        const status = batchCall.toObject()?.status;
        const utcDateTime: any = batchCall.toObject()?.utcDateTime;

        console.log(`Batch call ${batchCall._id}: status=${status}, utcDateTime=${utcDateTime}`);

        // STATUS 1 & 5: Allow update (no error)
        if (status === 1 || status === 5) {
          console.log(`Status ${status}: Update allowed`);
          continue; // Allow update
        }

        // STATUS 4: Block update (running batch call)
        if (status === 4) {
          throw throwError(
            'Cannot update agent: Batch call is currently running',
            { status: 409 },
            'BATCH_CALL_RUNNING'
          );
        }

        //  Time-based validation (scheduled batch calls)
        if (status === 2 || status === 3) {
          const currentTime = new Date();
          const scheduledTime = new Date(utcDateTime);
          const timeDifference = scheduledTime.getTime() - currentTime.getTime();
          const minutesDifference = timeDifference / (1000 * 60);

          console.log(`Current time: ${currentTime}`);
          console.log(`Scheduled time: ${scheduledTime}`);
          console.log(`Time difference: ${minutesDifference} minutes`);

          // If scheduled within 15 minutes, block update
          if (minutesDifference <= 15 && minutesDifference > 0) {
            throw throwError(
              'Cannot update agent: Batch call is scheduled to run within 15 minutes',
              { status: 409 },
              'BATCH_CALL_SCHEDULED_SOON'
            );
          }

          console.log(`Status ${status}: Update allowed (scheduled time is safe)`);
        }
      }

      console.log('All batch call validation passed');
    }

    console.log('All validation passed - agent can be updated');

  } catch (error: any) {
    console.error('Validation failed:', error.message);
    if (error.status) {
      throw error;
    }
    throw throwError(`Failed to validate agent: ${error.message}`, { status: 500 }, 'VALIDATION_FAILED');
  }
};
