import { throwError } from '../../../common/app-helper';
import { IAgent } from '../interface/agent.interface';
import { Agent } from '../models/agent.model';
export const validateAgent = async (payload: IAgent): Promise<void> => {
  // Check if agent name already exists
  const existingAgentByName = await Agent.findOne({
    name: { $regex: new RegExp(`^${payload.name}$`, 'i') },
    companyId: payload.companyId,
    isArchived: false
  });

  if (existingAgentByName) {
    throw throwError('Agent Name Already Exists');
  }
};
