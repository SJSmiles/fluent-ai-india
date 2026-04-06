import { FastifyRequest, FastifyReply } from 'fastify';
import { PhoneNumberService } from '../services/phone-number.services';
import { throwError } from '../../../common/app-helper';
import { Server } from '../../../server';

const PhoneNumberServiceInstance = new PhoneNumberService();

interface QueryParams {
  companyId?: string;
  skip?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  isArchived?: boolean;
}

export async function createPhoneNumberHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Create Phone Number request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await PhoneNumberServiceInstance.createPhoneNumber(
      user,
      request.body
    );

    Server.log.info(result, 'Create Phone Number response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in createPhoneNumberHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to create phone number'
    });
  }
}

export async function getPhoneNumberListHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Phone Number List request');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await PhoneNumberServiceInstance.getPhoneNumberList(
      user,
      request.query
    );

    Server.log.info(result, 'Get Phone Number List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getPhoneNumberListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch phone numbers'
    });
  }
}

export async function filterPhoneNumberListHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    Server.log.info('Get Filter Phone Number List request');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await PhoneNumberServiceInstance.getPhoneNumberFilterListing(user);

    Server.log.info(result, 'Get Filter Phone Number List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in filterPhoneNumberListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch phone numbers'
    });
  }
}

export async function updatePhoneNumberHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Update Phone Number request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await PhoneNumberServiceInstance.updatePhoneNumber(
      user,
      request.body
    );

    Server.log.info(result, 'Update Phone Number response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updatePhoneNumberHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to update phone number'
    });
  }
}

export async function deletePhoneNumberHandler(
  request: any,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.body, 'Delete Phone Number request payload');

    const user = request.user as any;

    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await PhoneNumberServiceInstance.deletePhoneNumber(
      user,
      request.body
    );

    Server.log.info(result, 'Delete Phone Number response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in deletePhoneNumberHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to delete phone number'
    });
  }
}




