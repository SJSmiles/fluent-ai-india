import { FastifyRequest, FastifyReply } from 'fastify';
import { MessageTemplateService } from '../services/message-template.services';
import { throwError } from '../../../common/app-helper';
import { Server } from '../../../server';

const MessageTemplateServiceInstance = new MessageTemplateService();

interface QueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  isActive?: boolean;
}

export async function createMessageTemplateHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Create Message Template request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.createTemplate(
      user,
      request.body
    );

    Server.log.info(result, 'Create Message Template response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in createMessageTemplateHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to create message template'
    });
  }
}

export async function getMessageTemplateListHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Message Template List request');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.getTemplateList(
      user,
      request.query
    );

    Server.log.info(result, 'Get Message Template List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getMessageTemplateListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch message templates'
    });
  }
}

export async function filterMessageTemplateListHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    Server.log.info('Get Filter Active Message Template List request');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.getTemplateFilterListing(user);

    Server.log.info(result, 'Get Filter Message Template List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in filterMessageTemplateListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch active message templates'
    });
  }
}

export async function updateMessageTemplateHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Update Message Template request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.updateTemplate(
      user,
      request.body
    );

    Server.log.info(result, 'Update Message Template response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateMessageTemplateHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to update message template'
    });
  }
}

export async function deleteMessageTemplateHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Delete Message Template request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.deleteTemplate(
      user,
      request.body
    );

    Server.log.info(result, 'Delete Message Template response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in deleteMessageTemplateHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to delete message template'
    });
  }
}



export async function updateStatusTemplateHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Update Message Template Status request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.updateStatusTemplate(
      user,
      request.body
    );

    Server.log.info(result, 'Update Message Template Status response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateStatusTemplateHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to update message template status'
    });
  }
}


export async function getMessageListHandler(
  request: FastifyRequest<{ Querystring: any }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Message List request');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await MessageTemplateServiceInstance.getMessageList(
      user,
      request.query
    );

    Server.log.info(result, 'Get Message List response');

    return result;

  } catch (error: any) {
    Server.log.error(error, 'Error in getMessageListHandler');

    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch messages'
    });
  }
}
